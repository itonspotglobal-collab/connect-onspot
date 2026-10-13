import { getSafeReturnTo } from "@shared/internalRedirect";

/** Cancellation navigation is deliberately separate from post-login returnTo. */
export function isAuthFlowPath(path: string): boolean {
  return /^\/(?:login|signup|sign-in|portal-login)(?:\/|$)/.test(path) ||
    path === "/talent/signup" || path === "/admin/login";
}

export function safeAuthOrigin(value: unknown): string | null {
  const safe = getSafeReturnTo(value);
  if (!safe) return null;
  let path = safe.split(/[?#]/)[0];
  try {
    for (let i = 0; i < 3; i++) path = decodeURIComponent(path);
  } catch { return null; }
  return isAuthFlowPath(path) ? null : safe;
}

export function authBackDestination(search: string): string {
  return safeAuthOrigin(new URLSearchParams(search).get("backTo")) ?? "/";
}

export function authPortalHref(kind: "login" | "signup", search: string): string {
  const params = new URLSearchParams(search);
  // Legacy portal=talent/client would otherwise reopen a form, not the chooser.
  params.delete("portal");
  const query = params.toString();
  return `/${kind}${query ? `?${query}` : ""}`;
}

export function authBackLabel(destination: string): string {
  const path = destination.split(/[?#]/)[0];
  if (path === "/") return "Back to Home";
  if (path === "/jobs" || /^\/find-work(?:\/jobs|\/[^/]+)?$/.test(path)) return "Back to Find Work";
  if (/^\/(?:jobs\/[^/]+|find-work\/job\/[^/]+)$/.test(path)) return "Back to Job Details";
  const labels: Record<string, string> = {
    "/hire-talent": "Hire Talent",
    "/talent-pool": "Talent Search",
    "/join-onspot": "Join OnSpot",
    "/why-onspot/about": "About OnSpot",
    "/why-onspot/investors": "Investors",
    "/pricing": "Pricing",
    "/contact": "Contact",
  };
  return labels[path] ? `Back to ${labels[path]}` : "Back to Previous Page";
}
