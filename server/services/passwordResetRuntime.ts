import { getClient } from "../db";
import { hashPassword } from "../auth-utils";
import { PasswordResetError, PasswordResetService } from "./passwordResetService";
import { sendPasswordResetEmail } from "./passwordResetEmail";
import { verificationSender } from "./signupVerificationEmail";

export const passwordResetRuntime = new PasswordResetService({
  connect: getClient, hashPassword, send: sendPasswordResetEmail,
  hmacKey: () => process.env.EMAIL_VERIFICATION_HMAC_KEY!,
  assertConfigured() {
    if (process.env.PASSWORD_RESET_EMAIL_DELIVERY_ENABLED !== "true"
      || !process.env.EMAIL_VERIFICATION_HMAC_KEY || process.env.EMAIL_VERIFICATION_HMAC_KEY.length < 32
      || !["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID"].every(key => !!process.env[key])) {
      throw new PasswordResetError(503, "Password reset is temporarily unavailable.");
    }
    verificationSender("client");
    verificationSender("talent");
  },
});
