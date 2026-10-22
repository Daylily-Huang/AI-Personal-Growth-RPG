"use client";
import { useState } from "react";
import { RecoveryPanel } from "@/components/system/RecoveryPanel";
import { useOptionalAppShell } from "@/components/layout/AppShellContext";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const shell = useOptionalAppShell(); const [retrying, setRetrying] = useState(false);
  async function recover() {
    if (retrying) return;
    if (!shell) { retry(); return; }
    setRetrying(true);
    // Refresh read-only shared data too: a persistent shell can retain the failed snapshot.
    await shell.refreshDashboard().catch(() => undefined);
    setRetrying(false); retry();
  }
  return <div className="w-full px-4 py-12"><RecoveryPanel onRetry={recover} retrying={retrying} /></div>;
}
