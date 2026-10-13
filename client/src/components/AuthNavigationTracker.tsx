import { useLayoutEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { isAuthFlowPath, safeAuthOrigin } from "@/lib/authBackNavigation";

/**
 * Carry the public origin in the auth URL so refreshes preserve it, while a
 * fresh direct visit cannot inherit a stale destination from another flow.
 * Covers links and programmatic navigation without altering successful auth.
 */
export function AuthNavigationTracker() {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const previousPage = useRef<string | null>(null);
  const flowOrigin = useRef<string | null>(null);

  useLayoutEffect(() => {
    // This improvement is limited to Client/Talent portals, not Admin auth.
    if (path.startsWith("/admin")) {
      previousPage.current = null;
      flowOrigin.current = null;
      return;
    }
    if (!isAuthFlowPath(path)) {
      previousPage.current = safeAuthOrigin(`${path}${search ? `?${search}` : ""}${window.location.hash}`);
      flowOrigin.current = null;
      return;
    }

    const params = new URLSearchParams(search);
    if (params.has("backTo")) {
      flowOrigin.current = safeAuthOrigin(params.get("backTo"));
    } else {
      flowOrigin.current ??= previousPage.current;
      if (flowOrigin.current) {
        params.set("backTo", flowOrigin.current);
        navigate(`${path}?${params.toString()}${window.location.hash}`, { replace: true });
      }
    }
    previousPage.current = null;
  }, [path, search, navigate]);

  return null;
}
