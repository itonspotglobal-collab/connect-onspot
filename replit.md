# OnSpot

### Overview
OnSpot is an outsourcing management system designed to simplify B2B and B2C outsourcing by integrating BPO services and freelancing. It leverages AI for talent matching, performance management, and project coordination. The platform provides a comprehensive solution for managing talent, projects, and client relationships with real-time tracking and automated workflows, featuring an Apple-inspired design.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture

#### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui components on Radix UI, styled with Tailwind CSS, adhering to Apple Human Interface Guidelines.
- **State Management**: TanStack React Query.
- **Routing**: Wouter for client-side routing, supporting multi-portal domain-based routing and immersive full-screen routes.
- **Design System**: Apple-inspired interface with light/dark mode, consistent spacing, and SF Pro Display fonts.

#### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API.
- **Database Layer**: Drizzle ORM, utilizing a Repository pattern (`IStorage`).
- **Middleware**: Custom logging and error handling.

#### Data Storage
- **Database**: PostgreSQL hosted on Neon (serverless).
- **ORM**: Drizzle ORM with a schema-first approach, supporting various entities like users, profiles, skills, jobs, and payments.
- **Migrations**: Drizzle Kit.

#### Authentication & Authorization
- **Integration**: Replit Auth system using `replitId`.
- **User Roles**: Multi-role system (client, talent, admin).
- **Profile Management**: 1:1 user-profile relationship.

#### Service Pages
- **Managed Services** (`/services/managed`): Dark theme, interactive capability tabs, proof metrics slider, pricing calculator with team size/complexity controls, case study accordion, FAQ.
- **Resourced Services** (`/services/resourced`): Light theme with cyan accents, capability cards, resourcing models, example roles, process steps, comparison table, dual CTA sections.
- **Enterprise Services** (`/services/enterprise`): Light theme with indigo accents, 3-layer offerings (strategic/execution/performance), full service comparison table (Enterprise vs Managed vs Resourced), engagement phase cards, dark CTA.
- **Human Virtual Assistant** (`/services/human-va` and `/services/human-virtual-assistant`): Light theme with framer-motion animations, capability tabs, ROI calculator (PHP currency), pricing tiers, comparison table, people gallery.

#### UI/UX Decisions
- **Modal Spacing**: Fixed modal overlap with navigation for consistent responsiveness.
- **Core Web Vitals Optimization**: Implemented preload hints, image dimensioning, and code splitting for performance.
- **Homepage Optimization**: Responsive design for tech stack integration across devices.
- **Coming Soon Page**: Immersive full-screen experience with animation and sequential text reveals.

#### Feature Specifications
- **Dual SEO + GEO Setup**: Dynamic `HeadSEO` component for US (clients) and Philippines (talent) geo-targeting.
- **VanessaChat (OpenAI Integration)**: AI-powered virtual assistant using `gpt-4o-mini` with streaming support, knowledge base, two-tier memory system, and self-learning capabilities.
- **Conversational Admin Training**: Interactive interface for administrators to train Vanessa, including automatic correction detection and knowledge base updates.
  - **Temporary No-Auth State**: Training routes (`/api/train/chat/stream`, `/api/train/correct`, `/api/site/reindex`) have auth middleware removed in both dev and production until the login system is complete.
  - **TODO**: Re-add `[authenticateJWT, requireAdmin]` to training routes in `server/routes.ts` and restore `Authorization` header in `TrainingChat.tsx` once login is finished.
- **VanessaChat Thread Persistence**: `threadId` and conversation `messages` are both persisted to `localStorage` via `VanessaContext`, ensuring one continuous OpenAI thread per browser across page reloads, tab restarts, and browser restarts. Only cleared when user clicks Reset Conversation.
- **Website Crawler & Navigation Context**: Automated daily crawling of `onspotglobal.com` to provide Vanessa with up-to-date website information and navigation assistance.

### External Dependencies

#### Payment Processing
- **Stripe**: Full integration for payment processing, payouts (Stripe Connect), and multi-currency support (USD, PHP).

#### Database & Hosting
- **Neon Database**: Serverless PostgreSQL.
- **Replit Platform**: Integrated development and hosting.

#### Development & Build Tools
- **Vite**: Fast build tool.
- **TypeScript**: Type safety.
- **ESBuild**: High-performance bundling.
- **PostCSS**: CSS processing with Tailwind CSS.

#### Monitoring & Analytics
- **Performance Tracking**: ROI, productivity, and client satisfaction metrics.
- **Real-time Updates**: WebSocket for live data.
- **Custom Logging**: Request/response logging, performance timing, and error tracking.

#### CRM Integration
- **GoHighLevel (GHL)**: Automated lead management with contact and opportunity creation.

#### Job Board (`/find-work`, `/find-work/jobs`, `/find-work/job/:jobId`, `/admin/find-work`)
- **Schema**: `jobs` table includes `culturalFit: text("cultural_fit").array()` (added to DB via `db:push`).
- **Public detail page** (`FindWorkJob.tsx`): Shows Job Description → Responsibilities → Skills Needed → Cultural Fit → Skills & Tags sections; DB jobs use `DbJobDetail` with `SectionBody` (handles Quill HTML); static roles 1–6 each have `culturalFit` arrays.
- **Admin page** (`AdminFindWork.tsx`): Redesigned with dark navy hero header matching the `FindWork.tsx` visual language; stat pills, branded job rows, full CRUD; `JobFormModal.tsx` includes a Cultural Fit Quill editor (Section 4).
- **Data flow**: `culturalFit` saved from admin form → stored in DB → surfaced on the public full-job page; empty value falls back to `CULTURAL_FIT_DEFAULTS` in `FindWorkJob.tsx`.

