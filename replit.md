# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning programs including day-by-day Bible studies with progress tracking, devotionals, community discussions, and comprehensive discipleship tools. The platform features robust authentication, real-time messaging, video content management with tiered access, admin content and user management, a comprehensive podcasts system, weekly challenges, and a local exercise database. The project aims to provide a centralized hub for spiritual and personal development, fostering a strong, engaged community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite. It employs Wouter for routing, shadcn/ui (based on Radix UI) for components, and Tailwind CSS for styling with a custom ministry-themed color palette. TanStack Query manages server state, while React Hook Form with Zod handles form validation. The application features a mobile-first responsive design with a bottom navigation and card-based layouts.

## Backend Architecture
The backend is an Express.js server in TypeScript, following a RESTful API design. It utilizes session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware is used for logging, error handling, and role-based access control (user, moderator, admin, owner) with a single subscription model (trial/active/expired/cancelled). Moderators have all user permissions plus the ability to delete content in: community discussions/replies, War Room posts/comments, Under Fire requests, and video/podcast/study ratings. Moderator role is assignable by admins via the Admin panel user management.

## File Storage (Object Storage)
All file uploads are stored in Replit Object Storage (GCS-backed), not local disk. The integration is in `server/replit_integrations/object_storage/objectStorage.ts` and the helper wrapper is `server/objectStorage.ts`.
- **Public files** (thumbnails, community media, blog images, store product images, fitness plan documents): uploaded to `public/uploads/{type}/{key}` in the bucket via `uploadPublicFile()`. URLs stored in DB as `/api/media/public/uploads/...` (backend proxy) — direct GCS URLs are NOT publicly accessible (uniform bucket-level ACL). The proxy route `GET /api/media/public/uploads/*` streams files from GCS with `Cache-Control: public, max-age=31536000` headers.
- **Private files** (subscription-gated videos): uploaded to `.private/uploads/videos/{key}` via `uploadPrivateFile()`. Stored in `videos.videoUrl` as `gcs:.private/uploads/videos/{key}`. Served through `GET /api/videos/:id/stream` which uses `streamVideoFromStorage()` with range-request support.
- **Documents** (bulk-import PDFs/Word): processed via `documentUpload` (disk storage), then uploaded to Object Storage after processing.
- **Video thumbnails**: generated via ffmpeg from a temp file, then uploaded to public Object Storage.
- **Legacy files**: A one-time migration script (`server/migrate-to-object-storage.ts`) ran and moved all pre-existing local disk files to GCS. All DB records now point to GCS URLs. The script also scans the local `uploads/` directory and logs any orphaned disk files (54 found post-migration, all safe to delete after verifying GCS).
- Bucket name is parsed from `PUBLIC_OBJECT_SEARCH_PATHS` env var (format: `/bucket-name/public`).
- `express.static('/uploads')` has been removed — all files are served from GCS only.

## Database Design
PostgreSQL, hosted on Neon Database, is used with Drizzle ORM for type-safe queries and migrations. The schema includes tables for study series, individual studies, lessons, user progress (overall and per-lesson), users, discussions, devotionals, podcasts, challenges, testimonies, exercises, challenge participants, events, event_tiers, bible_reading_plans, bible_reading_plan_days, and bible_reading_progress.

