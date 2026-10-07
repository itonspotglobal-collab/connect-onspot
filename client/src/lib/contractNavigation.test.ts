import { describe, expect, it } from "vitest";
import {
  CONTRACT_NAVIGATION_STATE_KEY,
  fallbackContractsLocation,
  getContractListLocation,
  getTrustedPreviousLocation,
  installContractNavigationTracker,
  markContractHistoryEntry,
} from "./contractNavigation";

const session = "document-session";
const origin = "https://onspot.test";

function createHistoryHarness(initialEntries: Array<{ url: string; state?: unknown }>, index: number) {
  const entries = initialEntries.map(({ url, state = null }) => ({ url: new URL(url, origin).href, state }));
  let currentIndex = index;
  const listeners = new Map<string, Set<() => void>>();
  const emit = (type: string) => listeners.get(type)?.forEach((listener) => listener());
  const currentUrl = () => new URL(entries[currentIndex].url);
  const fakeWindow = {
    get location() {
      return currentUrl();
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const callback = typeof listener === "function" ? listener as () => void : () => listener.handleEvent(new Event(type));
      const group = listeners.get(type) ?? new Set<() => void>();
      group.add(callback);
      listeners.set(type, group);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const callback = typeof listener === "function" ? listener as () => void : () => listener.handleEvent(new Event(type));
      listeners.get(type)?.delete(callback);
    },
    history: {
      get state() { return entries[currentIndex].state; },
      pushState(state: unknown, _title: string, url: string) {
        entries.splice(currentIndex + 1);
        entries.push({ url: new URL(url, currentUrl()).href, state });
        currentIndex += 1;
        emit("pushState");
      },
      replaceState(state: unknown, _title: string, url: string) {
        entries[currentIndex] = { url: new URL(url, currentUrl()).href, state };
        emit("replaceState");
      },
      back() {
        currentIndex = Math.max(0, currentIndex - 1);
        emit("popstate");
      },
      forward() {
        currentIndex = Math.min(entries.length - 1, currentIndex + 1);
        emit("popstate");
      },
    },
  };
  return { window: fakeWindow as unknown as Window, entries, current: () => entries[currentIndex] };
}

describe("contract navigation safety", () => {
  it("trusts an internal Talent-origin history entry in this document", () => {
    const state = markContractHistoryEntry({ existing: "preserved" }, {
      documentId: session,
      previousLocation: "/my-applications?status=active",
    });
    expect(state.existing).toBe("preserved");
    expect(getTrustedPreviousLocation(state, session, origin)).toBe("/my-applications?status=active");
  });

  it("keeps list query context when the detail entry is backed out of", () => {
    const detailState = markContractHistoryEntry({}, {
      documentId: session,
      previousLocation: "/contracts?status=executed&page=2",
    });
    const prior = getTrustedPreviousLocation(detailState, session, origin);
    expect(getContractListLocation("?id=contract-7&status=draft", prior)).toBe("/contracts?status=executed&page=2");
    expect(getContractListLocation("?id=contract-7&status=draft")).toBe("/contracts?status=draft");
    expect(getContractListLocation("?id=contract-7&offerId=offer-9")).toBe("/contracts");
  });

  it("rejects stale refresh markers and foreign history targets", () => {
    const oldDocument = markContractHistoryEntry({}, {
      documentId: "old-document",
      previousLocation: "/my-applications",
    });
    const foreign = markContractHistoryEntry({}, {
      documentId: session,
      previousLocation: "https://outside.test/",
    });
    expect(getTrustedPreviousLocation(oldDocument, session, origin)).toBeNull();
    expect(getTrustedPreviousLocation(foreign, session, origin)).toBeNull();
    expect(getTrustedPreviousLocation({ [CONTRACT_NAVIGATION_STATE_KEY]: { documentId: session, previousLocation: "//outside.test" } }, session, origin)).toBeNull();
  });

  it("chooses a safe role fallback", () => {
    expect(fallbackContractsLocation("talent")).toBe("/my-applications");
    expect(fallbackContractsLocation("client")).toBe("/clients");
    expect(fallbackContractsLocation("admin")).toBe("/admin/dashboard");
    expect(fallbackContractsLocation(null)).toBe("/my-applications");
  });

  it("preserves unrelated browser history state fields", () => {
    const state = markContractHistoryEntry({ modal: "open", router: { key: 4 } }, {
      documentId: session,
      previousLocation: null,
    });
    expect(state).toMatchObject({ modal: "open", router: { key: 4 } });
  });

  it("does not invent an internal predecessor when a direct/deep-linked entry is replaced", () => {
    const harness = createHistoryHarness([
      { url: "https://foreign.test/somewhere" },
      { url: "/contracts?id=contract-7" },
    ], 1);
    const uninstall = installContractNavigationTracker(harness.window);
    harness.window.history.replaceState(null, "", "/contracts");
    const marker = (harness.current().state as Record<string, unknown>)[CONTRACT_NAVIGATION_STATE_KEY] as { documentId: string };

    expect(getTrustedPreviousLocation(harness.current().state, marker.documentId, origin)).toBeNull();
    expect(fallbackContractsLocation("talent")).toBe("/my-applications");
    uninstall();
  });

  it("tracks push, preserves a true predecessor through replace, and restores entries on browser Back/Forward", () => {
    const harness = createHistoryHarness([{ url: "/my-applications?tab=active", state: { retained: "talent" } }], 0);
    const uninstall = installContractNavigationTracker(harness.window);
    const initialMarker = (harness.current().state as Record<string, unknown>)[CONTRACT_NAVIGATION_STATE_KEY] as { documentId: string };
    const documentId = initialMarker.documentId;

    harness.window.history.pushState(null, "", "/contracts?status=sent");
    expect(getTrustedPreviousLocation(harness.current().state, documentId, origin)).toBe("/my-applications?tab=active");
    harness.window.history.pushState(null, "", "/contracts?id=42&status=sent");
    expect(getTrustedPreviousLocation(harness.current().state, documentId, origin)).toBe("/contracts?status=sent");
    harness.window.history.replaceState(null, "", "/contracts?status=sent");
    expect(getTrustedPreviousLocation(harness.current().state, documentId, origin)).toBe("/contracts?status=sent");

    harness.window.history.back();
    expect(harness.current().url).toBe("https://onspot.test/contracts?status=sent");
    expect((harness.current().state as Record<string, unknown>).retained).toBeUndefined();
    expect(getTrustedPreviousLocation(harness.current().state, documentId, origin)).toBe("/my-applications?tab=active");
    harness.window.history.back();
    expect((harness.current().state as Record<string, unknown>).retained).toBe("talent");
    harness.window.history.forward();
    expect(getTrustedPreviousLocation(harness.current().state, documentId, origin)).toBe("/my-applications?tab=active");
    uninstall();
  });
});
