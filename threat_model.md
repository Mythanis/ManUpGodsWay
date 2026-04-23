# Threat Model

## Project Overview

This is a full-stack React + Vite frontend with an Express/TypeScript backend and PostgreSQL via Drizzle. It serves a member platform with public content, authenticated community features, admin and owner tools, paid subscriptions through Stripe, live streaming through Mux, object storage for uploaded media, push notifications, and email integrations.

Production scope for this scan is the shipped web app and its backend routes. The mockup sandbox is not deployed to production and is out of scope. Assume `NODE_ENV=production` in deployed environments, platform TLS is handled by Replit, and only production-reachable code should drive findings.

## Assets

- **User accounts and sessions** — Replit Auth identities, session cookies, role assignments, and profile records. If these are misused, attackers can act as other users or reach protected features.
- **Paid and member-only content** — subscription-gated videos, studies, downloads, and fitness content. This content is part of the product and must not be exposed to anonymous or unpaid users.
- **Community and personal data** — email addresses, profile data, direct messages, group activity, prayer requests, reports, order details, and shipping information. This data can harm users if exposed or changed by the wrong person.
- **Payment and commerce state** — Stripe customer IDs, subscription status, event payments, registrations, orders, and fulfillment details. Errors here can grant access incorrectly or affect billing and business records.
- **Streaming credentials and broadcast state** — Mux stream IDs, stream keys, RTMP/WHIP details, playback IDs, simulcast keys, live status, and recording workflows. Exposure or spoofing here can let outsiders hijack broadcasts or trigger false live events.
- **Application and integration secrets** — session secret, database connection details, Stripe keys, Mux credentials, Resend and Mailchimp credentials, VAPID keys, and object storage access. These must never leak to clients or untrusted logs.
- **Uploaded files and documents** — private videos, public images, thumbnails, PDFs, and Word documents. Access rules and path handling must prevent cross-user disclosure and unsafe file processing.

## Trust Boundaries

- **Browser / API boundary** — every client request crosses from an untrusted browser into Express handlers in `server/index.ts` and `server/routes.ts`.
- **Public / authenticated / admin / owner boundary** — this app mixes public browsing, logged-in community features, admin content tools, and owner-only system settings. These checks must be enforced on the server, not assumed from the UI.
- **API / database boundary** — `server/storage.ts` and direct Drizzle queries in `server/routes.ts` can read and mutate most business data.
- **API / external service boundary** — the backend talks to Replit Auth, Stripe, Mux, Mailchimp, Resend, Bible APIs, nutrition APIs, and object storage. Webhooks and callbacks from these services must be authenticated and validated.
- **Public media / private media boundary** — public assets are proxied through `/api/media/*`, while private videos are supposed to stay behind gated streaming routes.
- **Production / dev-only boundary** — scripts, backups, experiments, and mockup-only files should usually be ignored unless runtime reachability is shown in production.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/replitAuth.ts`
- **Highest-risk code areas:** `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`, `server/stripeWebhook.ts`, `server/objectStorage.ts`, live-stream and admin flows
- **Public surfaces:** many `GET /api/*` content, media, live-stream, blog, study, podcast, and video routes
- **Authenticated/admin surfaces:** profile, community, purchases, uploads, admin management, owner tools, live-stream controls
- **Usually dev-only unless proven reachable:** `scripts/*`, `*.backup`, mockup/sandbox-only code, one-off migration helpers

## Confirmed Hot Spots For Future Scans

- Public read endpoints in `server/routes.ts` sometimes return raw database rows from `server/storage.ts` without field filtering. Future scans should keep checking for full `users`, `live_streams`, and similar records crossing the API boundary.
- Paid-content controls are split across UI flows, list endpoints, download endpoints, and object-storage/media proxies. Future scans should verify the storage path itself is protected, not just the page that links to it.
- Webhook and payment-confirmation paths deserve repeated review. This codebase has multiple routes that trust external callback payloads or browser-supplied payment state more than Stripe or Mux should allow.
- Messaging and group features need explicit participant and membership checks on every read/write route. UI consent settings and removal flows cannot be assumed to hold unless the route enforces them directly.
- Upload routes using `multer.memoryStorage()` are a recurring denial-of-service risk, especially where authorization happens after multipart parsing or where per-route byte limits are large.

## Threat Categories

### Spoofing

This app accepts identity from Replit Auth and events from outside services like Stripe and Mux. Protected routes must require a real session, role checks must be enforced on the server, and third-party callbacks must verify signatures or another strong origin proof before changing state.

### Tampering

Users and outside services can submit JSON bodies, file uploads, query parameters, and webhook payloads that affect subscriptions, live-stream state, community content, and admin-managed records. The server must treat all request data as untrusted and must not let client input directly decide privileged actions, billing outcomes, or broadcast state.

### Information Disclosure

The app stores a mix of private member content, profile data, payment-linked records, streaming credentials, and uploaded files. API responses must return only the fields needed by the caller, private media must stay behind access checks, and secrets or internal identifiers must never be exposed in public responses.

### Denial of Service

The API includes uploads, content generation, external API fetches, streaming helpers, and broad list endpoints. Public or lightly protected routes must be rate-limited and bounded so outsiders cannot cheaply trigger expensive work, notification spam, or large media operations.

### Elevation of Privilege

This codebase has many role-based routes and many places where content visibility depends on subscription state. Every route that reads or changes protected data must enforce the correct user, role, ownership, or subscription rule on the server. Public list endpoints and direct object/file streaming paths are especially important because they can bypass UI paywalls if not checked carefully.

### Repudiation

Sensitive actions such as subscription changes, admin moderation, live-stream state changes, payouts, and order handling should leave enough server-side evidence to understand who triggered them and when. Where third-party events drive state, the app needs trustworthy event validation and meaningful logs so false or malicious changes can be traced.