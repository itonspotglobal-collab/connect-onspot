# OnSpot

## Overview
OnSpot is an outsourcing management system that integrates BPO services and freelancing with an Apple-inspired design. It aims to simplify outsourcing for B2B and B2C clients using AI for talent matching, performance management, and project coordination. The platform offers a comprehensive solution for managing talent, projects, and client relationships with real-time tracking and automated workflows, built with React, TypeScript, Express, and PostgreSQL.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui components on Radix UI, styled with Tailwind CSS, following Apple Human Interface Guidelines.
- **State Management**: TanStack React Query for server state.
- **Routing**: Wouter for client-side routing, with domain-based routing for multi-portal architecture (e.g., `talent.onspotglobal.com` for Talent Portal).
- **Immersive Routes**: Full-screen experiences for campaigns and service pages without navigation.
- **Design System**: Apple-inspired interface with light/dark mode, consistent spacing, and SF Pro Display fonts.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API structure.
- **Database Layer**: Drizzle ORM.
- **Storage Pattern**: Repository pattern via `IStorage` interface.
- **Middleware**: Custom logging and error handling.

### Data Storage
- **Database**: PostgreSQL hosted on Neon (serverless).
- **ORM**: Drizzle ORM with schema-first approach (`/shared/schema.ts`).
- **Schema**: Supports users, profiles, skills, jobs, proposals, contracts, milestones, time tracking, messaging, reviews, payments, and notifications.
- **Migrations**: Drizzle Kit.
- **Connection**: Connection pooling with WebSocket support.

### Authentication & Authorization
- **Integration**: Replit Auth system using `replitId`.
- **User Roles**: Multi-role system for client, talent, and admin.
- **Profile Management**: 1:1 user-profile relationship with comprehensive talent information.

### UI/UX Decisions
- **Modal Spacing**: Fixed modal overlap with navigation bar on all dialogs, ensuring proper spacing and responsiveness.
- **Core Web Vitals Optimization**: Improved LCP with preload hints, prevented CLS with image dimensions, and optimized JavaScript bundle size through code splitting for non-critical components.
- **Homepage Mobile Optimization**: Redesigned tech stack integration section for mobile (3-column grid) and tablet/desktop (circular neural network layout) to ensure optimal viewing across devices.
- **Coming Soon Page**: Immersive full-screen experience with neural network animation, sequential text reveals, and no navigation for focused content delivery.

### Feature Specifications
- **Dual SEO + GEO Setup**: Implemented dynamic `HeadSEO` component for US (clients) and Philippines (talent) geo-targeting, with region-specific meta tags and JSON-LD schemas based on route.
- **VanessaChat (OpenAI Integration)**: AI-powered virtual assistant using `gpt-4o-mini` with streaming support for real-time interaction.

## External Dependencies

### Payment Processing
- **Stripe**: Full integration with React Stripe.js components for payment processing, Stripe Connect for payouts, and multi-currency support (USD, PHP).

### Database & Hosting
- **Neon Database**: Serverless PostgreSQL.
- **Replit Platform**: Integrated development and hosting.

### Development & Build Tools
- **Vite**: Fast build tool.
- **TypeScript**: Full type safety.
- **ESBuild**: High-performance bundling.
- **PostCSS**: CSS processing with Tailwind CSS.

### Monitoring & Analytics
- **Performance Tracking**: ROI calculation, productivity metrics, client satisfaction scoring.
- **Real-time Updates**: WebSocket for live data and monitoring.
- **Custom Logging**: Request/response logging with performance timing and error tracking.

### CRM Integration
- **GoHighLevel (GHL)**: Automated lead management with contact and optional opportunity creation. Requires `GHL_API_KEY` for basic functionality.

