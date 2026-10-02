import jwt from "jsonwebtoken";
import { getClient } from "../db";
import { hashPassword } from "../auth-utils";
import { SignupError, SignupVerificationService } from "./signupVerificationService";
import { sendSignupVerificationEmail, verificationSender } from "./signupVerificationEmail";

export const signupVerificationRuntime = new SignupVerificationService({
  connect: getClient,
  hashPassword,
  hmacKey: () => process.env.EMAIL_VERIFICATION_HMAC_KEY!,
  assertConfigured() {
    if (!process.env.EMAIL_VERIFICATION_HMAC_KEY || Buffer.byteLength(process.env.EMAIL_VERIFICATION_HMAC_KEY) < 32
      || !process.env.JWT_SECRET || !process.env.MICROSOFT_TENANT_ID
      || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      throw new SignupError(503, "VERIFICATION_NOT_CONFIGURED", "Email verification is temporarily unavailable.");
    }
    verificationSender("client");
    verificationSender("talent");
  },
  send: sendSignupVerificationEmail,
  issueCredentials({ user, candidateId }) {
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    const talentToken = candidateId ? jwt.sign(
      { type: "candidate", candidateId, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "30d" },
    ) : null;
    return { token, candidateId, talentToken, userId: user.id, email: user.email, role: user.role,
      user: { id: user.id, email: user.email, username: user.username, first_name: user.first_name,
        last_name: user.last_name, role: user.role, company: user.company } };
  },
});