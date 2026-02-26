# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning programs including day-by-day Bible studies with progress tracking, devotionals, community discussions, and comprehensive discipleship tools. The platform features robust authentication, real-time messaging, video content management with tiered access, admin content and user management, a comprehensive podcasts system, weekly challenges, and a local exercise database. The project aims to provide a centralized hub for spiritual and personal development, fostering a strong, engaged community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite. It employs Wouter for routing, shadcn/ui (based on Radix UI) for components, and Tailwind CSS for styling with a custom ministry-themed color palette. TanStack Query manages server state, while React Hook Form with Zod handles form validation. The application features a mobile-first responsive design with a bottom navigation and card-based layouts.

## Backend Architecture
The backend is an Express.js server in TypeScript, following a RESTful API design. It utilizes session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware is used for logging, error handling, and role-based access control (user, admin) with a single subscription model (trial/active/expired/cancelled).

## Database Design
PostgreSQL, hosted on Neon Database, is used with Drizzle ORM for type-safe queries and migrations. The schema includes tables for study series, individual studies, lessons, user progress (overall and per-lesson), users, discussions, devotionals, podcasts, challenges, testimonies, exercises, and challenge participants.

## Content Management
The system supports a single subscription model with configurable free trial. Admins can set trial duration, pricing, and selectively enable content areas and individual items for trial access. Features include progress tracking, search, and a comprehensive admin panel.
- **Study Content**: Supports embedded, day-by-day lessons with rich text editing, scripture, questions, and key takeaways. Includes a bulk import tool for converting document-based content (Word/PDF) into structured lessons. Progress tracking is integrated at various levels (lesson, study, series). Series can require consecutive completion, where studies unlock only after completing the previous one. Users receive notifications when the next study becomes available.
- **Devotional Content**: Admins can upload custom thumbnail images and utilize a bulk import tool for up to 30 devotionals, which supports automated daily posting and validation.

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging.
- **Studies & Devotionals**: Management for Bible studies (lesson-based) and devotionals (with thumbnail uploads).
- **Community**: Interactive discussions, user profiles, and a discipleship system with tag-based user discovery and faith journey stages.
- **Video & Podcast Management**: Full upload, storage, processing, and management with tiered access, topic classification, ratings, and RSS feed import capabilities (e.g., Podomatic).
- **Notifications**: Enhanced system for native push notifications (via Web Push API and Service Workers), daily devotionals, content updates, and discussion replies. Users can enable/disable push notifications per device in settings.
- **User Engagement**: Streak tracking, prayer time system, weekly challenges with participation tracking, and a testimony system.
- **War Room**: A dedicated prayer request space where users can post prayer requests (real names only), comment, and indicate they've prayed, with real-time updates via WebSockets.
- **Under Fire**: An accountability space where users post requests, and others can "Assist" to become accountability partners, initiating a direct message.
- **War Groups**: Licensed discipleship groups with city-based discovery, interactive map view (OpenStreetMap Nominatim API), leader/member management, and private discussion boards supporting media uploads. Includes a registration and approval workflow for new groups with admin notifications.
- **Fitness Integration**: Local exercise database for fitness plans.
- **Gamification (Rations & Ranks)**: A system where users earn "rations" for completing missions (40+ types across features) to progress through a 5-tier rank system. Includes anti-abuse guardrails and a grace bonus for returning users.

# External Dependencies

## Core Frameworks
- React 18
- Express.js
- TypeScript
- Vite

## Database & ORM
- Neon Database
- Drizzle ORM
- @neondatabase/serverless

## Authentication
- Replit Auth
- Passport.js
- openid-client

## UI Components & Styling
- Radix UI
- shadcn/ui
- Tailwind CSS
- Lucide React

## State Management & Data Fetching
- TanStack Query
- React Hook Form
- Zod

## Replit Integration
- @replit/vite-plugin-runtime-error-modal
- @replit/vite-plugin-cartographer

## PWA (Progressive Web App)
- Full PWA support for installability on iOS and Android devices
- Web app manifest with multiple icon sizes (152, 167, 192, 384, 512px) in PNG format
- Service worker (`client/public/sw.js`) with offline caching: network-first for API, stale-while-revalidate for static assets, navigation fallback to cached shell
- Apple-specific meta tags, touch icons, and splash screens for all major iPhone sizes
- Install prompt component (`client/src/components/pwa-install-prompt.tsx`) with Android native prompt and iOS Safari instructions
- Push notification support via Web Push API and VAPID keys

## Bible Verse Tagging
- Logos RefTagger integration (api.reftagger.com) for automatic Bible verse reference detection
- NASB translation with tooltips enabled
- Custom useRefTagger hook (`client/src/hooks/useRefTagger.ts`) for triggering re-tagging on React content updates
- Integrated in: study lessons, blog posts, devotionals, discussions, War Room, and Under Fire pages

## Production Server Stability (Critical)
- **SIGHUP handling**: Replit's terminal manager sends SIGHUP to Node.js processes ~57 seconds after startup. The default SIGHUP behavior terminates the process. The server MUST ignore SIGHUP to stay alive (`process.on("SIGHUP", () => {})` in `server/index.ts`).
- **DB pool config**: `idleTimeoutMillis: 60000`, `connectionTimeoutMillis: 10000`, `max: 2` in `server/db.ts`.
- **Background services**: Staggered start times (0s, 5s, 10s, 15s, 20s) to prevent simultaneous DB load.
- Never add high-frequency logging (>1 per second) — it causes pipe overflow crashes.