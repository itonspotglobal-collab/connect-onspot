# OnSpot

## Overview

OnSpot is a modern outsourcing management system that bridges BPO services and freelancing with Apple-inspired design principles. The platform serves as an "integrator system" designed to simplify outsourcing for B2B and B2C clients through AI-powered talent matching, performance management, and seamless project coordination. Built with React, TypeScript, Express, and PostgreSQL, it offers a comprehensive solution for managing talent, projects, and client relationships with real-time performance tracking and automated workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessibility and consistency
- **Styling**: Tailwind CSS with custom design system following Apple Human Interface Guidelines
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing with domain-based routing for multi-portal architecture
- **Domain-Based Routing**: Automatic routing based on subdomain detection:
  - `onspotglobal.com` → Primary domain serving main public site (home page, marketing pages, etc.)
  - `talent.onspotglobal.com` → Talent Portal (auto-redirects to /talent-portal)
- **Immersive Routes**: Full-screen experiences without navigation for campaigns and reveals using ImmersivePage component:
  - Campaign pages: `/pricing`, `/enterprise`, `/affiliate-marketing`, `/bpo-partner`, `/waitlist`, `/ai-assistant`
  - Service pages: `/services/ai-assistant`, `/services/managed`, `/services/resourced`, `/services/enterprise`, `/services/human-va`
- **Design System**: Apple-inspired interface with light/dark mode support, consistent spacing (4, 6, 8, 12, 16, 24 unit increments), and professional typography using SF Pro Display system fonts

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for type safety and modern JavaScript features
- **API Design**: RESTful API structure with organized route handlers in `/server/routes.ts`
- **Database Layer**: Drizzle ORM for type-safe database operations
- **Storage Pattern**: Repository pattern implemented through `IStorage` interface for data access abstraction
- **Middleware**: Custom logging middleware for API request tracking and error handling

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with schema-first approach located in `/shared/schema.ts`
- **Schema Design**: Comprehensive data model supporting users, profiles, skills, jobs, proposals, contracts, milestones, time tracking, messaging, reviews, payments, and notifications
- **Migrations**: Drizzle Kit for database schema migrations and version control
- **Connection**: Connection pooling with WebSocket support for real-time features

### Authentication & Authorization
- **Integration**: Replit Auth system with `replitId` field for seamless platform integration
- **User Roles**: Multi-role system supporting client, talent, and admin user types
- **Profile Management**: 1:1 user-profile relationship with comprehensive talent information including skills, rates, availability, and performance metrics

## External Dependencies

### Payment Processing
- **Stripe Integration**: Full Stripe ecosystem integration with React Stripe.js components for payment processing
- **Payout System**: Stripe Connect accounts for talent payouts and revenue distribution
- **Multi-currency Support**: USD and PHP currency handling for global operations

### Database & Hosting
- **Neon Database**: Serverless PostgreSQL database with connection pooling and WebSocket support
- **Replit Platform**: Integrated development and hosting environment with custom error handling and development tools

### Development & Build Tools
- **Vite**: Fast build tool with HMR, development server, and production optimization
- **TypeScript**: Full type safety across frontend, backend, and shared schemas
- **ESBuild**: High-performance bundling for server-side code compilation
- **PostCSS**: CSS processing with Tailwind CSS integration and autoprefixing

### Monitoring & Analytics
- **Performance Tracking**: Built-in ROI calculation system with productivity metrics, cost savings analysis, and client satisfaction scoring
- **Real-time Updates**: WebSocket infrastructure for live performance data and system monitoring
- **Custom Logging**: Request/response logging with performance timing and error tracking

### CRM Integration
- **GoHighLevel (GHL)**: Automated lead management with contact and opportunity creation
  - **Contact Creation**: Always enabled when `GHL_API_KEY` is configured
  - **Opportunity Creation**: Optional feature requiring additional configuration
  - **Required Environment Variables**:
    - `GHL_API_KEY` (required): GoHighLevel API authentication key for basic contact creation
    - `GHL_LOCATION_ID` (optional): GHL location identifier for opportunity creation
    - `GHL_PIPELINE_ID` (optional): GHL pipeline identifier for opportunity creation
    - `GHL_PIPELINE_STAGE_ID` (optional): GHL pipeline stage identifier for opportunity creation
  - **Features**: Lead intake forms automatically create GHL contacts; when fully configured, also creates opportunities with monetary values mapped from budget ranges
  - **Error Handling**: Graceful degradation - contact creation succeeds even if opportunity creation fails

### AI Assistants
- **OpenAI Integration**: Vanessa AI Assistant powered by OpenAI Assistants API
  - **Assistant ID**: `asst_l95RxbCxER9jjTZliJQzEpt2` (Vanessa AI from OpenAI dashboard)
  - **Model**: GPT-4o-mini or GPT-4-turbo for intelligent, context-aware responses
  - **API Endpoint**: `/api/chat` handles message processing using Threads + Runs workflow
  - **Frontend**: `VanessaChat.tsx` component with streaming response simulation for smooth UX
  - **Error Handling**: Graceful fallback messages when API is unavailable
  - **Environment Variable**: `OPENAI_API_KEY` (configured in Replit Secrets)

