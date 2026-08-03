/**
 * Seed default applicant email templates.
 * Idempotent — uses the template name as a uniqueness key.
 * Called at application startup.
 */
import { query } from "../db.ts";

interface TemplateRow {
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
  stage: string | null;
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: TemplateRow[] = [
  // 1. Application Received
  {
    name: "Application Received",
    category: "application_received",
    stage: "submitted",
    isDefault: true,
    subject: "We received your application — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>Thank you for applying for the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p>We have received your application and our team will review it shortly. We'll be in touch if your profile is a strong match.</p>
<p>In the meantime, you can track your application status by signing in to the <a href="{{portal_url}}">OnSpot Talent Portal</a>.</p>
<p>Thank you again for your interest!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 2. Under Review
  {
    name: "Application Under Review",
    category: "under_review",
    stage: "under_review",
    isDefault: true,
    subject: "Your application is under review — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We wanted to let you know that your application for <strong>{{job_title}}</strong> is currently being reviewed by our team.</p>
<p>We'll contact you with the next steps as soon as we have an update. Thank you for your patience.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 3. Shortlisted
  {
    name: "Applicant Shortlisted",
    category: "shortlisted",
    stage: "shortlisted",
    isDefault: true,
    subject: "Great news — you've been shortlisted for {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We're pleased to let you know that you have been <strong>shortlisted</strong> for the <strong>{{job_title}}</strong> role.</p>
<p>Our team will be reaching out shortly to discuss the next steps in the selection process.</p>
<p>Congratulations on making it this far, and we look forward to speaking with you!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 4. Interview Invitation
  {
    name: "Interview Invitation",
    category: "interview_invitation",
    stage: "interview",
    isDefault: true,
    subject: "Interview Invitation — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We would like to invite you to an interview for the <strong>{{job_title}}</strong> position.</p>
<p>Please reply to this email with your availability over the next few business days and we will confirm a time that works for both parties.</p>
<p>We look forward to learning more about you!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 5. Interview Confirmed
  {
    name: "Interview Confirmed",
    category: "interview_confirmed",
    stage: "interview",
    isDefault: false,
    subject: "Interview Confirmed — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>Your interview for the <strong>{{job_title}}</strong> position has been confirmed.</p>
<p>Please review the details below and don't hesitate to reach out if you have any questions.</p>
<p>We look forward to speaking with you!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 6. Offer Extended
  {
    name: "Offer Extended",
    category: "offer_extended",
    stage: "offered",
    isDefault: true,
    subject: "Offer of Employment — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We are delighted to extend an offer of employment for the <strong>{{job_title}}</strong> position.</p>
<p>Please review the offer details that will be provided separately. If you have any questions, please reply to this email.</p>
<p>We are excited about the prospect of you joining our team!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 7. Hired / Welcome
  {
    name: "Welcome to the Team",
    category: "hired",
    stage: "hired",
    isDefault: true,
    subject: "Welcome aboard, {{applicant_first_name}}! 🎉",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We're thrilled to officially welcome you to the {{company_name}} team as <strong>{{job_title}}</strong>!</p>
<p>Our onboarding team will be reaching out shortly with next steps to get you set up and ready to go.</p>
<p>We're so excited to have you with us. Welcome aboard!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 8. Rejection — Early Stage
  {
    name: "Application Not Progressing",
    category: "rejection_early",
    stage: "rejected",
    isDefault: true,
    subject: "Your application for {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>Thank you for taking the time to apply for the <strong>{{job_title}}</strong> position at {{company_name}}.</p>
<p>After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.</p>
<p>We appreciate your interest and encourage you to apply for future openings that align with your skills and experience.</p>
<p>We wish you all the best in your job search.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 9. Rejection — After Interview
  {
    name: "Post-Interview — Not Progressing",
    category: "rejection_post_interview",
    stage: "rejected",
    isDefault: false,
    subject: "Update on your application — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>Thank you for the time you invested in interviewing for the <strong>{{job_title}}</strong> role. It was a pleasure getting to know you better.</p>
<p>After thorough deliberation, we have decided to move forward with another candidate at this time. This was a difficult decision given the strength of your candidacy.</p>
<p>We hope you'll keep {{company_name}} in mind for future opportunities, and we wish you continued success.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 10. Withdrawn Acknowledgment
  {
    name: "Application Withdrawal Acknowledged",
    category: "withdrawn",
    stage: "withdrawn",
    isDefault: true,
    subject: "Application withdrawal confirmed — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We have received your request to withdraw your application for <strong>{{job_title}}</strong>. We've updated our records accordingly.</p>
<p>We appreciate your interest in {{company_name}} and hope to hear from you again in the future.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 11. Follow-up Request
  {
    name: "Follow-Up Request",
    category: "follow_up",
    stage: null,
    isDefault: false,
    subject: "Following up on your application — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We're following up on your application for <strong>{{job_title}}</strong> submitted on {{submitted_date}}.</p>
<p>We'd love to connect and learn more about your background. Please reply to this email at your convenience.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 12. Document Request
  {
    name: "Document Request",
    category: "document_request",
    stage: null,
    isDefault: false,
    subject: "Documents required — {{job_title}} application",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>As part of the evaluation process for the <strong>{{job_title}}</strong> position, we'd like to request some additional documents.</p>
<p>Please reply to this email with the requested materials at your earliest convenience. If you have any questions, don't hesitate to ask.</p>
<p>Thank you for your cooperation!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 13. Reference Check
  {
    name: "Reference Check Notice",
    category: "reference_check",
    stage: null,
    isDefault: false,
    subject: "Reference check — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We are conducting a reference check as part of the evaluation for the <strong>{{job_title}}</strong> role.</p>
<p>Please provide the contact details for 2–3 professional references who can speak to your work experience. Reply to this email with their names, titles, and email addresses.</p>
<p>Thank you!</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },

  // 14. General Update
  {
    name: "General Application Update",
    category: "general_update",
    stage: null,
    isDefault: false,
    subject: "Update on your application — {{job_title}}",
    bodyHtml: `<p>Hi {{applicant_first_name}},</p>
<p>We wanted to provide you with an update regarding your application for <strong>{{job_title}}</strong>.</p>
<p>[Add your update here]</p>
<p>Please don't hesitate to reach out if you have any questions.</p>
<p>Warm regards,<br>The {{company_name}} Team</p>`,
  },
];

export async function seedEmailTemplates(): Promise<void> {
  try {
    let seeded = 0;
    let skipped = 0;
    for (const tpl of DEFAULT_TEMPLATES) {
      // Idempotent: skip if a template with the same name already exists
      const existing = await query(
        `SELECT id FROM applicant_email_templates WHERE name = $1 LIMIT 1`,
        [tpl.name],
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      await query(
        `INSERT INTO applicant_email_templates
           (name, subject, body_html, category, stage, is_published, is_default, is_archived, variables)
         VALUES ($1, $2, $3, $4, $5, true, $6, false, '[]')`,
        [tpl.name, tpl.subject, tpl.bodyHtml, tpl.category, tpl.stage, tpl.isDefault],
      );
      seeded++;
    }
    console.log(`✅ Email templates seeded: ${seeded} inserted, ${skipped} already exist (${seeded + skipped} total).`);
    if (seeded + skipped < DEFAULT_TEMPLATES.length) {
      console.warn(`⚠️  Email template seed incomplete: expected ${DEFAULT_TEMPLATES.length}, got ${seeded + skipped}.`);
    }
  } catch (err: any) {
    console.warn("⚠️  Email template seeding skipped:", err.message);
  }
}
