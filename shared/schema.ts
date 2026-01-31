import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
  unique,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // user, admin, owner
  subscriptionTier: varchar("subscription_tier").default("free"), // free, premium, vip
  subscriptionStatus: varchar("subscription_status").default("active"), // active, cancelled, expired
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  streakDays: integer("streak_days").default(0),
  lastActiveDate: timestamp("last_active_date"),
  totalStudiesCompleted: integer("total_studies_completed").default(0), // Lifetime count - never resets
  totalActiveDays: integer("total_active_days").default(0), // Lifetime days with study activity - never resets
  lastStudyActivityDate: varchar("last_study_activity_date"), // Track when last study day was counted (YYYY-MM-DD)
  rations: integer("rations").default(0), // Gamification currency
  rationRank: varchar("ration_rank").default("recruit"), // recruit, warrior, shepherd, watchman, elder
  allowDirectMessages: boolean("allow_direct_messages").default(true),
  allowGroupInvites: boolean("allow_group_invites").default(true),
  prayerPermissionsGranted: boolean("prayer_permissions_granted").default(false),
  isProfileComplete: boolean("is_profile_complete").default(false),
  themePreference: varchar("theme_preference").default("light"), // light, dark, system
  isProfilePrivate: boolean("is_profile_private").default(false),
  isBanned: boolean("is_banned").default(false),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
  hasSeenWelcome: boolean("has_seen_welcome").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Videos table for storing video content
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration"), // in seconds
  thumbnailUrl: varchar("thumbnail_url"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  requiredTier: varchar("required_tier").notNull().default("free"), // free, premium, vip
  category: varchar("category").notNull().default("general"), // leadership, marriage, fatherhood, character, general
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingCount: integer("rating_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  isProcessed: boolean("is_processed").default(false),
  processingStatus: varchar("processing_status").default("pending"), // pending, processing, completed, failed
  rationReward: integer("ration_reward").default(15), // Rations earned for watching this video
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Study Series - groups related studies together
export const studySeries = pgTable("study_series", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  thumbnailUrl: varchar("thumbnail_url"),
  category: varchar("category").notNull().default("general"),
  requiredTier: varchar("required_tier").default("free"),
  displayOrder: integer("display_order").default(0),
  isPublished: boolean("is_published").default(false),
  requiresConsecutiveCompletion: boolean("requires_consecutive_completion").default(false), // Studies must be completed in order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bible studies
export const studies = pgTable("studies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar("series_id").references(() => studySeries.id, { onDelete: 'set null' }),
  seriesOrder: integer("series_order").default(0),
  title: varchar("title").notNull(),
  description: text("description"),
  content: text("content"),
  category: varchar("category").notNull(), // leadership, marriage, fatherhood, character, etc.
  difficulty: varchar("difficulty").default("beginner"), // beginner, intermediate, advanced
  estimatedHours: integer("estimated_hours").default(1),
  totalDays: integer("total_days").default(0), // Total number of days/lessons in the study
  thumbnailUrl: varchar("thumbnail_url"),
  thumbnailFilename: varchar("thumbnail_filename"), // Stored thumbnail file
  thumbnailMimeType: varchar("thumbnail_mime_type"),
  thumbnailFileSize: integer("thumbnail_file_size"),
  pdfFilename: varchar("pdf_filename"), // Stored PDF document (optional backup)
  pdfOriginalName: varchar("pdf_original_name"),
  pdfMimeType: varchar("pdf_mime_type"),
  pdfFileSize: integer("pdf_file_size"),
  wordFilename: varchar("word_filename"), // Stored Word document (optional backup)
  wordOriginalName: varchar("word_original_name"),
  wordMimeType: varchar("word_mime_type"),
  wordFileSize: integer("word_file_size"),
  videoId: varchar("video_id").references(() => videos.id), // Reference to videos table
  videoUrl: varchar("video_url"), // Keep for backward compatibility with external URLs
  requiredTier: varchar("required_tier").default("free"), // free, premium, vip
  requiresPurchase: boolean("requires_purchase").default(false), // Whether study requires purchase
  price: decimal("price", { precision: 10, scale: 2 }), // Price for purchase (if required)
  purchaseRequiredTiers: text("purchase_required_tiers").array().default(sql`'{}'::text[]`), // Which tiers require purchase: free, premium, vip
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingCount: integer("rating_count").default(0),
  isPublished: boolean("is_published").default(false),
  isFeatured: boolean("is_featured").default(false),
  scheduledPublishDate: timestamp("scheduled_publish_date"), // Optional: publish study at this date/time
  rationReward: integer("ration_reward").default(100), // Rations earned for completing this study
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Study lessons/days - individual daily content for embedded studies
export const studyLessons = pgTable("study_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  dayNumber: integer("day_number").notNull(), // Day 1, Day 2, etc.
  title: varchar("title").notNull(), // e.g., "The Foundation of Biblical Manhood"
  content: text("content").notNull(), // Rich text content for the day
  scripture: text("scripture"), // Bible verses or references
  questions: jsonb("questions").default(sql`'[]'::jsonb`), // Array of reflection questions [{id, question, type}]
  keyTakeaway: text("key_takeaway"), // Summary or key point for the day
  displayOrder: integer("display_order").notNull(), // Order of lesson in study
  estimatedMinutes: integer("estimated_minutes").default(15), // Estimated time to complete this lesson
  rationReward: integer("ration_reward").default(25), // Rations earned for completing this lesson
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.studyId, table.dayNumber), // Each study has unique day numbers
  index("idx_study_lessons_study_order").on(table.studyId, table.displayOrder), // Optimize lesson ordering
]);

// User progress tracking for overall study
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  currentDay: integer("current_day").default(1), // Current day/lesson user is on
  status: varchar("status").default("not_started"), // not_started, in_progress, completed
  documentScrollPosition: integer("document_scroll_position").default(0), // Track reading position in document (for PDF fallback)
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.studyId), // One progress record per user per study
]);

// User progress tracking for individual lessons/days
export const userLessonProgress = pgTable("user_lesson_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: varchar("lesson_id").notNull().references(() => studyLessons.id, { onDelete: 'cascade' }),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  answers: jsonb("answers").default(sql`'{}'::jsonb`), // User's answers to questions {questionId: answer}
  notes: text("notes"), // User's personal study notes for this lesson
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.lessonId), // One progress record per user per lesson
  index("idx_user_lesson_progress_user_lesson").on(table.userId, table.lessonId), // Fast lookups
]);

// User purchases
export const userPurchases = pgTable("user_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("usd").notNull(),
  status: varchar("status").default("completed").notNull(), // completed, refunded, etc.
  purchasedAt: timestamp("purchased_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.studyId), // Prevent duplicate purchases
]);

// Study editable sections (admin-defined interactive areas in Word documents)
export const studyEditableSections = pgTable("study_editable_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  anchorKey: varchar("anchor_key").notNull(), // Stable identifier for position in HTML (e.g., "heading-1", "para-5")
  label: varchar("label").notNull(), // Display label for the editable section (e.g., "Reflection Question 1")
  displayOrder: integer("display_order").notNull(), // Order of sections in the document
  defaultPrompt: text("default_prompt"), // Optional placeholder text for users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User responses to editable sections in studies
export const userStudyResponses = pgTable("user_study_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  sectionId: varchar("section_id").notNull().references(() => studyEditableSections.id, { onDelete: 'cascade' }),
  responseText: text("response_text"), // User's text input
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.studyId, table.sectionId), // One response per user per study per section
]);