### Chatbot Integration
- **Lindy.ai**: Embedded AI chatbot for customer support and lead qualification
  - **Configuration**: Requires domain whitelisting in Lindy.ai dashboard
  - **Current Status**: Embed script installed, pending domain configuration on Lindy.ai side

## Recent Changes

### OpenAI Vanessa AI Integration (October 21, 2025)
- **Purpose**: Transform Vanessa from FAQ-based responses to dynamic AI-powered conversations using OpenAI Assistants API
- **Backend Implementation** (`server/routes.ts`):
  - Created `/api/chat` endpoint using OpenAI Node.js SDK
  - Implements Assistants API Threads + Runs pattern for conversation management
  - Uses `createAndPoll()` for automatic polling and completion handling
  - Robust error handling with user-friendly fallback messages
  - Assistant ID: `asst_l95RxbCxER9jjTZliJQzEpt2` configured with OnSpot knowledge base
- **Frontend Integration** (`client/src/components/VanessaChat.tsx`):
  - Replaced local FAQ detection with direct API calls to `/api/chat`
  - Maintains word-by-word streaming simulation for natural typing effect
  - Added comprehensive error handling with graceful degradation
  - Preserves all existing UI animations and user experience
- **Key Features**:
  - Real-time AI responses based on OnSpot's services and offerings
  - Maintains existing luminous glass aesthetic and premium interactions
  - Error recovery with helpful fallback messages
  - Seamless integration with existing chat context and message management

### Dual SEO + GEO Setup (US + Philippines) - October 19, 2025
- **Purpose**: Comprehensive dual geo-targeting SEO implementation for US (clients) and Philippines (talent) audiences
- **Brand Strategy**: "OnSpot" visible everywhere, "OnSpot Global" as hidden legal name in schema for ranking continuity
- **Key Implementation**:
  - Created `GEO_MAP` configuration (`client/src/config/geo-map.ts`) to identify US vs PH pages via regex patterns
  - Built dynamic `HeadSEO` component that auto-injects region-specific meta tags and JSON-LD schemas based on route
  - **US Pages** (client-facing): Service schema with `areaServed: "US"` + offering catalog (AI VA, Managed Services, Resourced Services)
  - **PH Pages** (talent-facing): EmploymentAgency schema with Cebu City address + geo coordinates
  - Created `robots.txt` allowing global crawl access with sitemap reference
  - Created comprehensive `sitemap.xml` with both US and PH URLs, proper priorities, and changefreq
  - Updated `client/index.html` to remove static schemas (now fully dynamic via HeadSEO)
- **Route Classification**:
  - US routes (default): `/`, `/hire-talent`, `/why-onspot/*`, `/pricing`, `/enterprise`, `/investors`, etc.
  - PH routes: `/find-work`, `/get-hired`, `/talent-portal`, `/jobs`, `/careers`, `/apply`, `/operations`
- **SEO Features**:
  - Dynamic canonical URLs matching current pathname
  - Geo-specific meta tags (`geo.region`, `geo.placename`, coordinates for PH)
  - Organization schema globally with both `name` and `legalName` fields
  - WebSite schema with SearchAction for hire-talent endpoint
  - Region-adaptive Service/EmploymentAgency schemas
- **No Visible Changes**: All modifications in `<head>` only - zero layout/content/copy changes per requirements

### Coming Soon Page (October 18, 2025)
- **Purpose**: Immersive full-screen experience for campaign reveals and marketing pages (`/pricing`, `/enterprise`, `/affiliate-marketing`, `/bpo-partner`)
- **Design Philosophy**: Bright, cinematic, intelligent, and inspiring - like watching the birth of intelligence
- **Key Features**:
  - **No Navigation**: Only OnSpot logo faintly glowing at top center for focused, distraction-free experience
  - **Neural Network Animation**: High-performance Canvas-based animation (60fps target using requestAnimationFrame)
    - Grows from 0 to 150-220 nodes over 1.6s with spring easing
    - Two-lobe brain structure with 2-3 connections per node
    - Gradient strokes (#5B7CFF→#9B5CFF) with soft outer glow
    - Breathing scale animation (0.985↔1 over 6s)
    - Traveling signal pulses along random paths (every 1.8-2.4s)
    - Node twinkle effects for visual interest
    - Full cycle: grow (1.6s) → hold (2.5s) → bloom (+8% brightness, 300ms) → dissolve (900ms) → loop (~6-7s total)
  - **Sequential Text Reveal**:
    - "COMING SOON..." with typing animation + looping dots
    - "The next evolution of outsourcing." fades in after 1.8s
    - "Powered by intelligence and human brilliance." fades in after 2.4s
  - **Backdrop Design**: Light text halo with backdrop-blur for contrast against neural network
  - **Accessibility**: Respects `prefers-reduced-motion` - renders static full network without growth/typing animations
  - **CTAs**: Same gradient buttons as homepage (Launch AI Assistant, Explore OnSpot) with hover shimmer effects
- **Technical Implementation**:
  - ImmersiveRouter component for routes without TopNavigation
  - Full-screen layout (fixed positioning) for cinematic effect
  - Clean white → very-pale-lavender radial gradient background
  - Base neural network opacity: 0.85 for visual hierarchy
  - Performance optimized with no heavy libraries