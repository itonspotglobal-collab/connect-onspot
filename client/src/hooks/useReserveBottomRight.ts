import { useEffect } from "react";

/**
 * Call this hook in any page or component that occupies the bottom-right
 * floating area (e.g. a minimized popup, a sticky pill, a floating CTA).
 *
 * While the component is mounted, it adds `has-floating-bottom-right` to
 * <body>. Vanessa's global launcher reads that class via CSS variables and
 * shifts upward so the two widgets never overlap.  The class is cleaned up
 * automatically on unmount.
 */
export function useReserveBottomRight(): void {
  useEffect(() => {
    document.body.classList.add("has-floating-bottom-right");
    return () => {
      document.body.classList.remove("has-floating-bottom-right");
    };
  }, []);
}
