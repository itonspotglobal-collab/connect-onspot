import { SignupError } from "./signupVerificationService";

export function verificationSender(role: "client" | "talent", env: NodeJS.ProcessEnv = process.env): string {
  const sender = (role === "talent"
    ? env.TALENT_VERIFICATION_EMAIL_FROM
    : env.CLIENT_VERIFICATION_EMAIL_FROM)?.trim().toLowerCase();
  // Exact role identity, not merely any allowed mailbox. No default fallback.
  const expected = role === "talent" ? "findwork@onspotglobal.com" : "hiretalent@onspotglobal.com";
  if (sender !== expected) throw new SignupError(503, "VERIFICATION_NOT_CONFIGURED", "Email verification is temporarily unavailable.");
  return sender;
}

export async function sendSignupVerificationEmail(input: {
  email: string; role: "client" | "talent"; code: string;
}): Promise<{ success: boolean }> {
  // Operator opt-in is required before any real UAT/delivery. Unit tests inject
  // transport directly; this is not an authentication bypass or fake success.
  if (process.env.SIGNUP_VERIFICATION_EMAIL_DELIVERY_ENABLED !== "true") return { success: false };
  const senderEmail = verificationSender(input.role);
  if (!/^\d{6}$/.test(input.code)) return { success: false };
  const { sendApplicantEmail } = await import("./microsoftGraphEmailService");
  const label = input.role === "talent" ? "Talent" : "Client";
  const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#25283d">
    <h1>Verify your OnSpot ${label} signup</h1>
    <p>Enter this code to finish creating or claiming your account:</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${input.code}</p>
    <p>This code expires in 10 minutes. Do not share it with anyone.</p>
    <p>If you did not request this signup, ignore this email.</p></div>`;
  const result = await sendApplicantEmail({
    to: input.email, subject: `Verify your OnSpot ${label} email`, bodyHtml,
    senderEmail, replyTo: senderEmail, redactErrors: true,
  });
  // Do not propagate raw provider errors, HTML or recipient data.
  return { success: result.success === true };
}