import type { ReactNode } from "react";
import { AppShell, AppShellProvider } from "@/components/layout";
import { JourneyNav } from "@/components/journey/JourneyNav";

export default function JourneyLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellProvider>
      <AppShell
        title="成长旅程"
        breadcrumbs={[{ label: "Journey" }]}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-10">
          <JourneyNav />
          {children}
        </div>
      </AppShell>
    </AppShellProvider>
  );
}
