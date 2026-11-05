/** Shared stock content for automatic approval emails and the email composer. */
export const button = (href: string, label: string) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;">
    <tr><td style="border-radius:6px;background-color:#474ead;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
    </td></tr>
  </table>`;

function escHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function formatJobApprovalDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function jobApprovalEmailContent(values: {
  firstName: string; jobTitle: string; approvedDate: string;
  jobViewUrl: string; applicationsUrl: string;
}): string {
  const firstName = escHtml(values.firstName);
  const title = escHtml(values.jobTitle);
  const date = escHtml(values.approvedDate);
  const viewUrl = escHtml(values.jobViewUrl);
  const applicationsUrl = escHtml(values.applicationsUrl);
  return `<h1 style="color:#25283d;font-size:24px;line-height:1.25;margin:0 0 16px;">Your job post is now live</h1>
<p style="margin:0 0 16px;">Hi ${firstName},</p>
<p style="margin:0 0 16px;">Great news — your job post has been approved and is now live on OnSpot.</p>
<table role="presentation" cellpadding="8" cellspacing="0" style="width:100%;margin:20px 0;background:#f5f6fc;border-radius:6px;color:#25283d;font-size:15px;">
  <tr><th scope="row" align="left">Job title</th><td>${title}</td></tr>
  <tr><th scope="row" align="left">Approved date</th><td>${date}</td></tr>
  <tr><th scope="row" align="left">Status</th><td>Live</td></tr>
</table>
<h2 style="font-size:18px;color:#25283d;margin:24px 0 12px;">What happens next</h2>
<ul style="padding-left:22px;line-height:1.7;">
  <li>Talent can now find your job post and apply.</li>
  <li>You'll be notified as new applications arrive.</li>
  <li>Review applications, shortlist talent and schedule interviews from your dashboard.</li>
</ul>
${button(viewUrl, "View Job Post")}
<p style="margin:0 0 20px;"><a href="${applicationsUrl}" style="color:#474ead;text-decoration:underline;">View applications</a></p>
<p style="margin:0 0 16px;">Need a hand? Reply to this email and our team will be happy to help.</p>
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`;
}
