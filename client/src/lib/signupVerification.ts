export interface SignupPendingState {
  success: false;
  pendingVerification: true;
  challengeId: string;
  role: "client" | "talent";
  maskedEmail: string;
  codeExpiresAt: string;
  resendAvailableAt: string;
  expiresAt: string;
  deliveryStatus: "accepted" | "failed";
}

export function isSignupPending(value: unknown): value is SignupPendingState {
  const state = value as Partial<SignupPendingState> | null;
  return !!state && state.pendingVerification === true
    && typeof state.challengeId === "string"
    && (state.role === "client" || state.role === "talent")
    && typeof state.maskedEmail === "string";
}

export async function signupStatus(): Promise<SignupPendingState | null> {
  const response = await fetch("/api/signup/status", { credentials: "same-origin" });
  if (response.status === 404) return null;
  const data = await response.json().catch(() => null);
  return response.ok && isSignupPending(data) ? data : null;
}

export async function cancelSignup(challengeId: string): Promise<void> {
  const response = await fetch("/api/signup/cancel", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId }),
  });
  if (!response.ok) throw new Error("Pending signup could not be safely cancelled.");
}

export function safeSignupReturnTo(value?: string): string | null {
  return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) ? value : null;
}

export function getRetrySeconds(response: Response, body: any): number {
  const header = response.headers.get("Retry-After") ?? body?.retryAfter;
  if (typeof header === "number" || /^\d+$/.test(String(header ?? ""))) return Math.max(0, Number(header));
  const date = Date.parse(String(header ?? ""));
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : 0;
}