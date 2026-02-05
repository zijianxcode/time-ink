import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Time Ink - 让时间带着你写下去",
  description: "沉浸式限时写作工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
