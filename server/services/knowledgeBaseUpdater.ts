/**
 * knowledgeBaseUpdater.ts
 *
 * Generates a clean, human-readable platform knowledge file for Vanessa AI.
 * Scans relevant project files to extract product workflow knowledge, then
 * writes a structured summary to resources/platform_knowledge.auto.txt.
 *
 * SAFETY: Never includes secrets, API keys, tokens, passwords, database URLs,
 * environment variables, raw source code, or personal user data.
 */

import fs from "fs";
import path from "path";

// ── Paths ──────────────────────────────────────────────────────────────────────
const RESOURCES_DIR = path.join(process.cwd(), "resources");
export const PLATFORM_KNOWLEDGE_PATH = path.join(RESOURCES_DIR, "platform_knowledge.auto.txt");

// ── Secret patterns to redact ──────────────────────────────────────────────────
const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9\-_]{20,}/g,             // OpenAI API keys
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,     // Bearer tokens
  /process\.env\.[A-Z_]+\s*=\s*\S+/g,    // env assignments
  /OPENAI_API_KEY/gi,
  /DATABASE_URL/gi,
  /JWT_SECRET/gi,
  /password_hash/gi,
  /STRIPE_SECRET/gi,
  /GHL_API_KEY/gi,
];

// ── Files to scan ──────────────────────────────────────────────────────────────
const FILES_TO_SCAN = [
  { path: "server/routes.ts", label: "API Routes" },
  { path: "shared/schema.ts", label: "Data Schema" },
  { path: "client/src/pages/ClientProfile.tsx", label: "Client Profile" },
  { path: "client/src/pages/FindBestMatches.tsx", label: "Talent Registration / Find Best Matches" },
  { path: "client/src/pages/TalentPool.tsx", label: "Talent Pool" },
  { path: "client/src/pages/TalentProfile.tsx", label: "Talent Profile" },
  { path: "client/src/pages/FindWork.tsx", label: "Find Work (Job Board)" },
  { path: "client/src/pages/HireTalentPage.tsx", label: "Hire Talent Page" },
  { path: "client/src/pages/Dashboard.tsx", label: "Dashboard" },
  { path: "client/src/pages/AdminDashboard.tsx", label: "Admin Dashboard" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function scrubSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function safeRead(filePath: string): { content: string; ok: true } | { ok: false } {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  [KnowledgeUpdater] File not found, skipping: ${filePath}`);
      return { ok: false };
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    return { content, ok: true };
  } catch (error) {
    console.warn(`⚠️  [KnowledgeUpdater] Could not read ${filePath}:`, error);
    return { ok: false };
  }
}

function extractApiRouteGroups(content: string): {
  clientRoutes: string[];
  talentRoutes: string[];
  jobRoutes: string[];
  authRoutes: string[];
} {
  const allRoutes: string[] = [];
  for (const match of content.matchAll(/app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
    allRoutes.push(`${match[1].toUpperCase()} ${match[2]}`);
  }
  const unique = [...new Set(allRoutes)];
  return {
    clientRoutes: unique.filter(r => /\/(client|client-profile)/i.test(r)),
    talentRoutes: unique.filter(r => /\/(talent|candidate|resume)/i.test(r)),
    jobRoutes: unique.filter(r => /\/job/i.test(r)),
    authRoutes: unique.filter(r => /\/(signup|login|auth)/i.test(r)),
  };
}

function extractSchemaEntities(content: string): string[] {
  return [...content.matchAll(/export const (\w+)\s*=\s*pgTable/g)].map(m => m[1]);
}

// ── Main generator ─────────────────────────────────────────────────────────────

export async function generatePlatformKnowledge(): Promise<string> {
  console.log("📚 [KnowledgeUpdater] Starting platform knowledge generation...");
  let scannedCount = 0;

  // Scan all files
  const scanResults: Record<string, string> = {};
  for (const spec of FILES_TO_SCAN) {
    const result = safeRead(spec.path);
    if (result.ok) {
      scanResults[spec.path] = result.content;
      scannedCount++;
    }
  }
  console.log(`📚 [KnowledgeUpdater] Scanned ${scannedCount} of ${FILES_TO_SCAN.length} files`);

  // Extract dynamic info
  let routesSupplement = "";
  let schemaSupplement = "";

  const routesContent = scanResults["server/routes.ts"];
  if (routesContent) {
    const { clientRoutes, talentRoutes, jobRoutes, authRoutes } = extractApiRouteGroups(routesContent);
    const cap = (arr: string[]) => arr.slice(0, 12).join(", ");
    routesSupplement = [
      authRoutes.length   ? `Auth endpoints: ${cap(authRoutes)}`   : "",
      clientRoutes.length ? `Client endpoints: ${cap(clientRoutes)}` : "",
      talentRoutes.length ? `Talent endpoints: ${cap(talentRoutes)}` : "",
      jobRoutes.length    ? `Job endpoints: ${cap(jobRoutes)}`     : "",
    ].filter(Boolean).join("\n- ");
    if (routesSupplement) routesSupplement = "- " + routesSupplement;
  }

  const schemaContent = scanResults["shared/schema.ts"];
  if (schemaContent) {
    const entities = extractSchemaEntities(schemaContent);
    if (entities.length > 0) {
      schemaSupplement = `- Database entities tracked: ${entities.join(", ")}`;
    }
  }

  const timestamp = new Date().toISOString();

  const knowledge = `=== Auto-Generated Platform Knowledge ===
Last Updated: ${timestamp}

IMPORTANT: This file documents the CURRENTLY IMPLEMENTED behavior of the OnSpot Global platform.
When this internal platform knowledge differs from public website information, PRIORITIZE THIS FILE
because it reflects the actual, current state of the application — not marketing copy.

─────────────────────────────────────────────
Client Workflow:
─────────────────────────────────────────────
- Clients can sign up or log in directly on the OnSpot Global platform (no manual contact required to get started).
- Client signup uses email and password. The role is set to "client" during registration.
- After logging in, clients land on their Client Profile (accessible at /client-profile).
- The Client Profile page shows: company name, contact person, email, phone, website, industry, company size, location, about, hiring needs, preferred roles, and timezone.
- Clients can edit all their profile fields directly on the Client Profile page.
- IMPORTANT: Clients CAN create and post job openings DIRECTLY from their Client Profile. They do NOT need to contact OnSpot manually to post a job.
- From the Client Profile, clients can: add new job postings (click the "+ Post a Job" button), edit existing job postings, toggle jobs between open and closed status, view job details, and delete job postings.
- All jobs a client has posted are listed on their Client Profile page.
- Client-posted jobs immediately appear on the public Find Work / job board page for talent to apply.
${routesSupplement ? routesSupplement + "\n" : ""}
─────────────────────────────────────────────
Talent Workflow:
─────────────────────────────────────────────
- Talents (candidates) register by visiting the Find Best Matches page (at /find-best-matches).
- The registration flow has 7 steps: (1) Resume Upload, (2) Profile Finalization, (3) Account Setup, (4) Success, (5) Culture Evaluation, (6) Culture Results, (7) Job Matches.
- Step 1 — Resume/CV Upload: Talent uploads a PDF or DOCX resume file. This is required to start.
- Step 2 — Profile Finalization: The platform automatically parses and extracts resume data into profile fields: full name, email, phone, location, target position, job category, years of experience, seniority level, core skills (from a predefined list), secondary skills (free-text), work history entries, preferred work setup (Remote/Hybrid/On-site), preferred shift, preferred job type (Full-time/Part-time), and summary. Talent reviews and edits all extracted fields before saving.
- Step 3 — Account Setup: After saving the profile, talent sets up an account with email and password, or logs in if they already have one. This links the saved profile to a talent account.
- Step 4 — Success: Profile is confirmed saved. Two options: "Continue Setup" (go to culture evaluation) or "View My Profile" (navigate to the public talent profile page).
- Step 5 — Culture Evaluation: Talent answers values-based questions. This generates a culture score used in matching.
- Step 6 — Culture Results: Talent sees their culture alignment score and breakdown.
- Step 7 — Job Matches: The platform shows personalized job matches based on the talent's profile and culture score. Match scoring uses: skills overlap, domain match, experience level, work preferences, and values bonus.
- Talent authentication uses a separate JWT system (stored as talent_profile_token in localStorage).
- Talents have a public Talent Profile page at /talent-profile/:id (LinkedIn-inspired layout with sticky nav).
- Talent can edit their own profile inline (after signing in with their talent account).
- Talents can upload a profile photo and update/re-upload their resume directly from the Talent Profile page.

─────────────────────────────────────────────
Job Posting Workflow:
─────────────────────────────────────────────
- Clients post jobs from their Client Profile — click "+ Post a Job" to open the job creation form.
- Job fields include: title, description, category, location, work setup, contract type, salary/rate range, and status.
- Published (open) jobs appear on the public Find Work page (/find-work), searchable and filterable by talent.
- Each job has a public detail page at /find-work/job/:id with full details and apply information.
- Admins can also create, edit, and manage all job postings from the Admin Dashboard.
- Clients can toggle their jobs open or closed at any time from their Client Profile.
- Closed jobs are removed from the public job board but preserved in the client's profile.
- Job postings support: skills requirements, cultural fit fields, and full CRUD (create, read, update, delete).

─────────────────────────────────────────────
Resume/CV and Profile Workflow:
─────────────────────────────────────────────
- Talent uploads a Resume/CV (PDF or DOCX) in Step 1 of the Find Best Matches flow.
- The platform parses the resume automatically using the resume parser service (POST /api/resume/parse).
- Parsed fields include: full name, contact info, target position, job category, experience level, seniority, skills, and work history.
- Talent reviews and can edit all auto-extracted fields in Step 2 (Profile Finalization) before saving.
- Profile is saved to the database after account creation (Step 3).
- Talent can later re-upload a new resume file directly on their public Talent Profile page (/talent-profile/:id).
- The resume file is stored and linked to the profile (accessible for download from the Talent Profile).
- Profile data (skills, experience, preferences) feeds directly into job matching and Talent Pool visibility.
- A profile photo can be uploaded from the Talent Profile page (owner only, after signing in).

─────────────────────────────────────────────
Talent Pool and Matching Workflow:
─────────────────────────────────────────────
- The Talent Pool (/talent-pool) displays a searchable, filterable grid of pre-assessed candidates.
- Talent Pool is visible to: Admins, Talent Acquisition users, and logged-in Clients.
- Candidate cards show: name, profile photo, headline, top skills, experience level, location, preferred work setup, and a match score.
- Match scoring is performed client-side using a weighted algorithm: skills overlap (primary), domain match, experience level, work preference compatibility, and values/culture bonus.
- Match labels displayed on cards: "Best Match" (score ≥ 70), "Strong Match" (50–69), "Possible Match" (30–49). Candidates below 30 are hidden.
- Available filters: job category, years of experience, location preference, and work setup (Remote/Hybrid/On-site).
- Contact details (email/phone) are gated — visible only to Admin and Talent Acquisition roles.
- Clients can shortlist (bookmark) candidates from the Talent Pool.
- Each candidate card has a "Full Profile" button linking to their public /talent-profile/:id page.
- The Find Best Matches flow (Step 7) shows personalized job matches immediately after culture evaluation.
- The matching engine uses domain-first scoring with hard incompatibility rejection and a match threshold of 35 (Find Best Matches) or 30 (Talent Pool).
${schemaSupplement ? schemaSupplement + "\n" : ""}
─────────────────────────────────────────────
Integration and Automation Workflow:
─────────────────────────────────────────────
- GoHighLevel (GHL) CRM: Lead intake forms and waitlist submissions auto-sync to GHL pipelines every 15 minutes.
- Stripe: Payment processing, Stripe Connect payouts, multi-currency (USD, PHP).
- VanessaChat (Vanessa AI): OpenAI Assistant API with streaming, RAG retrieval, two-tier memory, and self-learning.
- Website crawler: onspotglobal.com is crawled daily at 3:00 AM to keep Vanessa updated with public content.
- Lindy.ai: Embedded chatbot for additional customer support.

─────────────────────────────────────────────
User Roles and Permissions:
─────────────────────────────────────────────
- admin: Full platform access — manage all users, jobs, candidates, content, and settings.
- client: Can sign up, log in, manage Client Profile, post/manage job openings, and browse Talent Pool.
- talent: Registers via Find Best Matches, manages their Talent Profile, uploads resume/CV, views job matches.
- Unauthenticated visitors can browse the public job board (Find Work) and view public talent profiles.
- Talent authentication is separate from the main JWT system. Talent tokens stored as talent_profile_token in localStorage.
- Contact details in Talent Pool are restricted to admin and talent acquisition roles.

─────────────────────────────────────────────
Important User Guidance:
─────────────────────────────────────────────
- "As a client, how do I add a job opening?" → Log in to your client account, navigate to your Client Profile page, and click "+ Post a Job". Fill in the job details and publish. Your job will immediately appear on the Find Work page. You do NOT need to contact OnSpot manually to post a job.
- "As a talent, how do I get started?" → Visit the Find Best Matches page (/find-best-matches) and upload your Resume/CV (PDF or DOCX). The platform will auto-extract your information and guide you through a 7-step process: resume upload → profile setup → account creation → culture evaluation → job matching.
- "Where can I browse available jobs?" → Visit the Find Work page (/find-work) to see all open positions. Filter by category, location, experience level, or work setup.
- "How does the Talent Pool work?" → It shows pre-assessed candidates with match scores. Clients and TA users can search, filter, and shortlist. Each candidate's score is based on skills, experience, and cultural fit.
- "Can I upload my resume?" → Yes. Talent uploads their Resume/CV during registration (Find Best Matches Step 1). You can also update it later directly on your Talent Profile page.
- "How do I edit my talent profile?" → Go to your Talent Profile at /talent-profile/:id and sign in with your talent account credentials. Once authenticated, edit any section inline.
- "Can clients post jobs without contacting OnSpot?" → Yes. Clients with an account can post jobs directly from their Client Profile — no manual contact needed, though guided support is always available.

=== End Auto-Generated Platform Knowledge ===`;

  return scrubSecrets(knowledge);
}

// ── Save ───────────────────────────────────────────────────────────────────────

export async function savePlatformKnowledge(): Promise<{
  filePath: string;
  timestamp: string;
  success: boolean;
  error?: string;
  validation?: ReturnType<typeof validatePlatformKnowledge>;
}> {
  const timestamp = new Date().toISOString();
  try {
    const knowledge = await generatePlatformKnowledge();

    if (!fs.existsSync(RESOURCES_DIR)) {
      fs.mkdirSync(RESOURCES_DIR, { recursive: true });
    }

    fs.writeFileSync(PLATFORM_KNOWLEDGE_PATH, knowledge, "utf-8");
    console.log(`✅ [KnowledgeUpdater] Platform knowledge saved → ${PLATFORM_KNOWLEDGE_PATH}`);

    const validation = validatePlatformKnowledge();
    if (!validation.valid) {
      console.warn(`⚠️  [KnowledgeUpdater] Validation issues:`, validation.errors);
    } else {
      console.log(`✅ [KnowledgeUpdater] Validation passed — all required sections present, no secrets detected`);
    }

    return { filePath: PLATFORM_KNOWLEDGE_PATH, timestamp, success: true, validation };
  } catch (error: any) {
    console.error(`❌ [KnowledgeUpdater] Failed to generate platform knowledge:`, error);
    return { filePath: PLATFORM_KNOWLEDGE_PATH, timestamp, success: false, error: error.message };
  }
}

// ── Validate ───────────────────────────────────────────────────────────────────

export function validatePlatformKnowledge(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(PLATFORM_KNOWLEDGE_PATH)) {
    errors.push("platform_knowledge.auto.txt does not exist");
    return { valid: false, warnings, errors };
  }

  const content = fs.readFileSync(PLATFORM_KNOWLEDGE_PATH, "utf-8");

  // Required sections
  const requiredSections = [
    "Client Workflow",
    "Talent Workflow",
    "Job Posting Workflow",
    "Resume/CV and Profile Workflow",
    "Talent Pool and Matching Workflow",
  ];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  // Secret patterns — must NOT appear with values
  const secretChecks: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /sk-[a-zA-Z0-9\-_]{20,}/, label: "OpenAI API key" },
    { pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]{10,}/, label: "Bearer token" },
    { pattern: /OPENAI_API_KEY\s*[:=]\s*\S+/, label: "OPENAI_API_KEY value" },
    { pattern: /DATABASE_URL\s*[:=]\s*\S+/, label: "DATABASE_URL value" },
    { pattern: /JWT_SECRET\s*[:=]\s*\S+/, label: "JWT_SECRET value" },
    { pattern: /password_hash\s*[:=]\s*\S+/, label: "password_hash value" },
  ];
  for (const { pattern, label } of secretChecks) {
    if (pattern.test(content)) {
      errors.push(`Secret pattern detected: ${label}`);
    }
  }

  // File should not be empty
  if (content.trim().length < 100) {
    errors.push("Generated file appears to be too short — may be empty or malformed");
  }

  return { valid: errors.length === 0, warnings, errors };
}

// ── Load (for use by openaiService) ───────────────────────────────────────────

export function loadPlatformKnowledge(): string {
  try {
    if (fs.existsSync(PLATFORM_KNOWLEDGE_PATH)) {
      return fs.readFileSync(PLATFORM_KNOWLEDGE_PATH, "utf-8");
    }
    return "";
  } catch {
    return "";
  }
}
