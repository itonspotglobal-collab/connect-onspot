import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { ObjectStorageService, objectStorageClient } from "../objectStorage.js";
import {
  applicationUploadErrorResponse,
  isAcceptedApplicationVideoMime,
  registerRoutes,
} from "../routes.js";

const suffix = Date.now();
const clientId = `application-flow-client-${suffix}`;
const talentId = `application-flow-talent-${suffix}`;
const clientEmail = `${clientId}@test.example`;
const talentEmail = `${talentId}@test.example`;
const adminId = `application-flow-admin-${suffix}`;
const adminEmail = `application-flow-${suffix}@onspotglobal.com`;
const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
const talentToken = jwt.sign(
  { userId: talentId, email: talentEmail, role: "talent" },
  jwtSecret,
  { expiresIn: "1h" },
);
const adminToken = jwt.sign(
  { userId: adminId, email: adminEmail, role: "admin" },
  jwtSecret,
  { expiresIn: "1h" },
);

let server: http.Server;
let jobId: string;
let requiredVideoJobId: string;
let candidateId: string;
let otherTalentId: string;
let otherCandidateId: string;
const submissionIds: string[] = [];
const uploadedVideoPaths: string[] = [];

function request(method: string, path: string, body: unknown, token = talentToken) {
  const { port } = server.address() as { port: number };
  const data = JSON.stringify(body);
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode ?? 0, json });
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function multipartApply(
  targetJobId: string,
  video: { name: string; type: string; bytes: Uint8Array } | null,
  overrides: Record<string, string> = {},
  token = talentToken,
) {
  const { port } = server.address() as { port: number };
  const form = new FormData();
  const fields = {
    firstName: "Application",
    lastName: "Talent",
    email: talentEmail,
    phone: "+1 555 0199",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (video) form.append("video", new Blob([video.bytes], { type: video.type }), video.name);
  const response = await fetch(`http://127.0.0.1:${port}/api/jobs/${targetJobId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return {
    status: response.status,
    json: await response.json().catch(() => null),
  };
}

async function adminFetchVideo(applicationId: string) {
  const { port } = server.address() as { port: number };
  const response = await fetch(`http://127.0.0.1:${port}/api/admin/job-applications/${applicationId}/video`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return {
    status: response.status,
    disposition: response.headers.get("content-disposition"),
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

async function oversizedVideoApply(targetJobId: string) {
  const { port } = server.address() as { port: number };
  const boundary = `onspot-video-limit-${suffix}`;
  const textField = (name: string, value: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const prefix = Buffer.from(
    textField("firstName", "Application") +
      textField("lastName", "Talent") +
      textField("email", talentEmail) +
      textField("phone", "+1 555 0177") +
      `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="too-large.mp4"\r\n` +
      `Content-Type: video/mp4\r\n\r\n`,
  );
  const suffixBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fileBytes = 201 * 1024 * 1024;
  const reusableMegabyte = Buffer.alloc(1024 * 1024);

  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: `/api/jobs/${targetJobId}/apply`,
      headers: {
        Authorization: `Bearer ${talentToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": prefix.length + fileBytes + suffixBuffer.length,
      },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode ?? 0, json });
      });
    });
    req.on("error", reject);

    void (async () => {
      req.write(prefix);
      for (let sent = 0; sent < fileBytes; sent += reusableMegabyte.length) {
        if (!req.write(reusableMegabyte)) await once(req, "drain");
      }
      req.end(suffixBuffer);
    })().catch(reject);
  });
}

async function listApplicationVideoObjects() {
  const privateObjectDir = new ObjectStorageService().getPrivateObjectDir();
  const parts = privateObjectDir.split("/").filter(Boolean);
  const bucketName = parts.shift();
  assert.ok(bucketName, "private object bucket must be configured");
  const prefix = `${parts.join("/")}${parts.length ? "/" : ""}application-videos/`;
  const [files] = await objectStorageClient.bucket(bucketName).getFiles({ prefix });
  return new Set(files.map((file) => file.name));
}

describe("canonical job application submission", () => {
  before(async () => {
    await query(
      `INSERT INTO users (id, email, role, first_name, last_name, admin_sub_role)
        VALUES ($1, $2, 'client', 'Application', 'Client', NULL),
               ($3, $4, 'talent', 'Application', 'Talent', NULL),
               ($5, $6, 'admin', 'Application', 'Admin', 'talent_acquisition')`,
      [clientId, clientEmail, talentId, talentEmail, adminId, adminEmail],
    );
    jobId = (await query(
      `INSERT INTO jobs
         (client_id, title, description, category, experience_level, status, engagement_type, application_method)
       VALUES ($1, 'Application Flow Test', 'Test job', 'Engineering', 'intermediate', 'open', 'Standard', 'built_in_form')
       RETURNING id`,
      [clientId],
    )).rows[0].id;
    requiredVideoJobId = (await query(
      `INSERT INTO jobs
         (client_id, title, description, category, experience_level, status, engagement_type, application_method, requires_video_intro)
       VALUES ($1, 'Video Application Flow Test', 'Test job', 'Engineering', 'intermediate', 'open', 'Standard', 'built_in_form', true)
       RETURNING id`,
      [clientId],
    )).rows[0].id;
    candidateId = `application-flow-candidate-${suffix}`;
    await query(
      `INSERT INTO candidates (id, user_id, email, full_name, target_position, category, video_intro_url, video_intro_file_name)
       VALUES ($1, $2, $3, 'Application Talent', 'Engineer', 'Engineering', '/objects/candidate-videos/owned-video', 'owned-intro.webm')`,
      [candidateId, talentId, talentEmail],
    );

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    // Let fire-and-forget application email writes settle before removing their
    // parent submissions, then delete all fixture dependents in FK-safe order.
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (submissionIds.length) {
      await query(`DELETE FROM job_application_emails WHERE application_id = ANY($1::varchar[])`, [submissionIds]).catch(() => {});
      await query(`DELETE FROM notifications WHERE related_id = ANY($1::varchar[])`, [submissionIds]).catch(() => {});
      await query(`DELETE FROM application_tokens WHERE submission_id = ANY($1::varchar[])`, [submissionIds]).catch(() => {});
      await query(`DELETE FROM job_application_status_history WHERE application_id = ANY($1::varchar[])`, [submissionIds]).catch(() => {});
      await query(`DELETE FROM job_submissions WHERE id = ANY($1::varchar[])`, [submissionIds]).catch(() => {});
    }
    for (const path of uploadedVideoPaths) {
      try {
        const file = await new ObjectStorageService().getObjectEntityFile(path);
        await file.delete({ ignoreNotFound: true });
      } catch {
        // A prior assertion or route rollback may already have removed it.
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
    await query(`DELETE FROM jobs WHERE id = $1`, [requiredVideoJobId]).catch(() => {});
    await query(`DELETE FROM candidates WHERE id = ANY($1::text[])`, [[candidateId, otherCandidateId].filter(Boolean)]).catch(() => {});
    await query(`DELETE FROM notifications WHERE user_id = ANY($1::text[])`, [[clientId, talentId, otherTalentId, adminId].filter(Boolean)]).catch(() => {});
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[clientId, talentId, otherTalentId, adminId].filter(Boolean)]).catch(() => {});
  });

  it("submits the visible application flow through job_submissions", async () => {
    const response = await request("POST", `/api/jobs/${jobId}/apply`, {
      firstName: "Application",
      lastName: "Talent",
      email: talentEmail,
      phone: "+1 555 0100",
      coverLetter: "I have the relevant experience and would be excited to contribute to this role.",
      proposedBudget: "1500",
      estimatedDuration: "3 weeks",
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.success, true);
    const submissionId = response.json.applicationId;
    submissionIds.push(submissionId);
    const stored = await query(
      `SELECT talent_id, status, cover_letter
               , proposed_rate, proposed_budget, estimated_duration
         FROM job_submissions
        WHERE id = $1`,
      [submissionId],
    );
    assert.equal(stored.rows[0].talent_id, talentId);
    assert.equal(stored.rows[0].status, "new");
    assert.equal(stored.rows[0].cover_letter, "I have the relevant experience and would be excited to contribute to this role.");
    assert.equal(stored.rows[0].proposed_rate, null);
    assert.equal(Number(stored.rows[0].proposed_budget), 1500);
    assert.equal(stored.rows[0].estimated_duration, "3 weeks");
  });

  it("rejects a required-video job without an upload or owned profile video", async () => {
    const response = await request("POST", `/api/jobs/${requiredVideoJobId}/apply`, {
      firstName: "Application", lastName: "Talent", email: talentEmail, phone: "+1 555 0101",
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.error, "video_required");
  });

  it("reuses only the authenticated talent's profile video and persists it", async () => {
    const portalToken = jwt.sign(
      { type: "candidate", candidateId, email: talentEmail },
      jwtSecret,
      { expiresIn: "1h" },
    );
    const response = await request("POST", `/api/jobs/${requiredVideoJobId}/apply`, {
      firstName: "Application", lastName: "Talent",
      // Contact email must not control which profile media is selected.
      email: "different-contact@test.example", phone: "+1 555 0102", useProfileVideo: "true",
    }, portalToken);
    assert.equal(response.status, 201);
    submissionIds.push(response.json.applicationId);
    const stored = await query(
      `SELECT video_introduction_url, video_introduction_file_name FROM job_submissions WHERE id = $1`,
      [response.json.applicationId],
    );
    assert.equal(stored.rows[0].video_introduction_url, "/objects/candidate-videos/owned-video");
    assert.equal(stored.rows[0].video_introduction_file_name, "owned-intro.webm");
  });

  it("does not reuse another talent's profile video based on submitted email", async () => {
    otherTalentId = `application-flow-other-talent-${suffix}`;
    otherCandidateId = `application-flow-other-candidate-${suffix}`;
    const otherEmail = `${otherTalentId}@test.example`;
    await query(
      `INSERT INTO users (id, email, role, first_name, last_name) VALUES ($1, $2, 'talent', 'Other', 'Talent')`,
      [otherTalentId, otherEmail],
    );
    await query(
      `INSERT INTO candidates (id, user_id, email, full_name, target_position, category)
       VALUES ($1, $2, $3, 'Other Talent', 'Engineer', 'Engineering')`,
      [otherCandidateId, otherTalentId, otherEmail],
    );
    const otherToken = jwt.sign({ userId: otherTalentId, email: otherEmail, role: "talent" }, jwtSecret, { expiresIn: "1h" });
    const response = await request("POST", `/api/jobs/${requiredVideoJobId}/apply`, {
      firstName: "Other", lastName: "Talent", email: talentEmail, phone: "+1 555 0103", useProfileVideo: "true",
    }, otherToken);
    assert.equal(response.status, 400);
    assert.equal(response.json.error, "profile_video_unavailable");
  });

  it("uploads MP4 and WebM videos, persists their private paths, and serves them through the authorized Admin proxy", async () => {
    for (const fixture of [
      { name: "intro.mp4", type: "video/mp4", bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) },
      { name: "intro.webm", type: "video/webm", bytes: new Uint8Array([26, 69, 223, 163, 159, 66, 134, 129]) },
    ]) {
      const response = await multipartApply(requiredVideoJobId, fixture);
      assert.equal(response.status, 201);
      submissionIds.push(response.json.applicationId);

      const stored = await query(
        `SELECT video_introduction_url, video_introduction_file_name
           FROM job_submissions WHERE id = $1`,
        [response.json.applicationId],
      );
      assert.match(stored.rows[0].video_introduction_url, /^\/objects\/application-videos\//);
      assert.equal(stored.rows[0].video_introduction_file_name, fixture.name);
      uploadedVideoPaths.push(stored.rows[0].video_introduction_url);

      const adminVideo = await adminFetchVideo(response.json.applicationId);
      assert.equal(adminVideo.status, 200);
      assert.match(adminVideo.disposition ?? "", /^inline;/);
      assert.deepEqual(adminVideo.bytes, fixture.bytes);
    }
  });

  it("rejects unsupported video MIME without creating a submission", async () => {
    const before = await query(`SELECT COUNT(*)::int AS count FROM job_submissions WHERE job_id = $1`, [requiredVideoJobId]);
    const response = await multipartApply(requiredVideoJobId, {
      name: "not-a-video.png",
      type: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.error, "invalid_video_type");
    const after = await query(`SELECT COUNT(*)::int AS count FROM job_submissions WHERE job_id = $1`, [requiredVideoJobId]);
    assert.equal(after.rows[0].count, before.rows[0].count);
  });

  it("removes a newly uploaded application video when later application validation fails", async () => {
    const before = await listApplicationVideoObjects();
    const response = await multipartApply(
      requiredVideoJobId,
      { name: "rollback.webm", type: "video/webm", bytes: new Uint8Array([26, 69, 223, 163]) },
      { firstName: "" },
    );
    assert.equal(response.status, 400);
    // Object deletion is awaited by the route before it sends the validation response.
    const after = await listApplicationVideoObjects();
    assert.deepEqual(after, before);
  });

  it("returns a controlled 413 for a real multipart video over 200 MB without side effects", async () => {
    const objectsBefore = await listApplicationVideoObjects();
    const submissionsBefore = await query(
      `SELECT COUNT(*)::int AS count FROM job_submissions WHERE job_id = $1`,
      [requiredVideoJobId],
    );
    const response = await oversizedVideoApply(requiredVideoJobId);
    assert.equal(response.status, 413);
    assert.deepEqual(response.json, {
      error: "video_too_large",
      message: "Video must be 200 MB or smaller.",
    });
    const submissionsAfter = await query(
      `SELECT COUNT(*)::int AS count FROM job_submissions WHERE job_id = $1`,
      [requiredVideoJobId],
    );
    assert.equal(submissionsAfter.rows[0].count, submissionsBefore.rows[0].count);
    assert.deepEqual(await listApplicationVideoObjects(), objectsBefore);
  });
});

describe("application video upload policy", () => {
  it("accepts MP4 and WebM MIME types and rejects unsupported types", () => {
    assert.equal(isAcceptedApplicationVideoMime("video/mp4"), true);
    assert.equal(isAcceptedApplicationVideoMime("video/webm"), true);
    assert.equal(isAcceptedApplicationVideoMime("video/quicktime"), true);
    assert.equal(isAcceptedApplicationVideoMime("image/png"), false);
  });

  it("maps Multer video size limits to the controlled API response", () => {
    assert.deepEqual(applicationUploadErrorResponse({ code: "LIMIT_FILE_SIZE", field: "video" }), {
      status: 413,
      body: { error: "video_too_large", message: "Video must be 200 MB or smaller." },
    });
  });
});