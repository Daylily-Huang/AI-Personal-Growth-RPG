import type { ReactNode } from "react";
import { JourneyNav } from "@/components/journey/JourneyNav";

export default function JourneyLayout({ children }: { children: ReactNode }) {
  return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-10">
          <JourneyNav />
          {children}
        </div>
  );
}
