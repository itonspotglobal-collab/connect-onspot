import { describe, expect, it } from "vitest";
import { getSafeReturnTo } from "@shared/internalRedirect";
import { buildLoginReturnUrl } from "./returnTo";

describe("authenticated deep-link return flow", () => {
  it("retains the full internal path, query, and hash through login", () => {
    const url = buildLoginReturnUrl("/my-applications?offerId=offer-7&tab=history#offer", {
      loginPath: "/portal-login",
      portal: "talent",
    });
    const parsed = new URL(url, "https://connect.onspotglobal.com");
    expect(parsed.pathname).toBe("/portal-login");
    expect(parsed.searchParams.get("portal")).toBe("talent");
    expect(parsed.searchParams.get("returnTo")).toBe("/my-applications?offerId=offer-7&tab=history#offer");
  });

  it("routes admin guards to the admin credential screen without dropping the resource selector", () => {
    const url = buildLoginReturnUrl("/admin/job-applications?applicationId=app-11", {
      loginPath: "/admin/login",
    });
    const parsed = new URL(url, "https://connect.onspotglobal.com");
    expect(parsed.pathname).toBe("/admin/login");
    expect(parsed.searchParams.get("returnTo")).toBe("/admin/job-applications?applicationId=app-11");
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "javascript:alert(1)",
    "/\\evil.example",
    "/%5cevil.example",
    "/%250d%250aLocation:%20evil",
  ])("rejects unsafe returnTo %s", (value) => {
    expect(getSafeReturnTo(value)).toBeNull();
    expect(buildLoginReturnUrl(value)).toBe("/login");
  });

  it("allows known internal resource destinations", () => {
    expect(getSafeReturnTo("/contracts/contract-123")).toBe("/contracts/contract-123");
    expect(getSafeReturnTo("/my-applications?interviewId=it-2&applicationId=app-8"))
      .toBe("/my-applications?interviewId=it-2&applicationId=app-8");
  });
});
