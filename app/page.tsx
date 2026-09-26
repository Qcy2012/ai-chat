'use client';
import { useChat } from '@ai-sdk/react';

const MODEL_LIST = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill' },
  { id: '@cf/glm/glm-4.5-air', name: 'GLM-4.5 Air' },
];

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
  });

  return (
    <main className="min-h-screen bg-vscode-bg text-gray-100 p-4 max-w-4xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white">
            W
          </div>
          <div>
            <h1 className="text-2xl font-bold text-vscode-blue">Workers AI Chat</h1>
            <p className="text-xs text-gray-500">零密钥 · 免实名 · Cloudflare 边缘部署</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([])}
          className="px-3 py-1.5 text-sm rounded-md border border-vscode-border hover:bg-vscode-panel transition-colors"
        >
          清空对话
        </button>
      </div>

      {/* 模型选择提示 */}
      <div className="mb-4 p-3 rounded-lg bg-vscode-panel border border-vscode-border text-sm text-gray-400">
        💡 默认使用 Llama 3.3 70B，可在 <code className="text-vscode-blue px-1">app/api/chat/route.ts</code> 中切换其他模型
      </div>

      {/* 消息列表 */}
      <div className="space-y-4 mb-6 h-[65vh] overflow-y-auto p-4 rounded-lg bg-vscode-panel border border-vscode-border">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="text-5xl mb-4">💬</div>
            <p>开始你的对话吧！这是一个完全基于Cloudflare Workers AI的零密钥AI助手</p>
            <p className="mt-2 text-xs">不需要任何API Key，不需要实名认证，部署完就能用</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-lg ${
              m.role === 'user'
                ? 'bg-vscode-button text-white rounded-tr-none'
                : 'bg-vscode-border text-gray-100 rounded-tl-none'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-vscode-border p-4 rounded-lg rounded-tl-none">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入你想问的问题..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-lg bg-vscode-panel border border-vscode-border text-white outline-none focus:border-vscode-blue transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-vscode-button hover:bg-vscode-button-hover rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '生成中...' : '发送'}
        </button>
      </form>

      {/* 底部说明 */}
      <p className="mt-4 text-center text-xs text-gray-600">
        Powered by Cloudflare Workers AI · 完全免费额度支持 · 数据在边缘节点处理
      </p>
    </main>
  );
}
