import jwt from "jsonwebtoken";
import { getClient } from "../db";
import { hashPassword } from "../auth-utils";
import { SignupError, SignupVerificationService, signupEmailVerificationRequired } from "./signupVerificationService";
import { sendSignupVerificationEmail } from "./signupVerificationEmail";
import { assertSignupVerificationConfigured } from "./signupVerificationConfig";

export const signupVerificationRuntime = new SignupVerificationService({
  connect: getClient,
  hashPassword,
  hmacKey: () => process.env.EMAIL_VERIFICATION_HMAC_KEY!,
  assertConfigured: assertSignupVerificationConfigured,
  verificationRequired: signupEmailVerificationRequired,
  assertDirectConfigured() {
    if (!process.env.JWT_SECRET) {
      throw new SignupError(503, "AUTH_NOT_CONFIGURED", "Signup is temporarily unavailable.");
    }
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