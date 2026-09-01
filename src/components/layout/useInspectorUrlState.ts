"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface InspectorUrlState {
  inspectId: string | null;
  activeTab: string | null;
  openInspector: (id: string, tab?: string) => void;
  closeInspector: () => void;
  setTab: (tab: string) => void;
}

/**
 * Universal, domain-neutral URL state management hook for InspectorDrawer.
 * Synchronizes `?inspect=<entityId>&tab=<tabName>` with the browser URL
 * while preserving all unrelated query parameters.
 */
export function useInspectorUrlState(): InspectorUrlState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const inspectId = searchParams ? searchParams.get("inspect") : null;
  const activeTab = searchParams ? searchParams.get("tab") : null;

  const openInspector = useCallback(
    (id: string, tab?: string) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      params.set("inspect", id);
      if (tab) {
        params.set("tab", tab);
      } else {
        params.delete("tab");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const closeInspector = useCallback(() => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.delete("inspect");
    params.delete("tab");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [searchParams, router, pathname]);

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return useMemo(
    () => ({
      inspectId,
      activeTab,
      openInspector,
      closeInspector,
      setTab,
    }),
    [inspectId, activeTab, openInspector, closeInspector, setTab]
  );
}
