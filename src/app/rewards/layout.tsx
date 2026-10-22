import type { ReactNode } from "react";
import { RewardsNav } from "@/components/rewards/RewardsNav";

export default function RewardsLayout({ children }: { children: ReactNode }) {
  return <>
    <div className="mx-auto w-full max-w-7xl pb-10"><RewardsNav />{children}</div>
  </>;
}
