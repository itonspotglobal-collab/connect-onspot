/**
 * Microsoft Graph Email Service
 * Sends transactional emails via Microsoft Graph API using client credentials OAuth.
 *
 * Required environment variables:
 *   MICROSOFT_TENANT_ID     — Azure AD tenant ID
 *   MICROSOFT_CLIENT_ID     — App registration client ID
 *   MICROSOFT_CLIENT_SECRET — App registration client secret (store as a Replit Secret)
 *   MICROSOFT_SENDER_EMAIL  — Default sender UPN / shared mailbox (e.g. careers@onspotglobal.com)
 *
 * Optional environment variables:
 *   APPLICATION_EMAIL_FROM       — Fallback sender address if MICROSOFT_SENDER_EMAIL is unset
 *   APPLICATION_EMAIL_FROM_NAME  — Display name for the default sender (default: "OnSpot Careers")
 *   APPLICATION_EMAIL_REPLY_TO   — Reply-to address (default: same as sender)
 *
 * The app registration must have the Mail.Send *application* permission granted by a
 * tenant admin, and the sender address must be a licensed M365 mailbox or shared mailbox.
 * One Graph app with Mail.Send can send from any of the allowed mailboxes — no separate
 * client IDs are required.
 */

import {
  buildEmailContext,
  renderApplicantEmail,
  renderBrandedEmailLayout,
} from "./emailVariableResolver";

/**
 * Server-side allowlist of permitted sender mailboxes.
 * The frontend may know these addresses, but never accepts arbitrary values —
 * any senderEmail not in this map is rejected and replaced with the default.
 */
export const ALLOWED_SENDERS: Record<string, string> = {
  "careers@onspotglobal.com":    "OnSpot Careers",
  "findwork@onspotglobal.com":   "OnSpot Find Work",
  "hiretalent@onspotglobal.com": "OnSpot Hire Talent",
};

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let _tokenCache: TokenCache | null = null;

