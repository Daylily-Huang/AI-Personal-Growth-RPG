import { AppShell } from "@/components/layout/AppShell";

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="知识图" fullBleed={true}>{children}</AppShell>;
}
