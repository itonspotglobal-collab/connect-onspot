import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { validatePasswordStrength } from "../../shared/passwordPolicy";
import { hasEmailOwnership } from "../lib/emailOwnership";
import { getSafeReturnTo } from "../../shared/internalRedirect";

export const signupDetailsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["client", "talent"]),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  password: z.string().max(128).optional(),
  username: z.string().trim().min(1).max(100).optional(),
  company: z.string().trim().max(200).optional(),
  returnTo: z.string().max(1024).optional(),
}).strict();

export interface SignupConnection {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  release(): void;
}
export interface SignupDependencies {
  connect(): Promise<SignupConnection>;
  hashPassword(value: string): Promise<string>;
  send(input: { email: string; role: "client" | "talent"; code: string }): Promise<{ success: boolean }>;
  issueCredentials(identity: any): any;
  assertConfigured(): void;
  hmacKey(): string;
  verificationRequired?(): boolean;
  assertDirectConfigured?(): void;
  now?: () => Date;
}
/** Fail closed: only the exact server-side value "false" enables the fallback. */
export function signupEmailVerificationRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SIGNUP_EMAIL_VERIFICATION_REQUIRED !== "false";
}
export class SignupError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const generateSignupCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export function signupCodeHmac(key: string, row: any, code: string): string {
  return createHmac("sha256", key).update(JSON.stringify([
    row.id, row.email, row.role, row.purpose, row.generation, code,
  ])).digest("hex");
}
export function safeSignupReturnTo(value?: string): string | null {
  return getSafeReturnTo(value);
}
const seconds = (date: Date, now: Date) => Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));

