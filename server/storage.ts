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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, ilike, count } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Study operations
  getStudies(category?: string, requiredTier?: string): Promise<Study[]>;
  getStudy(id: string): Promise<Study | undefined>;
  createStudy(study: InsertStudy): Promise<Study>;
  updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study>;
  deleteStudy(id: string): Promise<void>;
  searchStudies(query: string): Promise<Study[]>;
  
  // Progress operations
  getUserProgress(userId: string, studyId?: string): Promise<UserProgress[]>;
  updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress>;
  
  // Discussion operations
  getDiscussions(category?: string, limit?: number): Promise<(Discussion & { user: User })[]>;
  getDiscussion(id: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[] }) | undefined>;
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  
  // Reply operations
  createReply(reply: InsertDiscussionReply): Promise<DiscussionReply>;
  
  // Devotional operations
  getTodaysDevotional(): Promise<Devotional | undefined>;
  getDevotionals(limit?: number): Promise<Devotional[]>;
  createDevotional(devotional: InsertDevotional): Promise<Devotional>;
  updateDevotional(id: string, devotional: InsertDevotional): Promise<Devotional | undefined>;
  deleteDevotional(id: string): Promise<void>;
  
  // Rating operations
  rateStudy(rating: InsertStudyRating): Promise<StudyRating>;
  
  // Admin operations
  getAllUsers(limit?: number): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
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
  async getStudies(category?: string, requiredTier?: string): Promise<Study[]> {
    const conditions = [eq(studies.isPublished, true)];
    
    if (category) {
      conditions.push(eq(studies.category, category));
    }
    
    if (requiredTier) {
      conditions.push(eq(studies.requiredTier, requiredTier));
    }
    
    return await db
      .select()
      .from(studies)
      .where(and(...conditions))
      .orderBy(desc(studies.createdAt));
  }

  async getStudy(id: string): Promise<Study | undefined> {
    const [study] = await db.select().from(studies).where(eq(studies.id, id));
    return study;
  }

  async createStudy(study: InsertStudy): Promise<Study> {
    const [newStudy] = await db.insert(studies).values(study).returning();
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

  // Discussion operations
  async getDiscussions(category?: string, limit = 20): Promise<(Discussion & { user: User })[]> {
    const query = db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id));

    if (category) {
      return await query
        .where(eq(discussions.category, category))
        .orderBy(desc(discussions.isPinned), desc(discussions.createdAt))
        .limit(limit);
    }

    return await query
      .orderBy(desc(discussions.isPinned), desc(discussions.createdAt))
      .limit(limit);
  }

  async getDiscussion(id: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[] }) | undefined> {
    const [discussion] = await db
      .select({
        id: discussions.id,
        userId: discussions.userId,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        likes: discussions.likes,
        replyCount: discussions.replyCount,
        isPinned: discussions.isPinned,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: users,
      })
      .from(discussions)
      .innerJoin(users, eq(discussions.userId, users.id))
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
        rating: avgRating.toFixed(1),
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

    // Create new direct conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        type: "direct",
        createdBy: userId1,
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
    return await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        userId: messages.userId,
        content: messages.content,
        messageType: messages.messageType,
        isEdited: messages.isEdited,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
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
}

export const storage = new DatabaseStorage();
