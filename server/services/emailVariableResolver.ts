/**
 * Email Variable Resolver
 * Replaces {{variable_name}} tokens in email subjects and HTML bodies.
 *
 * Supported variables:
 *   {{applicant_first_name}}   {{applicant_last_name}}  {{applicant_full_name}}
 *   {{applicant_email}}        {{applicant_phone}}
 *   {{job_title}}              {{job_company}}          {{job_location}}
 *   {{application_status}}     {{previous_application_status}} {{new_application_status}}
 *   {{application_id}}         {{job_posting_id}}     {{submitted_date}}
 *   {{portal_url}}             {{company_name}}
 */

export interface EmailVariableContext {
  applicantFirstName?: string;
  applicantLastName?: string;
  applicantFullName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  jobTitle?: string;
  jobCompany?: string;
  jobLocation?: string;
  applicationStatus?: string;
  previousApplicationStatus?: string;
  newApplicationStatus?: string;
  applicationId?: string;
  jobPostingId?: string;
  submittedDate?: string;
  portalUrl?: string;
  companyName?: string;
}

const VARIABLE_MAP: Record<string, keyof EmailVariableContext> = {
  applicant_first_name:  "applicantFirstName",
  applicant_last_name:   "applicantLastName",
  applicant_full_name:   "applicantFullName",
  applicant_email:       "applicantEmail",
  applicant_phone:       "applicantPhone",
  job_title:             "jobTitle",
  job_company:           "jobCompany",
  job_location:          "jobLocation",
  application_status:    "applicationStatus",
  previous_application_status: "previousApplicationStatus",
  new_application_status: "newApplicationStatus",
  application_id:        "applicationId",
  job_posting_id:        "jobPostingId",
  first_name:            "applicantFirstName",
  full_name:             "applicantFullName",
  new_status:            "newApplicationStatus",
  previous_status:       "previousApplicationStatus",
  submitted_date:        "submittedDate",
  portal_url:            "portalUrl",
  company_name:          "companyName",
};

export interface ResolveResult {
  resolved: string;
  unresolvedKeys: string[];
}

/**
 * Resolve all {{variable}} tokens in a template string.
 * Returns the resolved string and a list of variable keys that had no value.
 */
export function resolveVariables(template: string, ctx: EmailVariableContext): ResolveResult {
  const unresolvedKeys: string[] = [];

  const resolved = template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => {
    const contextKey = VARIABLE_MAP[key];
    if (!contextKey) {
      // Unknown variable — leave as-is and note it
      unresolvedKeys.push(key);
      return _match;
    }
    const value = ctx[contextKey];
    if (value === undefined || value === null || value === "") {
      unresolvedKeys.push(key);
      return _match; // leave token in place so the caller can see what's missing
    }
    return String(value);
  });

  return { resolved, unresolvedKeys };
}

/**
 * Build an EmailVariableContext from a raw DB application row and related job info.
 */
export function buildEmailContext(opts: {
  firstName?: string | null;
  lastName?: string | null;
  applicantName?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
  status?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  applicationId?: string | null;
  jobPostingId?: string | null;
  submittedAt?: Date | string | null;
}): EmailVariableContext {
  const firstName = opts.firstName?.trim() ?? opts.applicantName?.split(" ")[0] ?? "";
  const lastName = opts.lastName?.trim() ?? (opts.applicantName?.split(" ").slice(1).join(" ") ?? "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || opts.applicantName || opts.email;

  const portalUrl = process.env.PUBLIC_APP_URL ?? process.env.PUBLIC_BASE_URL ?? "";
  const companyName = "OnSpot";

  let submittedDate = "";
  if (opts.submittedAt) {
    try {
      submittedDate = new Date(opts.submittedAt).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    } catch {
      submittedDate = String(opts.submittedAt);
    }
  }

  return {
    applicantFirstName: firstName || undefined,
    applicantLastName:  lastName || undefined,
    applicantFullName:  fullName || undefined,
    applicantEmail:     opts.email,
    applicantPhone:     opts.phone ?? undefined,
    jobTitle:           opts.jobTitle ?? undefined,
    jobCompany:         opts.jobCompany ?? undefined,
    jobLocation:        opts.jobLocation ?? undefined,
    applicationStatus:  opts.newStatus ?? opts.status ?? undefined,
    previousApplicationStatus: opts.previousStatus ?? undefined,
    newApplicationStatus: opts.newStatus ?? opts.status ?? undefined,
    applicationId: opts.applicationId ?? undefined,
    jobPostingId: opts.jobPostingId ?? undefined,
    submittedDate:      submittedDate || undefined,
    portalUrl:          portalUrl || undefined,
    companyName,
  };
}

/** List of all supported variable tokens (for UI insertion menus). */
export const SUPPORTED_VARIABLES: { key: string; label: string; description: string }[] = [
  { key: "applicant_first_name", label: "First Name",        description: "Applicant's first name" },
  { key: "applicant_last_name",  label: "Last Name",         description: "Applicant's last name" },
  { key: "applicant_full_name",  label: "Full Name",         description: "Applicant's full name" },
  { key: "applicant_email",      label: "Email",             description: "Applicant's email address" },
  { key: "applicant_phone",      label: "Phone",             description: "Applicant's phone number" },
  { key: "job_title",            label: "Job Title",         description: "Title of the job applied for" },
  { key: "job_company",          label: "Company",           description: "Company name from the job posting" },
  { key: "job_location",         label: "Job Location",      description: "Location of the job" },
  { key: "application_status",   label: "Application Status",description: "Current application status" },
  { key: "previous_application_status", label: "Previous Status", description: "Application status before this update" },
  { key: "new_application_status", label: "New Status", description: "Application status after this update" },
  { key: "application_id",       label: "Application ID",   description: "Canonical application ID" },
  { key: "job_posting_id",       label: "Job Posting ID",    description: "Job posting ID" },
  { key: "submitted_date",       label: "Submitted Date",    description: "Date the application was submitted" },
  { key: "portal_url",           label: "Portal URL",        description: "Link to the talent portal" },
  { key: "company_name",         label: "Our Company",       description: "OnSpot company name" },
];
