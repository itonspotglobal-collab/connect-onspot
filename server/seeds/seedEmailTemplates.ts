/**
 * Default applicant email templates.
 *
 * Existing records are updated only when they exactly match a known stock
 * legacy template (or the known malformed Application Received variation).
 * This makes the startup migration safe for administrator-customized records.
 */
import { createHash } from "node:crypto";
import { query } from "../db.ts";
import {
  extractClientTemplateVariables,
  extractTemplateVariables,
  renderBrandedEmailLayout,
} from "../services/emailVariableResolver.ts";

export interface TemplateRow {
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
  stage: string | null;
  isDefault: boolean;
  variables: string[];
}

function brandedTemplate(config: Omit<TemplateRow, "bodyHtml" | "variables"> & { content: string }): TemplateRow {
  const bodyHtml = renderBrandedEmailLayout(config.content);
  return {
    name: config.name,
    subject: config.subject,
    bodyHtml,
    category: config.category,
    stage: config.stage,
    isDefault: config.isDefault,
    variables: extractTemplateVariables(`${config.subject}\n${bodyHtml}`),
  };
}

const button = (href: string, label: string) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;">
    <tr><td style="border-radius:6px;background-color:#474ead;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
    </td></tr>
  </table>`;

function brandedClientTemplate(
  config: Omit<TemplateRow, "bodyHtml" | "variables"> & { content: string },
): TemplateRow {
  const bodyHtml = renderBrandedEmailLayout(config.content);
  return {
    name: config.name,
    subject: config.subject,
    bodyHtml,
    category: config.category,
    stage: config.stage,
    isDefault: config.isDefault,
    variables: extractClientTemplateVariables(`${config.subject}\n${bodyHtml}`),
  };
}

export const DEFAULT_TEMPLATES: TemplateRow[] = [
  brandedClientTemplate({
    name: "Job Posted on Your Behalf", category: "job_posted_on_behalf", stage: null, isDefault: true,
    subject: "A job post was created for you — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{client_first_name}},</p>
<p style="margin:0 0 16px;">The OnSpot team has created a job posting for <strong>{{job_title}}</strong> on your behalf.</p>
<p style="margin:0 0 16px;">You can review the job posting and its current status from your OnSpot Client account.</p>
${button("{{job_url}}", "View Job Posting")}
<p style="margin:0 0 16px;">If any changes are needed, you can review the posting in OnSpot or contact the OnSpot Hire Talent team.</p>
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`,
  }),
  brandedClientTemplate({
    name: "Job Post Unapproved", category: "job_unapproved", stage: null, isDefault: true,
    subject: "Update on your job post — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{client_first_name}},</p>
<p style="margin:0 0 16px;">Your job posting for <strong>{{job_title}}</strong> has been moved out of approved status.</p>
<p style="margin:0 0 16px;">Please review the posting and make any required updates before submitting it again for approval.</p>
${button("{{job_url}}", "Review Job Posting")}
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`,
  }),
  brandedClientTemplate({
    name: "Job Post Approved", category: "job_approved", stage: null, isDefault: true,
    subject: "Your job post has been approved — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{client_first_name}},</p>
<p style="margin:0 0 16px;">Good news — your job posting for <strong>{{job_title}}</strong> has been approved.</p>
<p style="margin:0 0 16px;">Your role is now available according to the current OnSpot publishing rules, and you can begin reviewing talent and applications.</p>
${button("{{job_url}}", "View Job Posting")}
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`,
  }),
  brandedClientTemplate({
    name: "Job Post Rejected", category: "job_rejected", stage: null, isDefault: true,
    subject: "Update on your job post — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{client_first_name}},</p>
<p style="margin:0 0 16px;">We've reviewed your job posting for <strong>{{job_title}}</strong>, and it requires changes before it can be approved.</p>
{{#rejection_reason}}<p style="margin:0 0 16px;"><strong>Reason:</strong><br />{{rejection_reason}}</p>{{/rejection_reason}}
<p style="margin:0 0 16px;">Please review and update the job posting, then submit it again for approval.</p>
${button("{{job_url}}", "Review Job Posting")}
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`,
  }),
  brandedTemplate({
    name: "Application Received", category: "application_received", stage: "submitted", isDefault: true,
    subject: "We received your application — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">Thank you for applying for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p style="margin:0 0 16px;">We have received your application and our team will review it shortly. We'll be in touch if your profile is a strong match.</p>
<p style="margin:0 0 16px;">In the meantime, you can track your application status through the OnSpot Talent Portal.</p>
${button("{{portal_url}}", "View Application Status")}
<p style="margin:0 0 16px;">Thank you again for your interest!</p>
<p style="margin:0;">Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Application Under Review", category: "under_review", stage: "under_review", isDefault: true,
    subject: "Your application is under review — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We wanted to let you know that your application for <strong>{{job_title}}</strong> is currently being reviewed by our team.</p>
<p style="margin:0 0 16px;">We'll contact you with the next steps as soon as we have an update. Thank you for your patience.</p>
${button("{{portal_url}}", "View Application Status")}
<p style="margin:0;">Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Applicant Shortlisted", category: "shortlisted", stage: "shortlisted", isDefault: true,
    subject: "Great news — you've been shortlisted for {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We're pleased to let you know that you have been <strong>shortlisted</strong> for the <strong>{{job_title}}</strong> role.</p>
<p style="margin:0 0 16px;">Our team will be reaching out shortly to discuss the next steps in the selection process.</p>
${button("{{portal_url}}", "View Application Status")}
<p style="margin:0;">Congratulations on making it this far. We look forward to speaking with you!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Interview Invitation", category: "interview_invitation", stage: "interview", isDefault: true,
    subject: "Interview Invitation — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We would like to invite you to an interview for the <strong>{{job_title}}</strong> position.</p>
<p style="margin:0 0 16px;">Please reply to this email with your availability over the next few business days and we will confirm a time that works for both parties.</p>
<p style="margin:0;">We look forward to learning more about you!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Interview Confirmed", category: "interview_confirmed", stage: "interview", isDefault: false,
    subject: "Interview Confirmed — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">Your interview for the <strong>{{job_title}}</strong> position has been confirmed.</p>
<p style="margin:0 0 16px;">Please review the details shared with you and reply to this email if you have any questions.</p>
<p style="margin:0;">We look forward to speaking with you!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Offer Extended", category: "offer_extended", stage: "offered", isDefault: true,
    subject: "Offer of Employment — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We are delighted to extend an offer of employment for the <strong>{{job_title}}</strong> position.</p>
<p style="margin:0 0 16px;">Please review the offer details that will be provided separately. If you have any questions, please reply to this email.</p>
<p style="margin:0;">We are excited about the prospect of you joining our team!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Welcome to the Team", category: "hired", stage: "hired", isDefault: true,
    subject: "Welcome aboard, {{applicant_first_name}}!",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We're thrilled to officially welcome you to the {{company_name}} team as <strong>{{job_title}}</strong>!</p>
<p style="margin:0 0 16px;">Our onboarding team will be reaching out shortly with next steps to get you set up and ready to go.</p>
<p style="margin:0;">We're so excited to have you with us. Welcome aboard!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Application Not Progressing", category: "rejection_early", stage: "rejected", isDefault: true,
    subject: "Your application for {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">Thank you for taking the time to apply for the <strong>{{job_title}}</strong> position at {{company_name}}.</p>
<p style="margin:0 0 16px;">After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.</p>
<p style="margin:0 0 16px;">We appreciate your interest and encourage you to apply for future openings that align with your skills and experience.</p>
<p style="margin:0;">We wish you all the best in your job search.<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Post-Interview — Not Progressing", category: "rejection_post_interview", stage: "rejected", isDefault: false,
    subject: "Update on your application — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">Thank you for the time you invested in interviewing for the <strong>{{job_title}}</strong> role. It was a pleasure getting to know you better.</p>
<p style="margin:0 0 16px;">After thorough deliberation, we have decided to move forward with another candidate at this time. This was a difficult decision given the strength of your candidacy.</p>
<p style="margin:0;">We hope you'll keep {{company_name}} in mind for future opportunities, and we wish you continued success.<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Application Withdrawal Acknowledged", category: "withdrawn", stage: "withdrawn", isDefault: true,
    subject: "Application withdrawal confirmed — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We have received your request to withdraw your application for <strong>{{job_title}}</strong>. We've updated our records accordingly.</p>
<p style="margin:0;">We appreciate your interest in {{company_name}} and hope to hear from you again in the future.<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Follow-Up Request", category: "follow_up", stage: null, isDefault: false,
    subject: "Following up on your application — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We're following up on your application for <strong>{{job_title}}</strong> submitted on {{submitted_date}}.</p>
<p style="margin:0;">We'd love to connect and learn more about your background. Please reply to this email at your convenience.<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Document Request", category: "document_request", stage: null, isDefault: false,
    subject: "Documents required — {{job_title}} application",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">As part of the evaluation process for the <strong>{{job_title}}</strong> position, we'd like to request some additional documents.</p>
<p style="margin:0 0 16px;">Please reply to this email with the requested materials at your earliest convenience. If you have any questions, don't hesitate to ask.</p>
<p style="margin:0;">Thank you for your cooperation!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "Reference Check Notice", category: "reference_check", stage: null, isDefault: false,
    subject: "Reference check — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We are conducting a reference check as part of the evaluation for the <strong>{{job_title}}</strong> role.</p>
<p style="margin:0 0 16px;">Please provide the contact details for 2–3 professional references who can speak to your work experience. Reply to this email with their names, titles, and email addresses.</p>
<p style="margin:0;">Thank you!<br /><br />Warm regards,<br />The {{company_name}} Team</p>`,
  }),
  brandedTemplate({
    name: "General Application Update", category: "general_update", stage: null, isDefault: false,
    subject: "Update on your application — {{job_title}}",
    content: `<p style="margin:0 0 16px;">Hi {{applicant_first_name}},</p>
<p style="margin:0 0 16px;">We wanted to provide you with an update regarding your application for <strong>{{job_title}}</strong>.</p>
<p style="margin:0 0 16px;">Please don't hesitate to reach out if you have any questions.</p>
${button("{{portal_url}}", "View Application Status")}
<p style="margin:0;">Warm regards,<br />The {{company_name}} Team</p>`,
  }),
];

const LEGACY_TEMPLATE_HASHES = new Set([
  "303f20be4bb5259bd17298286e6bba8ee368d8fa010f4f124d8c7b9cc26b3899",
  "013f3cec2ab9ed3b2fdd3909839f119414dd77b9c448332aa1b25fa1b443663c",
  "ffc3d4223ea7c621a61754430b9c1df994a9f7a8a0098f2e8aa7a1f87e902b3b",
  "b25b354b9bde26a867d38c3a03d57030f641d65e13988eca33a5effd91a0db17",
  "eb68c8a7e41963b43a52b043dff3607670e01c15a02c2298c9bfdf5d17ee6a57",
  "0578e8545ee4fcfdc8eedc2c540c4992511d908f3ccf615e33767e6015916dc8",
  "3a380415328efd3e029124979d734a6336abc2b692b55ba1fd611a45cf8d1416",
  "bbeb739139426793558c915c011a4b17a5832485134085181b9d76c33ab0b255",
  "353924eac53cf84dbb812569827f45765ad3a4f6c05d48a6869af84f41a63b1d",
  "61bf6d314855a1d97ffd3c207309ab8dc302c53ec725a0bf289b5237ae31455b",
  "da96da02d0ebc45a7fdfbad0bead339f03661bf6ace38d8cfb367027947e6632",
  "187b850fe53dcd1438e11ea9c76246285b17b81434188949eb05a513236aeb1b",
  "e2a472fe015688eb10f8fef2e0efbda45e99caea540d9a584d7e1114a73820a5",
  "89f846e47b42f9bf19fc8d6131d212df6cb154be13f2188ff97193da22a916bf",
]);

function templateHash(subject: string, bodyHtml: string): string {
  return createHash("sha256").update(`${subject}\n${bodyHtml}`).digest("hex");
}

function isKnownBrokenApplicationReceived(row: { name: string; subject: string; body_html: string }): boolean {
  return row.name === "Application Received" &&
    row.subject === "We received your application — {{job_title}}" &&
    row.body_html.includes(
      "Thank you for applying for the <strong>{{job_title}}</strong> position{{#job_company}} at <strong>{{job_company}}</strong>{{/job_company}}.",
    ) &&
    row.body_html.includes(
      "We have received your application and our team will review it shortly.",
    ) &&
    row.body_html.includes("track your application status") &&
    row.body_html.includes("{{/job_company}}");
}

export async function seedEmailTemplates(): Promise<void> {
  try {
    const existingResult = await query(
      `SELECT id, name, subject, body_html, variables
         FROM applicant_email_templates
        WHERE name = ANY($1::text[])`,
      [DEFAULT_TEMPLATES.map((template) => template.name)],
    );
    const existingByName = new Map(existingResult.rows.map((row: any) => [row.name, row]));
    let inserted = 0;
    let upgraded = 0;
    let preserved = 0;

    for (const template of DEFAULT_TEMPLATES) {
      const existing = existingByName.get(template.name);
      if (!existing) {
        await query(
          `INSERT INTO applicant_email_templates
             (name, subject, body_html, category, stage, is_published, is_default, is_archived, variables)
           VALUES ($1, $2, $3, $4, $5, true, $6, false, $7)`,
          [
            template.name, template.subject, template.bodyHtml, template.category,
            template.stage, template.isDefault, JSON.stringify(template.variables),
          ],
        );
        inserted++;
        continue;
      }

      const isStockLegacy =
        LEGACY_TEMPLATE_HASHES.has(templateHash(existing.subject, existing.body_html)) ||
        isKnownBrokenApplicationReceived(existing);
      if (!isStockLegacy) {
        preserved++;
        continue;
      }

      await query(
        `UPDATE applicant_email_templates
            SET subject = $1, body_html = $2, category = $3, stage = $4,
                is_default = $5, variables = $6, updated_at = NOW()
          WHERE id = $7`,
        [
          template.subject, template.bodyHtml, template.category, template.stage,
          template.isDefault, JSON.stringify(template.variables), existing.id,
        ],
      );
      upgraded++;
    }

    console.log(
      `✅ Email templates: ${inserted} inserted, ${upgraded} stock defaults upgraded, ${preserved} customized records preserved.`,
    );
  } catch (err: any) {
    console.warn("⚠️  Email template seed/migration skipped:", err.message);
  }
}