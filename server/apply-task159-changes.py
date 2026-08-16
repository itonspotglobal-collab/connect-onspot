#!/usr/bin/env python3
"""
Reapplies all task-159 improvements to the latest server/routes.ts after `git checkout --theirs`.
Run: python3 server/apply-task159-changes.py
"""
import sys, re, os

path = "server/routes.ts"
content = open(path).read()

applied = []
missed  = []

def apply(label, old, new):
    global content
    if old in content:
        content = content.replace(old, new, 1)
        applied.append(label)
    else:
        missed.append(label)

# ── 1. escHtml helper + fireInvitationEmail improvements ─────────────────────
FIRE_MARKER = 'async function fireInvitationEmail(opts: {'
if FIRE_MARKER in content:
    # Find the full function extent
    start = content.index(FIRE_MARKER)
    # Look for the closing "}" of the function (the "} at end of fireInvitationEmail)
    end = content.index('\n}\n', start + 200) + 3  # include the newline + } + newline
    old_block = content[start:end]
    # Only replace if it doesn't already have escHtml
    if 'escHtml' not in content[:start]:
        new_block = '''\
// ── HTML-escape helper (prevents injection in email bodies) ──────────────────
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function fireInvitationEmail(opts: {
  talentEmail: string;
  talentName: string;
  jobTitle: string;
  jobDescription: string | null;
  submissionId: string;
}): Promise<void> {
  try {
    if (!opts.talentEmail) return;
    const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");

    const baseUrl = process.env.APP_URL?.replace(/\\/$/, "") ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://onspotglobal.com");
    const myAppsUrl = `${baseUrl}/my-applications`;

    const safeName  = escHtml(opts.talentName  || "there");
    const safeTitle = escHtml(opts.jobTitle     || "a role");
    const descriptionHtml = opts.jobDescription
      ? `<p style="color:#444;font-size:15px;margin:16px 0;">${escHtml(opts.jobDescription)}</p>`
      : "";

    const subject = `You\\'ve been invited to a role: ${safeTitle}`;
    const bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">You\\'ve been invited to a role</h2>
  <p style="color:#444;font-size:15px;margin-bottom:4px;">Hi ${safeName},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A client has invited you to apply for the following role:
  </p>
  <h3 style="color:#1a1a2e;margin:8px 0;">${safeTitle}</h3>
  ${descriptionHtml}
  <p style="margin:24px 0;">
    <a href="${myAppsUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View Invitation
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    You can accept or decline the invitation from your
    <a href="${myAppsUrl}" style="color:#4f46e5;">My Applications</a> page.
  </p>
</div>`.trim();

    await sendApplicantEmail({ to: opts.talentEmail, subject, bodyHtml });
    console.log(`✅ Invitation email sent to ${opts.talentEmail} for submission ${opts.submissionId}`);
  } catch (e: any) {
    console.warn("fireInvitationEmail (non-fatal):", e?.message);
  }
}'''
        content = content[:start] + new_block + content[end:]
        applied.append('1:escHtml+email')
    else:
        applied.append('1:escHtml+email (already present)')
else:
    missed.append('1:escHtml+email (FIRE_MARKER not found)')

# ── 2. GET /api/client/jobs: exclude scaffold jobs ────────────────────────────
if "IS DISTINCT FROM 'search_scaffold'" not in content:
    apply('2:jobs-scaffold-exclusion',
        "         WHERE j.client_id = $1\n         ORDER BY j.created_at DESC`",
        "         WHERE j.client_id = $1\n           AND (j.created_via IS DISTINCT FROM 'search_scaffold')\n         ORDER BY j.created_at DESC`")
else:
    applied.append('2:jobs-scaffold-exclusion (already present)')

