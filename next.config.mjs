import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 注意：使用 @opennextjs/cloudflare 时不要设置 runtime = "edge"
};

export default nextConfig;

// 仅在本地 `next dev` 时启用，让开发环境也能访问 Cloudflare 绑定。
// 生产构建 / CI 环境不能调用，否则会尝试建立远端代理连接而构建失败。
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
