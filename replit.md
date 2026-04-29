# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning, community features, and discipleship tools, including authentication, real-time messaging, tiered video content, robust admin management, podcasts, weekly challenges, and a local exercise database. The project aims to be a central hub for spiritual and personal development, fostering an engaged and supportive community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
The platform is built with a React frontend (TypeScript, Vite, Wouter, shadcn/ui, Tailwind CSS) for a mobile-first, responsive design, and an Express.js backend (TypeScript) with a RESTful API. Data is stored in PostgreSQL (Neon Database) using Drizzle ORM. All file uploads are managed via Replit Object Storage, with public files cached and private video content streamed with range-request support.

Core features include:
- **Authentication**: Replit Auth with session management and role-based access control (user, moderator, admin, owner).
- **Content Management**: Single subscription model with configurable trials, comprehensive admin panels for studies (rich text, bulk import, tiered unlocking) and devotionals (thumbnail uploads, bulk import, daily posting), and user progress tracking.
- **Community Features**: Real-time messaging (direct and group), user profiles, discussions, and a tag-based discipleship system.
- **Engagement Tools**: Bible reading plans with gamification, streak tracking, prayer time, weekly challenges, testimony system, "War Room" for prayer requests, "Under Fire" for accountability, and "War Groups" for licensed discipleship with city-based discovery.
- **Media Management**: Video and podcast uploading, storage, processing, and management with tiered access, topic classification, and RSS import.
- **Notifications**: Native push notifications via Web Push API for reminders and updates.
- **Fitness Integration**: A local exercise database, fitness community feed, and a "Health" tab for logging personal metrics. Includes injury-aware exercise filtering based on user-reported injuries.
- **Terms & Conditions**: Versioned terms of use system with forced re-agreement logic and auditing.
- **Live Streaming**: In-app live streaming powered by Mux with RTMP, simulcasting, and recording management.
- **Event Ticketing**: In-app paid event processing via Stripe, supporting multi-tier tickets, registration tracking, and confirmation emails.
- **Gamification**: "Rations" and "ranks" system for mission completion.
- **Onboarding**: An 11-step guided tour for new users.
- **@Mention System**: Parses and processes @mentions in various content types, sending notifications based on user preferences.

# External Dependencies
- **Core Frameworks**: React 18, Express.js, TypeScript, Vite
- **Database & ORM**: Neon Database, Drizzle ORM
- **Authentication**: Replit Auth, Passport.js, openid-client
- **UI Components & Styling**: Radix UI, shadcn/ui, Tailwind CSS, Lucide React
- **State Management & Data Fetching**: TanStack Query, React Hook Form, Zod
- **Replit Integration**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer
- **PWA**: Web Push API (for notifications)
- **Bible Verse Tagging**: Logos RefTagger (api.reftagger.com)
- **Payment Processing**: Stripe
- **Live Streaming**: Mux
- **Email Service**: Resend
- **Mapping**: OpenStreetMap Nominatim API