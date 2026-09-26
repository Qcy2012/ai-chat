import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cloudflare WAI Chat - 无密钥AI助手',
  description: '基于Cloudflare Workers AI搭建的零密钥AI聊天助手，无需实名即可使用',
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