#### Chatbot Integration
- **VanessaChat (OpenAI Assistant API)**: AI virtual assistant with custom knowledge base, self-learning, and conversational training.
- **Lindy.ai**: Embedded AI chatbot for customer support (pending whitelisting).

#### Candidate Matching Journey (`/find-best-matches`)
- **7-step stepper**: Upload → Profile → Account → Success → Culture → Result → Jobs (actual flow steps 0-5; results are a phase)
- **Resume Auto-Extraction**: `client/src/lib/resumeParser.ts` — client-side PDF (pdfjs-dist) + DOCX (mammoth) text extraction; infers name, job title, category, years of experience, seniority, core/secondary skills, and summary; Step 2 is pre-filled automatically with extracted values and a confidence-level banner ("Pre-filled from your resume" / "Partially auto-filled"); fallback to blank form with error notice if parsing fails
- **`ExtractedCandidateProfile` type**: `fullName`, `targetPosition`, `jobCategory`, `yearsOfExperience`, `seniority`, `coreSkills[]`, `secondarySkills[]`, `summary`, `confidence` (high/partial/low), `extractedFields[]`
- **Auto-advance**: After parsing completes (or fails), the flow automatically advances to Step 2
- **Extended CandidateProfile**: Now includes `email`, `phone`, `location`, `workHistory: WorkHistoryEntry[]` (all optional contact/context fields)
- **Work History Section**: Add/edit/remove work history entries inline (job title, company, duration, responsibilities); inline mini-form with cancel/save within FinalizeInformationStep
- **DB Persistence**: Candidate profiles saved to `candidates` table on Step 2 → Step 3 transition via `POST /api/candidates`; culture score saved at the end via `PATCH /api/candidates/:id`; `candidateId` persisted in state for the session
- **Candidates Table**: `shared/schema.ts` → `candidates` (id varchar PK, fullName, email, phone, location, targetPosition, category, experienceYears, seniority, coreSkills[], secondarySkills[], workHistory jsonb, preferences jsonb, summary, cultureScore, createdAt)
- **Candidates API**: `POST /api/candidates`, `GET /api/candidates`, `GET /api/candidates/:id`, `PATCH /api/candidates/:id`
- **JSP-style profile archetypes**: 10 internal role profiles used for candidate matching — not shown as final results
- **Core Values Assessment**: 6 questions aligned to company values; outputs values alignment score (0–100%) + trait badges + personalized summary
- **Real jobs only**: Results use `usePostedJobs()` hook (same source as FindWorkAllJobs); empty-state cards shown when no matches exist
- **Results screen**: Top profile match card → Values alignment card → Matched posted job cards → Bottom CTA
- **Matching animation**: 2.8-second animated loading screen between assessment completion and results reveal
- **LAST_FLOW_STEP = 3**: The constant marks the culture result step; `handleNext` checks this explicitly to trigger matching (not `TOTAL_FLOW_STEPS - 1`)

#### Matching Engine (Domain-Based, v2)
- **Domain-first scoring**: Each candidate skill maps to a functional domain (admin_ops, customer_support, sales_marketing, finance, technical, design, hr). Each job's domain is inferred from its **title keywords first** (preventing mislabeled categories, e.g. "IT Administrator" in "Admin" category → `technical`), falling back to DB category.
- **Hard incompatibility rejection**: Domain penalty matrix defines hard penalties per [candidateDomain][jobDomain]. If the minimum penalty across all candidate domains ≥ `DOMAIN_HARD_THRESHOLD` (40), the job is rejected before scoring begins.
- **Weighted scoring**: Skills overlap (0–35 pts, via SKILL_ALIASES exact matching against job text), domain match (0–25 pts), experience level tier alignment (0–20 pts, -10 on mismatch), work preferences (0–12 pts: voice, work type, remote), values bonus (0–5 pts — supportive only, never primary driver).
- **Skill alias matching**: Each candidate skill has an exhaustive list of aliases matched against the full job text (title + description + skillTags + requirements + skillsAndCompetencies). Prevents false positives like "Admin Support" matching "IT Administrator" via title substring.
- **Confidence threshold**: `MATCH_THRESHOLD = 35`. Only jobs scoring ≥ 35 appear in results. Empty state shown instead of weak matches.
- **Per-job match explanation**: Each result card shows concrete reasons (e.g. "Matched skills: Bookkeeping, Report Generation", "Experience fit: Entry-level role", "Preference fit: Non-voice role, Remote setup") — no generic or misleading text.
- **Safeguard examples**: accounting/admin candidate vs IT Administrator → hard rejected (penalty 45); customer support candidate vs bookkeeping role → hard rejected (penalty 30); social media candidate vs technical support → hard rejected (penalty 50).