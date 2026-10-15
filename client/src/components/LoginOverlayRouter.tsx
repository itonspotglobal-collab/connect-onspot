import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Router, useLocation, useSearch } from "wouter";
import PortalLogin from "@/pages/PortalLogin";
import { AuthModalPresentation } from "@/components/AuthModalPresentation";
import { authBackDestination, isAuthFlowPath } from "@/lib/authBackNavigation";

type Background = { path: string; search: string; hash: string; x: number; y: number };
type Navigation = ReturnType<typeof useLocation>[1];
const BackgroundLocation = createContext<{ path: string; search: string; navigate: Navigation } | null>(null);

// Stable hook identities keep the original public route and its components mounted.
function useBackgroundLocation(): ReturnType<typeof useLocation> {
  const value = useContext(BackgroundLocation)!;
  return [value.path, value.navigate];
}
function useBackgroundSearch() {
  return useContext(BackgroundLocation)!.search;
}
const isLoginPath = (path: string) => /^\/(?:login(?:\/(?:client|talent))?|sign-in|portal-login)\/?$/.test(path);

/** Freeze only the background router, never the login URL or authentication state. */
export function LoginOverlayRouter({ children }: { children: ReactNode }) {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const loginOpen = isLoginPath(path);
  const previous = useRef<Background | null>(null);
  const focus = useRef<HTMLElement | null>(null);
  const background = loginOpen ? previous.current : null;
  const locked = useRef(loginOpen);
  locked.current = loginOpen;
  const navigateBackground = useCallback<Navigation>((to, options) => {
    // The mounted background is inert. Its role-aware redirects must not race
    // the real login form's successful-authentication destination.
    if (!locked.current) navigate(to, options);
  }, [navigate]);

  useLayoutEffect(() => {
    if (loginOpen) {
      if (!background) window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      return;
    }
    if (isAuthFlowPath(path) || path.startsWith("/admin")) {
      previous.current = null;
      return;
    }
    const saved: Background = { path, search, hash: window.location.hash, x: window.scrollX, y: window.scrollY };
    previous.current = saved;
    const rememberScroll = () => {
      saved.x = window.scrollX;
      saved.y = window.scrollY;
    };
    const rememberFocus = () => {
      if (document.activeElement instanceof HTMLElement) focus.current = document.activeElement;
    };
    const rememberHash = () => { saved.hash = window.location.hash; };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    document.addEventListener("focusin", rememberFocus);
    window.addEventListener("hashchange", rememberHash);
    return () => {
      window.removeEventListener("scroll", rememberScroll);
      document.removeEventListener("focusin", rememberFocus);
      window.removeEventListener("hashchange", rememberHash);
    };
  }, [path, search, loginOpen, background]);

  const close = () => {
    const target = background
      ? `${background.path}${background.search ? `?${background.search}` : ""}${background.hash}`
      : authBackDestination(search);
    navigate(target);
    requestAnimationFrame(() => {
      if (focus.current?.isConnected) focus.current.focus({ preventScroll: true });
      window.scrollTo({ left: background?.x ?? 0, top: background?.y ?? 0, behavior: "instant" });
    });
  };
  const displayPath = loginOpen ? background?.path ?? "/" : path;
  const displaySearch = loginOpen ? background?.search ?? "" : search;
  const backgroundLocation = useMemo(() => ({
    path: displayPath, search: displaySearch, navigate: navigateBackground,
  }), [displayPath, displaySearch, navigateBackground]);

  return (
    <>
      <BackgroundLocation.Provider value={backgroundLocation}>
        <div
          data-login-background={loginOpen ? background?.path ?? "/" : undefined}
          className={loginOpen && !background ? "fixed inset-0 overflow-hidden bg-background" : undefined}
        >
          <Router hook={useBackgroundLocation} searchHook={useBackgroundSearch}>
            {children}
          </Router>
        </div>
      </BackgroundLocation.Provider>
      {loginOpen && (
        <AuthModalPresentation.Provider value={{ onClose: close }}>
          <PortalLogin />
        </AuthModalPresentation.Provider>
      )}
    </>
  );
}