## Content Management
The system supports a single subscription model with configurable free trial. Admins can set trial duration, pricing, and selectively enable content areas and individual items for trial access. Features include progress tracking, search, and a comprehensive admin panel.
- **Study Content**: Supports embedded, day-by-day lessons with rich text editing, scripture, questions, and key takeaways. Includes a bulk import tool for converting document-based content (Word/PDF) into structured lessons. Progress tracking is integrated at various levels (lesson, study, series). Series can require consecutive completion, where studies unlock only after completing the previous one. Users receive notifications when the next study becomes available.
- **Devotional Content**: Admins can upload custom thumbnail images and utilize a bulk import tool for up to 30 devotionals, which supports automated daily posting and validation.

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging.
- **Studies & Devotionals**: Management for Bible studies (lesson-based) and devotionals (with thumbnail uploads).
- **Bible Reading Plans**: Two 365-day whole-Bible reading plans available in the Study Library — "Read Through the Bible in 365 Days" (canonical Genesis–Revelation order) and "Chronological Bible Reading Plan" (historical event order). Each plan has 365 daily readings generated algorithmically (~3 chapters/day across all 66 books). Users can check off each day, track a consecutive-reading streak, and view overall progress. Rations awarded: 10 per day completed, 50 bonus for 7-day streak, 200 bonus for 30-day streak. Data: `bible_reading_plans` (2 rows), `bible_reading_plan_days` (730 rows), `bible_reading_progress` (per-user). Routes: GET /api/bible-plans, GET /api/bible-plans/:id/days, GET /api/bible-plans/:id/progress, POST /api/bible-plans/:id/days/:dayNum/complete, POST /api/admin/seed-bible-plans. UI: `client/src/pages/bible-reading-plan.tsx`, section in `library.tsx`.
- **Community**: Interactive discussions, user profiles, and a discipleship system with tag-based user discovery and faith journey stages.
- **Video & Podcast Management**: Full upload, storage, processing, and management with tiered access, topic classification, ratings, and RSS feed import capabilities (e.g., Podomatic). Videos support both direct file uploads (up to 100MB) and external URL-based videos (YouTube, Vimeo, or any direct .mp4 link — no size limit). The admin upload dialog has two tabs: "Upload File" and "Add by URL". YouTube and Vimeo URLs are auto-detected and rendered as embedded iframes; other URLs play in a `<video>` tag. The `videos` table has a nullable `videoUrl` column and nullable file-related columns to support both modes.
- **Notifications**: Enhanced system for native push notifications (via Web Push API and Service Workers), daily devotionals, content updates, and discussion replies. Users can enable/disable push notifications per device in settings.
- **User Engagement**: Streak tracking, prayer time system, weekly challenges with participation tracking, and a testimony system.
- **War Room**: A dedicated prayer request space where users can post prayer requests (real names only), comment, and indicate they've prayed, with real-time updates via WebSockets.
- **Under Fire**: An accountability space where users post requests, and others can "Assist" to become accountability partners, initiating a direct message.
- **War Groups**: Licensed discipleship groups with city-based discovery, interactive map view (OpenStreetMap Nominatim API), leader/member management, and private discussion boards supporting media uploads. Includes a registration and approval workflow for new groups with admin notifications.
- **Fitness Integration**: Local exercise database for fitness plans. Gated by a per-user `hasFitnessAccess` boolean flag. Includes a **Fitness Community** tab (exclusive to fitness subscribers) — a social feed where members can post encouragement, ask for help, share plan ideas, and discuss nutrition. Posts support photo and video uploads (up to 5 files, stored in `uploads/community/`). Members can like posts and delete their own. Categories: Encouragement, Help/Questions, Plan Ideas, Nutrition. Backed by `fitness_posts` and `fitness_post_likes` tables. API routes under `/api/fitness/community/`. Users gain access via Stripe checkout (fitness membership $4.99/mo) which sets the flag via webhook on `checkout.session.completed`. Access is revoked on `customer.subscription.updated` when status becomes `canceled`. Admins can manually grant or revoke access per-user via the admin user management panel (`PUT /api/admin/users/:id/fitness-access`).
- **Event Ticketing (In-App)**: Paid event tickets are processed fully inside the app using Stripe PaymentIntent + Elements (no redirect to external Stripe pages). Single-tier events use `event.price`; multi-tier events show a tier picker first. After payment, a registration record is created via `POST /api/events/:id/confirm-purchase` (userId, paymentIntentId, amountPaid stored). Admins can view all registrants per event via a "View Registrants" button (Users icon) on each event card in the admin Events tab, which navigates to `/admin/events/:id/registrants` — showing name, email, ticket type, and payment status with CSV export. Confirmation email sent via Resend after successful payment.
- **Gamification (Rations & Ranks)**: A system where users earn "rations" for completing missions (40+ types across features) to progress through a 5-tier rank system. Includes anti-abuse guardrails and a grace bonus for returning users.
- **App Onboarding Tour**: An 11-step guided tour of the app's main sections. Auto-launches for new users (hasCompletedTour=false in DB) 600ms after their first login post-profile-completion. Each step navigates to the relevant route and shows a fixed floating panel (bottom-20, z-index 9999) with title, description, progress bar, "Next" button, and "Skip Tour" link. During the tour, all TrialPageGuard paywalls are bypassed so users can see every section. Users can restart the tour anytime via "Take the App Tour" in Profile Settings. TourContext at client/src/contexts/TourContext.tsx; overlay at client/src/components/app-tour.tsx; endpoint: POST /api/user/complete-tour.

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

## Stripe Webhook Security
- Webhook handler extracted to `server/stripeWebhook.ts` and registered in `server/index.ts` BEFORE `express.json()` using `express.raw({ type: 'application/json' })` so the raw request body is available for Stripe signature verification.
- **Required secret**: `STRIPE_WEBHOOK_SECRET` must be added to Replit Secrets. Get it from Stripe Dashboard → Developers → Webhooks → select your endpoint → Signing secret. Without this, all webhook requests return 503 (fail-closed by design).
- Signature verification uses `stripe.webhooks.constructEvent(rawBody, sig, secret)` — any request with a missing or invalid signature is rejected with 400 before any database writes occur.