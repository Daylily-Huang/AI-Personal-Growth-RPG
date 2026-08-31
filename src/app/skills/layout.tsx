import { AppShell } from "@/components/layout/AppShell";

export default function SkillsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="技能谱" fullBleed={true}>{children}</AppShell>;
}
