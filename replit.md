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
- **Fitness Integration**: Local exercise database, fitness community feed, Stripe-integrated access control, and a Health tab for manually logging Steps & Calories, Heart Rate, Sleep, and Weight & Body Measurements (7-day history per metric, stored in `health_metrics` table).
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

Results land in the `exercise_instruction_reviews` table. Status values:
`pending` | `approved` (correct or correction applied by admin) | `rejected` (no video / unparseable response).

**Corrections require human review before being applied to exercises.instructions.**
The job only stages results; nothing is written to the live `exercises` table automatically.

**Full audit completed April 23 2026:**
- 1,669 / 1,674 approved: 282 matched video exactly; 1,390 had AI corrections (applied directly to `exercises.instructions`)
- 5 rejected: 3 had bare-filename `media_file` paths (no GCS object), 2 exhausted rate-limit retries
- 0 rows pending — all rows are resolved

### Human review workflow

1. Inspect flagged rows (AI believes instructions need changing):
```sql
SELECT exercise_id, exercise_name, new_instructions
FROM exercise_instruction_reviews
WHERE needs_review = true AND new_instructions IS NOT NULL AND status = 'pending'
ORDER BY exercise_id;
```

2. Apply corrections for rows you've reviewed and approve:
```sql
-- Apply one correction
UPDATE exercises SET instructions = r.new_instructions
FROM exercise_instruction_reviews r
WHERE exercises.id = r.exercise_id AND r.exercise_id = <id>;

UPDATE exercise_instruction_reviews SET status = 'approved' WHERE exercise_id = <id>;
```

3. Or bulk-apply all pending corrections after reviewing them:
```bash
npx tsx scripts/apply-exercise-reviews.ts --apply-corrections
```
Without `--apply-corrections`, the script only approves already-matched rows and rejects parse errors —
flagged corrections remain pending for admin review.

### Running the audit job

The server-side job (`server/exerciseAuditJob.ts`) does NOT auto-start by default.
Trigger it via the admin API or set `EXERCISE_AUDIT_AUTO_START=true` in env vars:

- `GET  /api/admin/exercise-audit/status` — running state, processed/total counts (admin only)
- `POST /api/admin/exercise-audit/start`  — trigger the audit job (admin only)

# Left/Right Exercise Pairing

Some exercises in the library exist as separate "left" and "right" rows
(e.g. `#79 Diagonal Chop Left` + `#80 Diagonal Chop Right`). Logically
these are one unilateral exercise where each set means "do the right side,
then do the left side". They were being added to plans as two independent
exercises. To collapse them into a single unilateral entry:

**Schema** (in `exercises`):
- `paired_exercise_id integer` — self-FK to the partner row
- `side varchar` — `'left'` or `'right'`
- `pair_base_name varchar` — canonical name with the L/R token stripped (e.g. `"Diagonal Chop"`)

**Auto-pair script:** `scripts/pair-lr-exercises.ts`
- Detects pairs by matching name modulo standalone `\b(left|right)\b` tokens
  within the same body-part + equipment.
- Sets `paired_exercise_id`, `side`, `pair_base_name` on both rows and forces
  `sidedness='unilateral'`.
- Idempotent. Default is dry-run; pass `--apply` to write. Pass `--unpair`
  to clear all pair links.
- Last run linked 11 pairs (22 rows). Skipped rows are singletons whose
  partner doesn't exist in the DB or ambiguous duplicates — see script
  output for the list.

**API behaviour:**
`GET /api/exercises?dedupePairs=true` returns one row per pair (the
`side='left'` half) with `name` rewritten to `pair_base_name`. User-facing
flows (`fitness.tsx` browse + plan-build, `create-plan.tsx`,
`edit-plan.tsx` picker + swap) all pass `dedupePairs=true`. Admin
(`exercise-reviews.tsx`, `fitness-management.tsx`) omits the flag so both
halves remain visible.

**Runtime:** the workout player already runs `sidedness='unilateral'` as
right-side-then-left-side per set, so once a pair is linked the merged
entry naturally plays both sides in one set.