export class SignupVerificationService {
  constructor(private deps: SignupDependencies) {}
  private now() { return this.deps.now?.() ?? new Date(); }
  private async transaction<T>(work: (db: SignupConnection) => Promise<T>): Promise<T> {
    const db = await this.deps.connect();
    try {
      await db.query("BEGIN");
      const result = await work(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }
  private async budget(db: SignupConnection, kind: string, value: string, maximum: number, duration: number) {
    const now = this.now();
    const bucket = `${kind}:${sha256(value)}:${Math.floor(now.getTime() / duration)}`;
    const resets = new Date((Math.floor(now.getTime() / duration) + 1) * duration);
    const result = await db.query(
      `INSERT INTO signup_verification_limits(bucket, used, resets_at) VALUES ($1,1,$2)
       ON CONFLICT (bucket) DO UPDATE SET used = signup_verification_limits.used + 1
       WHERE signup_verification_limits.used < $3 RETURNING used`, [bucket, resets, maximum],
    );
    if (!result.rows.length) throw new SignupError(429, "RATE_LIMITED", "Please try again later.", seconds(resets, now));
  }
  private async emailSendBudget(db: SignupConnection, email: string) {
    await this.budget(db, "send-hour", email, 5, 3_600_000);
    await this.budget(db, "send-day", email, 10, 86_400_000);
  }
  private async lockEmail(db: SignupConnection, email: string) {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`signup-email:${email}`]);
  }
  private async lockCapability(db: SignupConnection, capability: string) {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`signup-capability:${sha256(capability)}`]);
  }
  private publicState(row: any) {
    const [local, domain] = row.email.split("@");
    return {
      success: false, pendingVerification: true, challengeId: row.id, role: row.role,
      maskedEmail: `${local.slice(0, 1)}***@${domain}`,
      codeExpiresAt: new Date(row.code_expires_at).toISOString(),
      resendAvailableAt: new Date(row.resend_available_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      deliveryStatus: row.delivery_status,
    };
  }
  private async send(row: any, code: string) {
    let success = false;
    try { success = (await this.deps.send({ email: row.email, role: row.role, code })).success === true; }
    catch { /* No provider exception, recipient or OTP is logged or returned. */ }
    const db = await this.deps.connect();
    try {
      const result = await db.query(
        `UPDATE pending_registrations SET delivery_status = $1
          WHERE id = $2 AND generation = $3 AND consumed_at IS NULL AND superseded_at IS NULL RETURNING *`,
        [success ? "accepted" : "failed", row.id, row.generation],
      );
      if (!result.rows[0]) throw new SignupError(409, "SUPERSEDED", "This verification request is no longer current.");
      return { status: success ? 202 : 503, body: {
        ...this.publicState(result.rows[0]),
        ...(!success && { error: "EMAIL_SEND_FAILED", message: "The verification email could not be sent. Please retry." }),
      } };
    } finally { db.release(); }
  }
  async start(raw: unknown, ip: string, oldCapability?: string,
    trusted: { purpose?: "talent_claim" | "provider"; provider?: { provider: string; subject: string } } = {}) {
    // This fallback is for fresh password registrations, never profile claiming
    // or provider identity linking, which still require ownership evidence.
    const direct = !trusted.purpose && this.deps.verificationRequired?.() === false;
    if (direct) this.deps.assertDirectConfigured?.();
    else this.deps.assertConfigured();
    const parsed = signupDetailsSchema.safeParse(raw);
    if (!parsed.success) throw new SignupError(400, "INVALID_SIGNUP", "Check your signup details.");
    const input = parsed.data;
    if (trusted.purpose !== "provider") {
      if (!input.password || !validatePasswordStrength(input.password).isValid) {
        throw new SignupError(400, "WEAK_PASSWORD", "Use a password meeting all signup requirements.");
      }
    }
    await this.transaction(db => this.budget(db, "start-ip", ip, 10, 3_600_000));
    if (direct) await this.transaction(db => this.emailSendBudget(db, input.email));
    const passwordHash = input.password ? await this.deps.hashPassword(input.password) : null;
    if (direct) {
      const identity = await this.transaction(async db => {
        await this.lockEmail(db, input.email);
        const result = await this.activate(db, {
          ...input, username: input.username ?? input.email, company: input.company ?? null,
          password_hash: passwordHash, purpose: "signup",
          context: { returnTo: safeSignupReturnTo(input.returnTo) },
        }, false);
        if (result.error) throw result.error;
        return result.identity;
      });
      // Share record creation and credentials with OTP activation; never
      // fabricate verified timestamps or issue credentials before COMMIT.
      return { status: 201, capability: "", body: {
        success: true, accountCreated: true, ...this.deps.issueCredentials(identity),
        returnTo: identity.returnTo,
      } };
    }
    const capability = oldCapability && /^[a-f0-9]{64}$/.test(oldCapability) ? oldCapability : randomBytes(32).toString("hex");
    const now = this.now();
    const row: any = {
      id: randomUUID(), email: input.email, role: input.role, purpose: trusted.purpose ?? "signup", generation: 1,
      code_expires_at: new Date(now.getTime() + 600_000),
      resend_available_at: new Date(now.getTime() + 60_000),
      expires_at: new Date(now.getTime() + 86_400_000), delivery_status: "sending",
    };
    const code = generateSignupCode();
    await this.transaction(async db => {
      await this.lockCapability(db, capability);
      await this.lockEmail(db, input.email);
      await this.emailSendBudget(db, input.email);
      const latest = await db.query(
        `SELECT resend_available_at FROM pending_registrations WHERE email = $1
         AND resend_available_at > $2 ORDER BY created_at DESC LIMIT 1`, [input.email, now],
      );
      if (latest.rows[0]) throw new SignupError(429, "RESEND_COOLDOWN", "Wait before requesting another code.",
        seconds(new Date(latest.rows[0].resend_available_at), now));
      await db.query(
        `UPDATE pending_registrations SET superseded_at = $2 WHERE capability_hash = $1
          AND consumed_at IS NULL AND superseded_at IS NULL`, [sha256(capability), now],
      );
      await db.query(
        `INSERT INTO pending_registrations
        (id,capability_hash,email,role,purpose,first_name,last_name,username,company,password_hash,context,
         code_hmac,generation,code_expires_at,resend_available_at,expires_at,delivery_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,$13,$14,$15,'sending')`,
        [row.id, sha256(capability), input.email, input.role, row.purpose, input.first_name, input.last_name,
          input.username ?? input.email, input.company ?? null, passwordHash,
          JSON.stringify({ returnTo: safeSignupReturnTo(input.returnTo), ...(trusted.provider && { provider: trusted.provider }) }),
          signupCodeHmac(this.deps.hmacKey(), row, code), row.code_expires_at, row.resend_available_at, row.expires_at],
      );
    });
    return { ...(await this.send(row, code)), capability };
  }
  private async pending(db: SignupConnection, capability: string, id?: string, lock = false) {
    if (!/^[a-f0-9]{64}$/.test(capability) || (id && !z.string().uuid().safeParse(id).success)) {
      throw new SignupError(404, "NO_PENDING_SIGNUP", "No pending signup was found.");
    }
    const result = await db.query(
      `SELECT * FROM pending_registrations WHERE capability_hash = $1 ${id ? "AND id = $2" : ""}
       ORDER BY created_at DESC LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      id ? [sha256(capability), id] : [sha256(capability)],
    );
    const row = result.rows[0];
    if (!row || row.consumed_at || row.superseded_at) throw new SignupError(409, "CHALLENGE_USED", "Start a new signup or sign in.");
    if (new Date(row.expires_at) <= this.now()) throw new SignupError(410, "REGISTRATION_EXPIRED", "Start signup again.");
    return row;
  }
  async status(capability: string) {
    const db = await this.deps.connect();
    try {
      const row = await this.pending(db, capability);
      if (this.deps.verificationRequired?.() === false && row.purpose === "signup") {
        throw new SignupError(404, "NO_PENDING_SIGNUP", "Start signup again or sign in.");
      }
      return this.publicState(row);
    }
    finally { db.release(); }
  }
  async cancel(capability: string, id: string) {
    await this.transaction(async db => {
      await this.lockCapability(db, capability);
      const row = await this.pending(db, capability, id, true);
      await db.query("UPDATE pending_registrations SET superseded_at = $2 WHERE id = $1", [row.id, this.now()]);
    });
  }
  async resend(capability: string, id: string, ip: string) {
    this.deps.assertConfigured();
    await this.transaction(db => this.budget(db, "resend-ip", ip, 20, 3_600_000));
    const code = generateSignupCode();
    const row = await this.transaction(async db => {
      await this.lockCapability(db, capability);
      const current = await this.pending(db, capability, id, true);
      await this.lockEmail(db, current.email);
      const now = this.now();
      if (new Date(current.resend_available_at) > now) throw new SignupError(429, "RESEND_COOLDOWN", "Wait before requesting another code.",
        seconds(new Date(current.resend_available_at), now));
      await this.emailSendBudget(db, current.email);
      const generation = current.generation + 1;
      const next = { ...current, generation };
      const result = await db.query(
        `UPDATE pending_registrations SET generation = $2, code_hmac = $3, incorrect_attempts = 0,
         code_expires_at = $4, resend_available_at = $5, delivery_status = 'sending' WHERE id = $1 RETURNING *`,
        [id, generation, signupCodeHmac(this.deps.hmacKey(), next, code), new Date(now.getTime() + 600_000),
          new Date(now.getTime() + 60_000)],
      );
      return result.rows[0];
    });
    return this.send(row, code);
  }
  async verify(capability: string, id: string, code: string, ip: string) {
    this.deps.assertConfigured();
    if (!/^\d{6}$/.test(code)) throw new SignupError(400, "INVALID_CODE", "Enter the six-digit code.");
    // Commit shared attempt budgets even if the challenge is expired/incorrect.
    await this.transaction(db => this.budget(db, "verify-ip", ip, 50, 900_000));
    await this.transaction(async db => {
      const current = await this.pending(db, capability, id);
      await this.budget(db, "verify-email", current.email, 20, 3_600_000);
    });
    const outcome = await this.transaction(async db => {
      await this.lockCapability(db, capability);
      const row = await this.pending(db, capability, id, true);
      await this.lockEmail(db, row.email);
      if (!["signup", "talent_claim", "provider"].includes(row.purpose)
        || (row.purpose === "talent_claim" && row.role !== "talent")) {
        throw new SignupError(400, "INVALID_CHALLENGE", "Invalid verification request.");
      }
      if (row.delivery_status !== "accepted") throw new SignupError(409, "EMAIL_NOT_SENT", "Retry sending the verification email.");
      if (new Date(row.code_expires_at) <= this.now()) throw new SignupError(410, "CODE_EXPIRED", "Request a new code.");
      if (row.incorrect_attempts >= 5) throw new SignupError(429, "ATTEMPTS_EXHAUSTED", "Request a new code.", 60);
      const expected = signupCodeHmac(this.deps.hmacKey(), row, code);
      const stored = Buffer.from(row.code_hmac, "hex");
      const correct = stored.length === 32 && timingSafeEqual(Buffer.from(expected, "hex"), stored);
      if (!correct) {
        await db.query("UPDATE pending_registrations SET incorrect_attempts = incorrect_attempts + 1 WHERE id = $1", [id]);
        return { error: new SignupError(400, "INCORRECT_CODE", "That code is incorrect.") };
      }
      const result = await this.activate(db, row);
      if (result.error) return result;
      await db.query("UPDATE pending_registrations SET consumed_at = $2 WHERE id = $1", [id, this.now()]);
      return { identity: result.identity };
    });
    if (outcome.error) throw outcome.error;
    // No token signing callback runs until transaction COMMIT has completed.
    return { success: true, ...this.deps.issueCredentials(outcome.identity), returnTo: outcome.identity.returnTo };
  }
  private async activate(db: SignupConnection, row: any, verified = true): Promise<{ error?: SignupError; identity?: any }> {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`signup-username:${row.username}`]);
    const existing = await db.query("SELECT * FROM users WHERE lower(trim(email)) = $1 FOR UPDATE", [row.email]);
    if (existing.rows.length > 1) throw new SignupError(409, "IDENTITY_CONFLICT", "This account needs administrator assistance.");
    let user = existing.rows[0];
    if (!verified && user) {
      return { error: new SignupError(409, "ACCOUNT_EXISTS", "An account already exists. Please sign in.") };
    }
    // A code proves inbox possession, not knowledge of an established password.
    if (user && (user.role !== row.role || user.email_verified_at || user.email_verification_required === false
      || await hasEmailOwnership((sql, values) => db.query(sql, values), { userId: user.id }))) {
      await db.query("UPDATE pending_registrations SET consumed_at = $2 WHERE id = $1", [row.id, this.now()]);
      return { error: new SignupError(409, "ACCOUNT_EXISTS", "An account already exists. Please sign in.") };
    }
    const conflicts = await db.query("SELECT id FROM users WHERE username = $1 AND id <> $2", [row.username, user?.id ?? ""]);
    if (conflicts.rows.length) throw new SignupError(409, "USERNAME_UNAVAILABLE", "Choose another username and restart signup.");
    let candidate: any;
    if (row.role === "talent") {
      const candidates = await db.query("SELECT * FROM candidates WHERE lower(trim(email)) = $1 FOR UPDATE", [row.email]);
      if (candidates.rows.length > 1) throw new SignupError(409, "IDENTITY_CONFLICT", "This profile needs administrator assistance.");
      candidate = candidates.rows[0];
      if (!verified && candidate) {
        // Without inbox proof, do not attach or overwrite an imported profile,
        // even if it has no password yet.
        throw new SignupError(409, "ACCOUNT_EXISTS", "A profile already exists. Please sign in or contact support.");
      }
      if (candidate && (
        (candidate.user_id && candidate.user_id !== user?.id)
        || (!candidate.user_id && (candidate.email_verified_at || candidate.email_verification_required === false
          || await hasEmailOwnership((sql, values) => db.query(sql, values), { candidateId: candidate.id })))
      )) {
        throw new SignupError(409, "ACCOUNT_EXISTS", "An account already exists. Please sign in.");
      }
      if (candidate && row.purpose === "talent_claim" && candidate.full_name?.trim()) {
        const parts = candidate.full_name.trim().split(/\s+/);
        row.first_name = candidate.first_name || parts[0];
        row.last_name = candidate.last_name || parts.slice(1).join(" ") || "Member";
      }
    }
    if (!user) {
      const created = await db.query(
        `INSERT INTO users(id,email,username,first_name,last_name,password_hash,company,role,
          email_verification_required,email_verified_at,email_verified_email,created_at,updated_at)
          VALUES ($1,$2::text,$3,$4,$5,$6,$7,$8,$10,$11::timestamptz,$12::text,$9::timestamptz,$9::timestamptz) RETURNING *`,
        [randomUUID(), row.email, row.username, row.first_name, row.last_name, row.password_hash, row.company, row.role,
          this.now(), verified, verified ? this.now() : null, verified ? row.email : null],
      );
      user = created.rows[0];
    } else {
      const claimed = await db.query(
        `UPDATE users SET password_hash = $2, email_verified_at = $3::timestamptz, email_verified_email = $4,
          email_verification_required = true, updated_at = $3::timestamptz WHERE id = $1 RETURNING *`,
        [user.id, row.password_hash, this.now(), row.email],
      );
      user = claimed.rows[0];
    }
    if (row.role === "client") {
      await db.query(
        `INSERT INTO client_profiles(id,user_id,company_name,contact_person,email)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO NOTHING`,
        [randomUUID(), user.id, row.company, `${row.first_name} ${row.last_name}`, row.email],
      );
    } else {
      await db.query(
        `INSERT INTO profiles(id,user_id,first_name,last_name,location,rate_currency,languages,timezone)
         VALUES ($1,$2,$3,$4,'Global','USD',ARRAY['English'],'UTC') ON CONFLICT (user_id) DO NOTHING`,
        [randomUUID(), user.id, row.first_name, row.last_name],
      );
      if (candidate) {
        await db.query(
          `UPDATE candidates SET user_id = $2, password_hash = $3, account_created = true WHERE id = $1`,
          [candidate.id, user.id, row.password_hash],
        );
      } else {
        const created = await db.query(
          `INSERT INTO candidates(full_name,email,password_hash,user_id,account_created,email_verification_required)
           VALUES ($1,$2,$3,$4,true,$5) RETURNING id`,
          [`${row.first_name} ${row.last_name}`, row.email, row.password_hash, user.id, verified],
        );
        candidate = created.rows[0];
      }
    }
    if (row.purpose === "provider") {
      const provider = row.context.provider;
      if (!provider || !["google", "linkedin", "replit"].includes(provider.provider) || !provider.subject) {
        throw new SignupError(400, "INVALID_PROVIDER", "Restart provider sign-in.");
      }
      await db.query("INSERT INTO auth_provider_links(provider,subject,user_id) VALUES ($1,$2,$3)",
        [provider.provider, provider.subject, user.id]);
    }
    return { identity: { user, candidateId: candidate?.id ?? null, returnTo: safeSignupReturnTo(row.context.returnTo) } };
  }
}