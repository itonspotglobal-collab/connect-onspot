import { SignupError } from "./signupVerificationService";
import { verificationSender } from "./signupVerificationEmail";

type ConfigStatus = "missing" | "too-short" | "valid" | "present" | "invalid" | boolean;
type DiagnosticLogger = (message: string, failures: Record<string, ConfigStatus>) => void;

/** Only fixed prerequisite names and statuses may enter the server log. */
export function assertSignupVerificationConfigured(
  env: NodeJS.ProcessEnv = process.env,
  log: DiagnosticLogger = (message, failures) => console.error(message, failures),
): void {
  const senderStatus = (role: "client" | "talent"): ConfigStatus => {
    try {
      verificationSender(role, env);
      return "valid";
    } catch {
      return "invalid";
    }
  };
  const hmac = env.EMAIL_VERIFICATION_HMAC_KEY;
  const statuses: Record<string, ConfigStatus> = {
    EMAIL_VERIFICATION_HMAC_KEY: !hmac ? "missing" : Buffer.byteLength(hmac) < 32 ? "too-short" : "valid",
    JWT_SECRET: env.JWT_SECRET ? "present" : "missing",
    MICROSOFT_TENANT_ID: env.MICROSOFT_TENANT_ID ? "present" : "missing",
    MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID ? "present" : "missing",
    MICROSOFT_CLIENT_SECRET: env.MICROSOFT_CLIENT_SECRET ? "present" : "missing",
    CLIENT_VERIFICATION_EMAIL_FROM: senderStatus("client"),
    TALENT_VERIFICATION_EMAIL_FROM: senderStatus("talent"),
    SIGNUP_VERIFICATION_EMAIL_DELIVERY_ENABLED: env.SIGNUP_VERIFICATION_EMAIL_DELIVERY_ENABLED === "true",
  };
  log("[signup-verification] CONFIGURATION", statuses);
  const failures = Object.fromEntries(
    Object.entries(statuses).filter(([, status]) => ["missing", "too-short", "invalid"].includes(String(status))),
  );
  if (Object.keys(failures).length) {
    throw new SignupError(503, "VERIFICATION_NOT_CONFIGURED", "Email verification is temporarily unavailable.");
  }
}