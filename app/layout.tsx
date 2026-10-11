import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "安心用藥紀錄",
  description: "家人專用的用藥資訊整理與說明工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}