# ── 3. POST /api/client/talent-search: scaffold lifecycle + DTO masking ───────
SCAFFOLD_MARKER = "return res.json({ jobId, results });"
# Check if lifecycle already present
if 'orphan cleanup' not in content and SCAFFOLD_MARKER in content:
    # Find the scaffold INSERT block — multiple possible forms
    markers = [
        "Create an internal scaffold job",
        "Search scaffold:",
    ]
    found_scaffold = False
    for m in markers:
        if m in content:
            # Find from here to return res.json({ jobId, results });
            idx = content.index(m)
            # Go back to find the start of the comment block
            block_start = content.rfind('\n      //', 0, idx) + 1
            if block_start == 0:
                block_start = idx
            block_end = content.index(SCAFFOLD_MARKER, idx) + len(SCAFFOLD_MARKER)
            old_scaffold = content[block_start:block_end]
            new_scaffold = '''\
      // Scaffold lifecycle:
      // 1. Orphan cleanup — delete uninvited scaffolds for this client.
      // 2. Reuse — refresh skill_tags if a scaffold for client+title+engType already exists.
      // 3. Insert — only if no existing scaffold. description='' (never internal marker text).
      const safeCategory: string = (typeof category === "string" && category.trim()) ? category.trim() : "other";

      await query(
        `DELETE FROM jobs
         WHERE client_id = $1
           AND created_via = 'search_scaffold'
           AND id NOT IN (SELECT DISTINCT job_id FROM job_submissions WHERE client_id = $1)`,
        [userId],
      ).catch((e: any) => console.warn("scaffold orphan cleanup:", e?.message));

      const existingScaffold = await query(
        `SELECT id FROM jobs WHERE client_id=$1 AND title=$2 AND engagement_type=$3 AND created_via='search_scaffold' LIMIT 1`,
        [userId, title, engagementType],
      );

      let jobId: string;
      if (existingScaffold.rows.length > 0) {
        jobId = existingScaffold.rows[0].id as string;
        await query(`UPDATE jobs SET skill_tags=$1, updated_at=NOW() WHERE id=$2`, [skillTags, jobId])
          .catch((e: any) => console.warn("scaffold refresh:", e?.message));
      } else {
        const jobResult = await query(
          `INSERT INTO jobs
             (id, title, professional_role_name, category, job_function, engagement_type,
              status, approval_status, is_client_submitted, client_id, created_via, description,
              skill_tags, experience_level)
           VALUES (gen_random_uuid(), $1, $1, $2, $2, $3, 'draft', 'approved', true, $4, 'search_scaffold', '', $5, 'intermediate')
           RETURNING id`,
          [title, safeCategory, engagementType, userId, skillTags],
        );
        jobId = jobResult.rows[0].id as string;
      }

      const rawResults = await storage.rankTalentForJob(jobId, 30);

      // Client-safe DTO: server-mask names ("Jane S."), strip all sensitive fields.
      const results = rawResults.map(({ candidateId, userId: talentUserId, score, overlapSkills, matchReasons, candidate }) => ({
        candidateId,
        userId: talentUserId,
        score,
        overlapSkills,
        matchReasons,
        candidate: (() => {
          const rawName: string | null = (candidate as any).fullName ?? (candidate as any).full_name ?? null;
          const maskedName = (() => {
            if (!rawName || rawName.toLowerCase().startsWith("candidate ")) return null;
            const parts = rawName.trim().split(/\\s+/).filter(Boolean);
            if (parts.length === 1) return parts[0][0] + "••••";
            return parts[0] + " " + (parts[1]?.[0] ?? "") + ".";
          })();
          return {
            maskedName,
            targetPosition:  (candidate as any).targetPosition  ?? (candidate as any).target_position  ?? null,
            location:        (candidate as any).location        ?? null,
            seniority:       (candidate as any).seniority       ?? null,
            coreSkills:      (candidate as any).coreSkills      ?? (candidate as any).core_skills      ?? [],
            secondarySkills: (candidate as any).secondarySkills ?? (candidate as any).secondary_skills ?? [],
            category:        (candidate as any).category        ?? null,
          };
        })(),
      }));

      return res.json({ jobId, results });'''
            content = content[:block_start] + new_scaffold + content[block_end:]
            applied.append('3:scaffold-lifecycle')
            found_scaffold = True
            break
    if not found_scaffold:
        missed.append('3:scaffold-lifecycle')
else:
    applied.append('3:scaffold-lifecycle (already present or no marker)')

# ── 4. POST /api/client/invitations: scaffold+talent-role check ───────────────
if "created_via = 'search_scaffold'" not in content[content.find('client/invitations'):content.find('client/invitations')+3000] if 'client/invitations' in content else True:
    apply('4:invitations-scaffold-check',
        "      // Verify the job belongs to this client\n"
        "      const jobCheck = await query(\n"
        "        `SELECT id FROM jobs WHERE id = $1 AND client_id = $2`,\n"
        "        [jobId, clientId],\n"
        "      );\n"
        "      if (!jobCheck.rows.length) {\n"
        "        return res.status(403).json({ error: \"Job not found or not owned by you\" });\n"
        "      }",
        "      // Verify the job belongs to this client AND is a search scaffold\n"
        "      const jobCheck = await query(\n"
        "        `SELECT id FROM jobs WHERE id = $1 AND client_id = $2 AND created_via = 'search_scaffold'`,\n"
        "        [jobId, clientId],\n"
        "      );\n"
        "      if (!jobCheck.rows.length) {\n"
        "        return res.status(403).json({ error: \"Job not found, not owned by you, or not a search scaffold\" });\n"
        "      }\n"
        "\n"
        "      // Verify the target user exists and has the talent role\n"
        "      const talentCheck = await query(\n"
        "        `SELECT id FROM users WHERE id = $1 AND role = 'talent'`,\n"
        "        [talentUserId],\n"
        "      );\n"
        "      if (!talentCheck.rows.length) {\n"
        "        return res.status(400).json({ error: \"Target user is not a talent account\" });\n"
        "      }"
    )
