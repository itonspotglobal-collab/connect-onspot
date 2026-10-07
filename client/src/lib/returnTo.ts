import { getSafeReturnTo } from "@shared/internalRedirect";

/** Build an authentication URL that carries the complete validated destination. */
export function buildLoginReturnUrl(
  destination: string,
  options: { loginPath?: string; portal?: "client" | "talent" } = {},
): string {
  const safeDestination = getSafeReturnTo(destination);
  const params = new URLSearchParams();
  if (options.portal) params.set("portal", options.portal);
  if (safeDestination) params.set("returnTo", safeDestination);
  const query = params.toString();
  return `${options.loginPath ?? "/login"}${query ? `?${query}` : ""}`;
}
