import type { ReactNode } from "react";
import { AppShell, AppShellProvider } from "@/components/layout";

export default function RewardsLayout({ children }: { children: ReactNode }) {
  return <AppShellProvider><AppShell title="心愿与奖励" breadcrumbs={[{ label: "心愿" }]}>
    <div className="mx-auto w-full max-w-7xl pb-10">{children}</div>
  </AppShell></AppShellProvider>;
}
