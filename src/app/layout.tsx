import type { Metadata } from "next";
import "./globals.css";
import { AppShellBoundary } from "@/components/layout/AppShellBoundary";

export const metadata: Metadata = {
  title: "AI Personal Growth RPG",
  description: "把现实成长转化为可验证的角色成长",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppShellBoundary>{children}</AppShellBoundary>
      </body>
    </html>
  );
}
