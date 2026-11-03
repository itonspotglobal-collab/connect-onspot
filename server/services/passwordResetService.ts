import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { validatePasswordStrength } from "../../shared/passwordPolicy";
import { generateSignupCode, type SignupConnection } from "./signupVerificationService";

export const RESET_REQUEST_MESSAGE = "If an account exists for that email, we've sent a 6-digit code.";
export const RESET_INVALID_CODE_MESSAGE = "That code is invalid or has expired.";
const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const resetRequestSchema = z.object({
  email: emailSchema, role: z.enum(["client", "talent"]).optional(),
}).strict();
const confirmSchema = z.object({
  email: emailSchema, code: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().max(128), confirmPassword: z.string().max(128),
}).strict();
type Role = "client" | "talent";
type Challenge = { id: string; email: string; role: Role; code_hmac: string; attempts: number };
export class PasswordResetError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function passwordResetHmac(key: string, row: Pick<Challenge, "id" | "email" | "role">, code: string) {
  return createHmac("sha256", key).update(JSON.stringify(["password-reset", row.id, row.email, row.role, code])).digest("hex");
}
interface Dependencies {
  connect(): Promise<SignupConnection>;
  hashPassword(password: string): Promise<string>;
  hmacKey(): string;
  assertConfigured(): void;
  send(input: { email: string; role: Role; code: string }): Promise<{ success: boolean }>;
  now?(): Date;
}

