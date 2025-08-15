# Overview

This is a full-stack React/Express application called "Man Up God's Way" - a faith-based platform focused on biblical masculinity, leadership development, and spiritual growth. The application provides Bible studies, community discussions, devotionals, and progress tracking for men seeking to strengthen their faith and character through structured learning programs.

## Recent Changes (Updated: August 15, 2025)

✓ **Core Application Built**: Complete implementation of the men's ministry web application
✓ **Authentication System**: Replit Auth integration with proper session management working
✓ **Database Schema**: PostgreSQL database with comprehensive schema for users, studies, discussions, devotionals, progress tracking, and messaging
✓ **Frontend Components**: All major pages implemented (Dashboard, Library, Community, Messages, Profile, Admin)
✓ **API Endpoints**: Full REST API with proper authentication middleware
✓ **Mobile-First Design**: Responsive design with ministry-themed color scheme
✓ **Critical Fixes Applied**: QueryClient provider setup and database query syntax resolved
✓ **Messaging System**: Complete direct messaging and private group chat functionality
✓ **Study Management**: Admin panel with full CRUD operations for managing Bible studies
✓ **Discussion System**: Full community features with replies, likes, and sorting options
✓ **Enhanced Group Chat**: Advanced member search, selection interface, and profile interactions
✓ **Profile Interactions**: Clickable avatars across all components for direct messaging and group creation
✓ **User Management**: New `/api/users` endpoint for secure user access in messaging features
✓ **Application Status**: Fully functional with comprehensive social interaction features

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript for the client-side application
- **Vite** as the build tool and development server with HMR support
- **Wouter** for client-side routing instead of React Router
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with custom ministry-themed color palette
- **TanStack Query** for server state management and API caching
- **React Hook Form** with Zod validation for form handling

## Backend Architecture
- **Express.js** server with TypeScript
- **RESTful API** design with structured route handlers
- **Session-based authentication** using Replit's OIDC integration
- **PostgreSQL sessions** stored using connect-pg-simple middleware
- **Request/response logging** middleware for API monitoring
- **Error handling** middleware with proper HTTP status codes

## Database Design
- **PostgreSQL** database with Drizzle ORM for type-safe queries
- **Neon Database** as the PostgreSQL provider
- **Schema-first** approach with shared TypeScript types
- **Drizzle Kit** for database migrations and schema management
- Tables include: users, studies, discussions, devotionals, progress tracking, and ratings

## Authentication & Authorization
- **Replit Auth** integration using OpenID Connect
- **Passport.js** strategy for OAuth flow handling
- **Role-based access control** (user, admin) with middleware protection
- **Session management** with PostgreSQL session store
- **Subscription tiers** (free, premium, VIP) for content access control

## Content Management
- **Tiered content system** with free, premium, and VIP study materials
- **Category-based organization** (leadership, marriage, fatherhood, character)
- **Progress tracking** with lesson completion and study ratings
- **Search functionality** across study content
- **Admin panel** for content creation and user management

## State Management
- **TanStack Query** for server state with automatic caching and invalidation
- **React Hook Form** for form state management
- **Local component state** using React hooks for UI interactions
- **Query key patterns** for efficient cache management

## UI/UX Design
- **Mobile-first responsive design** with bottom navigation
- **Ministry-themed color scheme** with navy, gold, and steel accents
- **Card-based layouts** for content organization
- **Progressive enhancement** with loading states and error boundaries
- **Accessibility considerations** with proper ARIA labels and semantic HTML

# External Dependencies

## Core Framework Dependencies
- **React 18** - Frontend framework with hooks and concurrent features
- **Express.js** - Backend web server framework
- **TypeScript** - Type safety across the entire application
- **Vite** - Development server and build tool

## Database & ORM
- **Neon Database** - Serverless PostgreSQL database hosting
- **Drizzle ORM** - Type-safe SQL query builder and migrations
- **@neondatabase/serverless** - Neon's serverless database client

## Authentication
- **Replit Auth** - OIDC-based authentication service
- **Passport.js** - Authentication middleware for Express
- **openid-client** - OpenID Connect client implementation

## UI Components & Styling
- **Radix UI** - Unstyled, accessible component primitives
- **shadcn/ui** - Pre-built component library based on Radix
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library

## State Management & Data Fetching
- **TanStack Query** - Server state management and caching
- **React Hook Form** - Form state management and validation
- **Zod** - Runtime type validation and schema definition

## Development Tools
- **ESBuild** - Fast JavaScript bundler for production builds
- **PostCSS** - CSS processing with Tailwind integration
- **connect-pg-simple** - PostgreSQL session store for Express

## Replit Integration
- **@replit/vite-plugin-runtime-error-modal** - Development error overlay
- **@replit/vite-plugin-cartographer** - Replit-specific development tools