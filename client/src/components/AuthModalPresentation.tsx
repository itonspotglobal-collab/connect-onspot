import { createContext, useContext } from "react";

/** Presentation-only dismissal; successful authentication owns its own redirect. */
export const AuthModalPresentation = createContext<{ onClose: () => void } | null>(null);

export function useAuthModalPresentation() {
  return useContext(AuthModalPresentation);
}
