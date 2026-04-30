# OnSpot

### Overview
OnSpot is an outsourcing management system that streamlines B2B and B2C outsourcing by integrating BPO services and freelancing. It utilizes AI for talent matching, performance management, and project coordination. The platform offers a complete solution for managing talent, projects, and client relationships with real-time tracking and automated workflows, featuring an Apple-inspired design. The project aims to provide a comprehensive and intuitive platform for the outsourcing industry.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture

#### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui components on Radix UI, styled with Tailwind CSS, adhering to Apple Human Interface Guidelines. Features an Apple-inspired design system with light/dark mode and SF Pro Display fonts.
- **State Management**: TanStack React Query.
- **Routing**: Wouter for client-side routing, supporting multi-portal domain-based routing and immersive full-screen routes.

#### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API.
- **Database Layer**: Drizzle ORM, utilizing a Repository pattern.

#### Data Storage
- **Database**: PostgreSQL hosted on Neon (serverless).
- **ORM**: Drizzle ORM with a schema-first approach, supporting entities like users, profiles, skills, jobs, and payments.

#### Authentication & Authorization
- **Integration**: Replit Auth system using `replitId`.
- **User Roles**: Multi-role system (client, talent, admin) with a 1:1 user-profile relationship.

#### Service Pages
- **Managed Services**: Dark theme with interactive capability tabs, proof metrics slider, pricing calculator, and case studies.
- **Resourced Services**: Light theme with cyan accents, capability cards, resourcing models, and comparison tables.
- **Enterprise Services**: Light theme with indigo accents, three-layer offerings (strategic, execution, performance), and full-service comparison.
- **Human Virtual Assistant**: Light theme with Framer Motion animations, capability tabs, ROI calculator, and pricing tiers.

#### UI/UX Decisions
- **Core Web Vitals Optimization**: Implemented preload hints, image dimensioning, and code splitting for performance.
- **Design Consistency**: Fixed modal overlap with navigation for consistent responsiveness and an immersive "Coming Soon" page.

#### Feature Specifications
- **Dual SEO + GEO Setup**: Dynamic `HeadSEO` component for US (clients) and Philippines (talent) geo-targeting.
- **VanessaChat (OpenAI Integration)**: AI-powered virtual assistant using `gpt-4o-mini` with streaming, knowledge base, two-tier memory, self-learning, and conversational admin training.
- **VanessaChat Thread Persistence**: `threadId` and conversation `messages` are persisted to `localStorage` for continuous conversations across sessions.
- **Website Crawler**: Automated daily crawling of `onspotglobal.com` to provide Vanessa with up-to-date information.
- **Job Board**: Features public job detail pages and an admin interface for full CRUD operations, including `culturalFit` fields.
- **Candidate Matching Journey**: A 7-step stepper for candidates, including resume auto-extraction (PDF/DOCX), profile completion, account setup, culture assessment, and job matching. It features account access management (login/signup) and persistence of candidate data and culture evaluations.
- **Matching Engine (Domain-Based, v2)**: Employs domain-first scoring with hard incompatibility rejection, weighted scoring (skills overlap, domain match, experience, work preferences, values bonus), and skill alias matching. It provides per-job match explanations and filters out weak matches below a `MATCH_THRESHOLD` of 35.
- **Talent Pool**: Allows Talent Acquisition users and Clients to discover pre-assessed candidates. Features client-side match scoring, a `MATCH_THRESHOLD` of 30, match labels (Best, Strong, Possible), filters (category, experience, location, work setup), a shortlist function, and role-based visibility for candidate details (anonymized for clients, full details for admins).
- **User Activity-Based Recommendations**: `client/src/lib/userActivityMemory.ts` tracks visitor behavior (job searches, clicks, job/article/talent views, filter/category selections) in `localStorage` under `"userActivityMemory"` (max 50 entries, dedup within 1 min). Activities are weighted (AppliedJob=8, SavedJob=7, JobSearch/TalentSearch=5, views=4, CategoryClick/FilterClick=3, ArticleView=2) and scored with recency multipliers (<24h=1×, <7d=0.75×, older=0.5×). A "Recommended for You" section powered by `scoreJobsAgainstInterests()` surfaces up to 3 personalized job cards in FindWork and FindWorkAllJobs pages. Tracking is integrated into FindWork, FindWorkJob, FindWorkAllJobs, InsightPost, and TalentPool.

### External Dependencies

#### Payment Processing
- **Stripe**: For payment processing, payouts (Stripe Connect), and multi-currency support (USD, PHP).

#### Database & Hosting
- **Neon Database**: Serverless PostgreSQL.
- **Replit Platform**: For integrated development and hosting.

#### Monitoring & Analytics
- **Custom Logging**: Request/response logging, performance timing, and error tracking.

#### CRM Integration
- **GoHighLevel (GHL)**: For automated lead management.

#### Chatbot Integration
- **VanessaChat (OpenAI Assistant API)**: AI virtual assistant.
- **Lindy.ai**: Embedded AI chatbot for customer support.