import "./globals.css";
import type { Metadata, Viewport } from "next";

const basePath = process.env.BASE_PATH || "";
const brushCursor = `url(${basePath}/brush-cursor.svg) 4 28, auto`;

export const metadata: Metadata = {
  title: "Time Ink - 让时间带着你写下去",
  description: "沉浸式限时写作工具",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ ["--brush-cursor" as string]: brushCursor }}>{children}</body>
    </html>
  );
}
