import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { SignUpDialog } from "@/components/SignUpDialog";
import { isAuthFlowPath } from "@/lib/authBackNavigation";
import { getSafeReturnTo } from "@shared/internalRedirect";

type SignupPortal = "client" | "talent";
type InitialTalentProfile = { firstName: string; lastName: string; email: string };
type SignupRequest = { portal?: SignupPortal; search?: string; trigger?: HTMLElement; initialTalentProfile?: InitialTalentProfile };
type ModalSession = { id: number; portal?: SignupPortal; search: string; origin: string; initialTalentProfile?: InitialTalentProfile };

const SignupModalContext = createContext<((request?: SignupRequest) => void) | null>(null);

export function useSignupModal() {
  const open = useContext(SignupModalContext);
  if (!open) throw new Error("Signup controls require SignupModalProvider");
  return open;
}

function contextualPortal(path: string): SignupPortal | undefined {
  if (/^\/(?:find-work|jobs)(?:\/|$)/.test(path)) return "talent";
  if (/^\/hire-talent(?:\/|$)/.test(path)) return "client";
  return undefined;
}

/** Keep the real route mounted. No background-route reconstruction or snapshots. */
export function SignupModalProvider({ children }: { children: ReactNode }) {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const [session, setSession] = useState<ModalSession | null>(null);
  const serial = useRef(0);
  const restore = useRef<{ trigger: HTMLElement | null; x: number; y: number; origin: string } | null>(null);

  const openSignup = useCallback((request: SignupRequest = {}) => {
    if (isAuthFlowPath(path) || path.startsWith("/admin")) {
      const query = request.search ? `?${request.search.replace(/^\?/, "")}` : "";
      navigate(`${request.portal ? `/signup/${request.portal}` : "/portal"}${query}`);
      return;
    }
    restore.current = {
      trigger: request.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null),
      x: window.scrollX,
      y: window.scrollY,
      origin: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    };
    const params = new URLSearchParams(request.search);
    const returnTo = getSafeReturnTo(params.get("returnTo"));
    params.delete("returnTo");
    if (returnTo) params.set("returnTo", returnTo);
    setSession({
      id: ++serial.current,
      portal: request.portal ?? contextualPortal(path),
      search: params.toString(),
      origin: `${path}${search ? `?${search}` : ""}${window.location.hash}`,
      initialTalentProfile: request.portal === "talent" ? request.initialTalentProfile : undefined,
    });
  }, [path, search, navigate]);

  // Public signup anchors use the same modal as the navigation buttons.
  // Modified clicks and new-tab links keep the standalone URL behavior.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (session || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          isAuthFlowPath(path) || path.startsWith("/admin")) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      const match = url.pathname.match(/^\/(?:portal|signup(?:\/(client|talent))?)\/?$/);
      if (url.origin !== window.location.origin || !match) return;
      event.preventDefault();
      event.stopPropagation();
      openSignup({ portal: match[1] as SignupPortal | undefined, search: url.search, trigger: anchor });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session, path, openSignup]);

  // A genuine route change (for example browser Back) also dismisses the modal.
  useEffect(() => {
    if (session && `${path}${search ? `?${search}` : ""}${window.location.hash}` !== session.origin) {
      setSession(null);
    }
  }, [path, search, session]);

  const restorePageFocus = useCallback((event: Event) => {
    event.preventDefault();
    const saved = restore.current;
    requestAnimationFrame(() => {
      if (!saved || `${window.location.pathname}${window.location.search}${window.location.hash}` !== saved.origin) return;
      const isCollapsedMenuItem = saved.trigger?.dataset.testid === "mobile-signup-button";
      const trigger = saved.trigger?.isConnected && !isCollapsedMenuItem
        ? saved.trigger : document.querySelector<HTMLElement>('[data-testid="mobile-menu-toggle"]');
      trigger?.focus({ preventScroll: true });
      window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
    });
  }, []);

  const params = new URLSearchParams(session?.search);
  return (
    <SignupModalContext.Provider value={openSignup}>
      {children}
      {session && (
        <SignUpDialog
          key={session.id}
          open
          hideTrigger
          standalone
          modalOverlay
          defaultUserType={session.portal}
          defaultEmail={session.initialTalentProfile?.email ?? params.get("email") ?? undefined}
          initialProfile={session.initialTalentProfile}
          returnTo={params.get("returnTo") ?? undefined}
          onOpenChange={open => { if (!open) setSession(null); }}
          onCloseAutoFocus={restorePageFocus}
          onSignInInstead={portal => {
            const next = new URLSearchParams(session.search);
            next.set("backTo", session.origin);
            next.delete("portal");
            setSession(null);
            navigate(`/login${portal ? `/${portal}` : ""}?${next.toString()}`);
          }}
        />
      )}
    </SignupModalContext.Provider>
  );
}
