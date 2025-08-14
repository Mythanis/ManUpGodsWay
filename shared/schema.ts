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
  videoUrl: varchar("video_url"),
  requiredTier: varchar("required_tier").default("free"), // free, premium, vip
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingCount: integer("rating_count").default(0),
  isPublished: boolean("is_published").default(false),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  discussions: many(discussions),
  replies: many(discussionReplies),
  ratings: many(studyRatings),
}));

export const studiesRelations = relations(studies, ({ many }) => ({
  progress: many(userProgress),
  ratings: many(studyRatings),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  user: one(users, { fields: [discussions.userId], references: [users.id] }),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudySchema = createInsertSchema(studies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  rating: true,
  ratingCount: true,
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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
