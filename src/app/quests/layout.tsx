import { AppShell } from "@/components/layout/AppShell";

export default function QuestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="任务志">{children}</AppShell>;
}
