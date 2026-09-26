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

---

## 8. 发消息返回 429「请求太频繁了，请等一分钟再试。」

这是**第一道闸门（每 IP 速率限制）**生效了，不是故障。

**含义**：同一个 IP 在 60 秒内请求超过 6 次。默认值定义在 `wrangler.jsonc`：

```jsonc
"ratelimits": [
  {
    "name": "CHAT_RATE_LIMITER",
    "namespace_id": "1001",
    "simple": { "limit": 6, "period": 60 }
  }
]
```

**调整方法**：改 `limit` 的值即可。注意两点：

- `period` **只能是 10 或 60**，填别的值会导致部署失败
- 计数器是**按 Cloudflare 边缘节点（地区）分别计算**的，不是全球统一计数，所以实际放行量会略高于设定值，这属于预期行为

**想彻底关掉**：删掉整个 `ratelimits` 数组，重新部署。代码里做了判断，绑定不存在时会自动跳过这道闸门。

---

## 9. 发消息返回 429「今天的调用次数已用完（上限 N 次/天）」

这是**第二道闸门（每日总量上限）**生效了。

**含义**：当天累计调用已达 `vars.DAILY_LIMIT` 设定的次数。

**恢复时间**：北京时间**早上 8:00**（UTC 00:00）自动重置，不需要任何操作。

**调整方法**：改 `wrangler.jsonc` 里的：

```jsonc
"vars": {
  "DAILY_LIMIT": "300"   // 改成你要的次数；填 "0" 表示不限制
}
```

**注意**：只有绑定了 `CHAT_KV` 时这道闸门才会生效。没绑定 KV 的话，`DAILY_LIMIT` 不起作用，站点也不会报这个错。

---

## 10. 部署时报 `ratelimits` / Rate Limiting 相关错误

**排查顺序**：

1. **Wrangler 版本太低**：Rate Limiting 绑定需要 **Wrangler ≥ 4.36.0**，本项目用的是 `^4.141.0`，正常不会触发
2. **`period` 取值非法**：只允许 `10` 或 `60`，其它值会直接部署失败
3. **`namespace_id` 类型错误**：必须是**字符串形式**的整数，例如 `"1001"`，写成数字 `1001` 可能报错

**确认绑定是否配置正确**，本地执行：

```bash
npx wrangler deploy --dry-run
```

输出里应能看到：

```
env.CHAT_RATE_LIMITER (6 requests/60s)      Rate Limit
env.AI                                      AI
env.DAILY_LIMIT ("300")                     Environment Variable
```

**如果确认是这项绑定导致部署失败**（例如账号不支持），直接删掉 `wrangler.jsonc` 里的整个 `ratelimits` 数组再部署即可，功能不受影响——代码会检测不到绑定并自动跳过限流。

---

## 11. 部署时报 `KV namespace ... not found` 或 `id` 无效

**原因**：启用了每日上限，但 `kv_namespaces` 里的 `id` 不是你自己账号下的有效命名空间 ID。

**修法**：

1. 控制台 → **Workers & Pages** → **KV** → 确认命名空间已创建
2. 复制该命名空间的 **ID**（32 位十六进制字符串），粘贴到 `wrangler.jsonc` 的 `id` 字段
3. `binding` 必须正好是 `CHAT_KV`

**暂时不想折腾**：把 `kv_namespaces` 整块注释掉再部署，站点照常运行（只是不做每日总量限制）。
