import { describe, expect, it } from "vitest";
import {
  applicationsFooterRouteForRole,
  notificationRouteForRole,
} from "@/lib/notificationRouting";

describe("notificationRouteForRole", () => {
  it("routes Admin application notifications to the Admin applications list", () => {
    expect(notificationRouteForRole("job_application_received", "admin", "/client-profile")).toBe(
      "/admin/job-applications",
    );
  });

  it("does not route Admin application notifications to the dashboard", () => {
    expect(notificationRouteForRole("job_application_received", "admin", "/client-profile")).not.toBe("/dashboard");
  });

  it.each(["job_pending", "job_approved", "job_rejected"])(
    "routes Admin %s job approval notifications to Admin Find Work",
    (type) => {
      expect(notificationRouteForRole(type, "admin", "/client-profile")).toBe("/admin/find-work");
    },
  );

  it("preserves Client application notification routing", () => {
    expect(notificationRouteForRole("job_application_received", "client", "/client-profile")).toBe("/client-profile");
  });

  it("preserves Talent application notification routing", () => {
    expect(notificationRouteForRole("job_application_status_changed", "talent", "/my-applications")).toBe(
      "/my-applications",
    );
  });

  it("routes the Admin View applications footer to the Admin applications list", () => {
    expect(applicationsFooterRouteForRole("admin", false)).toBe("/admin/job-applications");
  });

  it("preserves Client and Talent footer destinations", () => {
    expect(applicationsFooterRouteForRole("client", false)).toBe("/client-profile");
    expect(applicationsFooterRouteForRole("talent", true)).toBe("/my-applications");
  });
});