else:
    applied.append('4:invitations-scaffold-check (already present)')

# ── 5. POST /api/client/invitations: null description ────────────────────────
if 'const jobDescription: string | null = null' not in content:
    for old5 in [
        "      // Fetch job title & description for the invitation email\n"
        "      const jobRow = await query(\n"
        "        `SELECT title, description FROM jobs WHERE id = $1 LIMIT 1`,\n"
        "        [jobId],\n"
        "      );\n"
        "      const jobTitle = jobRow.rows[0]?.title ?? \"a new role\";\n"
        "      const jobDescription = jobRow.rows[0]?.description ?? null;",
        # variant with created_via
        "      const jobRow = await query(\n"
        "        `SELECT title, created_via FROM jobs WHERE id = $1 LIMIT 1`,\n"
        "        [jobId],\n"
        "      );\n"
        "      const jobTitle = jobRow.rows[0]?.title ?? \"a new role\";\n"
        "      // Always null for scaffold jobs; real jobs can expose their description in future\n"
        "      const jobDescription: string | null = null;",
    ]:
        if old5 in content:
            new5 = (
                "      // Fetch job title for the invitation email — never forward scaffold description to talent\n"
                "      const jobRow = await query(\n"
                "        `SELECT title FROM jobs WHERE id = $1 LIMIT 1`,\n"
                "        [jobId],\n"
                "      );\n"
                "      const jobTitle = jobRow.rows[0]?.title ?? \"a new role\";\n"
                "      const jobDescription: string | null = null;"
            )
            content = content.replace(old5, new5, 1)
            applied.append('5:invitations-null-desc')
            break
    else:
        missed.append('5:invitations-null-desc')
else:
    applied.append('5:invitations-null-desc (already present)')

# ── 6. GET /api/talent/invitations: null description for scaffolds ─────────────
if "CASE WHEN j.created_via = 'search_scaffold' THEN NULL" not in content:
    apply('6:talent-invitations-null-desc',
        '                j.description    AS "description"',
        "                CASE WHEN j.created_via = 'search_scaffold' THEN NULL\n"
        '                     ELSE j.description END AS "description"')
else:
    applied.append('6:talent-invitations-null-desc (already present)')

# ── 7. PATCH status: transition guard ────────────────────────────────────────
if 'transition_blocked' not in content:
    old7 = (
        '      const validStatuses = ["new", "reviewed", "shortlisted", "rejected", "hired"];\n'
        '      if (!validStatuses.includes(status)) {\n'
        '        return res.status(400).json({ error: "Invalid status. Must be: new, reviewed, shortlisted, rejected, hired" });\n'
        '      }\n'
        '      const result = await query(\n'
        '        `UPDATE job_submissions SET status = $1, updated_at = NOW()\n'
        '         WHERE id = $2 AND client_id = $3\n'
        '         RETURNING *`,\n'
        '        [status, id, userId],\n'
        '      );\n'
        '      if (result.rows.length === 0) return res.status(404).json({ error: "Submission not found or forbidden" });\n'
        '      return res.json(result.rows[0]);'
    )
    new7 = (
        '      const CLIENT_STATUSES = ["new", "reviewed", "shortlisted", "rejected", "hired"];\n'
        '      if (!CLIENT_STATUSES.includes(status)) {\n'
        '        return res.status(400).json({ error: "Invalid status. Must be one of: new, reviewed, shortlisted, rejected, hired" });\n'
        '      }\n'
        '      // Read current status — talent-controlled states (invited, declined) are immutable by the client\n'
        '      const current = await query(\n'
        '        `SELECT status FROM job_submissions WHERE id = $1 AND client_id = $2`,\n'
        '        [id, userId],\n'
        '      );\n'
        '      if (current.rows.length === 0) return res.status(404).json({ error: "Submission not found or forbidden" });\n'
        '      if (["invited", "declined"].includes(current.rows[0].status)) {\n'
        '        return res.status(409).json({\n'
        '          error: "transition_blocked",\n'
        "          message: `This submission is in '${current.rows[0].status}' state and cannot be changed by the client.`,\n"
        '        });\n'
        '      }\n'
        '      const result = await query(\n'
        '        `UPDATE job_submissions SET status = $1, updated_at = NOW()\n'
        '         WHERE id = $2 AND client_id = $3\n'
        '         RETURNING *`,\n'
        '        [status, id, userId],\n'
        '      );\n'
        '      if (result.rows.length === 0) return res.status(404).json({ error: "Submission not found or forbidden" });\n'
        '      return res.json(result.rows[0]);'
    )
    apply('7:status-transition-guard', old7, new7)
else:
    applied.append('7:status-transition-guard (already present)')

open(path, 'w').write(content)
print(f"Applied ({len(applied)}): {applied}")
print(f"Missed  ({len(missed)}): {missed}")
sys.exit(0 if not missed else 1)