/** Fetch (or return cached) OAuth2 client_credentials access token from Microsoft identity platform. */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.accessToken;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Graph email not configured — MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET must be set.",
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    // Strip any credential echoes from the error body before logging/throwing
    const safe = text.replace(clientSecret, "[REDACTED]").slice(0, 500);
    throw new Error(`Microsoft Graph token fetch failed (${res.status}): ${safe}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return _tokenCache.accessToken;
}

/** Resolve the configured sender address. MICROSOFT_SENDER_EMAIL takes precedence. */
function resolveSenderAddress(): string {
  const addr =
    process.env.MICROSOFT_SENDER_EMAIL ||
    process.env.APPLICATION_EMAIL_FROM ||
    "";
  if (!addr) {
    throw new Error(
      "Sender address not configured — set MICROSOFT_SENDER_EMAIL (e.g. careers@onspotglobal.com).",
    );
  }
  return addr;
}

export interface SendEmailOptions {
  to: string;          // recipient email address
  toName?: string;     // recipient display name (optional)
  subject: string;
  bodyHtml: string;
  replyTo?: string;    // override reply-to address
  /** Sender mailbox — must be a key in ALLOWED_SENDERS; ignored/defaulted if not in the allowlist. */
  senderEmail?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export interface OrganizationInvitationEmailOptions {
  to: string;
  organizationName: string;
  inviterName: string;
  signInUrl: string;
  recipientName?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Send the email that brings a Client into an organization invitation flow.
 * The sign-in URL deliberately carries the pending-invitations return path so
 * both existing and new accounts land in the same place after authentication.
 */
export async function sendOrganizationInvitationEmail(
  opts: OrganizationInvitationEmailOptions,
): Promise<SendEmailResult> {
  const safeOrganizationName = escapeHtml(opts.organizationName);
  const safeInviterName = escapeHtml(opts.inviterName);
  const safeSignInUrl = escapeHtml(opts.signInUrl);
  const greeting = opts.recipientName?.trim()
    ? `Hi ${escapeHtml(opts.recipientName.trim())},`
    : "Hello,";
  const subject = `${opts.inviterName} invited you to join ${opts.organizationName} on OnSpot`;
  const contentHtml = `
  <h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">You&apos;re invited to join an OnSpot organization</h1>
  <p style="color:#444;font-size:15px;margin:12px 0;">${greeting}</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    <strong>${safeInviterName}</strong> invited you to join
    <strong>${safeOrganizationName}</strong> as a Client team member.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    Sign in or create your free Client account to review the invitation. We&apos;ll take you
    directly to your pending organization invitations after you authenticate.
  </p>
  <p style="margin:26px 0 20px;">
    <a href="${safeSignInUrl}"
       style="background:#6d5ef7;color:#fff;padding:13px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
      Review organization invitation
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
    If you weren&apos;t expecting this invitation, you can safely ignore this email.
  </p>
`.trim();

  const rendered = renderApplicantEmail(
    {
      subject,
      bodyHtml: renderBrandedEmailLayout(contentHtml),
    },
    buildEmailContext({
      applicantName: opts.recipientName ?? undefined,
      email: opts.to,
    }),
  );
  if (rendered.unresolvedKeys.length > 0) {
    return {
      success: false,
      error: `Invitation email template could not be rendered: ${rendered.unresolvedKeys.join(", ")}`,
    };
  }

  return sendApplicantEmail({
    to: opts.to,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  });
}

/** Send a single HTML email to an applicant via Microsoft Graph /sendMail. */
export async function sendApplicantEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // If a senderEmail is supplied and is in the allowlist, use it; otherwise fall back to config.
    const fromAddress =
      opts.senderEmail && ALLOWED_SENDERS[opts.senderEmail]
        ? opts.senderEmail
        : resolveSenderAddress();
    const fromName =
      ALLOWED_SENDERS[fromAddress] ??
      process.env.APPLICATION_EMAIL_FROM_NAME ??
      "OnSpot Careers";
    const replyTo = opts.replyTo ?? process.env.APPLICATION_EMAIL_REPLY_TO ?? fromAddress;

    const accessToken = await getAccessToken();

    const messagePayload: Record<string, any> = {
      subject: opts.subject,
      body: {
        contentType: "HTML",
        content: opts.bodyHtml,
      },
      toRecipients: [
        {
          emailAddress: {
            address: opts.to,
            ...(opts.toName ? { name: opts.toName } : {}),
          },
        },
      ],
      from: {
        emailAddress: {
          address: fromAddress,
          name: fromName,
        },
      },
      replyTo: [{ emailAddress: { address: replyTo } }],
    };

    // Send via the shared mailbox's sendMail endpoint
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromAddress)}/sendMail`;
    const res = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: messagePayload, saveToSentItems: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph /sendMail failed (${res.status}): ${text.slice(0, 400)}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[microsoftGraphEmailService] sendApplicantEmail error:", err.message);
    return { success: false, error: err.message };
  }
}

export interface AuthTestResult {
  success: boolean;
  /** Graph HTTP status returned by the mailbox read probe (202 on sendMail success, etc.) */
  graphStatus?: number;
  /** Safe error description — no credentials */
  error?: string;
  senderAddress?: string;
}

/**
 * Test Graph authentication without sending an email.
 * Acquires a client_credentials OAuth2 token — if that succeeds, the
 * tenant/client/secret are valid and Mail.Send can be exercised.
 * No additional Graph API call is made (probing user or mailbox endpoints
 * requires permissions beyond Mail.Send and would give false negatives).
 */
export async function testGraphAuth(): Promise<AuthTestResult> {
  let senderAddress: string | undefined;
  try {
    senderAddress = resolveSenderAddress();

    // Acquire token — validates MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID,
    // and MICROSOFT_CLIENT_SECRET against the Microsoft identity platform.
    await getAccessToken();

    console.log(
      `[microsoftGraphEmailService] Auth test OK — token acquired for tenant, sender: ${senderAddress}`,
    );
    // graphStatus 200 signals token acquisition succeeded (no separate API probe)
    return { success: true, senderAddress, graphStatus: 200 };
  } catch (err: any) {
    console.error("[microsoftGraphEmailService] testGraphAuth error:", err.message);
    return { success: false, senderAddress, error: err.message };
  }
}

/** Returns true if all required environment variables for Graph email are present. */
export function isEmailServiceConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    (process.env.MICROSOFT_SENDER_EMAIL || process.env.APPLICATION_EMAIL_FROM)
  );
}
