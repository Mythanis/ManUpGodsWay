# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning programs including **embedded, day-by-day Bible studies** with progress tracking, devotionals, community discussions, and comprehensive discipleship tools to empower men in their faith and character. **Studies are transitioning from document-based (PDF/Word) to fully embedded structured lessons** with day-by-day navigation, interactive questions, progress tracking, and in-app reading. The platform features robust authentication, real-time messaging, video content management with tiered access, admin content and user management, a comprehensive podcasts system, weekly challenges, and a local exercise database for fitness programs. The project aims to provide a centralized hub for spiritual and personal development, fostering a strong, engaged community.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite for development. It employs Wouter for routing, shadcn/ui (based on Radix UI) for components, and Tailwind CSS for styling with a custom ministry-themed color palette (charcoal, gold, steel, slate). TanStack Query manages server state, while React Hook Form with Zod handles form validation. The application features a mobile-first responsive design with a bottom navigation and card-based layouts.

## Backend Architecture
The backend is an Express.js server in TypeScript, following a RESTful API design. It utilizes session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware is used for logging, error handling, and role-based access control (user, admin) with subscription tiers (free, premium, VIP) for content access.

## Database Design
PostgreSQL, hosted on Neon Database, is used with Drizzle ORM for type-safe queries and migrations. The schema includes:
- **studies**: Bible study metadata (title, description, category, tier, totalDays, etc.)
- **studyLessons**: Individual day/lesson content (dayNumber, title, content, scripture, questions, keyTakeaway)
- **userProgress**: Overall study progress tracking (currentDay, status, completedAt)
- **userLessonProgress**: Per-lesson completion tracking (isCompleted, answers, completedAt)
- **users, discussions, devotionals, podcasts, challenges, testimonies, exercises**: Additional core tables
- **challengeParticipants**: Tracks which users have accepted weekly challenges (with unique constraint to prevent duplicates)
- Various metadata tables for ratings, video content, and user engagement

## Content Management
The system supports a tiered content structure (free, premium, VIP) and category-based organization for study materials, videos, and podcasts. Features include progress tracking (lesson completion, study ratings), search, and a comprehensive admin panel for content and user management, video/podcast uploads, tier assignment, and notification broadcasting.

### Study Content Management
- **Embedded Lessons**: Admins can create structured, day-by-day study lessons directly in the app with rich text editor, scripture references, questions, and key takeaways
- **Bulk Import Tool**: Production-ready feature for converting Word/PDF content to embedded lessons. Supports common export formats (Markdown headings, colon/hyphen/em-dash separators), automatic lesson parsing with preview, and batch creation. Safety features include stale data prevention (clears preview on text edits) and collision-free ordering (uses max displayOrder)
- **Progress Tracking**: 
  - **Study Detail Page**: Displays incremental progress based on completed lessons (X of Y lessons completed, percentage)
  - **EmbeddedLessonViewer**: Shows comprehensive progress indicators including progress bar, day badges, visual navigation dots with completion checkmarks
  - **Library Page**: Smart button labels - "Start" for new studies, "Continue" for in-progress studies, "Review" for completed studies
  - **Streak Tracking**: Automatically updates when lessons are completed, incrementing once per calendar day regardless of activity type (devotionals or lessons)
- **Document Management**: Legacy system for managing PDF/Word study documents with tier-based access. Admins can upload new documents, delete existing ones, and update study materials through the edit interface

### Devotional Content Management
- **Thumbnail Uploads**: Admins can upload custom thumbnail images for daily devotionals through the admin panel
  - File upload UI with dropzone-style interface and instant preview
  - Uploaded images stored in `/uploads/thumbnails/` directory
  - Automatic display on home page devotional card (20x20 rounded thumbnail)
  - Graceful fallback to default logo when no custom thumbnail exists
  - Remove functionality to delete uploaded thumbnails
  - Form workflow ensures both devotional and thumbnail complete before success notification
  - Existing thumbnails preserved when editing devotional without uploading new image
- **Bulk Import**: Admins can import up to 30 devotionals at once for automated posting
  - Structured text format with TITLE, REFERENCE, VERSE, and CONTENT fields
  - Supports multiline devotional content and separators between entries
  - Start date picker assigns consecutive dates automatically (daily posting schedule)
  - Preview functionality shows parsed devotionals before import
  - Backend validation ensures data integrity for each devotional
  - Devotionals automatically appear on their assigned dates on the home page

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging with conversation management.
- **Studies & Devotionals**: Comprehensive management for Bible studies (including lesson-based structures) and devotionals with thumbnail image uploads for visual appeal on home page.
- **Community**: Interactive discussion features with auto-subscription when posting replies, real-time statistics, user profiles, and a discipleship system with tag-based user discovery and faith journey stages for testimonies.
- **Video & Podcast Management**: Full upload, storage, processing, and management system for videos and podcasts with tiered access, topic classification, ratings/reviews, live session support (Riverside.fm integration), and RSS feed import capability.
  - **RSS Feed Import**: One-click sync from Podomatic RSS feed (https://manupgodsway.podomatic.com/rss2.xml)
  - Automatic duplicate detection using case-insensitive title matching
  - Efficient batch processing with O(1) duplicate lookups using Set data structure
  - Parses iTunes-specific metadata (duration, thumbnails, enclosures)
  - Success feedback with detailed import/skip counts
- **Notifications**: Enhanced system with push notification broadcasting, user management, automated daily devotional notifications, tiered content update notifications, and automatic discussion reply notifications (users are automatically subscribed when they post a reply).
- **User Engagement**: Streak tracking, prayer time system, weekly challenges with intelligent release logic and participation tracking ("I Take the Challenge" button with real-time participant counts), and a comprehensive testimony system.
- **War Room**: Renamed from "Hurdle Wall" - A dedicated space for men to bring their battles to God and stand together in prayer. Features anonymous posting, discussion threads, and prayer request tracking with black card design, white text, and yellow badges.
- **War Groups**: Licensed discipleship groups named "Man Up God's Way - [City Name]" with city-based discovery, interactive map view with geocoding (OpenStreetMap Nominatim API), group leaders, member management, and admin oversight. Includes synchronous geocoding on group creation/updates with background retry service for failed attempts.
  - **Admin Management**: Comprehensive admin interface for managing war groups including:
    - View all groups with member counts, leader info, location, and licensing status
    - Search and filter groups by name, location, or leader
    - Change group leader with automatic role updates (old leader → member, new leader → leader role)
    - View group member rosters with profile information
    - Remove members from groups (with confirmation)
    - User search functionality for leader selection
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