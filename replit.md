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

### Chatbot Integration
- **Lindy.ai**: Embedded AI chatbot for customer support and lead qualification
  - **Configuration**: Requires domain whitelisting in Lindy.ai dashboard
  - **Current Status**: Embed script installed, pending domain configuration on Lindy.ai side