import { describe, expect, it } from "vitest";
import {
  applicationsFooterRouteForRole,
  CLIENT_NOTIFICATION_TYPES,
  clientNotificationModalKind,
  currentInterviewSchedule,
  notificationRouteForRole,
  TALENT_NOTIFICATION_TYPES,
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

  it("routes Admin Client application updates to Admin Find Work", () => {
    expect(
      notificationRouteForRole(
        "client_application_status_changed",
        "admin",
        "/admin/job-applications",
      ),
    ).toBe("/admin/find-work");
  });

  it("does not route Admin Client application updates to Admin applications", () => {
    expect(
      notificationRouteForRole(
        "client_application_status_changed",
        "admin",
        "/admin/job-applications",
      ),
    ).not.toBe("/admin/job-applications");
  });

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

describe("Client notification detail modal routing", () => {
  it("includes the two update types for Client notifications only", () => {
    expect(CLIENT_NOTIFICATION_TYPES).toContain("talent_invitation_accepted");
    expect(CLIENT_NOTIFICATION_TYPES).toContain("interview_reschedule_proposed");
    expect(TALENT_NOTIFICATION_TYPES).not.toContain("talent_invitation_accepted");
    expect(TALENT_NOTIFICATION_TYPES).not.toContain("interview_reschedule_proposed");
  });

  it("uses the current Client proposal instead of an older Talent proposal", () => {
    expect(
      currentInterviewSchedule({
        proposedTimes: [{ start: "2030-09-09T00:00:00.000Z", timezone: "Asia/Singapore" }],
        proposals: [
          {
            proposerRole: "client",
            proposedTimes: [{ start: "2030-09-07T00:00:00.000Z", timezone: "Asia/Singapore" }],
          },
          {
            proposerRole: "talent",
            proposedTimes: [{ start: "2030-09-08T00:00:00.000Z", timezone: "Asia/Singapore" }],
          },
          {
            proposerRole: "client",
            proposedTimes: [{ start: "2030-09-09T00:00:00.000Z", timezone: "Asia/Singapore" }],
          },
        ],
      }),
    ).toEqual({
      current: { start: "2030-09-09T00:00:00.000Z", timezone: "Asia/Singapore" },
      previous: { start: "2030-09-08T00:00:00.000Z", timezone: "Asia/Singapore" },
      prefix: "Client proposed",
    });
  });

  it("opens the acceptance modal only for a Client submission notification", () => {
    expect(
      clientNotificationModalKind(
        "talent_invitation_accepted",
        "client",
        "job_submission",
        "submission-1",
      ),
    ).toBe("invitation_acceptance");
    expect(
      clientNotificationModalKind(
        "talent_invitation_accepted",
        "talent",
        "job_submission",
        "submission-1",
      ),
    ).toBeNull();
    expect(
      clientNotificationModalKind(
        "talent_invitation_accepted",
        "client",
        "interview",
        "submission-1",
      ),
    ).toBeNull();
  });

  it("opens the reschedule modal only for a Client interview notification", () => {
    expect(
      clientNotificationModalKind(
        "interview_reschedule_proposed",
        "client",
        "interview",
        "interview-1",
      ),
    ).toBe("interview_reschedule");
    expect(
      clientNotificationModalKind(
        "interview_reschedule_proposed",
        "admin",
        "interview",
        "interview-1",
      ),
    ).toBeNull();
    expect(
      clientNotificationModalKind(
        "interview_reschedule_proposed",
        "client",
        "interview",
        null,
      ),
    ).toBeNull();
  });
});