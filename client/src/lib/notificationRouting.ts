export function notificationRouteForRole(
  type: string,
  role: string | null | undefined,
  existingRoute: string | null,
): string | null {
  if (role === "admin") {
    if (type === "job_application_received") return "/admin/job-applications";
    if (["job_pending", "job_approved", "job_rejected"].includes(type)) {
      return "/admin/find-work";
    }
  }
  return existingRoute;
}

export function applicationsFooterRouteForRole(
  role: string | null | undefined,
  isTalent: boolean,
): string {
  if (isTalent) return "/my-applications";
  return role === "admin" ? "/admin/job-applications" : "/client-profile";
}