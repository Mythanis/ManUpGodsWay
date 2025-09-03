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
  streakDays: integer("streak_days").default(0),
  lastActiveDate: timestamp("last_active_date"),
  allowDirectMessages: boolean("allow_direct_messages").default(true),
  allowGroupInvites: boolean("allow_group_invites").default(true),
  prayerPermissionsGranted: boolean("prayer_permissions_granted").default(false),
  isProfileComplete: boolean("is_profile_complete").default(false),
  themePreference: varchar("theme_preference").default("light"), // light, dark, system
  isProfilePrivate: boolean("is_profile_private").default(false),
  isBanned: boolean("is_banned").default(false),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bible studies
export const studies = pgTable("studies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  content: text("content"),
  category: varchar("category").notNull(), // leadership, marriage, fatherhood, character, etc.
  difficulty: varchar("difficulty").default("beginner"), // beginner, intermediate, advanced
  estimatedHours: integer("estimated_hours").default(1),
  lessonCount: integer("lesson_count").default(1),
  thumbnailUrl: varchar("thumbnail_url"),
  videoId: varchar("video_id").references(() => videos.id), // Reference to videos table
  videoUrl: varchar("video_url"), // Keep for backward compatibility with external URLs
  requiredTier: varchar("required_tier").default("free"), // free, premium, vip
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingCount: integer("rating_count").default(0),
  isPublished: boolean("is_published").default(false),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual lessons within studies
export const lessons = pgTable("lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  lessonNumber: integer("lesson_number").notNull(),
  title: varchar("title").notNull(),
  content: text("content"),
  videoId: varchar("video_id").references(() => videos.id),
  videoUrl: varchar("video_url"),
  estimatedMinutes: integer("estimated_minutes").default(30),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.studyId, table.lessonNumber), // Ensure unique lesson numbers per study
]);

// User progress tracking
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  currentLesson: integer("current_lesson").default(1),
  completedLessons: integer("completed_lessons").default(0),
  isCompleted: boolean("is_completed").default(false),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community discussions
export const discussions = pgTable("discussions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(),
  studyId: varchar("study_id").references(() => studies.id, { onDelete: 'cascade' }), // Optional link to study
  likes: integer("likes").default(0),
  replyCount: integer("reply_count").default(0),
  isPinned: boolean("is_pinned").default(false),
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

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  studyNotifications: boolean("study_notifications").default(true),
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
  imageUrl: varchar("image_url"),
  date: timestamp("date").notNull(),
  notificationsSent: boolean("notifications_sent").default(false), // Track if notifications have been sent for this devotional
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

export const studiesRelations = relations(studies, ({ one, many }) => ({
  progress: many(userProgress),
  ratings: many(studyRatings),
  discussions: many(discussions),
  lessons: many(lessons),
  video: one(videos, { fields: [studies.videoId], references: [videos.id] }),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  study: one(studies, { fields: [lessons.studyId], references: [studies.id] }),
  video: one(videos, { fields: [lessons.videoId], references: [videos.id] }),
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

export const insertStudySchema = createInsertSchema(studies, {
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  estimatedHours: z.number().int().min(1).default(1),
  lessonCount: z.number().int().min(1).default(1),
  requiredTier: z.enum(["free", "premium", "vip"]).default("free"),
  isPublished: z.boolean().default(false),
  videoId: z.string().optional(),
}).omit({ 
  id: true, 
  rating: true, 
  ratingCount: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertLessonSchema = createInsertSchema(lessons, {
  title: z.string().min(1, "Lesson title is required"),
  content: z.string().min(1, "Lesson content is required"),
  lessonNumber: z.number().int().min(1, "Lesson number must be at least 1"),
  estimatedMinutes: z.number().int().min(1).default(30),
  videoId: z.string().optional(),
  videoUrl: z.string().optional(),
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

export type Study = typeof studies.$inferSelect;
export type InsertStudy = z.infer<typeof insertStudySchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Discussion = typeof discussions.$inferSelect;
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;
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

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  currentAttendees: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  eventDate: z.string().transform((val) => new Date(val))
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
