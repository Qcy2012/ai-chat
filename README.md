# Cloudflare Workers AI 零密钥聊天助手

> ✅ 不需要任何 API Key、不需要实名认证、不需要信用卡，注册 Cloudflare 账号即可部署。

基于 **Next.js 15 + @opennextjs/cloudflare + Workers AI** 搭建的在线 AI 聊天网站。
所有模型调用都在同一个 Cloudflare 账号内通过 `env.AI` 绑定完成，不经过任何第三方接口。

---

## ⚠️ 本版本修复了什么

上一版项目在 `npm install` / 构建时会报 `npm error code ERESOLVE`，本版已彻底修复，改动如下：

| # | 问题 | 原因 | 修复 |
|---|------|------|------|
| 1 | `npm error code ERESOLVE` | 模板锁 `next@14.2.5`，而 `@opennextjs/cloudflare@1.20.6` 要求 `next >= 15.5.24 < 16` | 升级到 `next@15.5.26` + `react@19` |
| 2 | 同类冲突 | `wrangler@^3.72.0` 不满足适配器要求的 `wrangler ^4.125.0` | 升级到 `wrangler@^4.141.0` |
| 3 | 潜在冲突 | `ai@^3` 与 `@ai-sdk/react@^1` 版本代际不匹配 | **移除 AI SDK 依赖**，改为直接透传 Workers AI 的 SSE 流 |
| 4 | 配置文件错误 | 用的是 `wrangler.toml`，且**缺少 `[ai]` 绑定**，代码里 `env.AI` 必然为 undefined | 改为官方规范的 `wrangler.jsonc`，并加上 `"ai": { "binding": "AI" }` |
| 5 | 缺少必要文件 | 没有 `open-next.config.ts`、`.dev.vars`、`public/_headers` | 已按官方文档补齐 |
| 6 | 构建失败 | `next.config.js` 里写了 `experimental.runtime = 'edge'`，与 OpenNext 冲突 | 移除，并改用 `next.config.mjs` |
| 7 | CI 构建失败 | `initOpenNextCloudflareForDev()` 在非交互环境会尝试连接远端代理而报错 | 限制为仅 `NODE_ENV=development` 时启用 |
| 8 | 部署方式错误 | 文档写的是 Cloudflare **Pages**，而 OpenNext 适配器应部署到 **Workers** | 已更正为 Workers 部署流程 |

> 验证结果：`npm install` ✅ · `next build` ✅ · `opennextjs-cloudflare build` ✅ · `wrangler deploy --dry-run` ✅（正确识别 `env.AI` 绑定）

---

## 📦 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 本地开发（Node 环境，热更新）
npm run dev

# 3. 登录 Cloudflare（会打开浏览器授权，只需一次）
npx wrangler login

# 4. 本地模拟真实 Worker 运行时预览（推荐用这个测 AI 功能）
npm run preview

# 5. 一键部署上线
npm run deploy
```

部署完成后会得到一个免费的 `https://cloudflare-wai-chat.<你的子域>.workers.dev` 域名。

---

## 🔗 连接 GitHub 自动部署（可选）

Cloudflare Workers Builds 是「构建命令 + 部署命令」两段式流程，配置如下：

| 设置项 | 值 |
|--------|-----|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Node 版本 | **不需要配**。Workers Builds 默认已是 Node.js 24.18.0，满足全部依赖要求；仓库内已附 `.nvmrc`（`24.18.0`）自动锁定版本 |

> 注意：不要沿用旧文档里的「构建输出目录 `.open-next`」写法，那是 Cloudflare Pages 的旧流程，对 OpenNext 不适用。

### 关于 Node 版本（常见疑问）

**不需要在控制台添加 `NODE_VERSION` 环境变量。** 原因：

- Workers Builds 的默认 Node 版本已是 **24.18.0**（2026-07 起），而本项目只要求 Node ≥ 18.18（Next.js 15）与 ≥ 18（Wrangler 4），默认值已完全满足
- Node 20 已于 2026 年 4 月停止维护（EOL），**手动设 `NODE_VERSION=20` 等于主动降级到已停止安全更新的版本，不建议**
- 仓库内已附 `.nvmrc`（内容为 `24.18.0`），Cloudflare 会优先读取它来锁定版本，无需再配环境变量

版本读取优先级：`.nvmrc` / `.node-version` 文件 > `NODE_VERSION` 环境变量 > 平台默认值。

⚠️ 两个容易踩的坑：
1. Cloudflare **会忽略 `package.json` 里的 `engines` 字段**，别指望用它来指定版本
2. `.nvmrc` 里必须写**精确版本号**，写 `lts/*`、`lts/hydrogen` 这类别名会导致构建失败

若确实想改用其他版本，在 **Settings → Build → Build Variables and Secrets** 添加 `NODE_VERSION` 即可（该入口位于 Workers 项目设置里，不是 Pages 的「环境变量」页）。

---

## 🎯 模型切换

界面右上角下拉框可直接切换，模型 ID 定义在 `app/page.tsx` 的 `MODELS` 数组里：

| 模型 ID | 特点 |
|---------|------|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **默认**，效果均衡 |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 速度极快 |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 推理 / 数学强 |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 代码专用 |
| `@cf/glm/glm-4.5-air` | 中文更优 |

完整列表见 [Cloudflare Workers AI 模型目录](https://developers.cloudflare.com/workers-ai/models/)。

---

## 📁 项目结构

```
cloudflare-wai-chat/
├── app/
│   ├── api/chat/route.ts    # AI 接口：getCloudflareContext() 取 env.AI，零密钥
│   ├── globals.css          # VSCode 深色主题
│   ├── layout.tsx
│   └── page.tsx             # 聊天界面（手写 SSE 解析 + 模型选择）
├── public/_headers          # 静态资源缓存策略
├── wrangler.jsonc           # ★ Cloudflare 配置（含 AI 绑定）
├── open-next.config.ts      # OpenNext 适配器配置
├── next.config.mjs
├── .dev.vars                # 本地开发环境变量
├── tailwind.config.js
├── tsconfig.json
└── TROUBLESHOOTING.md       # 常见报错排查
```

---

## ✨ 进阶扩展

1. **对话历史**：接入 Cloudflare D1 免费数据库持久化聊天记录
2. **访问保护**：加一层 Basic Auth，避免公开后被人刷免费额度
3. **算法特色功能**：复用你已有的在线 IDE，做「AI 帮你 Debug 算法代码」「AI 生成题解」
4. **RAG 知识库**：把 OI Wiki / 自己的题解导入 Vectorize 向量库，让回答基于专业资料

---

## ⚠️ 注意事项

1. Workers AI 免费额度有每日调用上限，个人使用足够，不建议直接当大规模公开服务
2. 本地 `npm run preview` 需要先 `npx wrangler login`：AI 绑定在本地开发时会走远端代理会话，未登录会报 `Failed to start the remote proxy session`
3. 原生 Windows 下 OpenNext / Wrangler 偶发 WASM 路径问题，建议用 WSL 或 Linux 环境
