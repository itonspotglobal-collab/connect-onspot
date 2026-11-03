import { verificationSender } from "./signupVerificationEmail";

type Transport = (input: {
  to: string; subject: string; bodyHtml: string; senderEmail: string; replyTo: string; redactErrors: true;
}) => Promise<{ success: boolean }>;
export async function sendPasswordResetEmail(input: {
  email: string; role: "client" | "talent"; code: string;
}, transport?: Transport, env: NodeJS.ProcessEnv = process.env): Promise<{ success: boolean }> {
  if (env.PASSWORD_RESET_EMAIL_DELIVERY_ENABLED !== "true" || !/^\d{6}$/.test(input.code)) return { success: false };
  const sender = verificationSender(input.role, env);
  const send = transport ?? (await import("./microsoftGraphEmailService")).sendApplicantEmail;
  const result = await send({
    to: input.email, senderEmail: sender, replyTo: sender, redactErrors: true,
    subject: "Your OnSpot password reset code",
    bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#25283d">
      <h1>Reset your OnSpot password</h1><p>Enter this code to choose a new password:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${input.code}</p>
      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
      <p>If you didn't request this, ignore this email — your password will not change.</p></div>`,
  });
  return { success: result.success === true };
}