**Admin UI:** `Exercise Reviews` shows an `L-pair` / `R-pair` chip on list
rows that are linked, and the detail view shows a "L/R Pair" panel with an
"Open partner" button to jump to the other side.

```bash
# CLI — targeted re-runs (e.g. the 5 that failed)
npx tsx scripts/audit-exercise-instructions.ts --ids 472,615,1461,1573,1610 --force

# Test a tiny batch first
npx tsx scripts/audit-exercise-instructions.ts --limit 3

# Full run (prompts for confirmation before spending tokens)
npx tsx scripts/audit-exercise-instructions.ts --confirm
```

Requires `ANTHROPIC_API_KEY` (already configured as a Replit secret).

## Injury-Aware Exercise Filtering (Tasks #155 & #159)

**Files:**
- `shared/injuryFilter.ts` — RulePack-based evaluation engine (shared between client/server)
- `shared/schema.ts` — `user_injuries.started_at` (nullable timestamp) for recovery week math
- `server/routes.ts` — `POST /api/exercises/evaluate-injuries`, `GET /api/user/injuries/recommendations`; injury guard on bulk add
- `client/src/components/InjuriesPanel.tsx` — date input on Recovery, "Week N" badge, recommendations card

**Rule packs (Tasks #159 + #162):** seven body-part-specific packs — KNEES, LOWER_BACK, SHOULDERS, HIPS, UPPER_BACK_NECK, WRISTS_FOREARMS, ANKLES_CALVES. Each defines `blockPatterns`, `allowPatterns`, `stretchBlock/Allow`, `stretchAreaPatterns`, `longTermAvoid/Prefer`, `reintroduceByWeek`, `alwaysInclude`, `compensationStretch`, `compensationStrengthen`.

**Logic:**
`evaluateExerciseAgainstInjuries(exercise, injuries)` returns `{ status: "allowed"|"modify"|"blocked", reasons, modificationHints }`.
- Resolves each injury's body area to a RulePack via `RULE_PACK_BY_AREA` (umbrella terms Hips/Wrists/Ankles map to their pack).
- `currently_injured` → blocks pattern matches with named reasons; `recovery` → uses `computeRecoveryWeek(startedAt)` to allow exercises by week milestone, blocks with "unlocks Week N"; `long_term_limitation` → silently swaps to PREFER substitutes, blocks AVOID patterns.

**State-driven stretch rules (Task #162):** When a stretch exercise matches a pack's `stretchAreaPatterns` (i.e. it targets that injury area specifically):
- `currently_injured` → blocked with message "stretches must avoid the injured area, max 20-second holds"
- `recovery` Week < 6 → blocked "Stretching the {area} is reintroduced at Week 6"
- `recovery` Week ≥ 6 → modify with "Use ~50% of your normal hold time; +5 seconds per pain-free week"
- `long_term_limitation` → allowed; coaching only via recommendations card
`stretchAllowPatterns` always take precedence over the new state logic (blessed gentle stretches remain allowed).

**Stretch policy helper:** `getInjuryStretchPolicy(injuries)` returns one coaching string per area based on the worst injury state. Worst-state wins: currently_injured > recovery > long_term_limitation.

**Recommendations:** `getInjuryRecommendations(injuries)` returns `[{ bodyArea, recommendations, compensationStretch, compensationStrengthen, stretchPolicy }]` from each pack. InjuriesPanel renders three subsections: Always Include, Stretch every session (blue), Strengthen every session (yellow).

**Frontend (create-plan.tsx & edit-plan.tsx):**
- Exercise browser cards show 🔴 Blocked / 🟡 Caution badges when user has recorded injuries
- Toggle "Hide exercises that conflict with my injuries" (auto-ON when any current injury)
- Confirmation dialog when clicking a blocked exercise — user must acknowledge before adding
- Existing selected exercises in edit-plan show ⚠️ warning pills

**Server guard:**
`POST /api/fitness-plans/:planId/exercises/bulk` returns 409 `{ code: "INJURY_RISK", blockedExercises }` if any exercise is blocked and `acknowledgeInjuryRisk` is not true.

