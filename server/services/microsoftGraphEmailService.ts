/**
 * Microsoft Graph Email Service
 * Sends transactional emails via Microsoft Graph API using client credentials OAuth.
 *
 * Required environment variables:
 *   MICROSOFT_TENANT_ID     — Azure AD tenant ID
 *   MICROSOFT_CLIENT_ID     — App registration client ID
 *   MICROSOFT_CLIENT_SECRET — App registration client secret (store as a Replit Secret)
 *   MICROSOFT_SENDER_EMAIL  — Sender UPN / shared mailbox address (e.g. careers@onspotglobal.com)
 *
 * Optional environment variables:
 *   APPLICATION_EMAIL_FROM       — Fallback sender address if MICROSOFT_SENDER_EMAIL is unset
 *   APPLICATION_EMAIL_FROM_NAME  — Display name for the sender (default: "OnSpot Careers")
 *   APPLICATION_EMAIL_REPLY_TO   — Reply-to address (default: same as sender)
 *
 * The app registration must have the Mail.Send *application* permission granted by a
 * tenant admin, and the sender address must be a licensed M365 mailbox or shared mailbox.
 */

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
  to: string;       // recipient email address
  toName?: string;  // recipient display name (optional)
  subject: string;
  bodyHtml: string;
  replyTo?: string; // override reply-to address
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

/** Send a single HTML email to an applicant via Microsoft Graph /sendMail. */
export async function sendApplicantEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const fromAddress = resolveSenderAddress();
    const fromName =
      process.env.APPLICATION_EMAIL_FROM_NAME ?? "OnSpot Careers";
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
 * Test Graph authentication and mailbox access without sending an email.
 * Fetches an access token, then calls GET /users/{sender} to verify the
 * mailbox is reachable with the current credentials.
 */
export async function testGraphAuth(): Promise<AuthTestResult> {
  let senderAddress: string | undefined;
  try {
    senderAddress = resolveSenderAddress();
    const accessToken = await getAccessToken();

    // Probe: read the mailbox user record — lightweight, non-destructive
    const probeUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderAddress)}?$select=id,displayName,mail,userPrincipalName`;
    const probeRes = await fetch(probeUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!probeRes.ok) {
      const text = await probeRes.text();
      return {
        success: false,
        graphStatus: probeRes.status,
        senderAddress,
        error: `Graph user probe failed (${probeRes.status}): ${text.slice(0, 400)}`,
      };
    }

    const user = (await probeRes.json()) as { displayName?: string; mail?: string };
    console.log(
      `[microsoftGraphEmailService] Auth test OK — mailbox: ${user.mail ?? senderAddress} (${user.displayName ?? "unknown"})`,
    );
    return { success: true, senderAddress, graphStatus: probeRes.status };
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
