import { getClient } from "../db";
import { sendApplicantEmail, isEmailServiceConfigured } from "./microsoftGraphEmailService";
import { escHtml } from "../lib/escHtml";

// Verified published URL obtained through deployment metadata; explicit existing
// application URL configuration wins. Never derive production links from dev domains.
const VERIFIED_PUBLIC_ORIGIN = "https://connect.onspotglobal.com";
export async function deliverContractEmails(contractId: string) {
  const tx = await getClient();
  let failed = false, accepted = false, skipped = false;
  try {
    const ids = (await tx.query(`SELECT e.id FROM contract_delivery_events e JOIN contract_documents d ON d.id=e.document_id
      WHERE d.hiring_contract_id=$1 AND e.status IN ('pending','failed','skipped') ORDER BY e.updated_at`, [contractId])).rows;
    if (!ids.length) {
      const history = (await tx.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE e.status='accepted')::int AS accepted
        FROM contract_delivery_events e JOIN contract_documents d ON d.id=e.document_id WHERE d.hiring_contract_id=$1`, [contractId])).rows[0];
      return { status: history.total > 0 && history.accepted === history.total ? "accepted" : "skipped" };
    }
    for (const { id } of ids) {
      await tx.query("BEGIN");
      try {
        const event = (await tx.query(
          `SELECT e.*,u.email FROM contract_delivery_events e JOIN users u ON u.id=e.recipient_user_id
           WHERE e.id=$1 AND e.status IN ('pending','failed','skipped') FOR UPDATE OF e SKIP LOCKED`, [id])).rows[0];
        if (!event) { await tx.query("COMMIT"); continue; }
        let status: "accepted" | "failed" | "skipped" = "skipped";
        if (isEmailServiceConfigured()) {
          try {
            const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.PUBLIC_BASE_URL || VERIFIED_PUBLIC_ORIGIN;
            const url = new URL(`/contracts?id=${encodeURIComponent(contractId)}`, configured);
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid app origin");
            const result = await sendApplicantEmail({ to: event.email, subject: "Review your OnSpot contract",
              bodyHtml: `<p>Your contract has been ${escHtml(event.event_type.replace(/_/g, " "))}.</p><p><a href="${escHtml(url.href)}">Review the contract and required signatures in OnSpot</a></p><p>Sign in to view the private document. No sensitive PDF is attached.</p>`,
              redactErrors: true });
            status = result.success ? "accepted" : "failed";
          } catch { status = "failed"; }
        }
        failed ||= status === "failed"; accepted ||= status === "accepted"; skipped ||= status === "skipped";
        await tx.query("UPDATE contract_delivery_events SET status=$1,attempts=attempts+1,updated_at=NOW() WHERE id=$2", [status, id]);
        await tx.query("COMMIT");
      } catch (error) { await tx.query("ROLLBACK").catch(() => {}); failed = true; }
    }
    return { status: failed ? "failed" : accepted ? "accepted" : "skipped" };
  } finally { tx.release(); }
}
