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

## 🆕 本次新增

### 1. 默认模型换成 GLM-4.7 Flash

| 项 | 改动前 | 改动后 |
|---|---|---|
| 默认模型 | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **`@cf/zai-org/glm-4.7-flash`** |
| 免费额度可聊轮数 | 约 70 轮/天 | **约 380 轮/天** |

同样是每天 10000 Neurons 的免费额度，换模型后可用轮数提升 5 倍以上。

> 模型标识以 Cloudflare 官方更新日志为准：`@cf/zai-org/glm-4.7-flash`，131072 token 上下文。
> 上一版里写的 `@cf/glm/glm-4.5-air` 是错误标识，调用必然失败，本次已一并修正。

### 2. 两道闸门，防止绑了域名后被刷光额度

公开可访问的站点最怕被爬虫反复打接口，把当天的免费额度提前吃光。现在加了双层保护：

| 闸门 | 机制 | 是否需要额外配置 | 默认状态 |
|------|------|------------------|----------|
| **第一道：每 IP 速率限制** | Cloudflare 原生 Rate Limiting 绑定，每 IP 每分钟最多 6 次 | ❌ 不需要，已在 `wrangler.jsonc` 配好 | ✅ **已启用** |
| **第二道：每日总量上限** | 通过 KV 记录当天调用次数，默认 300 次/天 | ✅ 需要创建一个 KV 命名空间 | ⚙️ **可选** |

**第一道闸门零配置**，部署即生效——爬虫突发刷接口会被直接拦掉（返回 429 并提示「请求太频繁了」）。

**第二道闸门**用于防止「细水长流」式的额度消耗。启用方法见下方「启用每日总量上限」。

两道闸门都会**优雅降级**：万一绑定不存在或服务异常，请求会正常放行，不会把站点拖挂。

> ⚠️ 免费额度本身也有一层硬保护：Workers AI 每天 10000 Neurons 用完后，后续请求会**直接报错，不会产生任何费用**（免费计划没有支付方式，扣不了钱）。

### 3. 界面显示剩余调用次数

启用每日上限后，页面底部会实时显示「今日剩余调用次数」。

---

## 🚦 启用每日总量上限（可选，约 2 分钟）

第二道闸门默认是关闭的（配置块保持注释状态），开启步骤：

1. **创建 KV 命名空间**
   Cloudflare 控制台 → **Workers & Pages** → 左侧 **KV** → **创建命名空间**
   名称随意，例如 `chat-quota`，创建后复制它的 **ID**

2. **填入配置文件**
   打开 `wrangler.jsonc`，找到被注释掉的 `kv_namespaces` 块，解开注释并填入 ID：

   ```jsonc
   "kv_namespaces": [
     {
       "binding": "CHAT_KV",
       "id": "把这里换成你复制的命名空间 ID"
     }
   ],
   ```

   > `binding` 必须正好是 `CHAT_KV`，代码靠这个名字找它。

3. **调整上限（可选）**
   同一文件里的 `vars.DAILY_LIMIT` 就是每日上限，默认 `"300"`。改成 `"0"` 表示不限制。

4. **重新部署**
   ```bash
   npm run deploy
   ```

**为什么默认关闭？** 因为 KV 绑定里的 ID 必须是你自己的命名空间 ID，填错会导致部署失败。所以默认保持注释状态，让站点先跑起来，你想开的时候再开。

### KV 免费额度提醒

| 项 | 免费额度 |
|---|---|
| 读取 | 100,000 次/天 |
| 写入（不同 key） | 1,000 次/天 |
| **写入（同一个 key）** | **1 次/秒** |

每日上限默认设 300，一天最多产生约 300 次写入，远低于 1000 次的天花板，安全。

至于「同一个 key 每秒只能写 1 次」——高并发时部分计数写入会失败，代码里**直接忽略这类失败**。这是安全阀而不是计费系统，宁可少计几次，也不能影响正常对话。

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

界面右上角下拉框可直接切换，模型 ID 定义在 `app/page.tsx` 的 `MODELS` 数组里。

下表的「约可聊轮数」按「输入 800 token + 输出 600 token」的一轮中文对话估算，对应每天 10000 Neurons 的免费额度：

| 模型 ID | 特点 | 约可聊轮数 |
|---------|------|-----------|
| `@cf/zai-org/glm-4.7-flash` | **默认**，中文原生、便宜 | **约 380 轮** |
| `@cf/qwen/qwen3-30b-a3b-fp8` | MoE 架构，速度极快 | 约 450 轮 |
| `@cf/meta/llama-3.1-8b-instruct` | 最省额度 | 约 410 轮 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 效果均衡，但烧得快 | 约 70 轮 |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 长上下文（131k） | 约 150 轮 |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 推理 / 数学强，最贵 | 约 33 轮 |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 代码专用 | — |

> ⚠️ **别拿 DeepSeek R1 当日常聊天用**，一天只能聊 30 多轮就见底了，留给硬核推理场景。
>
> ⚠️ 部分模型（如 `kimi-k2.6`、`glm-5.2`、`deepseek-v4-pro`）**必须有付费方式才能调用**，点了报错不一定是代码问题，可能只是这个模型要付费。上表里的模型都是免费档可直接用的。

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
├── wrangler.jsonc           # ★ Cloudflare 配置（AI 绑定 + 每 IP 速率限制 + 每日上限参数）
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
2. **访问保护**：最彻底的做法是开 **Cloudflare Access**（Zero Trust，50 用户以内免费），加一层登录墙，爬虫根本进不来；控制台配置即可，不用改代码
3. **算法特色功能**：复用你已有的在线 IDE，做「AI 帮你 Debug 算法代码」「AI 生成题解」
4. **RAG 知识库**：把 OI Wiki / 自己的题解导入 Vectorize 向量库，让回答基于专业资料

---

## ⚠️ 注意事项

1. Workers AI 免费额度是**每天 10000 Neurons**（约 70~450 轮对话，取决于选哪个模型），UTC 00:00（北京时间早上 8:00）重置，**用不完不累积**；超额只会报错，免费计划没有支付方式，不会产生任何费用
2. 本地 `npm run preview` 需要先 `npx wrangler login`：AI 绑定在本地开发时会走远端代理会话，未登录会报 `Failed to start the remote proxy session`
3. 原生 Windows 下 OpenNext / Wrangler 偶发 WASM 路径问题，建议用 WSL 或 Linux 环境