export class PasswordResetService {
  constructor(private deps: Dependencies) {}
  private now() { return this.deps.now?.() ?? new Date(); }
  private async transaction<T>(fn: (db: SignupConnection) => Promise<T>): Promise<T> {
    const db = await this.deps.connect();
    try {
      await db.query("BEGIN");
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }
  private lock(db: SignupConnection, email: string) {
    return db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`password-reset:${email}`]);
  }
  private async budget(db: SignupConnection, kind: string, value: string, max: number, duration: number) {
    const now = this.now();
    const hash = createHash("sha256").update(value).digest("hex");
    const bucket = `password-reset:${kind}:${hash}:${Math.floor(now.getTime() / duration)}`;
    return (await db.query(`INSERT INTO signup_verification_limits(bucket,used,resets_at) VALUES ($1,1,$2)
      ON CONFLICT (bucket) DO UPDATE SET used=signup_verification_limits.used+1
      WHERE signup_verification_limits.used < $3 RETURNING used`,
    [bucket, new Date((Math.floor(now.getTime() / duration) + 1) * duration), max])).rows.length > 0;
  }
  private async ipBudget(ip: string, confirm = false) {
    const allowed = await this.transaction(db => this.budget(db, confirm ? "confirm-ip" : "request-ip",
      ip, confirm ? 50 : 20, confirm ? 900_000 : 3_600_000));
    if (!allowed) throw new PasswordResetError(429, "Too many password reset attempts. Please try again later.");
  }
  async request(raw: unknown, ip: string) {
    const parsed = resetRequestSchema.safeParse(raw);
    if (!parsed.success) throw new PasswordResetError(400, "Please enter a valid email address and portal.");
    await this.ipBudget(ip);
    const { email, role: preferred } = parsed.data;
    const prepared = await this.transaction(async db => {
      await this.lock(db, email);
      const now = this.now();
      const cooldown = await db.query(`INSERT INTO signup_verification_limits(bucket,used,resets_at) VALUES ($1,1,$2)
        ON CONFLICT (bucket) DO UPDATE SET used=1,resets_at=EXCLUDED.resets_at
        WHERE signup_verification_limits.resets_at <= $3 RETURNING used`,
      [`password-reset:cooldown:${createHash("sha256").update(email).digest("hex")}`, new Date(now.getTime() + 60_000), now]);
      if (!cooldown.rows.length || !await this.budget(db, "email-hour", email, 5, 3_600_000)) return null;
      const users = (await db.query("SELECT role FROM users WHERE lower(trim(email))=$1", [email])).rows;
      const candidates = (await db.query("SELECT id FROM candidates WHERE lower(trim(email))=$1", [email])).rows;
      const roles = new Set<Role>();
      for (const user of users) {
        if (user.role === "client" || user.role === "admin") roles.add("client");
        if (user.role === "talent") roles.add("talent");
      }
      if (candidates.length) roles.add("talent");
      if (!roles.size) return null;
      const role: Role = users.some(u => u.role === "admin") ? "client"
        : preferred && roles.has(preferred) ? preferred : roles.has("client") ? "client" : "talent";
      // Availability is not exposed through an account-dependent HTTP error.
      try { this.deps.assertConfigured(); } catch {
        console.warn("[password-reset] CONFIGURATION_UNAVAILABLE");
        return null;
      }
      const row = { id: randomUUID(), email, role };
      const code = generateSignupCode();
      await db.query("UPDATE password_reset_codes SET used_at=$2 WHERE email=$1 AND used_at IS NULL", [email, now]);
      await db.query(`INSERT INTO password_reset_codes(id,email,role,code_hmac,expires_at,created_at)
        VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.id, email, role, passwordResetHmac(this.deps.hmacKey(), row, code), new Date(now.getTime() + 600_000), now]);
      return { row, code };
    });
    if (prepared) {
      let delivered = false;
      try { delivered = (await this.deps.send({ ...prepared.row, code: prepared.code })).success === true; }
      catch { /* Never log provider errors, recipients or codes. */ }
      if (!delivered) {
        await this.transaction(db => db.query("UPDATE password_reset_codes SET used_at=$2 WHERE id=$1 AND used_at IS NULL",
          [prepared.row.id, this.now()]));
        console.warn("[password-reset] EMAIL_DELIVERY_FAILED");
      }
    }
    return { success: true, message: RESET_REQUEST_MESSAGE };
  }
  async confirm(raw: unknown, ip: string) {
    const parsed = confirmSchema.safeParse(raw);
    if (!parsed.success) throw new PasswordResetError(400, RESET_INVALID_CODE_MESSAGE);
    const { email, code, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword) throw new PasswordResetError(400, "Passwords don't match.");
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) throw new PasswordResetError(400, strength.errors.join(" "));
    await this.ipBudget(ip, true);
    this.deps.assertConfigured();
    const accepted = await this.transaction(async db => {
      await this.lock(db, email);
      const now = this.now();
      const row: Challenge | undefined = (await db.query(`SELECT * FROM password_reset_codes
        WHERE email=$1 AND used_at IS NULL AND expires_at>$2 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`, [email, now])).rows[0];
      if (!row || row.attempts >= 5) return false;
      const expected = Buffer.from(passwordResetHmac(this.deps.hmacKey(), row, code), "hex");
      const actual = Buffer.from(row.code_hmac, "hex");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await db.query(`UPDATE password_reset_codes SET attempts=attempts+1,
          used_at=CASE WHEN attempts+1 >= 5 THEN $2 ELSE used_at END WHERE id=$1`, [row.id, now]);
        return false; // Commit the failed attempt, rather than rolling it back.
      }
      const hash = await this.deps.hashPassword(newPassword);
      const users = await db.query("UPDATE users SET password_hash=$1,updated_at=$3 WHERE lower(trim(email))=$2 RETURNING id", [hash, email, now]);
      const candidates = await db.query("UPDATE candidates SET password_hash=$1 WHERE lower(trim(email))=$2 RETURNING id", [hash, email]);
      await db.query("UPDATE password_reset_codes SET used_at=$2 WHERE email=$1 AND used_at IS NULL", [email, now]);
      return users.rows.length + candidates.rows.length > 0;
    });
    if (!accepted) throw new PasswordResetError(400, RESET_INVALID_CODE_MESSAGE);
    return { success: true, message: "Password updated. Please sign in." };
  }
}
