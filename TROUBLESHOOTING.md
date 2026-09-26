# 常见报错排查

## 1. `npm error code ERESOLVE`

完整报错形如：

```
npm error code ERESOLVE
npm error ERESOLVE unable to resolve dependency tree
npm error While resolving: cloudflare-wai-chat@1.0.0
npm error Found: next@14.2.5
npm error Could not resolve dependency:
npm error peer next@">=15.5.24 <16 || >=16.3.3" from @opennextjs/cloudflare@1.20.6
```

**含义**：`@opennextjs/cloudflare` 对 `next` 和 `wrangler` 有 peer 版本下限要求，模板版本太旧。

**正确修法**（本仓库已修好）：

```jsonc
// package.json
"dependencies": {
  "next": "15.5.26",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
},
"devDependencies": {
  "@opennextjs/cloudflare": "^1.20.6",
  "wrangler": "^4.141.0"
}
```

**应急修法**（只想先跑起来，不推荐长期使用）：

```bash
npm install --legacy-peer-deps
```

或在项目根目录建 `.npmrc`：

```
legacy-peer-deps=true
```

> ⚠️ `--legacy-peer-deps` 只是让 npm 忽略 peer 冲突，装出来的组合可能运行时报错，属于「暂时不挡路」，不是「已修好」。
> 想知道到底哪两个包冲突，用：`npm install --dry-run --verbose`，报错段落里的 `Found:` / `Could not resolve dependency:` 两行就是冲突双方。

---

## 2. `Failed to start the remote proxy session ... CLOUDFLARE_API_TOKEN`

```
In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN
environment variable for wrangler to work.
```

**原因**：Workers AI 绑定在本地开发时无法本地模拟，Wrangler 需要建立到 Cloudflare 的远端代理会话，因此必须已登录。

**修法**：

- 本机开发：先执行 `npx wrangler login`（浏览器授权）
- CI / 服务器等非交互环境：设置环境变量 `CLOUDFLARE_API_TOKEN`（在 Cloudflare 控制台「My Profile → API Tokens」创建）
- 如果错误发生在 `next build` 阶段：本仓库已把 `initOpenNextCloudflareForDev()` 限制为仅在 `NODE_ENV=development` 时执行，正常不会再触发

---

## 3. `env.AI` 是 undefined / 接口返回「AI 绑定未找到」

**原因**：`wrangler.jsonc` 里没有声明 AI 绑定。

**修法**：确认配置文件（不是 `wrangler.toml`，用 `wrangler.jsonc`）里有：

```jsonc
"ai": {
  "binding": "AI"
}
```

改完后必须重新构建：`npx opennextjs-cloudflare build`。
可用 `npx wrangler deploy --dry-run` 校验，输出里应出现 `env.AI   AI`。

---

## 4. 构建时报 `runtime = "edge"` 相关错误

**原因**：`@opennextjs/cloudflare` 走的是 Workers + `nodejs_compat`，不支持在路由里声明 edge runtime。

**修法**：删除所有 `export const runtime = "edge";`，并确保 `wrangler.jsonc` 的 `compatibility_flags` 含 `nodejs_compat`。

---

## 5. `compatibility_date` 报错

`@opennextjs/cloudflare` 要求 `compatibility_date` **不早于 `2024-09-23`**。本仓库用的是 `2026-01-01`。

---

## 6. 页面能打开，但发消息一直转圈 / 没有打字机效果

按顺序排查：

1. 打开浏览器开发者工具 → Network → 看 `/api/chat` 的响应状态码
   - `500` + JSON 报错 → 看 `message` 字段，一般是绑定或模型 ID 问题
   - `200` 但无内容 → 模型 ID 写错了，去 [模型目录](https://developers.cloudflare.com/workers-ai/models/) 复制准确 ID
2. 看 Cloudflare 控制台的 Worker 实时日志（`observability.enabled` 已打开）
3. 确认免费额度没用完

---

## 7. Windows 下构建报 `resvg.wasm?module (ENOENT)`

**原因**：Windows 文件名不允许包含 `?`，而 WASM 资源文件名里带了 `?module` 后缀。

**修法**：改用 WSL2 或 Linux / GitHub Codespaces 环境执行构建，官方明确建议不要在原生 Windows 下跑 OpenNext。
