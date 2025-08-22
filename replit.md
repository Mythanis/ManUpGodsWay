# Overview
"Man Up God's Way" is a full-stack React/Express application providing a faith-based platform for biblical masculinity, leadership development, and spiritual growth. It offers structured learning programs including Bible studies, devotionals, community discussions, and progress tracking to empower men in their faith and character. The platform features robust authentication, real-time messaging, video content management with tiered access, and an admin system for content and user management.

## Recent Updates
- **Real-time Content Publishing**: Studies and videos now automatically appear across all pages when admins publish new content (8-10 second polling)
- **Enhanced Discussion Categories**: Added "Miscellaneous" topic and streamlined study discussion creation
- **Tier-Based Content Notifications**: Automatic real-time notifications sent to users when new studies/videos are published, filtered by subscription tier access (free users get free content notifications, premium users get free+premium, VIP users get all content)
- **Daily Devotional Notifications**: Implemented automatic background service that sends notifications to all users when new daily devotionals become available (checks every 15 minutes), with manual admin controls and immediate notifications when devotionals are created
- **Discussion Subscription System**: Complete implementation allowing users to subscribe/unsubscribe from discussions with bell button UI, automatic notifications when new replies are posted, and full database schema for tracking subscriptions
- **Consistent Dark Mode Theming**: Fixed "Post Reply" buttons in discussions to match "All Studies" button styling with proper black background and white text for optimal visibility in both light and dark modes
- **Ministry Color Scheme Correction**: Removed incorrect "navy" color from ministry palette and standardized admin page buttons to use proper ministry colors: charcoal (primary), gold (accent), steel (borders), and slate (subtle text)
- **Unified Community Statistics**: Updated admin dashboard stats to match community page calculations - "Active Today" now uses user activity tracking and "New Posts" includes both discussion threads and replies for consistent metrics across both interfaces
- **Complete User Profile System**: Implemented comprehensive user profile pages replacing popup menus with full profile views showing detailed statistics (studies completed, days active, forum posts, member tier), direct message capability, user reporting functionality with admin notifications, and profile navigation from discussion avatars
- **Notification Preferences Management**: Added complete notification preferences system allowing users to control all notification types (content updates, community activity, weekly digest) except admin notifications, with dedicated preferences page accessible through user profile settings
- **Complete Logo Management System**: Implemented comprehensive admin logo upload functionality with ministry theme background color selection (white, light gray, charcoal, gold, steel, slate), real-time splash screen preview, database storage, and automatic splash screen display on every app load/reload with configurable duration and background styling
- **SPA Navigation Fix**: Fixed notification panel to use proper single-page application navigation instead of window.location.href, preventing app restarts when clicking on notifications and maintaining smooth user experience
- **Persistent Account Settings Access**: Added fixed cog wheel icon at top right of all authenticated pages with "Account Settings" tooltip that navigates to user profile page, and removed Profile button from bottom menu for cleaner mobile navigation
- **Navigation Renaming**: Renamed Dashboard to Home throughout the application including navigation labels, page names, routing, and all code references for improved clarity
- **Complete Podcasts System**: Built comprehensive podcast management system with audio/video content support, user ratings (1-5 stars), review system, view tracking, search/filter functionality, sorting options (date, rating, views, alphabetical), category organization, and admin upload/management interface with title, description, topic fields
- **Weekly Challenges System**: Implemented complete challenges system with Monday-based weekly release logic, admin creation/management interface, user-facing challenges page with current week display, challenge history with sorting by date/topic, topic-based filtering, and navigation integration
- **Differentiated Challenge Visibility**: Admin challenge management shows all challenges (past, current, future) with visual status badges and intelligent sorting (Future → Current → Past), while user challenges page displays only current and previous challenges to prevent spoilers
- **Real-time Challenge Management**: Enhanced push-to-current functionality with immediate UI updates through direct cache manipulation, smart duplicate detection preventing unnecessary operations, visual status indicators (Current/Future/Past badges), and intelligent button display logic that only shows push option for non-current challenges
- **Unified Color Scheme**: Updated all yellow/gold colors throughout the application to use RGB 251,208,0 (HSL 50, 100%, 49%) for consistent visual branding across buttons, badges, tier indicators, challenge cards, stars, and accent elements
- **Challenge Date Selection Fix**: Resolved critical bug where Monday date selection was defaulting to previous Monday instead of selected/next Monday, implemented proper next-Monday calculation logic with comprehensive validation and error handling for accurate challenge release date management
- **Complete Lesson-Based Study System**: Implemented comprehensive lesson management system with individual lesson content areas, specialized navigation (X button returns to study, Discussion button opens discussions), admin lesson creation interface with configurable lesson count and content, database schema with lessons table including study relations, lesson number uniqueness constraints, video support, estimated time tracking, and seamless integration with existing study workflow including automatic lesson display in study detail pages when lessons are available
- **Enhanced Lesson Page Functionality**: Fixed lesson page navigation to properly return to studies (corrected route from /study to /studies), updated "Message" button to "Discussion" for clarity, resolved video playback issues with proper authentication handling for lesson videos, added comprehensive error handling and debug logging for video loading, and implemented proper TypeScript type casting for DOM elements
- **Lesson Progress Tracking System**: Implemented automatic lesson completion system with "Finished" button on lesson pages that marks lesson complete and advances to next lesson, replaced dropdown lesson selector with simple text display showing current lesson or "All lessons completed", removed manual "Update Progress" button in favor of automatic progression, and integrated progress invalidation to ensure real-time UI updates across the application
- **Home Page Progress Improvements**: Fixed inconsistent progress data display by implementing proper safety checks and improved currentStudy selection logic that prioritizes most recently accessed studies, enhanced ProgressCard to show current lesson information with "Currently on: Lesson X" display, resolved authentication issues in lesson completion API with proper credential handling, and updated Continue Study button to navigate to study overview page instead of specific lessons for better user workflow
- **Live Podcast Session System**: Implemented dedicated live streaming system where admins create new podcast entries for live sessions instead of streaming existing podcasts, integrated with Riverside.fm for professional streaming capabilities, added comprehensive admin interface for managing live sessions with detailed setup instructions, automatic podcast entry creation upon going live, user notification system for live streams, and permanent recording storage in podcast library after sessions end
- **Complete Testimony System**: Implemented comprehensive testimony management with database schema (testimonies table with content, privacy, tags), backend API endpoints for testimony CRUD operations and privacy management, frontend testimony form component with rich text editing, privacy controls, tag management, and public testimony display on user profiles when privacy settings allow sharing
- **Discipleship Page with Tag-Based User Discovery**: Added comprehensive discipleship system allowing users to search for testimony tags and discover community members with shared faith experiences, featuring tag-based search functionality, dropdown menu of all available tags with counts, real-time tag updates as users add unique tags, user discovery results showing profiles with matching tags, and seamless integration with the user profile system for viewing detailed member information

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite for development and bundling. It employs Wouter for routing, shadcn/ui (based on Radix UI) for components, and Tailwind CSS for styling with a custom ministry-themed color palette. TanStack Query manages server state and caching, while React Hook Form with Zod handles form validation.

