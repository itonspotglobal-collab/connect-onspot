/**
 * Microsoft Graph Email Service
 * Sends transactional emails via Microsoft Graph API using client credentials OAuth.
 * Requires environment variables:
 *   MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 *   APPLICATION_EMAIL_FROM (sender UPN / shared mailbox address)
 *   APPLICATION_EMAIL_FROM_NAME (display name, optional)
 *   APPLICATION_EMAIL_REPLY_TO (reply-to address, optional)
 */

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.accessToken;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph email not configured — MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET must be set.");
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
    throw new Error(`Microsoft Graph token fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return _tokenCache.accessToken;
}

export interface SendEmailOptions {
  to: string;           // recipient email address
  toName?: string;      // recipient display name
  subject: string;
  bodyHtml: string;
  replyTo?: string;     // override reply-to
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendApplicantEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const fromAddress = process.env.APPLICATION_EMAIL_FROM;
    if (!fromAddress) {
      throw new Error("APPLICATION_EMAIL_FROM is not set.");
    }

    const fromName = process.env.APPLICATION_EMAIL_FROM_NAME ?? "OnSpot Talent";
    const replyTo = opts.replyTo ?? process.env.APPLICATION_EMAIL_REPLY_TO;

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
    };

    if (replyTo) {
      messagePayload.replyTo = [
        { emailAddress: { address: replyTo } },
      ];
    }

    // Send via Graph API using the /sendMail endpoint on behalf of the shared mailbox
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
    console.error("microsoftGraphEmailService.sendApplicantEmail error:", err.message);
    return { success: false, error: err.message };
  }
}

/** Returns true if the Graph email service appears to be configured. */
export function isEmailServiceConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.APPLICATION_EMAIL_FROM
  );
}
