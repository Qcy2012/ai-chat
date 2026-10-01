'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/vs2015.css';
import { useCallback, useEffect, useRef, useState, memo } from 'react';

/**
 * 可选模型清单。
 * 标识均以 Cloudflare 官方文档为准，改动前请先核对，写错会直接调用失败。
 * 括号里标注的是免费额度（10000 Neurons/天）下的粗略可聊轮数。
 */
const MODELS = [
  {
    id: '@cf/zai-org/glm-4.7-flash',
    name: 'GLM-4.7 Flash（默认 · 中文 · 约380轮）',
  },
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    name: 'Qwen3 30B A3B（极速 · 约450轮）',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B（最省 · 约410轮）',
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 70B（均衡 · 约70轮）',
  },
  {
    id: '@cf/meta/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B（长文本 · 约150轮）',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill 32B（推理 · 约33轮）',
  },
  {
    id: '@cf/qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen2.5 Coder 32B（代码）',
  },
];

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Markdown 消息用 memo 避免流式输出时重复渲染整棵树
const MarkdownMessage = memo(({ content }: { content: string }) => (
  <div className="prose prose-invert max-w-none [&_pre]:bg-[#1e1e1e] [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm [&_:not(pre)>code]:bg-[#3c3c3c] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-orange-300 [&_h1]:text-[#569cd6] [&_h2]:text-[#569cd6] [&_h3]:text-[#4ec9b0] [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#569cd6] [&_blockquote]:pl-4 [&_blockquote]:text-gray-400 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:bg-[#2d2d2d] [&_th]:p-2 [&_th]:border [&_th]:border-[#3c3c3c] [&_td]:p-2 [&_td]:border [&_td]:border-[#3c3c3c] [&_tr:nth-child(even)]:bg-[#2a2a2a] [&_a]:text-[#4ec9b0] [&_a]:underline [&_hr]:border-[#3c3c3c] [&_img]:rounded-md [&_img]:max-w-full">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
    >
      {content}
    </ReactMarkdown>
  </div>
));
MarkdownMessage.displayName = 'MarkdownMessage';

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void send();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, loading, messages, model]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history: Msg[] = [
      ...messages,
      { id: newId(), role: 'user', content: text },
    ];

    setMessages([
      ...history,
      { id: newId(), role: 'assistant', content: '' },
    ]);
    setInput('');
    setError('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const append = (piece: string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + piece };
        }
        return next;
      });
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = `请求失败（HTTP ${res.status}）`;
        try {
          const data = await res.json();
          detail = data.message || data.error || detail;
        } catch {
          /* 响应不是 JSON，保留默认提示 */
        }
        throw new Error(res.status === 429 ? `🚦 ${detail}` : detail);
      }

      const remain = res.headers.get('X-Quota-Remaining');
      setQuota(remain !== null ? Number(remain) : null);

      if (!res.body) throw new Error('服务端没有返回数据流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;

          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const json = JSON.parse(payload);
            const piece =
              json.response ?? json.choices?.[0]?.delta?.content ?? '';
            if (piece) append(String(piece));
          } catch {
            append(payload);
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? '请求出错');
        setMessages((prev) =>
          prev.filter(
            (m, i) =>
              !(
                i === prev.length - 1 &&
                m.role === 'assistant' &&
                m.content === ''
              )
          )
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, messages, model]);

  return (
    <main className="min-h-screen bg-[#1e1e1e] text-gray-100 p-4 max-w-4xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white">
            AI
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#569cd6]">
              AI-Chat | Qcy's Blog
            </h1>
            <p className="text-xs text-gray-500">
              零密钥 · Cloudflare 边缘部署
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-md bg-[#252526] border border-[#3c3c3c] text-gray-200 outline-none focus:border-[#569cd6] disabled:opacity-50"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setMessages([])}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-md border border-[#3c3c3c] hover:bg-[#252526] transition-colors disabled:opacity-50"
          >
            清空对话
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="space-y-4 mb-4 h-[62vh] overflow-y-auto p-4 rounded-lg bg-[#252526] border border-[#3c3c3c]"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center px-6">
            <div className="text-5xl mb-4">💬</div>
            <p>开始你的对话吧！这是一个完全基于 Cloudflare Workers AI 的零密钥 AI 助手</p>
            <p className="mt-2 text-xs">
              不需要任何 API Key，部署完就能用 · 支持 Markdown 渲染和代码高亮
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* 头像 */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              m.role === 'user' 
                ? 'bg-[#0e639c] text-white' 
                : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
            }`}>
              {m.role === 'user' ? '我' : 'AI'}
            </div>

            {/* 消息气泡 */}
            <div
              className={`max-w-[85%] p-4 rounded-lg leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#0e639c] text-white rounded-tr-none'
                  : 'bg-[#3c3c3c] text-gray-100 rounded-tl-none'
              }`}
            >
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : m.content ? (
                <MarkdownMessage content={m.content} />
              ) : loading ? (
                <span className="inline-flex gap-1 align-middle">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
              ) : (
                <span className="text-gray-500">（无内容）</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* 多行输入框 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2 items-end"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你想问的问题...（Enter 发送，Shift+Enter 换行）"
          disabled={loading}
          rows={1}
          className="flex-1 px-4 py-3 rounded-lg bg-[#252526] border border-[#3c3c3c] text-white outline-none focus:border-[#569cd6] transition-colors disabled:opacity-50 resize-none font-sans"
        />
        {loading ? (
          <button
            type="button"
            onClick={stop}
            className="px-6 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-medium transition-colors shrink-0"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 py-3 bg-[#0e639c] hover:bg-[#1177bb] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            发送
          </button>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-gray-600">
        Powered by Cloudflare Workers AI · 免费额度支持 · 数据在边缘节点处理
        {quota !== null && (
          <>
            <br />
            今日剩余调用次数：<span className="text-gray-400">{quota}</span>
          </>
        )}
      </p>
    </main>
  );
}
