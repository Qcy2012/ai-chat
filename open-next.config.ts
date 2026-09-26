import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 本示例不使用 R2 增量缓存，保持最简配置，零成本即可部署。
// 如需开启 ISR / 数据缓存，可参考官方 Caching 文档接入 R2。
export default defineCloudflareConfig({});
