/** Honor the server's complete delay; signup defaults to a one-hour window. */
export function signupRetryDelayMs(
  retryAfter: unknown,
  nowMs = Date.now(),
  fallbackMs = 60 * 60 * 1000,
): number {
  if (typeof retryAfter === "number" || (typeof retryAfter === "string" && retryAfter.trim())) {
    const seconds = Number(retryAfter);
    const delayMs = Math.ceil(seconds) * 1000;
    if (seconds >= 0 && Number.isSafeInteger(delayMs)) {
      return Math.max(1000, delayMs);
    }

    if (typeof retryAfter === "string" && /[a-z]/i.test(retryAfter)) {
      const deadline = Date.parse(retryAfter);
      if (Number.isFinite(deadline)) return Math.max(1000, deadline - nowMs);
    }
  }
  return fallbackMs;
}