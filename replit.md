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

#### Chatbot Integration
- **VanessaChat (OpenAI Assistant API)**: AI virtual assistant with custom knowledge base, self-learning, and conversational training.
- **Lindy.ai**: Embedded AI chatbot for customer support (pending whitelisting).