### Chatbot Integration
- **VanessaChat (OpenAI Assistant API)**: AI-powered virtual assistant using OpenAI Assistant API with custom knowledge base and self-learning capabilities. Features:
  - **Assistant API**: Uses OpenAI's Assistant API with custom assistant configuration from OpenAI Dashboard
  - **Persona Reinforcement**: `additional_instructions` parameter ensures consistent Vanessa personality even if Dashboard config changes
  - **Streaming Responses**: Real-time streaming via `/api/chat/stream` endpoint with Server-Sent Events (SSE)
  - **Thread Persistence**: OpenAI-managed thread persistence for natural conversation continuity across sessions
  - **Knowledge Base System**: Structured text-based knowledge file at `/resources/vanessa_knowledge.txt` containing:
    - Company information (mission, headquarters, contact details)
    - Job Success System (JSS) framework
    - Talent Acquisition Framework
    - Core values and hiring principles
    - Services, pricing, and FAQs
    - Vanessa's persona guidelines
  - **Knowledge Upload**: Automated script at `/scripts/uploadVanessaKnowledgeTxt.ts` creates vector store and attaches to Assistant
    - Run: `npx tsx scripts/uploadVanessaKnowledgeTxt.ts`
    - Creates vector store with File Search enabled
    - Automatically links to Assistant via OpenAI API
  - **Two-Tier Memory System**: Vanessa uses both short-term and long-term memory to learn from user corrections
    - **Short-Term Conversational Memory** (Instant Recall):
      - Detects correction patterns in real-time ("you should", "actually", "the correct answer is", "remember that")
      - Stores corrections instantly in Replit DB with key format `memory:<topic>`
      - Acknowledges corrections: "Understood, I've updated my memory with that information."
      - Injects all stored memories into every chat context for immediate recall
      - Memories appear in chat instructions under `[Remembered Corrections]` section
      - Console log: `🧠 Memory saved for topic: {topic}` and `💡 Injected {N} memory correction(s) into context`
    - **Long-Term Knowledge Consolidation**:
      - Learning loop automatically consolidates memories into `/resources/vanessa_knowledge.txt`
      - Groups memories by topic and writes as sections: `=== {topic} (Memory Update YYYY-MM-DD) ===`
      - Clears short-term memories after successful consolidation to prevent duplication
      - Runs as part of auto-triggered learning loop (2+ similar feedbacks)
      - Console logs: `🧠 Consolidating {N} memory correction(s)...` and `✅ Memory consolidation completed!`
    - **Forget Command**: Users can clear specific memories with "forget {topic}"
      - Strips command verbs (forget/remove/delete/clear) to extract target topic
      - Responds: "I've forgotten everything about {topic}."
      - Console log: `🗑️ Memory deleted for topic: {topic}`
    - **Implementation**:
      - `server/services/db_manager.ts`: Memory storage functions (storeMemory, getAllMemories, deleteMemory, clearAllMemories)
      - `server/services/openaiService.ts`: Correction detection, memory injection, forget command
      - `server/services/learningLoop.ts`: consolidateMemories() function
  - **Self-Learning System**: AI continuously improves through user feedback and automated analysis
    - **User Feedback**: Thumbs up/down buttons with optional comments on every AI response
    - **Conversation Storage**: All chats and feedbacks stored in PostgreSQL `vanessa_logs` and `feedbacks` tables
    - **Feedback Tracking**: 
      - Feedbacks stored in PostgreSQL `feedbacks` table with thread_id, message_id, rating, comment, topic, timestamps
      - Topic extraction identifies keywords from user messages/comments using stopword filtering
      - Feedback grouped by topic for similarity detection
      - Auto-count feedbacks by topic using PostgreSQL queries
    - **Auto-Trigger Learning**: System automatically runs learning loop when 2+ similar feedbacks detected
      - Extracts topics from feedback comments (e.g., "CEO", "Delivery", "Pricing")
      - Tracks feedback count per topic
      - Triggers learning automatically when threshold met (2 similar feedbacks)
      - Runs in background without blocking response
      - Enhanced console logging for all events
    - **Knowledge Ingestion**: Admin can trigger AI-powered summarization of files in `/resources/knowledge/`
    - **Learning Loop**: Admin can trigger AI analysis of feedback patterns to generate actionable insights (also auto-triggered)
    - **Auto-Update Knowledge Base**: Vanessa automatically updates `/resources/vanessa_knowledge.txt` after each successful learning loop
      - Uses OpenAI to extract 1-3 main topics from learning insights
      - Finds and replaces existing sections OR appends new ones
      - Section format: `=== Topic (Learned YYYY-MM-DD) ===`
      - Security: Text sanitization, 1MB file size limit
      - Map-based topic-section pairing prevents duplicate/missing updates
      - Comprehensive console logging for visibility
    - **Learning Visibility Dashboard**: `/admin/learning` tab shows:
      - Learning Health: Success rate, total/success/failed run statistics
      - Latest Summary Preview: Recent insights with generation timestamp
      - Recent Learning Runs: Last 5 executions with colored status badges, durations, errors
      - Manual re-run button for triggering new analysis
    - **Context Enrichment**: Learning insights automatically included in future chat responses
    - **Admin Dashboard**: `/admin/learning` shows analytics, insights, and controls for learning system
    - **Data Persistence**: Replit DB stores conversation history, feedback, knowledge summaries, and learning insights
    - **Security**: All admin/learning endpoints protected with JWT + role-based authentication
    - **API Endpoints**: 
      - `POST /api/feedback` - Submit user feedback with auto-trigger learning (publicly accessible for development)
        - Returns: success, totalCount, topics, autoLearningTriggered
        - Auto-triggers learning loop when 2+ similar feedbacks detected
      - `GET /api/feedback` - View all feedback (admin only)
      - `GET /api/feedback/all` - View feedback history with statistics (admin only)
      - `GET /api/feedback/stats` - Get feedback statistics (total, positive, negative counts) (admin only)
      - `POST /api/learn` - Ingest knowledge files (admin only)
      - `GET /api/learn/knowledge` - View knowledge summaries (admin only)
      - `POST /api/learn/summarize` - Run learning loop analysis + auto-update knowledge base (admin only)
      - `GET /api/learn/summary` - Get latest learning insights (admin only)
      - `GET /api/learn/summary/latest` - Get latest summary with metadata (admin only)
      - `GET /api/learn/status` - Get recent learning run statuses (admin only)
      - `GET /api/learn/health` - Get learning system health metrics (admin only)
      - `GET /api/learn/stats` - View database statistics (admin only)
    - **Implementation**: 
      - `server/services/db_manager.ts` - Replit DB operations
      - `server/services/learningLoop.ts` - Knowledge ingestion and learning analysis
      - `server/services/openaiService.ts` - Chat integration with learning context
      - `client/src/pages/VanessaResponses.tsx` - Feedback UI
      - `client/src/pages/VanessaLearningDashboard.tsx` - Admin dashboard
  - **Dual API Support**: Both streaming (`streamWithAssistant`) and non-streaming (`sendMessageToAssistant`) endpoints
  - **Website Crawler & Navigation Context**: Vanessa can understand and navigate the OnSpotGlobal.com website
    - **Automated Crawling**: Daily cron job (3:00 AM) crawls public pages from `https://onspotglobal.com/`
    - **Safe Crawling Rules**:
      - ✅ Includes only internal links from same domain
      - 🚫 Excludes private/admin areas: `/vanessa-responses`, `/admin`, `/dashboard`, `/login`, `/api/`
      - 🚫 Excludes query strings and fragments (`?`, `#`)
      - Rate-limited to 1 request/second, max depth 3, max 200 pages
    - **Content Extraction**: Uses Cheerio to parse HTML and extract titles, headings, paragraphs
    - **AI Summarization**: OpenAI GPT-4o-mini generates concise 1-2 sentence summaries for each page
    - **Storage**: Results saved to `/resources/site_index.json` with URL, title, summary, timestamp
    - **Context Integration**: Site index automatically loaded into Vanessa's chat context (top 20 pages)
    - **Navigation Assistance**: Vanessa can guide users to specific pages with URLs and descriptions
    - **Manual Control**: Admin endpoint `POST /api/site/reindex` triggers immediate re-crawl
    - **Implementation**:
      - `server/services/siteCrawler.ts` - Core crawling logic with filtering and summarization
      - `server/services/siteCrawlerService.ts` - Cron job scheduler and service orchestration
      - `server/services/openaiService.ts` - Site index context injection into chat
      - `/resources/site_index.json` - Persistent storage for crawled pages
  - **Requirements**: 
    - `OPENAI_API_KEY`: OpenAI API key
    - `ASSISTANT_ID`: OpenAI Assistant ID (starts with `asst_`) from OpenAI Dashboard
- **Lindy.ai**: Embedded AI chatbot for customer support, pending domain whitelisting.