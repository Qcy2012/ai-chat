import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cloudflare WAI Chat - 零密钥 AI 助手',
  description:
    '基于 Cloudflare Workers AI 搭建的零密钥 AI 聊天助手，无需 API Key、无需实名即可使用',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
