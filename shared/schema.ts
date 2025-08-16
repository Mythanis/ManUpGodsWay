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
  role: varchar("role").default("user"), // user, admin
  subscriptionTier: varchar("subscription_tier").default("free"), // free, premium, vip
  streakDays: integer("streak_days").default(0),
  allowDirectMessages: boolean("allow_direct_messages").default(true),
  allowGroupInvites: boolean("allow_group_invites").default(true),
  prayerPermissionsGranted: boolean("prayer_permissions_granted").default(false),
  isProfileComplete: boolean("is_profile_complete").default(false),
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

// Daily devotionals
export const devotionals = pgTable("devotionals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  verse: varchar("verse").notNull(),
  verseReference: varchar("verse_reference").notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User ratings for studies
export const studyRatings = pgTable("study_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studyId: varchar("study_id").notNull().references(() => studies.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5 stars
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
export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  discussions: many(discussions),
  replies: many(discussionReplies),
  ratings: many(studyRatings),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  uploader: one(users, { fields: [videos.uploadedBy], references: [users.id] }),
  studies: many(studies),
}));

export const studiesRelations = relations(studies, ({ one, many }) => ({
  progress: many(userProgress),
  ratings: many(studyRatings),
  discussions: many(discussions),
  video: one(videos, { fields: [studies.videoId], references: [videos.id] }),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  user: one(users, { fields: [discussions.userId], references: [users.id] }),
  study: one(studies, { fields: [discussions.studyId], references: [studies.id] }),
  replies: many(discussionReplies),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one }) => ({
  discussion: one(discussions, { fields: [discussionReplies.discussionId], references: [discussions.id] }),
  user: one(users, { fields: [discussionReplies.userId], references: [users.id] }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, { fields: [userProgress.userId], references: [users.id] }),
  study: one(studies, { fields: [userProgress.studyId], references: [studies.id] }),
}));

export const studyRatingsRelations = relations(studyRatings, ({ one }) => ({
  user: one(users, { fields: [studyRatings.userId], references: [users.id] }),
  study: one(studies, { fields: [studyRatings.studyId], references: [studies.id] }),
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
  fileSize: z.number().int().min(1, "File size must be greater than 0"),
  duration: z.number().int().optional(),
  thumbnailUrl: z.string().optional(),
  uploadedBy: z.string().min(1, "Uploaded by is required"),
}).omit({ 
  id: true, 
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

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  createdAt: true,
});

export const insertDevotionalSchema = createInsertSchema(devotionals).omit({
  id: true,
  createdAt: true,
});

export const insertStudyRatingSchema = createInsertSchema(studyRatings).omit({
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Study = typeof studies.$inferSelect;
export type InsertStudy = z.infer<typeof insertStudySchema>;
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
