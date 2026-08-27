/**
 * Applicant email template rendering.
 *
 * This is the single interpolation boundary for applicant email subjects and
 * HTML. The renderer never fabricates text around a replacement value and it
 * reports every unresolved token so callers can block delivery safely.
 */
import { htmlToPlainText } from "../lib/htmlToPlainText.js";

export interface EmailVariableContext {
  applicantFirstName?: string;
  applicantLastName?: string;
  applicantFullName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobLocation?: string;
  applicationStatus?: string;
  previousApplicationStatus?: string;
  newApplicationStatus?: string;
  applicationId?: string;
  jobPostingId?: string;
  submittedDate?: string;
  portalUrl?: string;
  companyName?: string;
  logoUrl?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientName?: string;
  clientEmail?: string;
  jobId?: string;
  jobStatus?: string;
  approvalStatus?: string;
  rejectionReason?: string;
  jobUrl?: string;
}

const VARIABLE_MAP: Record<string, keyof EmailVariableContext> = {
  applicant_first_name: "applicantFirstName",
  applicant_last_name: "applicantLastName",
  applicant_full_name: "applicantFullName",
  applicant_email: "applicantEmail",
  applicant_phone: "applicantPhone",
  job_title: "jobTitle",
  job_description: "jobDescription",
  job_location: "jobLocation",
  application_status: "applicationStatus",
  previous_application_status: "previousApplicationStatus",
  new_application_status: "newApplicationStatus",
  application_id: "applicationId",
  job_posting_id: "jobPostingId",
  submitted_date: "submittedDate",
  portal_url: "portalUrl",
  company_name: "companyName",
  logo_url: "logoUrl",
  client_first_name: "clientFirstName",
  client_last_name: "clientLastName",
  client_name: "clientName",
  client_email: "clientEmail",
  job_id: "jobId",
  job_status: "jobStatus",
  approval_status: "approvalStatus",
  rejection_reason: "rejectionReason",
  job_url: "jobUrl",

  // Legacy aliases are supported for existing custom templates. New default
  // templates and the editor expose only the canonical names above.
  job_company: "companyName",
  first_name: "applicantFirstName",
  full_name: "applicantFullName",
  new_status: "newApplicationStatus",
  previous_status: "previousApplicationStatus",
};

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const UNRESOLVED_TOKEN_PATTERN = /\{\{\s*[^}]+\s*\}\}/g;
const URL_VARIABLES = new Set<keyof EmailVariableContext>(["portalUrl", "logoUrl", "jobUrl"]);
const MULTILINE_TEXT_VARIABLES = new Set<keyof EmailVariableContext>(["jobDescription"]);
const OPTIONAL_BLOCK_PATTERN = /\{\{#\s*([a-z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/gi;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function toSafeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function resolvePublicBaseUrl(): string | undefined {
  const configured = [
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : undefined,
  ];
  for (const candidate of configured) {
    const safeUrl = toSafeHttpsUrl(candidate);
    if (safeUrl) return safeUrl.replace(/\/$/, "");
  }
  return undefined;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export interface ResolveResult {
  resolved: string;
  unresolvedKeys: string[];
}

/**
 * Resolve one subject or HTML fragment. Missing and unknown variables remain
 * visible in this result so previews can highlight them; send paths must reject
 * results with unresolvedKeys instead of delivering a malformed email.
 */
export function resolveVariables(
  template: string,
  ctx: EmailVariableContext,
  format: "text" | "html" = "text",
): ResolveResult {
  const unresolvedKeys: string[] = [];
  const resolved = template.replace(TOKEN_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    const contextKey = VARIABLE_MAP[key];
    if (!contextKey) {
      unresolvedKeys.push(key);
      return match;
    }

    const rawValue = ctx[contextKey];
    const value = URL_VARIABLES.has(contextKey)
      ? toSafeHttpsUrl(rawValue)
      : rawValue?.trim();
    if (!value) {
      unresolvedKeys.push(key);
      return match;
    }

    if (format === "html") {
      const escaped = escapeHtml(value);
      return MULTILINE_TEXT_VARIABLES.has(contextKey)
        ? escaped.replace(/\n/g, "<br>")
        : escaped;
    }
    return escapeSubject(value);
  });

  return { resolved, unresolvedKeys: unique(unresolvedKeys) };
}

export interface RenderedApplicantEmail {
  subject: string;
  bodyHtml: string;
  unresolvedKeys: string[];
}

/** Render subject and HTML body using the same canonical context. */
export function renderApplicantEmail(
  template: { subject: string; bodyHtml: string },
  context: EmailVariableContext,
): RenderedApplicantEmail {
  const subject = resolveVariables(template.subject, context, "text");
  const body = resolveVariables(template.bodyHtml, context, "html");
  const unresolvedKeys = unique([
    ...subject.unresolvedKeys,
    ...body.unresolvedKeys,
    ...findUnresolvedTemplateVariables(subject.resolved),
    ...findUnresolvedTemplateVariables(body.resolved),
  ]);
  return {
    subject: escapeSubject(subject.resolved),
    bodyHtml: body.resolved,
    unresolvedKeys,
  };
}

/**
 * Client job emails support a small optional-block syntax so rejection-only
 * copy disappears cleanly when no reason was supplied:
 * {{#rejection_reason}}...{{rejection_reason}}...{{/rejection_reason}}
 */
export function renderClientEmail(
  template: { subject: string; bodyHtml: string },
  context: EmailVariableContext,
): RenderedApplicantEmail {
  const bodyWithConditionals = template.bodyHtml.replace(
    OPTIONAL_BLOCK_PATTERN,
    (_match, rawKey: string, content: string) => {
      const contextKey = VARIABLE_MAP[String(rawKey).toLowerCase()];
      return contextKey && context[contextKey]?.trim() ? content : "";
    },
  );
  return renderApplicantEmail(
    { subject: template.subject, bodyHtml: bodyWithConditionals },
    context,
  );
}

export function findUnresolvedTemplateVariables(value: string): string[] {
  return unique(
    Array.from(value.matchAll(UNRESOLVED_TOKEN_PATTERN), (match) =>
      match[0].slice(2, -2).trim().toLowerCase(),
    ),
  );
}

export function extractTemplateVariables(value: string): string[] {
  return unique(
    Array.from(value.matchAll(TOKEN_PATTERN), (match) => {
      const key = match[1].trim().toLowerCase();
      const contextKey = VARIABLE_MAP[key];
      return contextKey
        ? Object.entries(VARIABLE_MAP).find(([candidate, mapped]) => candidate === key && mapped === contextKey)?.[0] ?? key
        : key;
    }),
  );
}

export function extractClientTemplateVariables(value: string): string[] {
  const withoutBlockMarkers = value
    .replace(/\{\{#\s*[a-z0-9_]+\s*\}\}/gi, "")
    .replace(/\{\{\/\s*[a-z0-9_]+\s*\}\}/gi, "");
  return extractTemplateVariables(withoutBlockMarkers);
}

/**
 * Build a centralized, complete context from a submission and job row.
 * company_name is canonical; job_company is only an alias in VARIABLE_MAP.
 */
export function buildEmailContext(opts: {
  firstName?: string | null;
  lastName?: string | null;
  applicantName?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  jobDescription?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
  status?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  applicationId?: string | null;
  jobPostingId?: string | null;
  submittedAt?: Date | string | null;
}): EmailVariableContext {
  const firstName = opts.firstName?.trim() ?? opts.applicantName?.trim().split(/\s+/)[0] ?? "";
  const lastName = opts.lastName?.trim() ?? (opts.applicantName?.trim().split(/\s+/).slice(1).join(" ") ?? "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || opts.applicantName?.trim() || opts.email;
  const baseUrl = resolvePublicBaseUrl();
  const portalUrl = baseUrl ? `${baseUrl}/my-applications` : undefined;
  const logoUrl = toSafeHttpsUrl(process.env.ONSPOT_EMAIL_LOGO_URL) ?? (
    baseUrl ? `${baseUrl}/new-onspot.png` : undefined
  );
  const companyName =
    opts.jobCompany?.trim() ||
    process.env.ONSPOT_EMAIL_COMPANY_NAME?.trim() ||
    "OnSpot";

  let submittedDate: string | undefined;
  if (opts.submittedAt) {
    const date = new Date(opts.submittedAt);
    submittedDate = Number.isNaN(date.getTime())
      ? String(opts.submittedAt)
      : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  return {
    applicantFirstName: firstName || undefined,
    applicantLastName: lastName || undefined,
    applicantFullName: fullName || undefined,
    applicantEmail: opts.email,
    applicantPhone: opts.phone?.trim() || undefined,
    jobTitle: opts.jobTitle?.trim() || undefined,
    jobDescription: opts.jobDescription
      ? htmlToPlainText(opts.jobDescription) || undefined
      : undefined,
    jobLocation: opts.jobLocation?.trim() || undefined,
    applicationStatus: opts.newStatus ?? opts.status ?? undefined,
    previousApplicationStatus: opts.previousStatus ?? undefined,
    newApplicationStatus: opts.newStatus ?? opts.status ?? undefined,
    applicationId: opts.applicationId ?? undefined,
    jobPostingId: opts.jobPostingId ?? undefined,
    submittedDate,
    portalUrl,
    companyName,
    logoUrl,
  };
}

export function buildClientEmailContext(opts: {
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientEmail: string;
  companyName?: string | null;
  jobId: string;
  jobTitle?: string | null;
  jobStatus?: string | null;
  approvalStatus: string;
  rejectionReason?: string | null;
}): EmailVariableContext {
  const firstName = opts.clientFirstName?.trim() || "";
  const lastName = opts.clientLastName?.trim() || "";
  const clientName = [firstName, lastName].filter(Boolean).join(" ") || opts.clientEmail;
  const baseUrl = resolvePublicBaseUrl();
  const portalUrl = baseUrl ? `${baseUrl}/client-profile` : undefined;
  const jobUrl = baseUrl ? `${baseUrl}/client/jobs/${encodeURIComponent(opts.jobId)}/edit` : undefined;
  const logoUrl = toSafeHttpsUrl(process.env.ONSPOT_EMAIL_LOGO_URL) ?? (
    baseUrl ? `${baseUrl}/new-onspot.png` : undefined
  );

  return {
    clientFirstName: firstName || undefined,
    clientLastName: lastName || undefined,
    clientName,
    clientEmail: opts.clientEmail,
    companyName: opts.companyName?.trim() || "OnSpot",
    jobId: opts.jobId,
    jobPostingId: opts.jobId,
    jobTitle: opts.jobTitle?.trim() || undefined,
    jobStatus: opts.jobStatus?.trim() || undefined,
    approvalStatus: opts.approvalStatus,
    rejectionReason: opts.rejectionReason?.trim() || undefined,
    portalUrl,
    jobUrl,
    logoUrl,
  };
}

/**
 * Email-client-safe shell used by built-in templates and system-generated
 * applicant emails. Content is intentionally stored as complete HTML so admins
 * can edit a default template without relying on a runtime wrapper.
 */
export function renderBrandedEmailLayout(contentHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f6fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:30px 32px 22px;border-bottom:1px solid #e8eaf2;">
                <img src="{{logo_url}}" alt="OnSpot" width="150" style="display:block;max-width:150px;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 26px;font-family:Arial,Helvetica,sans-serif;color:#25283d;font-size:16px;line-height:1.6;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 32px;background-color:#f8f9fc;border-top:1px solid #e8eaf2;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px;line-height:1.5;">
                © OnSpot. Connecting exceptional talent with meaningful work.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Canonical variables shown in the editor and saved into default metadata. */
export const SUPPORTED_VARIABLES: { key: string; label: string; description: string }[] = [
  { key: "applicant_first_name", label: "First Name", description: "Applicant's first name" },
  { key: "applicant_last_name", label: "Last Name", description: "Applicant's last name" },
  { key: "applicant_full_name", label: "Full Name", description: "Applicant's full name" },
  { key: "applicant_email", label: "Email", description: "Applicant's email address" },
  { key: "applicant_phone", label: "Phone", description: "Applicant's phone number" },
  { key: "job_title", label: "Job Title", description: "Title of the job applied for" },
  { key: "job_description", label: "Job Description", description: "Readable text from the job description" },
  { key: "company_name", label: "Company", description: "Company name, or OnSpot when none is provided" },
  { key: "job_location", label: "Job Location", description: "Location of the job" },
  { key: "application_status", label: "Application Status", description: "Current application status" },
  { key: "previous_application_status", label: "Previous Status", description: "Application status before this update" },
  { key: "new_application_status", label: "New Status", description: "Application status after this update" },
  { key: "submitted_date", label: "Submitted Date", description: "Date the application was submitted" },
  { key: "portal_url", label: "Talent Portal URL", description: "Secure link to My Applications" },
  { key: "logo_url", label: "OnSpot Logo URL", description: "Absolute HTTPS URL for the OnSpot logo" },
  { key: "application_id", label: "Application ID", description: "Canonical application ID" },
  { key: "job_posting_id", label: "Job Posting ID", description: "Job posting ID" },
  { key: "client_first_name", label: "Client First Name", description: "Client account owner's first name" },
  { key: "client_last_name", label: "Client Last Name", description: "Client account owner's last name" },
  { key: "client_name", label: "Client Name", description: "Client account owner's full name" },
  { key: "client_email", label: "Client Email", description: "Client account owner's email" },
  { key: "job_id", label: "Job ID", description: "Canonical job ID" },
  { key: "job_status", label: "Job Status", description: "Current job publishing status" },
  { key: "approval_status", label: "Approval Status", description: "Job approval decision" },
  { key: "rejection_reason", label: "Rejection Reason", description: "Admin feedback when a job is rejected" },
  { key: "job_url", label: "Client Job URL", description: "Secure Client link to review the job" },
];