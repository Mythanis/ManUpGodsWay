import {
  users,
  studies,
  discussions,
  discussionReplies,
  userProgress,
  devotionals,
  studyRatings,
  conversations,
  conversationParticipants,
  messages,
  messageRequests,
  notifications,
  type User,
  type UpsertUser,
  type Study,
  type InsertStudy,
  type Discussion,
  type InsertDiscussion,
  type DiscussionReply,
  type InsertDiscussionReply,
  type UserProgress,
  type InsertUserProgress,
  type Devotional,
  type InsertDevotional,
  type StudyRating,
  type InsertStudyRating,
  type Conversation,
  type InsertConversation,
  type ConversationParticipant,
  type InsertConversationParticipant,
  type Message,
  type InsertMessage,
  type MessageRequest,
  type InsertMessageRequest,
  type Notification,
  type InsertNotification,
  videos,
  type Video,
  type InsertVideo,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, ilike, count } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Study operations
  getStudies(category?: string, requiredTier?: string, isAdmin?: boolean): Promise<Study[]>;
  getStudy(id: string): Promise<Study | undefined>;
  createStudy(study: InsertStudy): Promise<Study>;
  updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study>;
  deleteStudy(id: string): Promise<void>;
  searchStudies(query: string): Promise<Study[]>;
  getFeaturedStudy(): Promise<Study | null>;
  
  // Progress operations
  getUserProgress(userId: string, studyId?: string): Promise<UserProgress[]>;
  updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress>;
  
  // Study-specific methods
  getStudyDiscussion(studyId: string): Promise<(Discussion & { user: User }) | null>;
  createDiscussionsForExistingStudies(): Promise<void>;

  // Discussion operations
  getDiscussions(category?: string, limit?: number, sortBy?: string, searchTerm?: string): Promise<(Discussion & { user: User })[]>;
  getDiscussion(id: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[] }) | undefined>;
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  
  // Reply operations
  createReply(reply: InsertDiscussionReply): Promise<DiscussionReply>;
  getDiscussionReplies(discussionId: string): Promise<(DiscussionReply & { user: User })[]>;
  
  // Like operations
  toggleDiscussionLike(discussionId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }>;
  
  // Devotional operations
  getTodaysDevotional(): Promise<Devotional | undefined>;
  getDevotionals(limit?: number): Promise<Devotional[]>;
  createDevotional(devotional: InsertDevotional): Promise<Devotional>;
  updateDevotional(id: string, devotional: InsertDevotional): Promise<Devotional | undefined>;
  deleteDevotional(id: string): Promise<void>;
  
  // Rating operations
  rateStudy(rating: InsertStudyRating): Promise<StudyRating>;
  getStudyReviews(studyId: string): Promise<(StudyRating & { user: { firstName: string | null; lastName: string | null; profileImageUrl?: string | null } })[]>;
  
  // Video operations
  getVideos(limit?: number): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, video: Partial<InsertVideo>): Promise<Video>;
  deleteVideo(id: string): Promise<void>;
  updateVideoProcessingStatus(id: string, status: string, isProcessed?: boolean): Promise<Video>;
  
  // Admin operations
  getAllUsers(limit?: number): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
  updateUserSubscription(userId: string, subscriptionTier: string): Promise<User>;
  banUser(userId: string, reason: string): Promise<User>;
  unbanUser(userId: string): Promise<User>;
  getSystemStats(): Promise<{
    totalUsers: number;
    totalStudies: number;
    activeToday: number;
    newPosts: number;
  }>;

  // Messaging operations
  getUserConversations(userId: string): Promise<(Conversation & { participants: (ConversationParticipant & { user: User })[] })[]>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  createGroupConversation(conversation: InsertConversation, participantIds: string[]): Promise<Conversation>;
  getConversationMessages(conversationId: string, limit?: number): Promise<(Message & { user: User })[]>;
  sendMessage(message: InsertMessage): Promise<Message>;
  addParticipantToConversation(conversationId: string, userId: string, role?: string): Promise<ConversationParticipant>;
  removeParticipantFromConversation(conversationId: string, userId: string): Promise<void>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Study operations
  async getStudies(category?: string, requiredTier?: string, isAdmin?: boolean): Promise<Study[]> {
    const conditions = [];
    
    // Only filter by published status if not admin
    if (!isAdmin) {
      conditions.push(eq(studies.isPublished, true));
    }
    
    if (category) {
      conditions.push(eq(studies.category, category));
    }
    
    if (requiredTier) {
      conditions.push(eq(studies.requiredTier, requiredTier));
    }
    
    const query = db.select().from(studies);
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(studies.createdAt));
  }

  async getStudy(id: string): Promise<Study | undefined> {
    const [study] = await db.select().from(studies).where(eq(studies.id, id));
    return study;
  }

  async createStudy(study: InsertStudy): Promise<Study> {
    const [newStudy] = await db.insert(studies).values(study).returning();
    
    // Note: Discussion will be created automatically when first accessed via getStudyDiscussion
    
    return newStudy;
  }

  async updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study> {
    const [updatedStudy] = await db
      .update(studies)
      .set({ ...study, updatedAt: new Date() })
      .where(eq(studies.id, id))
      .returning();
    return updatedStudy;
  }

  async deleteStudy(id: string): Promise<void> {
    await db.delete(studies).where(eq(studies.id, id));
  }

  async searchStudies(query: string): Promise<Study[]> {
    return await db
      .select()
      .from(studies)
      .where(
        and(
          eq(studies.isPublished, true),
          ilike(studies.title, `%${query}%`)
        )
      )
      .orderBy(desc(studies.createdAt));
  }

  async getFeaturedStudy(): Promise<Study | null> {
    const [featuredStudy] = await db
      .select()
      .from(studies)
      .where(and(eq(studies.isPublished, true), eq(studies.isFeatured, true)))
      .limit(1);
    return featuredStudy || null;
  }

  // Progress operations
  async getUserProgress(userId: string, studyId?: string): Promise<UserProgress[]> {
    const conditions = [eq(userProgress.userId, userId)];
    
    if (studyId) {
      conditions.push(eq(userProgress.studyId, studyId));
    }
    
    return await db
      .select()
      .from(userProgress)
      .where(and(...conditions))
      .orderBy(desc(userProgress.lastAccessedAt));
  }

  async updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress> {
    const existing = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(userProgress)
        .set({ ...progress, lastAccessedAt: new Date() })
        .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)))
        .returning();
      return updated;
    } else {
      const [newProgress] = await db
        .insert(userProgress)
        .values({
          userId,
          studyId,
          ...progress,
        })
        .returning();
      return newProgress;
    }
  }

  // Study-specific methods
  async getStudyDiscussion(studyId: string): Promise<(Discussion & { user: User }) | null> {
    // First try to get existing discussion
    const [discussion] = await db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        studyId: discussions.studyId,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id))
      .where(eq(discussions.studyId, studyId))
      .limit(1);
    
    if (discussion) {
      return discussion;
    }

    // If no discussion exists, create one automatically
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
    if (!study) {
      return null;
    }

    // Get the first admin user to create the discussion
    const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    if (!adminUser) {
      // If no admin found, skip creating discussion for now
      return null;
    }
    const discussionUserId = adminUser.id;

    const discussionData: InsertDiscussion = {
      title: `${study.title} - Study Discussion`,
      content: `Welcome to the discussion for "${study.title}". Share your thoughts, questions, and insights about this study here.`,
      category: study.category || 'leadership',
      userId: discussionUserId,
      studyId: study.id,
    };
    
    const newDiscussion = await this.createDiscussion(discussionData);
    
    // Return the new discussion with user data
    const [createdDiscussion] = await db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        studyId: discussions.studyId,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id))
      .where(eq(discussions.id, newDiscussion.id))
      .limit(1);
    
    return createdDiscussion || null;
  }

  async createDiscussionsForExistingStudies(): Promise<void> {
    // Get all studies that don't have discussions
    const studiesWithoutDiscussions = await db
      .select()
      .from(studies)
      .leftJoin(discussions, eq(studies.id, discussions.studyId))
      .where(sql`${discussions.id} IS NULL`);

    // Get an admin user to create discussions
    const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    if (!adminUser) {
      return; // Skip if no admin user found
    }

    for (const { studies: study } of studiesWithoutDiscussions) {
      if (!study) continue;
      
      const discussionData: InsertDiscussion = {
        title: study.title,
        content: `Welcome to the discussion for "${study.title}". Share your thoughts, questions, and insights about this study here.`,
        category: study.category || 'leadership',
        userId: adminUser.id,
        studyId: study.id,
      };
      
      await this.createDiscussion(discussionData);
    }
  }

  // Discussion operations
  async getDiscussions(category?: string, limit = 20, sortBy = 'recent', searchTerm?: string): Promise<(Discussion & { user: User; study?: { id: string; title: string; requiredTier: string | null } | null })[]> {
    const query = db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        studyId: discussions.studyId,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
        study: {
          id: studies.id,
          title: studies.title,
          requiredTier: studies.requiredTier,
        },
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id))
      .leftJoin(studies, eq(discussions.studyId, studies.id));

    let orderBy;
    switch (sortBy) {
      case 'likes':
        orderBy = [desc(discussions.isPinned), desc(discussions.likes), desc(discussions.createdAt)];
        break;
      case 'replies':
        orderBy = [desc(discussions.isPinned), desc(discussions.replyCount), desc(discussions.createdAt)];
        break;
      default: // 'recent'
        orderBy = [desc(discussions.isPinned), desc(discussions.createdAt)];
    }

    // Build where conditions
    const conditions = [];
    
    if (category) {
      conditions.push(eq(discussions.category, category));
    }
    
    if (searchTerm) {
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${discussions.title}) LIKE ${searchPattern}`,
          sql`LOWER(${discussions.content}) LIKE ${searchPattern}`
        )
      );
    }
    
    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit);
    }

    return await query
      .orderBy(...orderBy)
      .limit(limit);
  }

  async getDiscussion(id: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[]; study?: { id: string; title: string; requiredTier: string | null } | null }) | undefined> {
    const [discussion] = await db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        studyId: discussions.studyId,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
        study: {
          id: studies.id,
          title: studies.title,
          requiredTier: studies.requiredTier,
        },
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id))
      .leftJoin(studies, eq(discussions.studyId, studies.id))
      .where(eq(discussions.id, id));

    if (!discussion) return undefined;

    const replies = await db
      .select({
        id: discussionReplies.id,
        discussionId: discussionReplies.discussionId,
        userId: discussionReplies.userId,
        content: discussionReplies.content,
        likes: discussionReplies.likes,
        createdAt: discussionReplies.createdAt,
        updatedAt: discussionReplies.updatedAt,
        user: users,
      })
      .from(discussionReplies)
      .innerJoin(users, eq(discussionReplies.userId, users.id))
      .where(eq(discussionReplies.discussionId, id))
      .orderBy(discussionReplies.createdAt);

    return { ...discussion, replies };
  }

  async createDiscussion(discussion: InsertDiscussion): Promise<Discussion> {
    const [newDiscussion] = await db.insert(discussions).values(discussion).returning();
    return newDiscussion;
  }

  // Reply operations
  async createReply(reply: InsertDiscussionReply): Promise<DiscussionReply> {
    const [newReply] = await db.insert(discussionReplies).values(reply).returning();
    
    // Update reply count
    await db
      .update(discussions)
      .set({
        replyCount: sql`${discussions.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, reply.discussionId));

    return newReply;
  }

  async getDiscussionReplies(discussionId: string): Promise<(DiscussionReply & { user: User })[]> {
    return await db
      .select({
        id: discussionReplies.id,
        discussionId: discussionReplies.discussionId,
        userId: discussionReplies.userId,
        content: discussionReplies.content,
        likes: discussionReplies.likes,
        createdAt: discussionReplies.createdAt,
        updatedAt: discussionReplies.updatedAt,
        user: users,
      })
      .from(discussionReplies)
      .innerJoin(users, eq(discussionReplies.userId, users.id))
      .where(eq(discussionReplies.discussionId, discussionId))
      .orderBy(discussionReplies.createdAt);
  }

  async toggleDiscussionLike(discussionId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }> {
    // For simplicity, we'll just increment/decrement the likes count
    // In a real app, you'd have a separate likes table to track who liked what
    const [discussion] = await db
      .select()
      .from(discussions)
      .where(eq(discussions.id, discussionId));

    if (!discussion) {
      throw new Error('Discussion not found');
    }

    // For now, just toggle the like count (in real app, track user likes)
    const newLikes = Math.max(0, (discussion.likes || 0) + 1);
    
    await db
      .update(discussions)
      .set({ likes: newLikes })
      .where(eq(discussions.id, discussionId));

    return { liked: true, totalLikes: newLikes };
  }

  // Devotional operations
  async getTodaysDevotional(): Promise<Devotional | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [devotional] = await db
      .select()
      .from(devotionals)
      .where(and(
        sql`${devotionals.date} >= ${today}`,
        sql`${devotionals.date} < ${tomorrow}`
      ));

    return devotional;
  }

  async getDevotionals(limit = 10): Promise<Devotional[]> {
    return await db
      .select()
      .from(devotionals)
      .orderBy(desc(devotionals.date))
      .limit(limit);
  }

  async createDevotional(devotional: InsertDevotional): Promise<Devotional> {
    const [newDevotional] = await db.insert(devotionals).values(devotional).returning();
    return newDevotional;
  }

  async updateDevotional(id: string, devotional: InsertDevotional): Promise<Devotional | undefined> {
    const [updatedDevotional] = await db
      .update(devotionals)
      .set(devotional)
      .where(eq(devotionals.id, id))
      .returning();
    return updatedDevotional;
  }

  async deleteDevotional(id: string): Promise<void> {
    await db.delete(devotionals).where(eq(devotionals.id, id));
  }

  // Rating operations
  // Get study reviews
  async getStudyReviews(studyId: string): Promise<(StudyRating & { user: { firstName: string | null; lastName: string | null; profileImageUrl?: string | null } })[]> {
    return await db
      .select({
        id: studyRatings.id,
        userId: studyRatings.userId,
        studyId: studyRatings.studyId,
        rating: studyRatings.rating,
        review: studyRatings.review,
        createdAt: studyRatings.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(studyRatings)
      .innerJoin(users, eq(studyRatings.userId, users.id))
      .where(and(
        eq(studyRatings.studyId, studyId),
        sql`${studyRatings.review} IS NOT NULL AND ${studyRatings.review} != ''`
      ))
      .orderBy(desc(studyRatings.createdAt));
  }

  async rateStudy(rating: InsertStudyRating): Promise<StudyRating> {
    // Check if user already rated this study
    const existing = await db
      .select()
      .from(studyRatings)
      .where(and(eq(studyRatings.userId, rating.userId), eq(studyRatings.studyId, rating.studyId)));

    let newRating;
    if (existing.length > 0) {
      [newRating] = await db
        .update(studyRatings)
        .set({ rating: rating.rating })
        .where(and(eq(studyRatings.userId, rating.userId), eq(studyRatings.studyId, rating.studyId)))
        .returning();
    } else {
      [newRating] = await db.insert(studyRatings).values(rating).returning();
    }

    // Update study rating average
    const [{ avgRating, ratingCount }] = await db
      .select({
        avgRating: sql<number>`AVG(${studyRatings.rating})`,
        ratingCount: count(studyRatings.id),
      })
      .from(studyRatings)
      .where(eq(studyRatings.studyId, rating.studyId));

    await db
      .update(studies)
      .set({
        rating: avgRating ? parseFloat(avgRating.toString()).toFixed(1) : "0.0",
        ratingCount: ratingCount,
      })
      .where(eq(studies.id, rating.studyId));

    return newRating;
  }

  // Admin operations
  async getAllUsers(limit = 50): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateUserSubscription(userId: string, subscriptionTier: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ subscriptionTier, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async banUser(userId: string, reason: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isBanned: true, 
        bannedAt: new Date(), 
        bannedReason: reason,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async unbanUser(userId: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isBanned: false, 
        bannedAt: null, 
        bannedReason: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getSystemStats(): Promise<{
    totalUsers: number;
    totalStudies: number;
    activeToday: number;
    newPosts: number;
  }> {
    const [{ totalUsers }] = await db.select({ totalUsers: count(users.id) }).from(users);
    const [{ totalStudies }] = await db.select({ totalStudies: count(studies.id) }).from(studies);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [{ activeToday }] = await db
      .select({ activeToday: count(userProgress.id) })
      .from(userProgress)
      .where(sql`${userProgress.lastAccessedAt} >= ${today}`);

    const [{ newPosts }] = await db
      .select({ newPosts: count(discussions.id) })
      .from(discussions)
      .where(sql`${discussions.createdAt} >= ${today}`);

    return {
      totalUsers,
      totalStudies,
      activeToday,
      newPosts,
    };
  }

  // Messaging operations
  async getUserConversations(userId: string): Promise<(Conversation & { participants: (ConversationParticipant & { user: User })[] })[]> {
    const userConversations = await db
      .select({
        id: conversations.id,
        type: conversations.type,
        name: conversations.name,
        description: conversations.description,
        createdBy: conversations.createdBy,
        isActive: conversations.isActive,
        lastMessageAt: conversations.lastMessageAt,
        originalParticipantNames: conversations.originalParticipantNames,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(eq(conversationParticipants.userId, userId))
      .orderBy(desc(conversations.lastMessageAt));

    // Get participants for each conversation
    const conversationsWithParticipants = await Promise.all(
      userConversations.map(async (conversation) => {
        const participants = await db
          .select({
            id: conversationParticipants.id,
            conversationId: conversationParticipants.conversationId,
            userId: conversationParticipants.userId,
            role: conversationParticipants.role,
            joinedAt: conversationParticipants.joinedAt,
            lastReadAt: conversationParticipants.lastReadAt,
            user: users,
          })
          .from(conversationParticipants)
          .innerJoin(users, eq(conversationParticipants.userId, users.id))
          .where(eq(conversationParticipants.conversationId, conversation.id));

        return { ...conversation, participants };
      })
    );

    return conversationsWithParticipants;
  }

  async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Check if direct conversation already exists
    const existingConversation = await db
      .select({
        id: conversations.id,
        type: conversations.type,
        name: conversations.name,
        description: conversations.description,
        createdBy: conversations.createdBy,
        isActive: conversations.isActive,
        lastMessageAt: conversations.lastMessageAt,
        originalParticipantNames: conversations.originalParticipantNames,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(
        and(
          eq(conversations.type, "direct"),
          eq(conversationParticipants.userId, userId1)
        )
      );

    for (const conv of existingConversation) {
      const otherParticipant = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conv.id),
            eq(conversationParticipants.userId, userId2)
          )
        );

      if (otherParticipant.length > 0) {
        return conv;
      }
    }

    // Get user names for the original participant names
    const user1 = await this.getUser(userId1);
    const user2 = await this.getUser(userId2);
    const participantNames = {
      [userId1]: `${user1?.firstName || ''} ${user1?.lastName || ''}`.trim() || user1?.email || 'Unknown User',
      [userId2]: `${user2?.firstName || ''} ${user2?.lastName || ''}`.trim() || user2?.email || 'Unknown User'
    };

    // Create new direct conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        type: "direct",
        createdBy: userId1,
        originalParticipantNames: JSON.stringify(participantNames),
      })
      .returning();

    // Add both participants
    await db.insert(conversationParticipants).values([
      { conversationId: newConversation.id, userId: userId1 },
      { conversationId: newConversation.id, userId: userId2 },
    ]);

    return newConversation;
  }

  async createGroupConversation(conversation: InsertConversation, participantIds: string[]): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();

    // Add participants
    const participantData = participantIds.map(userId => ({
      conversationId: newConversation.id,
      userId,
      role: userId === conversation.createdBy ? "admin" : "member",
    }));

    await db.insert(conversationParticipants).values(participantData);

    return newConversation;
  }

  async getConversationMessages(conversationId: string, limit = 50): Promise<(Message & { user: User })[]> {
    const results = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        userId: messages.userId,
        content: messages.content,
        messageType: messages.messageType,
        isEdited: messages.isEdited,
        editedAt: messages.editedAt,
        deletedBy: messages.deletedBy,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Return all messages since we removed the requesting user filtering
    return results;
  }

  async sendMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();

    // Update conversation's last message timestamp
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, message.conversationId));

    return newMessage;
  }

  async addParticipantToConversation(conversationId: string, userId: string, role = "member"): Promise<ConversationParticipant> {
    const [participant] = await db
      .insert(conversationParticipants)
      .values({ conversationId, userId, role })
      .returning();

    return participant;
  }

  async removeParticipantFromConversation(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }

  async getMessage(messageId: string): Promise<any> {
    const [message] = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    return message;
  }

  async softDeleteMessage(messageId: string, userId: string): Promise<void> {
    // Get current deletedBy array
    const [message] = await db.select({ deletedBy: messages.deletedBy })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message not found");
    }

    // Add user to deletedBy array if not already present
    const currentDeletedBy = message.deletedBy || [];
    if (!currentDeletedBy.includes(userId)) {
      const updatedDeletedBy = [...currentDeletedBy, userId];
      
      await db.update(messages)
        .set({ 
          deletedBy: updatedDeletedBy,
          updatedAt: new Date()
        })
        .where(eq(messages.id, messageId));
    }
  }

  async hardDeleteMessage(messageId: string): Promise<void> {
    await db.delete(messages)
      .where(eq(messages.id, messageId));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    // Delete all messages in the conversation
    await db.delete(messages)
      .where(eq(messages.conversationId, conversationId));
    
    // Delete all participants
    await db.delete(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    
    // Delete the conversation itself
    await db.delete(conversations)
      .where(eq(conversations.id, conversationId));
  }

  async getConversation(conversationId: string): Promise<any> {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (!conversation) return null;

    // Get all participants for this conversation
    const participants = await db.select()
      .from(conversationParticipants)
      .leftJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conversationId));

    return {
      ...conversation,
      participants: participants.map(p => ({
        id: p.conversation_participants?.id,
        userId: p.conversation_participants?.userId,
        role: p.conversation_participants?.role,
        user: p.users
      }))
    };
  }

  async getConversationParticipants(conversationId: string): Promise<any[]> {
    return await db.select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result.count);
  }

  // Message request methods
  async createMessageRequest(request: InsertMessageRequest): Promise<MessageRequest> {
    const [newRequest] = await db.insert(messageRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getUserMessageRequests(userId: string): Promise<(MessageRequest & { fromUser: User })[]> {
    return await db.select({
      id: messageRequests.id,
      fromUserId: messageRequests.fromUserId,
      toUserId: messageRequests.toUserId,
      message: messageRequests.message,
      status: messageRequests.status,
      createdAt: messageRequests.createdAt,
      respondedAt: messageRequests.respondedAt,
      fromUser: users,
    })
      .from(messageRequests)
      .innerJoin(users, eq(messageRequests.fromUserId, users.id))
      .where(eq(messageRequests.toUserId, userId))
      .orderBy(desc(messageRequests.createdAt));
  }

  async respondToMessageRequest(requestId: string, status: 'accepted' | 'declined'): Promise<MessageRequest> {
    const [updatedRequest] = await db.update(messageRequests)
      .set({ 
        status,
        respondedAt: new Date()
      })
      .where(eq(messageRequests.id, requestId))
      .returning();
    return updatedRequest;
  }

  async getMessageRequest(requestId: string): Promise<MessageRequest | undefined> {
    const [request] = await db.select()
      .from(messageRequests)
      .where(eq(messageRequests.id, requestId))
      .limit(1);
    return request;
  }

  // Check if direct conversation already exists between two users
  async findDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined> {
    const allConversations = await db.select()
      .from(conversations)
      .where(eq(conversations.type, 'direct'));

    for (const conversation of allConversations) {
      const participants = await this.getConversationParticipants(conversation.id);
      const participantIds = participants.map(p => p.userId);
      
      if (participantIds.includes(userId1) && participantIds.includes(userId2) && participantIds.length === 2) {
        return conversation;
      }
    }
    return undefined;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }


  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Video operations
  async getVideos(limit?: number): Promise<Video[]> {
    const query = db.select().from(videos).orderBy(desc(videos.createdAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    
    return await query;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async updateVideo(id: string, video: Partial<InsertVideo>): Promise<Video> {
    const [updatedVideo] = await db
      .update(videos)
      .set({ ...video, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<void> {
    // First, remove video references from studies
    await db
      .update(studies)
      .set({ videoId: null })
      .where(eq(studies.videoId, id));
    
    // Then delete the video
    await db.delete(videos).where(eq(videos.id, id));
  }

  async updateVideoProcessingStatus(id: string, status: string, isProcessed?: boolean): Promise<Video> {
    const updateData: any = { processingStatus: status, updatedAt: new Date() };
    if (isProcessed !== undefined) {
      updateData.isProcessed = isProcessed;
    }
    
    const [updatedVideo] = await db
      .update(videos)
      .set(updateData)
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo;
  }

  async clearAllNotifications(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  async clearNotification(userId: string, notificationId: string): Promise<void> {
    await db.delete(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.id, notificationId))
    );
  }
}

export const storage = new DatabaseStorage();
