import { StreamingTextResponse } from 'ai';

// 扩展Cloudflare环境类型声明
declare global {
  namespace Cloudflare {
    interface Env {
      AI: any;
    }
  }
}

export const runtime = 'edge';

export async function POST(req: Request, { env }: { env: any }) {
  try {
    const { messages } = await req.json();

    // ✅ 直接调用同账号下Workers AI，无需任何API密钥！
    // 使用 @cf/meta/llama-3.3-70b-instruct-fp8-fast 平衡速度和效果
    // 也可以换成其他模型，比如：
    // - @cf/meta/llama-4-scout-17b-16e-instruct (更快)
    // - @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (推理更强)
    // - @cf/glm/glm-4.5-air (中文更优，字节跳动)
    const stream = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    });

    // 返回SSE流式响应，实现打字机效果
    return new StreamingTextResponse(stream as any, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'AI服务调用失败', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
