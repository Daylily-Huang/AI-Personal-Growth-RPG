import type { ReactNode } from "react";
import { AppShell, AppShellProvider } from "@/components/layout";
import { RewardsNav } from "@/components/rewards/RewardsNav";

export default function RewardsLayout({ children }: { children: ReactNode }) {
  return <AppShellProvider><AppShell title="心愿与奖励" breadcrumbs={[{ label: "奖励" }]}>
    <div className="mx-auto w-full max-w-7xl pb-10"><RewardsNav />{children}</div>
  </AppShell></AppShellProvider>;
}
