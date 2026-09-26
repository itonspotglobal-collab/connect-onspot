import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trackEvent", () => {
  it("is a no-op without a browser tracker", () => {
    expect(() => trackEvent("application_submitted")).not.toThrow();
  });

  it("passes event dimensions to the injected tracker", () => {
    const track = vi.fn();
    vi.stubGlobal("window", { umami: { track } });
    trackEvent("offer_responded", { action: "accept" });
    expect(track).toHaveBeenCalledWith("offer_responded", { action: "accept" });
  });

  it("does not interrupt a user action if analytics throws", () => {
    vi.stubGlobal("window", { umami: { track: () => { throw new Error("blocked"); } } });
    expect(() => trackEvent("contract_signed")).not.toThrow();
  });
});