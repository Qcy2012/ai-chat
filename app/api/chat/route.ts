import { getCloudflareContext } from '@opennextjs/cloudflare';

// 每次请求都要实时调用模型，禁止静态化
export const dynamic = 'force-dynamic';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * 默认模型：GLM-4.7 Flash
 * 中文原生、免费额度内约可聊 380 轮（相比 Llama 3.3 70B 的约 70 轮提升 5 倍以上）
 * 模型标识来自 Cloudflare 官方更新日志，勿随意改动
 */
const DEFAULT_MODEL = '@cf/zai-org/glm-4.7-flash';

/** 每日调用上限默认值；可用 wrangler.jsonc 里的 vars.DAILY_LIMIT 覆盖，设为 "0" 表示不限 */
const DEFAULT_DAILY_LIMIT = 300;

/** 取 Cloudflare 运行时上下文（env + ctx），兼容同步/异步两种取值方式 */
async function getCtx(): Promise<{ env: any; ctx: any }> {
  try {
    const c: any = getCloudflareContext();
    return { env: c?.env, ctx: c?.ctx };
  } catch {
    const c: any = await getCloudflareContext({ async: true });
    return { env: c?.env, ctx: c?.ctx };
  }
}

/** UTC 日期。Cloudflare 免费额度的重置口径是 UTC 00:00，这里保持一致 */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 统一的 429 响应 */
function tooMany(message: string) {
  return Response.json({ error: '请求被限制', message }, { status: 429 });
}

export async function POST(req: Request) {
  try {
    const { env, ctx } = await getCtx();

    const AI = env?.AI;
    if (!AI) {
      return Response.json(
        {
          error: 'AI 绑定未找到',
          message:
            '没有拿到 Workers AI 绑定。请确认 wrangler.jsonc 里已配置 "ai": { "binding": "AI" }，并且已执行 opennextjs-cloudflare build 后部署。',
        },
        { status: 500 }
      );
    }

    // ---------- 第一道闸：每 IP 每分钟请求上限（防爬虫突发刷量） ----------
    // 绑定来自 wrangler.jsonc 的 ratelimits 配置，无需创建任何资源
    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const limiter = env?.CHAT_RATE_LIMITER;
    if (limiter && typeof limiter.limit === 'function') {
      try {
        const { success } = await limiter.limit({ key: ip });
        if (!success) {
          return tooMany('请求太频繁了，请等一分钟再试。');
        }
      } catch {
        // 限流服务本身异常时放行，不影响正常使用
      }
    }

    // ---------- 请求体解析与校验（放在计数之前，避免无效请求占用额度） ----------
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      model?: string;
    };

    const messages = body.messages ?? [];
    const model = body.model || DEFAULT_MODEL;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: '参数错误', message: 'messages 不能为空' },
        { status: 400 }
      );
    }

    // ---------- 第二道闸：每日总量上限（防免费额度被刷光） ----------
    // 需要先创建 KV 命名空间并在 wrangler.jsonc 中绑定 CHAT_KV；
    // 未绑定时自动跳过这一道闸，站点照常可用。
    const dailyLimit = Number(env?.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT) || 0;
    const kv = env?.CHAT_KV;
    let remaining: number | null = null;

    if (kv && dailyLimit > 0) {
      const key = `chat_count:${utcDay()}`;
      try {
        const used = Number((await kv.get(key)) || 0);

        if (used >= dailyLimit) {
          return tooMany(
            `今天的调用次数已用完（上限 ${dailyLimit} 次/天），额度会在北京时间早上 8:00 自动重置。`
          );
        }

        remaining = dailyLimit - used - 1;

        // 异步累加，不阻塞流式响应。
        // 注意：KV 对同一个 key 每秒只允许写 1 次，高并发时部分写入会失败，
        // 这里直接忽略——这是安全阀而非计费系统，宁可少计也不能影响正常使用。
        const bump = kv
          .put(key, String(used + 1), { expirationTtl: 172800 })
          .catch(() => {});
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(bump);
        } else {
          await bump;
        }
      } catch {
        // KV 读取异常时放行，避免把站点拖挂
        remaining = null;
      }
    }

    // ---------- 调用模型 ----------
    // 直接调用同账号下的 Workers AI —— 不需要任何 API Key
    const stream = (await AI.run(model, {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    })) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    };
    if (remaining !== null) {
      headers['X-Quota-Remaining'] = String(remaining);
    }

    // 原样透传 SSE 流，前端逐块解析，实现打字机效果
    return new Response(stream, { headers });
  } catch (error: any) {
    return Response.json(
      {
        error: 'AI 服务调用失败',
        message: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
