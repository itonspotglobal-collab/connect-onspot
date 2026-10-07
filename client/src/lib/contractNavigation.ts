export const CONTRACT_NAVIGATION_STATE_KEY = "__onspotContractNavigation";
let activeDocumentId: string | null = null;

export function getContractNavigationDocumentId(): string | null {
  return activeDocumentId;
}

export interface ContractNavigationMarker {
  documentId: string;
  previousLocation: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type TrackedWindow = Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">;

function readInternalLocation(win: TrackedWindow): string {
  return `${win.location.pathname}${win.location.search}${win.location.hash}`;
}

export function markContractHistoryEntry(
  state: unknown,
  marker: ContractNavigationMarker,
): Record<string, unknown> {
  const nextState: Record<string, unknown> = isRecord(state) ? { ...state } : state == null
    ? {}
    : { __onspotOriginalHistoryState: state };
  nextState[CONTRACT_NAVIGATION_STATE_KEY] = marker;
  return nextState;
}

/**
 * Tracks actual History API operations rather than inferred router renders:
 * Wouter emits synchronous pushState/replaceState events after its calls.
 * Replacements retain the current entry's predecessor; pops restore the
 * predecessor recorded on the destination entry.
 */
export function installContractNavigationTracker(win: TrackedWindow = window): () => void {
  const documentId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  activeDocumentId = documentId;
  let lastLocation = readInternalLocation(win);
  let currentEntryPrevious: string | null = null;
  let writingMarker = false;

  const writeMarker = (previousLocation: string | null) => {
    writingMarker = true;
    try {
      win.history.replaceState(
        markContractHistoryEntry(win.history.state, { documentId, previousLocation }),
        "",
        win.location.href,
      );
    } finally {
      writingMarker = false;
    }
  };
  const onPushState = () => {
    const nextLocation = readInternalLocation(win);
    currentEntryPrevious = lastLocation;
    writeMarker(currentEntryPrevious);
    lastLocation = nextLocation;
  };
  const onReplaceState = () => {
    if (writingMarker) return;
    lastLocation = readInternalLocation(win);
    // Wouter may replace the state with null. Keep the predecessor privately
    // because replacing a history entry does not change where Back will go.
    writeMarker(currentEntryPrevious);
  };
  const onPopState = () => {
    lastLocation = readInternalLocation(win);
    currentEntryPrevious = getTrustedPreviousLocation(win.history.state, documentId, win.location.origin);
  };

  // Initial/deep links and refreshed entries deliberately have no trusted
  // predecessor, regardless of prior entries outside this app/document.
  writeMarker(null);
  win.addEventListener("pushState", onPushState);
  win.addEventListener("replaceState", onReplaceState);
  win.addEventListener("popstate", onPopState);
  return () => {
    win.removeEventListener("pushState", onPushState);
    win.removeEventListener("replaceState", onReplaceState);
    win.removeEventListener("popstate", onPopState);
    if (activeDocumentId === documentId) activeDocumentId = null;
  };
}

export function getTrustedPreviousLocation(
  state: unknown,
  documentId: string,
  origin: string,
): string | null {
  if (!isRecord(state)) return null;
  const marker = state[CONTRACT_NAVIGATION_STATE_KEY] as ContractNavigationMarker | undefined;
  if (!marker || marker.documentId !== documentId || typeof marker.previousLocation !== "string") return null;

  try {
    const previous = new URL(marker.previousLocation, origin);
    if (previous.origin !== origin || !previous.pathname.startsWith("/") || previous.pathname.startsWith("//")) return null;
    return `${previous.pathname}${previous.search}${previous.hash}`;
  } catch {
    return null;
  }
}

export function getContractListLocation(search: string, trustedPrevious: string | null = null): string {
  const trustedUrl = trustedPrevious ? new URL(trustedPrevious, "https://onspot.invalid") : null;
  const listContext = trustedUrl?.pathname === "/contracts" && trustedPrevious
    ? trustedPrevious
    : `/contracts${search ? `?${search.replace(/^\?/, "")}` : ""}`;
  const url = new URL(listContext, "https://onspot.invalid");
  url.searchParams.delete("id");
  url.searchParams.delete("offerId");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function fallbackContractsLocation(role?: string | null): string {
  if (role === "client") return "/clients";
  if (role === "admin") return "/admin/dashboard";
  return "/my-applications";
}
