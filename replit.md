# Overview
"Man Up God's Way" is a full-stack React/Express application designed to be a comprehensive faith-based platform. It focuses on biblical masculinity, leadership development, and spiritual growth, offering structured learning programs, community features, and discipleship tools. The platform includes authentication, real-time messaging, video content with tiered access, robust admin management, podcast systems, weekly challenges, and a local exercise database. The project's vision is to establish a central hub for spiritual and personal development, fostering an engaged and supportive community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend uses React 18 with TypeScript, Vite, Wouter for routing, shadcn/ui (Radix UI) for components, and Tailwind CSS for styling with a custom theme. TanStack Query manages server state, and React Hook Form with Zod handles form validation. The design is mobile-first and responsive.

## Backend
The backend is an Express.js server in TypeScript, following a RESTful API design. It uses session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware handles logging, error handling, and role-based access control (user, moderator, admin, owner) with a single subscription model.

## File Storage
All file uploads are stored in Replit Object Storage (GCS-backed). Public files are proxied through the backend with caching, while private subscription-gated video files are streamed with range-request support. Video thumbnails are generated using ffmpeg.

## Database
PostgreSQL, hosted on Neon Database, is used with Drizzle ORM for type-safe queries and migrations. The schema supports various content types, user progress, community features, and engagement elements.

## Content Management
The system supports a single subscription model with configurable trials. Admins can manage trial settings and enable content access. Features include progress tracking, search, and a comprehensive admin panel for study content (rich text, bulk import, tiered unlocking), and devotionals (thumbnail uploads, bulk import, daily posting, user saving).

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging.
- **Studies & Devotionals**: Management for lesson-based Bible studies and devotionals.
- **Bible Reading Plans**: Two 365-day plans with progress tracking, streaks, and gamified rewards.
- **Community**: Discussions, user profiles, and a discipleship system with tag-based discovery.
- **Video & Podcast Management**: Upload, storage, processing, and management with tiered access, topic classification, ratings, and RSS import. Supports direct file uploads and external URLs (YouTube, Vimeo, MP4).
- **Notifications**: Native push notifications via Web Push API, daily reminders, and content updates.
- **User Engagement**: Streak tracking, prayer time, weekly challenges, and a testimony system.
- **War Room**: Dedicated prayer request space with real-time updates.
- **Under Fire**: Accountability system for requesting and providing support.
- **War Groups**: Licensed discipleship groups with city-based discovery, map view (OpenStreetMap), and private discussion boards.
- **Fitness Integration**: Local exercise database, fitness community feed, and Stripe-integrated access control.
- **Live Streaming (Mux)**: In-app live streaming with RTMP credentials, simulcasting, webhook-based status updates, and recording management.
- **Event Ticketing**: In-app paid event ticket processing via Stripe PaymentIntent, with multi-tier support, registration tracking, CSV export, and confirmation emails via Resend.
- **Gamification**: "Rations" and "ranks" system for completing missions, with anti-abuse measures and grace bonuses.
- **App Onboarding Tour**: An 11-step guided tour for new users, bypassing paywalls during the tour, with options to skip or restart.

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
- Full PWA support for installability on iOS and Android.
- Web app manifest with multiple icon sizes.
- Service worker for offline caching (network-first for API, stale-while-revalidate for static assets).
- Apple-specific meta tags and splash screens.
- Install prompt component for Android and iOS.
- Push notification support via Web Push API and VAPID keys.

## Bible Verse Tagging
- Logos RefTagger (api.reftagger.com) for automatic Bible verse detection (NASB translation, tooltips).

## Payment Processing
- Stripe (for event ticketing, fitness membership, webhook security)

## Live Streaming
- Mux

## Email Service
- Resend

## Mapping
- OpenStreetMap Nominatim API

# Production Data Migration

A one-time content migration script is available at `scripts/seed-prod.ts`.
The exported data snapshot lives at `scripts/seed-data.json` (629 KB, 9 tables).

**Approach**: The endpoint-based approach (temporary admin HTTP route) was replaced
by a direct script approach to avoid leaving temporary privileged endpoints exposed
in shipping code. The script is the sole migration path.

## Tables seeded (in FK order)
| Table | Rows |
|---|---|
| exercises | 330 |
| study_series | 1 |
| videos | 4 |
| podcasts | 104 |
| events | 1 |
| war_groups | 1 |
| studies | 15 |
| study_lessons | 105 |
| fitness_plans | 6 |

## How to run against production

```bash
DATABASE_URL=<prod-connection-string> npx tsx scripts/seed-prod.ts
```

The script:
- Inserts all tables every run; `ON CONFLICT DO NOTHING` preserves existing rows
  and backfills any missing ones — safe to re-run
- Ensures owner user records (Replit user IDs `46399196` and `46399698`) exist
  before inserting content so FK constraints on `uploaded_by` / `created_by` /
  `leader_id` / `user_id` are satisfied
- Verifies post-seed row counts against the seed file; exits non-zero on mismatch

## After confirmed success
Remove `scripts/seed-prod.ts` and `scripts/seed-data.json` (or keep for audit).

# Exercise Instruction Audit

A one-off review script lives at `scripts/audit-exercise-instructions.ts`.
It walks every row in `exercises`, extracts begin/middle/end frames from the
demo MP4 with ffmpeg, and asks Claude `claude-sonnet-4-20250514` whether the
written instructions match what the video actually shows.

Results land in the `exercise_instruction_reviews` table — never directly in
the live `exercises` table. A human approves before any update.

```bash
# Test a tiny batch first (no confirm prompt for small runs)
npx tsx scripts/audit-exercise-instructions.ts --limit 3

# Specific IDs
npx tsx scripts/audit-exercise-instructions.ts --ids 2,5,10

# Full 1,674-exercise run (real Claude API spend — prompts to confirm)
npx tsx scripts/audit-exercise-instructions.ts --confirm

# Re-process rows that were already reviewed
npx tsx scripts/audit-exercise-instructions.ts --limit 5 --force
```

Inspect flagged rows:
```sql
SELECT id, exercise_id, exercise_name, new_instructions
FROM exercise_instruction_reviews
WHERE needs_review = true AND status = 'pending'
ORDER BY exercise_id;
```

Approve a corrected instruction:
```sql
UPDATE exercises SET instructions = r.new_instructions
FROM exercise_instruction_reviews r
WHERE exercises.id = r.exercise_id AND r.id = <review_id>;

UPDATE exercise_instruction_reviews SET status = 'approved' WHERE id = <review_id>;
```

Requires `ANTHROPIC_API_KEY` (already configured as a Replit secret).