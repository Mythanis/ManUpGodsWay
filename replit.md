# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning programs including document-based Bible studies, devotionals, community discussions, and progress tracking to empower men in their faith and character. **Studies are now 100% document-based (PDF/Word) with no lesson structure.** The platform features robust authentication, real-time messaging, video content management with tiered access, admin content and user management, a comprehensive podcasts system, weekly challenges, and a local exercise database for fitness programs. The project aims to provide a centralized hub for spiritual and personal development, fostering a strong, engaged community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite for development. It employs Wouter for routing, shadcn/ui (based on Radix UI) for components, and Tailwind CSS for styling with a custom ministry-themed color palette (charcoal, gold, steel, slate). TanStack Query manages server state, while React Hook Form with Zod handles form validation. The application features a mobile-first responsive design with a bottom navigation and card-based layouts.

## Backend Architecture
The backend is an Express.js server in TypeScript, following a RESTful API design. It utilizes session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware is used for logging, error handling, and role-based access control (user, admin) with subscription tiers (free, premium, VIP) for content access.

## Database Design
PostgreSQL, hosted on Neon Database, is used with Drizzle ORM for type-safe queries and migrations. The schema includes tables for users, studies (with lessons), discussions, devotionals, podcasts, challenges, testimonies, exercises, and various metadata for progress tracking, ratings, and video content.

## Content Management
The system supports a tiered content structure (free, premium, VIP) and category-based organization for study materials, videos, and podcasts. Features include progress tracking (lesson completion, study ratings), search, and a comprehensive admin panel for content and user management, video/podcast uploads, tier assignment, and notification broadcasting. It also includes a robust system for managing study documents (PDFs, Word docs) with tier-based access. Admins can upload new PDF/Word documents, delete existing ones, and update study materials through the edit interface.

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging with conversation management.
- **Studies & Devotionals**: Comprehensive management for Bible studies (including lesson-based structures) and devotionals.
- **Community**: Interactive discussion features, real-time statistics, user profiles, and a discipleship system with tag-based user discovery and faith journey stages for testimonies.
- **Video & Podcast Management**: Full upload, storage, processing, and management system for videos and podcasts with tiered access, topic classification, ratings/reviews, and live session support (Riverside.fm integration).
- **Notifications**: Enhanced system with push notification broadcasting, user management, automated daily devotional notifications, and tiered content update notifications.
- **User Engagement**: Streak tracking, prayer time system, weekly challenges with intelligent release logic, and a comprehensive testimony system.
- **Fitness Integration**: Local exercise database with filtering and search capabilities for creating fitness plans.

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