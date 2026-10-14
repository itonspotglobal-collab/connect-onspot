import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useLocation } from "wouter";
import { SignUpDialog } from "@/components/SignUpDialog";
import { getSafeReturnTo } from "@shared/internalRedirect";

interface SignupOptions {
  portal?: "client" | "talent";
  email?: string;
  returnTo?: string;
}

interface SignupSession {
  options: SignupOptions;
  origin: string;
  x: number;
  y: number;
  opener: HTMLElement | null;
}

const SignupModalContext = createContext<{
  openSignup: (options?: SignupOptions, opener?: HTMLElement | null) => void;
} | null>(null);

const currentPage = () => window.location.pathname + window.location.search + window.location.hash;

/** Keeps the real page mounted; opening or dismissing signup never changes its URL. */
export function SignupModalProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [session, setSession] = useState<SignupSession | null>(null);

  const openSignup = useCallback((options: SignupOptions = {}, opener?: HTMLElement | null) => {
    const trigger = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    // The mobile menu closes on launch, so restore focus to its visible toggle.
    const focusTarget = trigger?.dataset.testid === "mobile-signup-button"
      ? document.querySelector<HTMLElement>('[data-testid="mobile-menu-toggle"]')
      : trigger;
    const next: SignupSession = {
      options, opener: focusTarget, origin: currentPage(), x: window.scrollX, y: window.scrollY,
    };
    setSession(existing => existing ?? next);
  }, []);

  useEffect(() => {
    setSession(null);
  }, [location]);

  function restoreContext(event: Event) {
    event.preventDefault();
    const original = session;
    requestAnimationFrame(() => {
      // A successful signup or Sign In action must not restore the old page.
      if (!original || currentPage() !== original.origin) return;
      window.scrollTo({ left: original.x, top: original.y, behavior: "instant" });
      const target = [
        original.opener,
        document.querySelector<HTMLElement>('[data-testid="nav-signup-button"]'),
        document.querySelector<HTMLElement>('[data-testid="mobile-menu-toggle"]'),
      ].find(element => element?.isConnected && element.getClientRects().length);
      target?.focus({ preventScroll: true });
    });
  }

  return (
    <SignupModalContext.Provider value={{ openSignup }}>
      {children}
      {session && (
        <SignUpDialog
          open
          hideTrigger
          defaultUserType={session.options.portal}
          defaultEmail={session.options.email}
          returnTo={session.options.returnTo}
          onOpenChange={open => { if (!open) setSession(null); }}
          onCloseAutoFocus={restoreContext}
          onSignInInstead={portal => {
            const params = new URLSearchParams({ backTo: session.origin });
            const returnTo = getSafeReturnTo(session.options.returnTo);
            if (returnTo) params.set("returnTo", returnTo);
            navigate(`/login${portal ? `/${portal}` : ""}?${params.toString()}`);
          }}
        />
      )}
    </SignupModalContext.Provider>
  );
}

export function useSignupModal() {
  const context = useContext(SignupModalContext);
  if (!context) throw new Error("useSignupModal must be used inside SignupModalProvider");
  return context;
}

/** Ordinary clicks open in-place; new-tab gestures keep the standalone URL. */
export function SignupLink({ children, onClick, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const { openSignup } = useSignupModal();
  return (
    <a
      {...props}
      href="/signup"
      onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || (props.target && props.target !== "_self")) return;
        event.preventDefault();
        openSignup({}, event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
