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

#### UI/UX Decisions
- **Modal Spacing**: Fixed modal overlap with navigation for consistent responsiveness.
- **Core Web Vitals Optimization**: Implemented preload hints, image dimensioning, and code splitting for performance.
- **Homepage Optimization**: Responsive design for tech stack integration across devices.
- **Coming Soon Page**: Immersive full-screen experience with animation and sequential text reveals.

#### Feature Specifications
- **Dual SEO + GEO Setup**: Dynamic `HeadSEO` component for US (clients) and Philippines (talent) geo-targeting.
- **VanessaChat (OpenAI Integration)**: AI-powered virtual assistant using `gpt-4o-mini` with streaming support, knowledge base, two-tier memory system, and self-learning capabilities.
- **Conversational Admin Training**: Interactive interface for administrators to train Vanessa, including automatic correction detection and knowledge base updates.
  - **Development Mode**: Authentication bypassed for training routes in development (NODE_ENV !== "production")
  - **Protected Routes (Dev Bypass)**: `/api/train/chat/stream`, `/api/train/correct`, `/api/site/reindex`
  - **UI Indicator**: Shows "🔧 Training Mode Active (No Auth Required)" banner in development
  - **Production Security**: Full JWT authentication required in production environment
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