## Backend Architecture
The backend is an Express.js server in TypeScript, following a RESTful API design. It utilizes session-based authentication integrated with Replit's OIDC, storing sessions in PostgreSQL. Middleware is used for request/response logging, error handling, and role-based access control (user, admin) with subscription tiers (free, premium, VIP) for content access.

## Database Design
PostgreSQL is used as the database, hosted on Neon Database. Drizzle ORM provides type-safe queries and manages database migrations with Drizzle Kit. The schema includes tables for users, studies, discussions, devotionals, progress tracking, ratings, and video metadata.

## Content Management
The system supports a tiered content structure (free, premium, VIP) and category-based organization for study materials and videos. It includes features for progress tracking (lesson completion, study ratings), search functionality, and an admin panel for comprehensive content and user management, including video uploads, tier assignment, and notification broadcasting.

## State Management
Server state is managed using TanStack Query for caching and invalidation. React Hook Form is used for form state, and local component state handles UI interactions. Query key patterns optimize cache management.

## UI/UX Design
The application features a mobile-first responsive design with a bottom navigation, a ministry-themed color scheme (navy, gold, steel), and card-based layouts. It incorporates progressive enhancement with loading states, error boundaries, and accessibility considerations.

## Key Features
- **Authentication**: Replit Auth integration with session management.
- **Messaging**: Real-time direct and group messaging with conversation management, privacy settings, and a user setup wizard.
- **Studies & Devotionals**: Comprehensive management for Bible studies and devotionals, including rich content display and admin CRUD operations.
- **Community**: Interactive discussion pop-outs, real-time statistics, and integration within study pages.
- **Video Management**: Full video upload, storage, processing, and management system with tiered access, topic classification, and ratings/reviews.
- **Notifications**: Enhanced notification system with push notification broadcasting (admin-controlled with targeting), user management, individual/bulk clearing, and automated daily devotional notifications with background service monitoring.
- **User Engagement**: Streak tracking based on user's local time, prayer time system with focus mode, and featured content display.

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

## Development Tools
- ESBuild
- PostCSS
- connect-pg-simple

## Replit Integration
- @replit/vite-plugin-runtime-error-modal
- @replit/vite-plugin-cartographer