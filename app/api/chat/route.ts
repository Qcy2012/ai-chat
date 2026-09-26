import { getCloudflareContext } from '@opennextjs/cloudflare';

// 每次请求都要实时调用模型，禁止静态化
export const dynamic = 'force-dynamic';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** 兼容不同版本：优先同步取用，SSG 场景下回退到异步模式 */
async function getAI(): Promise<any> {
  try {
    const { env } = getCloudflareContext();
    return (env as any).AI;
  } catch {
    const { env } = await getCloudflareContext({ async: true });
    return (env as any).AI;
  }
}

export async function POST(req: Request) {
  try {
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

    const AI = await getAI();
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

    // 直接调用同账号下的 Workers AI —— 不需要任何 API Key
    const stream = (await AI.run(model, {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    })) as ReadableStream;

    // 原样透传 SSE 流，前端逐块解析，实现打字机效果
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
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