// Community discussions
export const discussions = pgTable("discussions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(),
  studyId: varchar("study_id").references(() => studies.id, { onDelete: 'cascade' }), // Optional link to study
  // Media support for social posts
  mediaUrls: text("media_urls").array(), // Array of image/video URLs
  mediaTypes: text("media_types").array(), // Array of media types (image, video, gif)
  postType: varchar("post_type").default("text"), // text, media, link, share
  linkUrl: varchar("link_url"), // External link if sharing a link
  linkPreview: jsonb("link_preview"), // Preview data for shared links
  likes: integer("likes").default(0),
  replyCount: integer("reply_count").default(0),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Live streams table for admin-only streaming
export const liveStreams = pgTable("live_streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  streamUrl: varchar("stream_url"), // Embed URL (YouTube Live, Facebook Live, etc.)
  thumbnailUrl: varchar("thumbnail_url"),
  status: varchar("status").default("scheduled"), // scheduled, live, ended
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Discussion replies/comments
export const discussionReplies = pgTable("discussion_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discussionId: varchar("discussion_id").notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content flags table for reporting inappropriate content
export const contentFlags = pgTable("content_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentType: varchar("content_type").notNull(), // 'discussion' or 'reply'
  contentId: varchar("content_id").notNull(), // ID of the flagged discussion or reply
  reason: varchar("reason").notNull(), // 'inappropriate', 'spam', 'harassment', 'offensive', 'other'
  description: text("description"), // Optional additional details
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Discussion subscriptions for notifications
export const discussionSubscriptions = pgTable("discussion_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  discussionId: varchar("discussion_id").notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Honor system for discussions
export const discussionHonors = pgTable("discussion_honors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  discussionId: varchar("discussion_id").notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.discussionId), // Prevent duplicate honors from same user
]);

// Honor system for replies
export const replyHonors = pgTable("reply_honors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  replyId: varchar("reply_id").notNull().references(() => discussionReplies.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.replyId), // Prevent duplicate honors from same user
]);

// User testimonies
export const testimonies = pgTable("testimonies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  content: text("content").notNull(),
  tags: text("tags").array(), // Array of string tags
  faithJourneyStage: varchar("faith_journey_stage").default("beginning"), // beginning, middle, mature
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily fitness challenges
export const fitnessChallenge = pgTable("fitness_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  targetDate: timestamp("target_date").notNull(), // The date this challenge is for
  videoId: varchar("video_id").references(() => videos.id),
  videoUrl: varchar("video_url"), // For external video URLs
  difficulty: varchar("difficulty").default("beginner"), // beginner, intermediate, advanced
  duration: integer("duration").default(30), // in minutes
  equipment: text("equipment"), // equipment needed
  category: varchar("category").default("general"), // strength, cardio, flexibility, general
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin-managed pre-built fitness plans with tier access and downloads
export const preBuiltFitnessPlans = pgTable("pre_built_fitness_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").default("general"), // strength, cardio, flexibility, general
  difficulty: varchar("difficulty").default("beginner"), // beginner, intermediate, advanced
  duration: integer("duration").default(60), // in minutes
  equipment: text("equipment"), // equipment needed
  tier: varchar("tier").default("free"), // free, premium, vip
  thumbnailUrl: varchar("thumbnail_url"),
  downloadUrl: varchar("download_url"), // URL to downloadable PDF/document
  downloadFileName: varchar("download_file_name"), // Original filename for download
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User favorite exercises from ExerciseDB API
export const favoriteExercises = pgTable("favorite_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: varchar("exercise_id").notNull(), // ExerciseDB API exercise ID
  exerciseName: varchar("exercise_name").notNull(),
  bodyPart: varchar("body_part"),
  targetMuscle: varchar("target_muscle"),
  equipment: varchar("equipment"),
  imageUrl: varchar("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.exerciseId), // Prevent duplicate favorites
]);

// User fitness plans
export const fitnessPlans = pgTable("fitness_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").default("general"), // strength, cardio, flexibility, general
  difficulty: varchar("difficulty").default("beginner"), // beginner, intermediate, advanced
  estimatedDuration: integer("estimated_duration").default(60), // in minutes
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exercises within fitness plans
export const fitnessPlanExercises = pgTable("fitness_plan_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => fitnessPlans.id, { onDelete: 'cascade' }),
  exerciseId: varchar("exercise_id").notNull(), // ExerciseDB API exercise ID
  exerciseName: varchar("exercise_name").notNull(),
  bodyPart: varchar("body_part"),
  targetMuscle: varchar("target_muscle"),
  equipment: varchar("equipment"),
  imageUrl: varchar("image_url"),
  sets: integer("sets").default(3),
  reps: varchar("reps").default("10"), // Can be "10" or "10-12" or "30 seconds"
  minutes: integer("minutes"), // Optional minutes for cardio/time-based exercises
  weight: varchar("weight"), // Optional weight specification
  restTime: integer("rest_time").default(60), // Rest time in seconds
  notes: text("notes"), // Additional exercise notes
  daysOfWeek: text("days_of_week").array(), // Array of days: ['monday', 'tuesday', etc.]
  orderIndex: integer("order_index").notNull().default(0), // Order within the plan
  createdAt: timestamp("created_at").defaultNow(),
});

// Fitness plan reminders
export const fitnessPlanReminders = pgTable("fitness_plan_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => fitnessPlans.id, { onDelete: 'cascade' }),
  dayOfWeek: varchar("day_of_week").notNull(), // 'monday', 'tuesday', etc.
  time: varchar("time").notNull(), // '08:00' format
  isActive: boolean("is_active").default(true),
  lastSent: timestamp("last_sent"), // Track when reminder was last sent
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercise completion tracking for weekly progression
export const exerciseCompletions = pgTable("exercise_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id").notNull().references(() => fitnessPlans.id, { onDelete: 'cascade' }),
  exerciseId: varchar("exercise_id").notNull().references(() => fitnessPlanExercises.id, { onDelete: 'cascade' }),
  completedAt: timestamp("completed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.exerciseId), // Prevent duplicate completions
]);

export const insertTestimonySchema = createInsertSchema(testimonies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Testimony = typeof testimonies.$inferSelect;
export type InsertTestimony = z.infer<typeof insertTestimonySchema>;

export const insertFitnessChallengeSchema = createInsertSchema(fitnessChallenge, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  targetDate: z.string().min(1, "Target date is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  category: z.enum(["strength", "cardio", "flexibility", "general"]).default("general"),
  duration: z.number().int().min(1).default(30),
  equipment: z.string().optional(),
  videoId: z.string().optional(),
  videoUrl: z.string().optional(),
}).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type FitnessChallenge = typeof fitnessChallenge.$inferSelect;
export type InsertFitnessChallenge = z.infer<typeof insertFitnessChallengeSchema>;

// Pre-built fitness plans schema
export const insertPreBuiltFitnessPlanSchema = createInsertSchema(preBuiltFitnessPlans, {
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.enum(["strength", "cardio", "flexibility", "general"]).default("general"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  tier: z.enum(["free", "premium", "vip"]).default("free"),
  duration: z.number().int().min(1).default(60),
  equipment: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  downloadUrl: z.string().optional(),
  downloadFileName: z.string().optional(),
}).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type PreBuiltFitnessPlan = typeof preBuiltFitnessPlans.$inferSelect;
export type InsertPreBuiltFitnessPlan = z.infer<typeof insertPreBuiltFitnessPlanSchema>;

// Favorite exercises schema
export const insertFavoriteExerciseSchema = createInsertSchema(favoriteExercises, {
  exerciseId: z.string().min(1, "Exercise ID is required"),
  exerciseName: z.string().min(1, "Exercise name is required"),
}).omit({
  id: true,
  createdAt: true,
});

export type FavoriteExercise = typeof favoriteExercises.$inferSelect;
export type InsertFavoriteExercise = z.infer<typeof insertFavoriteExerciseSchema>;

// Fitness plans schema
export const insertFitnessPlanSchema = createInsertSchema(fitnessPlans, {
  name: z.string().min(1, "Plan name is required"),
  category: z.enum(["strength", "cardio", "flexibility", "general"]).default("general"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  estimatedDuration: z.number().int().min(1).default(60),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FitnessPlan = typeof fitnessPlans.$inferSelect;
export type InsertFitnessPlan = z.infer<typeof insertFitnessPlanSchema>;

// Fitness plan exercises schema
export const insertFitnessPlanExerciseSchema = createInsertSchema(fitnessPlanExercises, {
  exerciseId: z.string().min(1, "Exercise ID is required"),
  exerciseName: z.string().min(1, "Exercise name is required"),
  sets: z.number().int().min(1).default(3),
  reps: z.string().min(1, "Reps is required").default("10"),
  minutes: z.number().int().min(1).optional(),
  restTime: z.number().int().min(0).default(60),
  daysOfWeek: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).default([]),
  orderIndex: z.number().int().min(0).default(0),
}).omit({
  id: true,
  createdAt: true,
});

// Fitness plan reminders schema
export const insertFitnessPlanReminderSchema = createInsertSchema(fitnessPlanReminders, {
  dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format"),
}).omit({
  id: true,
  createdAt: true,
  lastSent: true,
});

export type FitnessPlanExercise = typeof fitnessPlanExercises.$inferSelect;
export type InsertFitnessPlanExercise = z.infer<typeof insertFitnessPlanExerciseSchema>;

export type FitnessPlanReminder = typeof fitnessPlanReminders.$inferSelect;
export type InsertFitnessPlanReminder = z.infer<typeof insertFitnessPlanReminderSchema>;

export type ExerciseCompletion = typeof exerciseCompletions.$inferSelect;
export const insertExerciseCompletionSchema = createInsertSchema(exerciseCompletions).omit({
  id: true,
  createdAt: true,
});
export type InsertExerciseCompletion = z.infer<typeof insertExerciseCompletionSchema>;

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  studyNotifications: boolean("study_notifications").default(true),
  nextStudyNotifications: boolean("next_study_notifications").default(true), // Notify when next study in series unlocks
  devotionalNotifications: boolean("devotional_notifications").default(true),
  discussionNotifications: boolean("discussion_notifications").default(true),
  discussionReplyNotifications: boolean("discussion_reply_notifications").default(true),
  messageNotifications: boolean("message_notifications").default(true),
  videoNotifications: boolean("video_notifications").default(true),
  communityNotifications: boolean("community_notifications").default(true),
  liveStreamNotifications: boolean("live_stream_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily devotionals
export const devotionals = pgTable("devotionals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  verse: varchar("verse").notNull(),
  verseReference: varchar("verse_reference").notNull(),
  content: text("content").notNull(),
  prayer: text("prayer"), // Closing prayer for the devotional
  imageUrl: varchar("image_url"),
  date: timestamp("date").notNull(),
  notificationsSent: boolean("notifications_sent").default(false), // Track if notifications have been sent for this devotional
  rationReward: integer("ration_reward").default(20), // Rations earned for completing this devotional
  createdAt: timestamp("created_at").defaultNow(),
});

// User ratings for studies
export const studyRatings = pgTable("study_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"), // Optional text review
  createdAt: timestamp("created_at").defaultNow(),
});

// User ratings for videos
export const videoRatings = pgTable("video_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: varchar("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"), // Optional text review
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat conversations (direct messages and group chats)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'direct' or 'group'
  name: varchar("name"), // null for direct messages, required for group chats
  description: text("description"), // optional group description
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  originalParticipantNames: text("original_participant_names"), // JSON string of original participant names for deleted DMs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversation participants (many-to-many relationship)
export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role").default("member"), // 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadAt: timestamp("last_read_at").defaultNow(),
});

// Messages within conversations
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"), // 'text', 'image', 'file'
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  deletedBy: text("deleted_by").array().default([]), // Array of user IDs who deleted this message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Direct message requests that need approval
export const messageRequests = pgTable("message_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUserId: varchar("to_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(), // The initial message
  status: varchar("status").default("pending"), // 'pending', 'accepted', 'declined'
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Notifications for various events
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'message_request', 'new_message', 'new_study', 'new_devotional', 'group_message'
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // ID of related entity (conversation, study, etc.)
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  progress: many(userProgress),
  discussions: many(discussions),
  replies: many(discussionReplies),
  ratings: many(studyRatings),
  videoRatings: many(videoRatings),
  discussionSubscriptions: many(discussionSubscriptions),
  notificationPreferences: one(notificationPreferences),
  discussionHonors: many(discussionHonors),
  replyHonors: many(replyHonors),
  createdFitnessChallenges: many(fitnessChallenge),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  uploader: one(users, { fields: [videos.uploadedBy], references: [users.id] }),
  studies: many(studies),
  ratings: many(videoRatings),
  fitnessChallenges: many(fitnessChallenge),
}));

export const fitnessChallengeRelations = relations(fitnessChallenge, ({ one }) => ({
  creator: one(users, { fields: [fitnessChallenge.createdBy], references: [users.id] }),
  video: one(videos, { fields: [fitnessChallenge.videoId], references: [videos.id] }),
}));

export const favoriteExercisesRelations = relations(favoriteExercises, ({ one }) => ({
  user: one(users, { fields: [favoriteExercises.userId], references: [users.id] }),
}));

export const fitnessPlansRelations = relations(fitnessPlans, ({ one, many }) => ({
  user: one(users, { fields: [fitnessPlans.userId], references: [users.id] }),
  exercises: many(fitnessPlanExercises),
}));

export const fitnessPlanExercisesRelations = relations(fitnessPlanExercises, ({ one }) => ({
  plan: one(fitnessPlans, { fields: [fitnessPlanExercises.planId], references: [fitnessPlans.id] }),
}));

export const studySeriesRelations = relations(studySeries, ({ many }) => ({
  studies: many(studies),
}));

export const studiesRelations = relations(studies, ({ one, many }) => ({
  progress: many(userProgress),
  ratings: many(studyRatings),
  discussions: many(discussions),
  video: one(videos, { fields: [studies.videoId], references: [videos.id] }),
  series: one(studySeries, { fields: [studies.seriesId], references: [studySeries.id] }),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  user: one(users, { fields: [discussions.userId], references: [users.id] }),
  study: one(studies, { fields: [discussions.studyId], references: [studies.id] }),
  replies: many(discussionReplies),
  subscriptions: many(discussionSubscriptions),
  honors: many(discussionHonors),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one, many }) => ({
  discussion: one(discussions, { fields: [discussionReplies.discussionId], references: [discussions.id] }),
  user: one(users, { fields: [discussionReplies.userId], references: [users.id] }),
  honors: many(replyHonors),
}));

export const discussionSubscriptionsRelations = relations(discussionSubscriptions, ({ one }) => ({
  discussion: one(discussions, {
    fields: [discussionSubscriptions.discussionId],
    references: [discussions.id],
  }),
  user: one(users, {
    fields: [discussionSubscriptions.userId],
    references: [users.id],
  }),
}));

export const discussionHonorsRelations = relations(discussionHonors, ({ one }) => ({
  user: one(users, { fields: [discussionHonors.userId], references: [users.id] }),
  discussion: one(discussions, { fields: [discussionHonors.discussionId], references: [discussions.id] }),
}));

export const replyHonorsRelations = relations(replyHonors, ({ one }) => ({
  user: one(users, { fields: [replyHonors.userId], references: [users.id] }),
  reply: one(discussionReplies, { fields: [replyHonors.replyId], references: [discussionReplies.id] }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, { fields: [userProgress.userId], references: [users.id] }),
  study: one(studies, { fields: [userProgress.studyId], references: [studies.id] }),
}));

export const userPurchasesRelations = relations(userPurchases, ({ one }) => ({
  user: one(users, { fields: [userPurchases.userId], references: [users.id] }),
  study: one(studies, { fields: [userPurchases.studyId], references: [studies.id] }),
}));

export const studyRatingsRelations = relations(studyRatings, ({ one }) => ({
  user: one(users, { fields: [studyRatings.userId], references: [users.id] }),
  study: one(studies, { fields: [studyRatings.studyId], references: [studies.id] }),
}));

export const videoRatingsRelations = relations(videoRatings, ({ one }) => ({
  user: one(users, { fields: [videoRatings.userId], references: [users.id] }),
  video: one(videos, { fields: [videoRatings.videoId], references: [videos.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, { fields: [conversations.createdBy], references: [users.id] }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationParticipants.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [conversationParticipants.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
}));

export const messageRequestsRelations = relations(messageRequests, ({ one }) => ({
  fromUser: one(users, { fields: [messageRequests.fromUserId], references: [users.id] }),
  toUser: one(users, { fields: [messageRequests.toUserId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoSchema = createInsertSchema(videos, {
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  filename: z.string().min(1, "Filename is required"),
  originalName: z.string().min(1, "Original name is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  requiredTier: z.enum(["free", "premium", "vip"]).default("free"),
  category: z.string().min(1, "Category is required").default("general"),
  fileSize: z.number().int().min(1, "File size must be greater than 0"),
  duration: z.number().int().optional(),
  thumbnailUrl: z.string().optional(),
  uploadedBy: z.string().min(1, "Uploaded by is required"),
}).omit({ 
  id: true, 
  rating: true,
  ratingCount: true,
  isProcessed: true,
  processingStatus: true,
  createdAt: true, 
  updatedAt: true 
});

export const insertStudySeriesSchema = createInsertSchema(studySeries, {
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  category: z.string().default("general"),
  requiredTier: z.enum(["free", "premium", "vip"]).default("free"),
  displayOrder: z.number().int().default(0),
  isPublished: z.boolean().default(false),
  requiresConsecutiveCompletion: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudySchema = createInsertSchema(studies, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  content: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  estimatedHours: z.number().int().min(1).default(1),
  totalDays: z.number().int().min(0).default(0),
  requiredTier: z.enum(["free", "premium", "vip"]).default("free"),
  requiresPurchase: z.boolean().default(false),
  price: z.string().nullable().optional(),
  purchaseRequiredTiers: z.array(z.enum(["free", "premium", "vip"])).default([]),
  isPublished: z.boolean().default(false),
  videoId: z.string().optional(),
  seriesId: z.string().nullable().optional(),
  seriesOrder: z.number().int().default(0),
}).omit({ 
  id: true, 
  rating: true, 
  ratingCount: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertStudyLessonSchema = createInsertSchema(studyLessons, {
  studyId: z.string().min(1, "Study ID is required"),
  dayNumber: z.number().int().min(1, "Day number must be at least 1"),
  title: z.string().min(1, "Lesson title is required"),
  content: z.string().min(1, "Lesson content is required"),
  scripture: z.string().optional(),
  questions: z.any().optional(), // JSONB array of questions
  keyTakeaway: z.string().optional(),
  displayOrder: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(1).default(15),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserLessonProgressSchema = createInsertSchema(userLessonProgress, {
  userId: z.string().min(1, "User ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  isCompleted: z.boolean().default(false),
  answers: z.any().optional(), // JSONB object of answers
}).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPurchaseSchema = createInsertSchema(userPurchases, {
  stripePaymentIntentId: z.string().min(1, "Payment intent ID is required"),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().default("usd"),
  status: z.string().default("completed"),
}).omit({
  id: true,
  createdAt: true,
  purchasedAt: true,
});

export const insertStudyEditableSectionSchema = createInsertSchema(studyEditableSections, {
  studyId: z.string().min(1, "Study ID is required"),
  anchorKey: z.string().min(1, "Anchor key is required"),
  label: z.string().min(1, "Label is required"),
  displayOrder: z.number().int().min(0),
  defaultPrompt: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserStudyResponseSchema = createInsertSchema(userStudyResponses, {
  userId: z.string().min(1, "User ID is required"),
  studyId: z.string().min(1, "Study ID is required"),
  sectionId: z.string().min(1, "Section ID is required"),
  responseText: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscussionSchema = createInsertSchema(discussions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
  replyCount: true,
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  startedAt: true,
  endedAt: true,
});

export const insertDiscussionReplySchema = createInsertSchema(discussionReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
});

export const insertDiscussionSubscriptionSchema = createInsertSchema(discussionSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  createdAt: true,
});

export const insertDevotionalSchema = createInsertSchema(devotionals).omit({
  id: true,
  createdAt: true,
});

export const insertStudyRatingSchema = createInsertSchema(studyRatings, {
  rating: z.number().int().min(1).max(5),
  review: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertVideoRatingSchema = createInsertSchema(videoRatings, {
  rating: z.number().int().min(1).max(5),
  review: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
  joinedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
  editedAt: true,
});

export const insertMessageRequestSchema = createInsertSchema(messageRequests).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User reports table for reporting inappropriate behavior
export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reporterUserId: varchar("reporter_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text("reason").notNull(), // User's explanation of the report
  location: varchar("location").notNull(), // Where the issue took place (e.g., "Discussion: Study Name", "Direct Message", etc.)
  status: varchar("status").default("pending"), // pending, reviewed, resolved
  adminNotes: text("admin_notes"), // Notes from admin review
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserReportSchema = createInsertSchema(userReports, {
  reason: z.string().min(10, "Please provide a detailed explanation (at least 10 characters)"),
  location: z.string().min(1, "Location is required"),
}).omit({
  id: true,
  createdAt: true,
  status: true,
  adminNotes: true,
  reviewedBy: true,
  reviewedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type StudySeries = typeof studySeries.$inferSelect;
export type InsertStudySeries = z.infer<typeof insertStudySeriesSchema>;
export type Study = typeof studies.$inferSelect;
export type InsertStudy = z.infer<typeof insertStudySchema>;
export type StudyLesson = typeof studyLessons.$inferSelect;
export type InsertStudyLesson = z.infer<typeof insertStudyLessonSchema>;
export type UserLessonProgress = typeof userLessonProgress.$inferSelect;
export type InsertUserLessonProgress = z.infer<typeof insertUserLessonProgressSchema>;
export type Discussion = typeof discussions.$inferSelect;
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type InsertDiscussionReply = z.infer<typeof insertDiscussionReplySchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type Devotional = typeof devotionals.$inferSelect;
export type InsertDevotional = z.infer<typeof insertDevotionalSchema>;
export type StudyRating = typeof studyRatings.$inferSelect;
export type InsertStudyRating = z.infer<typeof insertStudyRatingSchema>;
export type VideoRating = typeof videoRatings.$inferSelect;
export type InsertVideoRating = z.infer<typeof insertVideoRatingSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageRequest = typeof messageRequests.$inferSelect;
export type InsertMessageRequest = z.infer<typeof insertMessageRequestSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type DiscussionSubscription = typeof discussionSubscriptions.$inferSelect;
export type InsertDiscussionSubscription = z.infer<typeof insertDiscussionSubscriptionSchema>;
export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;

// User silences table for allowing users to silence/hide other users
export const userSilences = pgTable("user_silences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  silencerId: varchar("silencer_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  silencedId: varchar("silenced_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unique: unique().on(table.silencerId, table.silencedId),
}));

export const insertUserSilenceSchema = createInsertSchema(userSilences).omit({
  id: true,
  createdAt: true,
});

export type UserSilence = typeof userSilences.$inferSelect;
export type InsertUserSilence = z.infer<typeof insertUserSilenceSchema>;

// Logo settings table for app branding
export const logoSettings = pgTable("logo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logoUrl: varchar("logo_url"),
  splashDurationMs: integer("splash_duration_ms").default(3000),
  backgroundColor: varchar("background_color").default("white"),
  isEnabled: boolean("is_enabled").default(true),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLogoSettingsSchema = createInsertSchema(logoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LogoSettings = typeof logoSettings.$inferSelect;
export type InsertLogoSettings = z.infer<typeof insertLogoSettingsSchema>;

// Header logo settings (separate from splash screen logo)
export const headerLogoSettings = pgTable("header_logo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logoUrl: varchar("logo_url"),
  isEnabled: boolean("is_enabled").default(true),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHeaderLogoSettingsSchema = createInsertSchema(headerLogoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HeaderLogoSettings = typeof headerLogoSettings.$inferSelect;
export type InsertHeaderLogoSettings = z.infer<typeof insertHeaderLogoSettingsSchema>;

// System settings table for customizable app settings
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homepageTagline: text("homepage_tagline").default("Ready to grow in God's strength?"),
  warGroupsVideoUrl: text("war_groups_video_url"),
  warGroupsVideoTitle: text("war_groups_video_title").default("Welcome to War Groups"),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

// Podcasts table for storing podcast content
export const podcasts = pgTable("podcasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  episodeNumber: integer("episode_number"), // For sorting by episode order
  description: text("description"),
  type: varchar("type").notNull(), // "audio" or "video"
  fileUrl: varchar("file_url").notNull(),
  thumbnailUrl: varchar("thumbnail_url"),
  duration: integer("duration"), // in seconds
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  category: varchar("category").notNull().default("general"), // leadership, marriage, fatherhood, character, general
  tags: text("tags").array().default(sql`'{}'::text[]`),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingCount: integer("rating_count").default(0),
  viewCount: integer("view_count").default(0),
  isPublished: boolean("is_published").default(true),
  // Live streaming fields
  isLiveStream: boolean("is_live_stream").default(false),
  liveStreamUrl: varchar("live_stream_url"), // Riverside.fm embed URL
  isCurrentlyLive: boolean("is_currently_live").default(false),
  liveStartedAt: timestamp("live_started_at"),
  liveEndedAt: timestamp("live_ended_at"),
  scheduledLiveDate: timestamp("scheduled_live_date"),
  liveNotificationsSent: boolean("live_notifications_sent").default(false),
  rationReward: integer("ration_reward").default(15), // Rations earned for listening to this podcast
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPodcastSchema = createInsertSchema(podcasts).omit({
  id: true,
  rating: true,
  ratingCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

// Podcast ratings table
export const podcastRatings = pgTable("podcast_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  podcastId: varchar("podcast_id").notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  unique: unique().on(table.userId, table.podcastId),
}));

export const insertPodcastRatingSchema = createInsertSchema(podcastRatings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Podcast views table for tracking views
export const podcastViews = pgTable("podcast_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  podcastId: varchar("podcast_id").notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
  viewedAt: timestamp("viewed_at").defaultNow(),
  ipAddress: varchar("ip_address"), // For anonymous tracking
});

export const insertPodcastViewSchema = createInsertSchema(podcastViews).omit({
  id: true,
  viewedAt: true,
});

export type Podcast = typeof podcasts.$inferSelect;
export type InsertPodcast = z.infer<typeof insertPodcastSchema>;
export type PodcastRating = typeof podcastRatings.$inferSelect;
export type InsertPodcastRating = z.infer<typeof insertPodcastRatingSchema>;
export type PodcastView = typeof podcastViews.$inferSelect;
export type InsertPodcastView = z.infer<typeof insertPodcastViewSchema>;

// Challenges
export const challenges = pgTable("challenges", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  topic: varchar("topic", { length: 100 }).notNull(),
  releaseDate: timestamp("releaseDate").notNull(), // The Monday this challenge should be released
  durationDays: integer("duration_days").default(7), // How many days users have to complete the challenge
  rationReward: integer("ration_reward").default(25), // Rations earned for accepting this challenge
  completionReward: integer("completion_reward").default(75), // Rations earned for completing the challenge
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

// Challenge Participants - tracks who accepts weekly challenges
export const challengeParticipants = pgTable("challenge_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  acceptedAt: timestamp("accepted_at").defaultNow(),
  completedAt: timestamp("completed_at"), // When the user marked the challenge as complete (honor system)
  regroupedAt: timestamp("regrouped_at"), // When user acknowledged they didn't complete but will try harder next time
});

export const insertChallengeParticipantSchema = createInsertSchema(challengeParticipants).omit({
  id: true,
  acceptedAt: true,
  completedAt: true,
  regroupedAt: true,
});

export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type InsertChallengeParticipant = z.infer<typeof insertChallengeParticipantSchema>;

// Events
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventTime: varchar("event_time"), // Optional time as string (e.g., "7:00 PM")
  location: varchar("location"),
  url: varchar("url"),
  requiresPurchase: boolean("requires_purchase").default(false),
  price: decimal("price", { precision: 10, scale: 2 }), // Price in dollars
  maxAttendees: integer("max_attendees"),
  currentAttendees: integer("current_attendees").default(0),
  isPublished: boolean("is_published").default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  eventDate: z.string().transform((val) => new Date(val)),
  eventTime: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  eventUrl: z.string().nullable().optional(),
  requiresPurchase: z.boolean().optional().default(false),
  price: z.string().nullable().optional(),
  maxAttendees: z.number().optional(),
  isPublished: z.boolean().optional().default(true),
  createdBy: z.string()
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// Event purchases/registrations
export const eventRegistrations = pgTable("event_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  registrationType: varchar("registration_type").notNull().default("free"), // free, paid
  paymentIntentId: varchar("payment_intent_id"), // Stripe payment intent ID for paid events
  paymentStatus: varchar("payment_status").default("pending"), // pending, completed, failed, refunded
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  registeredAt: timestamp("registered_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => ({
  unique: unique().on(table.eventId, table.userId),
}));

export const insertEventRegistrationSchema = createInsertSchema(eventRegistrations).omit({
  id: true,
  registeredAt: true,
});

export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type InsertEventRegistration = z.infer<typeof insertEventRegistrationSchema>;

// Content flags schema and types
export const insertContentFlagSchema = createInsertSchema(contentFlags).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
});

export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;

// Brotherhood requests table
export const brotherhoodRequests = pgTable("brotherhood_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").notNull().default("pending"), // pending, approved, denied
  message: text("message"), // Optional message with request
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  unique: unique().on(table.requesterId, table.recipientId),
}));

export const insertBrotherhoodRequestSchema = createInsertSchema(brotherhoodRequests).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type BrotherhoodRequest = typeof brotherhoodRequests.$inferSelect;
export type InsertBrotherhoodRequest = z.infer<typeof insertBrotherhoodRequestSchema>;

// Track brotherhood request denials for cooldown management
export const brotherhoodDenials = pgTable("brotherhood_denials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  denialCount: integer("denial_count").notNull().default(1),
  lastDenialAt: timestamp("last_denial_at").defaultNow(),
  cooldownUntil: timestamp("cooldown_until"), // Set after 3rd denial
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  unique: unique().on(table.requesterId, table.recipientId),
}));

// Track individual denial records for 10-day decay logic
export const brotherhoodDenialHistory = pgTable("brotherhood_denial_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deniedAt: timestamp("denied_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBrotherhoodDenialSchema = createInsertSchema(brotherhoodDenials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrotherhoodDenialHistorySchema = createInsertSchema(brotherhoodDenialHistory).omit({
  id: true,
  createdAt: true,
});

export type BrotherhoodDenial = typeof brotherhoodDenials.$inferSelect;
export type InsertBrotherhoodDenial = z.infer<typeof insertBrotherhoodDenialSchema>;
export type BrotherhoodDenialHistory = typeof brotherhoodDenialHistory.$inferSelect;
export type InsertBrotherhoodDenialHistory = z.infer<typeof insertBrotherhoodDenialHistorySchema>;

// Brotherhoods table (approved relationships)
export const brotherhoods = pgTable("brotherhoods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId1: varchar("user_id_1").notNull().references(() => users.id, { onDelete: 'cascade' }),
  userId2: varchar("user_id_2").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tagFromUser1: varchar("tag_from_user_1"), // Paul, Timothy, Barnabas, or null
  tagFromUser2: varchar("tag_from_user_2"), // Paul, Timothy, Barnabas, or null
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unique: unique().on(table.userId1, table.userId2),
}));

export const insertBrotherhoodSchema = createInsertSchema(brotherhoods).omit({
  id: true,
  createdAt: true,
});

export type Brotherhood = typeof brotherhoods.$inferSelect;
export type InsertBrotherhood = z.infer<typeof insertBrotherhoodSchema>;

// Hurdle Wall Posts table
export const hurdleWallPosts = pgTable("hurdle_wall_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  postType: varchar("post_type").notNull().default("discussion"), // "discussion" or "prayer_request"
  prayerCount: integer("prayer_count").default(0),
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hurdle Wall Replies table
export const hurdleWallReplies = pgTable("hurdle_wall_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => hurdleWallPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hurdle Wall Prayers table (tracks who prayed for what)
export const hurdleWallPrayers = pgTable("hurdle_wall_prayers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => hurdleWallPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.postId, table.userId), // Prevent duplicate prayers from same user
]);

// User Prayer Statistics table
export const userPrayerStats = pgTable("user_prayer_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  prayersGiven: integer("prayers_given").default(0),
  prayersReceived: integer("prayers_received").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for Hurdle Wall
export const insertHurdleWallPostSchema = createInsertSchema(hurdleWallPosts).omit({
  id: true,
  prayerCount: true,
  replyCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHurdleWallReplySchema = createInsertSchema(hurdleWallReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHurdleWallPrayerSchema = createInsertSchema(hurdleWallPrayers).omit({
  id: true,
  createdAt: true,
});

export const insertUserPrayerStatsSchema = createInsertSchema(userPrayerStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Hurdle Wall
export type HurdleWallPost = typeof hurdleWallPosts.$inferSelect;
export type InsertHurdleWallPost = z.infer<typeof insertHurdleWallPostSchema>;
export type HurdleWallReply = typeof hurdleWallReplies.$inferSelect;
export type InsertHurdleWallReply = z.infer<typeof insertHurdleWallReplySchema>;
export type HurdleWallPrayer = typeof hurdleWallPrayers.$inferSelect;
export type InsertHurdleWallPrayer = z.infer<typeof insertHurdleWallPrayerSchema>;
export type UserPrayerStats = typeof userPrayerStats.$inferSelect;
export type InsertUserPrayerStats = z.infer<typeof insertUserPrayerStatsSchema>;

// Accountability Requests for Under Fire page
export const accountabilityRequests = pgTable("accountability_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  assistedById: varchar("assisted_by_id").references(() => users.id),
  assistedAt: timestamp("assisted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccountabilityRequestSchema = createInsertSchema(accountabilityRequests).omit({
  id: true,
  assistedById: true,
  assistedAt: true,
  createdAt: true,
});

export type AccountabilityRequest = typeof accountabilityRequests.$inferSelect;
export type InsertAccountabilityRequest = z.infer<typeof insertAccountabilityRequestSchema>;

// Carousel items for homepage featured content
export const carouselItems = pgTable("carousel_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url").notNull(),
  linkType: varchar("link_type").notNull(), // study, video, podcast, devotional, challenge, external
  linkId: varchar("link_id"), // ID of linked content (null for external links)
  externalUrl: varchar("external_url"), // For external links
  position: integer("position").notNull(), // 1 = large top, 2-3 = small bottom
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").notNull().default(0), // For sorting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCarouselItemSchema = createInsertSchema(carouselItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CarouselItem = typeof carouselItems.$inferSelect;
export type InsertCarouselItem = z.infer<typeof insertCarouselItemSchema>;

// Exercises table for fitness center
export const exercises = pgTable("exercises", {
  id: integer("id").primaryKey(),
  name: varchar("name").notNull(),
  bodyPart: varchar("body_part").notNull(),
  equipment: varchar("equipment").notNull(),
  level: varchar("level").notNull(), // Beginner, Intermediate, Advanced
  instructions: text("instructions").notNull(),
  mediaFile: varchar("media_file").notNull(),
  shortInstructions: text("short_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  createdAt: true,
  updatedAt: true,
});

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

// Tier pricing configuration table
export const tierPricing = pgTable("tier_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tier: varchar("tier").notNull().unique(), // premium, vip
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  features: text("features").array().default(sql`'{}'::text[]`), // Array of feature descriptions
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTierPricingSchema = createInsertSchema(tierPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Purchase types
export type UserPurchase = typeof userPurchases.$inferSelect;
export type InsertUserPurchase = z.infer<typeof insertUserPurchaseSchema>;

// Study editable sections types
export type StudyEditableSection = typeof studyEditableSections.$inferSelect;
export type InsertStudyEditableSection = z.infer<typeof insertStudyEditableSectionSchema>;

// User study responses types
export type UserStudyResponse = typeof userStudyResponses.$inferSelect;
export type InsertUserStudyResponse = z.infer<typeof insertUserStudyResponseSchema>;

export type TierPricing = typeof tierPricing.$inferSelect;
export type InsertTierPricing = z.infer<typeof insertTierPricingSchema>;

// War Groups - Local discipleship groups across USA
export const warGroups = pgTable("war_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // "Man Up God's Way - City Name"
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  description: text("description"),
  leaderId: varchar("leader_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  meetingInfo: text("meeting_info"), // Meeting times, location details
  latitude: real("latitude"), // Geocoded latitude
  longitude: real("longitude"), // Geocoded longitude
  needsGeocode: boolean("needs_geocode").default(true), // Explicit flag for groups needing geocoding
  geocodeFailureCount: integer("geocode_failure_count").default(0), // Track geocoding retry attempts
  lastGeocodeAttempt: timestamp("last_geocode_attempt"), // Last time geocoding was attempted
  isLicensed: boolean("is_licensed").default(false), // License status
  isHeadquarters: boolean("is_headquarters").default(false), // Founder's group is HQ, others are Outposts
  licenseExpiresAt: timestamp("license_expires_at"),
  stripeLicensePaymentId: varchar("stripe_license_payment_id"), // Payment for licensing fee
  licenseType: varchar("license_type").default("monthly"), // monthly, yearly
  logoUrl: varchar("logo_url"), // Group-specific logo if customized
  memberCount: integer("member_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_groups_city").on(table.city),
  index("idx_war_groups_state").on(table.state),
]);

// War Group Members - Users belonging to groups
export const warGroupMembers = pgTable("war_group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => warGroups.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").default("pending"), // pending, approved, rejected
  role: varchar("role").default("member"), // member, leader (co-leader)
  canManageMembers: boolean("can_manage_members").default(false), // Can view members, approve requests, remove members
  joinedAt: timestamp("joined_at"),
  requestedAt: timestamp("requested_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.groupId, table.userId), // Prevent duplicate memberships
  index("idx_war_group_members_group").on(table.groupId),
  index("idx_war_group_members_user").on(table.userId),
]);

// War Group Community Posts - Group-specific discussion posts
export const warGroupPosts = pgTable("war_group_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => warGroups.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  postType: varchar("post_type").notNull().default("discussion"), // discussion, shared_content, media
  sharedContentType: varchar("shared_content_type"), // study, devotional, podcast (when shared from main app)
  sharedContentId: varchar("shared_content_id"), // ID of shared content
  mediaUrls: text("media_urls").array(), // Array of uploaded media URLs
  mediaTypes: text("media_types").array(), // Array of media types (image, video)
  likes: integer("likes").default(0),
  replyCount: integer("reply_count").default(0),
  isPinned: boolean("is_pinned").default(false), // Leader can pin important posts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_group_posts_group").on(table.groupId),
]);

// War Group Post Replies
export const warGroupPostReplies = pgTable("war_group_post_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => warGroupPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// War Group Registrations - Pending registration requests
export const warGroupRegistrations = pgTable("war_group_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestedBy: varchar("requested_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // "Man Up God's Way - City Name"
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  description: text("description"),
  meetingInfo: text("meeting_info"), // Proposed meeting times, location details
  contactEmail: varchar("contact_email").notNull(),
  contactPhone: varchar("contact_phone"),
  leadershipExperience: text("leadership_experience"), // Background/experience
  motivation: text("motivation"), // Why they want to start a group
  status: varchar("status").default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"), // Admin notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_group_registrations_status").on(table.status),
  index("idx_war_group_registrations_requester").on(table.requestedBy),
]);

// War Group War Room Posts - Private group war room
export const warGroupWarRoomPosts = pgTable("war_group_war_room_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => warGroups.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  postType: varchar("post_type").notNull().default("discussion"), // discussion, prayer_request
  prayerCount: integer("prayer_count").default(0),
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_group_war_room_group").on(table.groupId),
]);

// War Group War Room Replies
export const warGroupWarRoomReplies = pgTable("war_group_war_room_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => warGroupWarRoomPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// War Group War Room Prayers
export const warGroupWarRoomPrayers = pgTable("war_group_war_room_prayers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => warGroupWarRoomPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.postId, table.userId), // Prevent duplicate prayers
]);

// War Group Challenges - Leader creates challenges for group
export const warGroupChallenges = pgTable("war_group_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => warGroups.id, { onDelete: 'cascade' }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  category: varchar("category").default("spiritual"), // spiritual, fitness, accountability, scripture
  participantCount: integer("participant_count").default(0),
  completionCount: integer("completion_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_group_challenges_group").on(table.groupId),
]);

// War Group Challenge Participants
export const warGroupChallengeParticipants = pgTable("war_group_challenge_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => warGroupChallenges.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").default("active"), // active, completed, dropped
  progress: integer("progress").default(0), // Percentage or days completed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.challengeId, table.userId), // Prevent duplicate participants
]);

// War Group Announcements - Leader announcements to group
export const warGroupAnnouncements = pgTable("war_group_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => warGroups.id, { onDelete: 'cascade' }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_war_group_announcements_group").on(table.groupId),
]);

// Insert schemas for War Groups
export const insertWarGroupSchema = createInsertSchema(warGroups).omit({
  id: true,
  memberCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupMemberSchema = createInsertSchema(warGroupMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupPostSchema = createInsertSchema(warGroupPosts).omit({
  id: true,
  likes: true,
  replyCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupPostReplySchema = createInsertSchema(warGroupPostReplies).omit({
  id: true,
  likes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupWarRoomPostSchema = createInsertSchema(warGroupWarRoomPosts).omit({
  id: true,
  prayerCount: true,
  replyCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupWarRoomReplySchema = createInsertSchema(warGroupWarRoomReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupWarRoomPrayerSchema = createInsertSchema(warGroupWarRoomPrayers).omit({
  id: true,
  createdAt: true,
});

export const insertWarGroupChallengeSchema = createInsertSchema(warGroupChallenges).omit({
  id: true,
  participantCount: true,
  completionCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupChallengeParticipantSchema = createInsertSchema(warGroupChallengeParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupAnnouncementSchema = createInsertSchema(warGroupAnnouncements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGroupRegistrationSchema = createInsertSchema(warGroupRegistrations).omit({
  id: true,
  requestedBy: true,
  reviewedBy: true,
  reviewedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

// Types for War Groups
export type WarGroup = typeof warGroups.$inferSelect;
export type InsertWarGroup = z.infer<typeof insertWarGroupSchema>;
export type WarGroupMember = typeof warGroupMembers.$inferSelect;
export type InsertWarGroupMember = z.infer<typeof insertWarGroupMemberSchema>;
export type WarGroupPost = typeof warGroupPosts.$inferSelect;
export type InsertWarGroupPost = z.infer<typeof insertWarGroupPostSchema>;
export type WarGroupPostReply = typeof warGroupPostReplies.$inferSelect;
export type InsertWarGroupPostReply = z.infer<typeof insertWarGroupPostReplySchema>;
export type WarGroupWarRoomPost = typeof warGroupWarRoomPosts.$inferSelect;
export type InsertWarGroupWarRoomPost = z.infer<typeof insertWarGroupWarRoomPostSchema>;
export type WarGroupWarRoomReply = typeof warGroupWarRoomReplies.$inferSelect;
export type InsertWarGroupWarRoomReply = z.infer<typeof insertWarGroupWarRoomReplySchema>;
export type WarGroupWarRoomPrayer = typeof warGroupWarRoomPrayers.$inferSelect;
export type InsertWarGroupWarRoomPrayer = z.infer<typeof insertWarGroupWarRoomPrayerSchema>;
export type WarGroupChallenge = typeof warGroupChallenges.$inferSelect;
export type InsertWarGroupChallenge = z.infer<typeof insertWarGroupChallengeSchema>;
export type WarGroupChallengeParticipant = typeof warGroupChallengeParticipants.$inferSelect;
export type InsertWarGroupChallengeParticipant = z.infer<typeof insertWarGroupChallengeParticipantSchema>;
export type WarGroupAnnouncement = typeof warGroupAnnouncements.$inferSelect;
export type InsertWarGroupAnnouncement = z.infer<typeof insertWarGroupAnnouncementSchema>;
export type WarGroupRegistration = typeof warGroupRegistrations.$inferSelect;
export type InsertWarGroupRegistration = z.infer<typeof insertWarGroupRegistrationSchema>;

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(),
  title: varchar("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImageUrl: varchar("cover_image_url"),
  authorId: varchar("author_id").references(() => users.id),
  authorName: varchar("author_name"), // For RSS imported posts without local author
  isPublished: boolean("is_published").default(false),
  isFeatured: boolean("is_featured").default(false),
  publishedAt: timestamp("published_at"),
  externalSource: varchar("external_source"), // RSS feed URL if imported
  rssGuid: varchar("rss_guid"), // Unique identifier from RSS to prevent duplicates
  externalUrl: varchar("external_url"), // Link to original post if imported
  category: varchar("category").default("general"),
  displayOrder: integer("display_order").default(0), // For manual ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

// Ration Transactions - tracks all earning and spending of rations
export const rationTransactions = pgTable("ration_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(), // Positive for earned, negative for spent
  type: varchar("type").notNull(), // 'earn' or 'spend'
  category: varchar("category").notNull(), // study, devotional, challenge, war_group, fitness, video, podcast, blog, event, profile, live, carousel
  missionType: varchar("mission_type").notNull(), // specific mission e.g., 'complete_lesson', 'start_study', 'join_war_group'
  description: text("description"), // Human-readable description
  referenceId: varchar("reference_id"), // ID of related entity (study, devotional, etc.)
  referenceType: varchar("reference_type"), // Type of reference entity
  balanceAfter: integer("balance_after").notNull(), // Balance after this transaction
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ration_transactions_user").on(table.userId),
  index("idx_ration_transactions_category").on(table.category),
  index("idx_ration_transactions_created").on(table.createdAt),
]);

export const insertRationTransactionSchema = createInsertSchema(rationTransactions).omit({
  id: true,
  createdAt: true,
});

export type RationTransaction = typeof rationTransactions.$inferSelect;
export type InsertRationTransaction = z.infer<typeof insertRationTransactionSchema>;

// Daily Mission Limits - anti-abuse tracking for repetitive actions
export const dailyMissionLimits = pgTable("daily_mission_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  missionType: varchar("mission_type").notNull(), // e.g., 'comment', 'share', 'prayer'
  count: integer("count").default(0), // How many times today
  date: varchar("date").notNull(), // YYYY-MM-DD format for easy daily reset
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.missionType, table.date),
  index("idx_daily_mission_limits_user_date").on(table.userId, table.date),
]);

export const insertDailyMissionLimitSchema = createInsertSchema(dailyMissionLimits).omit({
  id: true,
  lastUpdated: true,
});

export type DailyMissionLimit = typeof dailyMissionLimits.$inferSelect;
export type InsertDailyMissionLimit = z.infer<typeof insertDailyMissionLimitSchema>;

// Missions Table - configurable missions for ration rewards
export const missions = pgTable("missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  missionKey: varchar("mission_key").notNull().unique(), // e.g., 'study_start', 'video_watch_100'
  name: varchar("name").notNull(), // Display name e.g., "Studies Start a Study"
  description: text("description").notNull(), // What this mission is
  functionalArea: varchar("functional_area").notNull(), // Study, Videos, Podcasts, etc.
  rations: integer("rations").notNull().default(0), // Ration reward amount
  pointCap: integer("point_cap"), // Maximum rations earnable within cap duration (null = unlimited)
  capDuration: integer("cap_duration"), // Number of days before cap resets (null = no cap)
  activity: text("activity"), // Description of what user does to complete this mission
  isActive: boolean("is_active").default(true), // Whether this mission is currently active
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_missions_functional_area").on(table.functionalArea),
  index("idx_missions_key").on(table.missionKey),
]);

export const insertMissionSchema = createInsertSchema(missions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Mission = typeof missions.$inferSelect;
export type InsertMission = z.infer<typeof insertMissionSchema>;

// User Mission Progress - tracks user progress per mission with cap enforcement
export const userMissionProgress = pgTable("user_mission_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  missionId: varchar("mission_id").notNull().references(() => missions.id, { onDelete: 'cascade' }),
  rationsEarnedInPeriod: integer("rations_earned_in_period").default(0), // Rations earned in current cap period
  timesCompletedInPeriod: integer("times_completed_in_period").default(0), // Times completed in current cap period
  periodStartedAt: timestamp("period_started_at"), // When the current cap period started
  totalTimesCompleted: integer("total_times_completed").default(0), // Total times ever completed
  totalRationsEarned: integer("total_rations_earned").default(0), // Total rations ever earned from this mission
  lastCompletedAt: timestamp("last_completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.missionId),
  index("idx_user_mission_progress_user").on(table.userId),
  index("idx_user_mission_progress_mission").on(table.missionId),
]);

export const insertUserMissionProgressSchema = createInsertSchema(userMissionProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserMissionProgress = typeof userMissionProgress.$inferSelect;
export type InsertUserMissionProgress = z.infer<typeof insertUserMissionProgressSchema>;

// Ration Rank Thresholds - defines the ranks and their requirements
export const RATION_RANKS = {
  recruit: { min: 0, max: 999, label: 'Recruit', order: 1 },
  warrior: { min: 1000, max: 4999, label: 'Warrior', order: 2 },
  shepherd: { min: 5000, max: 14999, label: 'Shepherd', order: 3 },
  watchman: { min: 15000, max: 29999, label: 'Watchman', order: 4 },
  elder: { min: 30000, max: Infinity, label: 'Elder', order: 5 },
} as const;

// Mission Reward Definitions
export const MISSION_REWARDS = {
  // Studies
  study_start: { amount: 5, category: 'study', description: 'Started a study' },
  study_complete_lesson: { amount: 25, category: 'study', description: 'Completed a lesson' },
  study_complete: { amount: 150, category: 'study', description: 'Completed entire study' },
  study_reflection: { amount: 20, category: 'study', description: 'Submitted reflection questions' },
  study_streak_7: { amount: 50, category: 'study', description: '7-day study streak' },
  study_streak_30: { amount: 250, category: 'study', description: '30-day study streak' },
  
  // Videos
  video_watch_50: { amount: 5, category: 'video', description: 'Watched 50% of video' },
  video_watch_100: { amount: 15, category: 'video', description: 'Watched entire video' },
  video_comment: { amount: 10, category: 'video', description: 'Posted comment on video' },
  video_share: { amount: 5, category: 'video', description: 'Shared video' },
  
  // Podcasts
  podcast_listen_50: { amount: 5, category: 'podcast', description: 'Listened to 50% of podcast' },
  podcast_listen_100: { amount: 15, category: 'podcast', description: 'Listened to entire podcast' },
  podcast_save: { amount: 5, category: 'podcast', description: 'Saved podcast for later' },
  podcast_comment: { amount: 10, category: 'podcast', description: 'Posted comment on podcast' },
  
  // Live Sessions
  live_attend: { amount: 40, category: 'live', description: 'Attended live session' },
  live_stay_full: { amount: 25, category: 'live', description: 'Stayed for full session' },
  live_participate: { amount: 15, category: 'live', description: 'Participated in session' },
  live_replay: { amount: 15, category: 'live', description: 'Watched replay within 48 hours' },
  
  // Blogs
  blog_read: { amount: 10, category: 'blog', description: 'Read full blog post' },
  blog_comment: { amount: 15, category: 'blog', description: 'Posted thoughtful comment' },
  blog_share: { amount: 5, category: 'blog', description: 'Shared blog post' },
  
  // Devotionals
  devotional_complete: { amount: 20, category: 'devotional', description: 'Completed daily devotional' },
  devotional_reflection: { amount: 15, category: 'devotional', description: 'Submitted devotional reflection' },
  devotional_streak_7: { amount: 75, category: 'devotional', description: '7-day devotional streak' },
  devotional_streak_30: { amount: 300, category: 'devotional', description: '30-day devotional streak' },
  
  // War Groups
  war_group_join: { amount: 100, category: 'war_group', description: 'Joined a War Group' },
  war_group_checkin: { amount: 40, category: 'war_group', description: 'Weekly group check-in' },
  war_group_call: { amount: 50, category: 'war_group', description: 'Attended group call' },
  war_group_post: { amount: 20, category: 'war_group', description: 'Posted encouragement or Scripture' },
  war_group_prayer: { amount: 10, category: 'war_group', description: 'Prayed for a brother' },
  war_group_lead_weekly: { amount: 150, category: 'war_group', description: 'Led War Group weekly' },
  war_group_host_call: { amount: 100, category: 'war_group', description: 'Hosted a call or study' },
  war_group_mentor: { amount: 75, category: 'war_group', description: 'Logged mentoring session' },
  war_group_resolve_issue: { amount: 50, category: 'war_group', description: 'Resolved accountability issue' },
  
  // Challenges
  challenge_join: { amount: 25, category: 'challenge', description: 'Joined a challenge' },
  challenge_daily: { amount: 30, category: 'challenge', description: 'Daily challenge completion' },
  challenge_complete: { amount: 200, category: 'challenge', description: 'Completed challenge' },
  challenge_perfect: { amount: 150, category: 'challenge', description: 'Perfect challenge completion' },
  
  // Fitness
  fitness_log_workout: { amount: 15, category: 'fitness', description: 'Logged workout' },
  fitness_3_weekly: { amount: 50, category: 'fitness', description: '3 workouts this week' },
  fitness_5_weekly: { amount: 100, category: 'fitness', description: '5 workouts this week' },
  fitness_scripture_combo: { amount: 25, category: 'fitness', description: 'Scripture + fitness combo day' },
  
  // Events
  event_register: { amount: 25, category: 'event', description: 'Registered for event' },
  event_attend: { amount: 100, category: 'event', description: 'Attended event' },
  event_volunteer: { amount: 200, category: 'event', description: 'Volunteered at event' },
  event_bring_friend: { amount: 150, category: 'event', description: 'Brought another man' },
  
  // Carousel
  carousel_complete: { amount: 20, category: 'carousel', description: 'Completed featured item' },
  carousel_weekly_complete: { amount: 100, category: 'carousel', description: 'Completed all weekly featured' },
  
  // Profile
  profile_photo: { amount: 25, category: 'profile', description: 'Uploaded profile photo' },
  profile_complete: { amount: 75, category: 'profile', description: 'Completed profile fully' },
  profile_apparel: { amount: 50, category: 'profile', description: 'Man Up apparel in event photo' },
  profile_licensed_leader: { amount: 250, category: 'profile', description: 'Licensed leader brand compliance' },
  
  // Special
  grace_bonus: { amount: 100, category: 'special', description: 'Welcome back! Grace bonus for returning' },
} as const;

// Daily limits for anti-abuse
export const DAILY_MISSION_LIMITS = {
  video_comment: 5,
  podcast_comment: 5,
  blog_comment: 5,
  war_group_post: 10,
  war_group_prayer: 20,
  video_share: 5,
  blog_share: 5,
} as const;

export type MissionType = keyof typeof MISSION_REWARDS;
export type RationRank = keyof typeof RATION_RANKS;

// Store Products - items users can redeem with rations
export const storeProducts = pgTable("store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  tier: varchar("tier").notNull().default("bronze"), // bronze (codes/discounts), silver (small items), gold (VIP items)
  rationCost: integer("ration_cost").notNull().default(100),
  stock: integer("stock"), // null = unlimited
  isVipOnly: boolean("is_vip_only").default(false), // Requires VIP subscription
  productType: varchar("product_type").notNull().default("physical"), // physical, digital, discount_code
  discountCode: varchar("discount_code"), // For discount code products
  discountValue: varchar("discount_value"), // e.g., "20% off", "$10 off"
  hasSizes: boolean("has_sizes").default(false), // Whether product has size options
  availableSizes: text("available_sizes").array(), // Array of available sizes e.g., ["S", "M", "L", "XL"]
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_store_products_tier").on(table.tier),
  index("idx_store_products_active").on(table.isActive),
]);

export const insertStoreProductSchema = createInsertSchema(storeProducts, {
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  tier: z.enum(["bronze", "silver", "gold"]).default("bronze"),
  rationCost: z.number().int().min(1, "Ration cost must be at least 1"),
  stock: z.number().int().min(0).nullable().optional(),
  isVipOnly: z.boolean().default(false),
  productType: z.enum(["physical", "digital", "discount_code"]).default("physical"),
  discountCode: z.string().optional(),
  discountValue: z.string().optional(),
  hasSizes: z.boolean().default(false),
  availableSizes: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;

// Store Redemptions - tracks user purchases from the store
export const storeRedemptions = pgTable("store_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  rationsCost: integer("rations_cost").notNull(), // Snapshot of cost at time of redemption
  selectedSize: varchar("selected_size"), // Size selected if product has sizes
  status: varchar("status").notNull().default("pending"), // pending, fulfilled, cancelled
  shippingName: varchar("shipping_name"),
  shippingAddress: text("shipping_address"),
  shippingCity: varchar("shipping_city"),
  shippingState: varchar("shipping_state"),
  shippingZip: varchar("shipping_zip"),
  shippingPhone: varchar("shipping_phone"),
  shippingEmail: varchar("shipping_email"),
  notes: text("notes"), // Admin notes for fulfillment
  fulfilledAt: timestamp("fulfilled_at"),
  fulfilledBy: varchar("fulfilled_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_store_redemptions_user").on(table.userId),
  index("idx_store_redemptions_product").on(table.productId),
  index("idx_store_redemptions_status").on(table.status),
]);

export const insertStoreRedemptionSchema = createInsertSchema(storeRedemptions, {
  productId: z.string().min(1, "Product ID is required"),
  rationsCost: z.number().int().min(1),
  selectedSize: z.string().optional(),
  status: z.enum(["pending", "fulfilled", "cancelled"]).default("pending"),
  shippingName: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingPhone: z.string().optional(),
  shippingEmail: z.string().optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  fulfilledAt: true,
  fulfilledBy: true,
  createdAt: true,
  updatedAt: true,
});

export type StoreRedemption = typeof storeRedemptions.$inferSelect;
export type InsertStoreRedemption = z.infer<typeof insertStoreRedemptionSchema>;

// Store tier definitions
export const STORE_TIERS = {
  bronze: { label: 'Bronze', description: 'Discount codes and coupons', color: '#CD7F32', minRations: 0 },
  silver: { label: 'Silver', description: 'Small items like pens, coozies, and accessories', color: '#C0C0C0', minRations: 500 },
  gold: { label: 'Gold', description: 'Premium items for VIP members', color: '#FFD700', minRations: 2000, vipOnly: true },
} as const;

export type StoreTier = keyof typeof STORE_TIERS;

// Push Subscriptions - stores browser push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(), // Public key
  auth: text("auth").notNull(), // Auth secret
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_push_subscriptions_user").on(table.userId),
  index("idx_push_subscriptions_endpoint").on(table.endpoint),
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions, {
  endpoint: z.string().min(1, "Endpoint is required"),
  p256dh: z.string().min(1, "Public key is required"),
  auth: z.string().min(1, "Auth secret is required"),
  userAgent: z.string().optional(),
}).omit({
  id: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
