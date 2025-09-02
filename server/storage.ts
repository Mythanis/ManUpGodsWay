import {
  users,
  studies,
  lessons,
  discussions,
  discussionReplies,
  discussionSubscriptions,
  discussionHonors,
  replyHonors,
  userProgress,
  devotionals,
  studyRatings,
  videoRatings,
  conversations,
  conversationParticipants,
  messages,
  messageRequests,
  notifications,
  notificationPreferences,
  userReports,
  userSilences,
  logoSettings,
  headerLogoSettings,
  contentFlags,
  testimonies,
  brotherhoodRequests,
  brotherhoodDenials,
  brotherhoodDenialHistory,
  brotherhoods,
  fitnessChallenge,
  hurdleWallPosts,
  hurdleWallReplies,
  hurdleWallPrayers,
  userPrayerStats,
  type User,
  type UpsertUser,
  type Study,
  type InsertStudy,
  type Lesson,
  type InsertLesson,
  type Discussion,
  type InsertDiscussion,
  type DiscussionReply,
  type InsertDiscussionReply,
  type DiscussionSubscription,
  type InsertDiscussionSubscription,
  type UserProgress,
  type InsertUserProgress,
  type Devotional,
  type InsertDevotional,
  type StudyRating,
  type InsertStudyRating,
  type VideoRating,
  type InsertVideoRating,
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
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UserReport,
  type InsertUserReport,
  type UserSilence,
  type InsertUserSilence,
  type LogoSettings,
  type InsertLogoSettings,
  type HeaderLogoSettings,
  type InsertHeaderLogoSettings,
  type SystemSettings,
  type InsertSystemSettings,
  systemSettings,
  type Podcast,
  type InsertPodcast,
  podcasts,
  type PodcastRating,
  type InsertPodcastRating,
  podcastRatings,
  type PodcastView,
  type InsertPodcastView,
  podcastViews,
  videos,
  type Video,
  type InsertVideo,
  challenges,
  type Challenge,
  type InsertChallenge,
  type ContentFlag,
  type InsertContentFlag,
  type Testimony,
  type InsertTestimony,
  type BrotherhoodRequest,
  type InsertBrotherhoodRequest,
  type Brotherhood,
  type InsertBrotherhood,
  type BrotherhoodDenial,
  type InsertBrotherhoodDenial,
  type FitnessChallenge,
  type InsertFitnessChallenge,
  type HurdleWallPost,
  type InsertHurdleWallPost,
  type HurdleWallReply,
  type InsertHurdleWallReply,
  type HurdleWallPrayer,
  type InsertHurdleWallPrayer,
  type UserPrayerStats,
  type InsertUserPrayerStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, sql, ilike, count, inArray, not, gte, lte, isNull, isNotNull, lt } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Study operations
  getStudies(category?: string, requiredTier?: string, isAdmin?: boolean): Promise<Study[]>;
  getStudy(id: string): Promise<Study | undefined>;
  createStudy(study: InsertStudy, createdByUserId?: string): Promise<Study>;
  updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study>;
  deleteStudy(id: string): Promise<void>;
  searchStudies(query: string): Promise<Study[]>;
  getFeaturedStudy(): Promise<Study | null>;
  getRecommendedStudies(userId: string, limit?: number): Promise<Study[]>;
  
  // Progress operations
  getUserProgress(userId: string, studyId?: string): Promise<UserProgress[]>;
  updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress>;
  markLessonCompleted(userId: string, studyId: string, lessonNumber: number): Promise<UserProgress>;
  updateUserStreak(userId: string, userLocalDate?: Date): Promise<void>;
  getWeeklyStudyCompletions(userId: string): Promise<number>;
  
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
  
  // Discussion subscription operations
  subscribeToDiscussion(subscription: InsertDiscussionSubscription): Promise<DiscussionSubscription>;
  unsubscribeFromDiscussion(discussionId: string, userId: string): Promise<void>;
  isSubscribedToDiscussion(discussionId: string, userId: string): Promise<boolean>;
  getDiscussionSubscribers(discussionId: string): Promise<DiscussionSubscription[]>;
  
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
  getVideos(category?: string, requiredTier?: string, userTier?: string, sortBy?: string, limit?: number): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, video: Partial<Video>): Promise<Video>;
  deleteVideo(id: string): Promise<void>;
  updateVideoProcessingStatus(id: string, status: string, isProcessed?: boolean): Promise<Video>;
  
  // Video rating operations
  rateVideo(rating: InsertVideoRating): Promise<VideoRating>;
  getVideoReviews(videoId: string): Promise<(VideoRating & { user: { firstName: string | null; lastName: string | null; profileImageUrl?: string | null } })[]>;
  
  // Title validation
  checkTitleExists(title: string, excludeStudyId?: string, excludeVideoId?: string): Promise<boolean>;
  
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
  getUserConversations(userId: string, currentUserId?: string): Promise<(Conversation & { participants: (ConversationParticipant & { user: User })[] })[]>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  createGroupConversation(conversation: InsertConversation, participantIds: string[]): Promise<Conversation>;
  getConversationMessages(conversationId: string, limit?: number, currentUserId?: string): Promise<(Message & { user: User })[]>;
  sendMessage(message: InsertMessage): Promise<Message>;
  addParticipantToConversation(conversationId: string, userId: string, role?: string): Promise<ConversationParticipant>;
  removeParticipantFromConversation(conversationId: string, userId: string): Promise<void>;
  getConversationMessageSenders(conversationId: string): Promise<string[]>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;

  // Feedback operations
  sendFeedbackToAdmins(userId: string, feedback: string, category: string): Promise<void>;
  
  // Community stats
  getCommunityStats(): Promise<{
    totalMembers: number;
    activeToday: number;
    newPosts: number;
    categoryStats: { [key: string]: number };
  }>;
  
  // User profile operations
  getUserProfile(userId: string): Promise<{
    user: User;
    studiesCompleted: number;
    daysActive: number;
    forumPosts: number;
    memberSince: Date;
  } | undefined>;
  createUserReport(report: InsertUserReport): Promise<UserReport>;
  
  // Notification preferences operations
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  
  // User silence operations
  silenceUser(silencerId: string, silencedId: string): Promise<UserSilence>;
  unsilenceUser(silencerId: string, silencedId: string): Promise<void>;
  getUserSilences(userId: string): Promise<string[]>;
  isUserSilenced(silencerId: string, silencedId: string): Promise<boolean>;
  
  // Logo settings operations
  getLogoSettings(): Promise<LogoSettings | undefined>;
  updateLogoSettings(logoSettings: InsertLogoSettings): Promise<LogoSettings>;
  
  // Header logo settings operations
  getHeaderLogoSettings(): Promise<HeaderLogoSettings | undefined>;
  updateHeaderLogoSettings(headerLogoSettings: InsertHeaderLogoSettings): Promise<HeaderLogoSettings>;
  deleteHeaderLogoSettings(): Promise<void>;
  
  // System settings operations
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(systemSettings: InsertSystemSettings): Promise<SystemSettings>;
  
  // Podcast operations
  getPodcasts(options?: { search?: string; category?: string; sort?: string }): Promise<Podcast[]>;
  getAllPodcasts(): Promise<Podcast[]>;
  getPodcastById(id: string): Promise<Podcast | undefined>;
  createPodcast(podcast: InsertPodcast): Promise<Podcast>;
  updatePodcast(id: string, podcast: Partial<Podcast>): Promise<Podcast>;
  deletePodcast(id: string): Promise<void>;
  ratePodcast(userId: string, podcastId: string, rating: { rating: number; review?: string }): Promise<PodcastRating>;
  getPodcastRatings(podcastId: string): Promise<PodcastRating[]>;
  getUserPodcastRating(userId: string, podcastId: string): Promise<PodcastRating | undefined>;
  incrementPodcastViews(podcastId: string, userId?: string, ipAddress?: string): Promise<void>;
  // Live streaming operations
  startLiveStream(podcastId: string): Promise<Podcast>;
  endLiveStream(podcastId: string): Promise<Podcast>;
  getLiveStreams(): Promise<Podcast[]>;
  notifyLiveStreamStart(podcastId: string): Promise<void>;

  // Challenge operations
  getChallenges(): Promise<Challenge[]>;
  getChallengeById(id: string): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  updateChallenge(id: string, challenge: Partial<Challenge>): Promise<Challenge>;
  deleteChallenge(id: string): Promise<void>;
  getCurrentWeekChallenge(): Promise<Challenge | undefined>;
  pushChallengeToCurrentWeek(id: string): Promise<Challenge>;

  // Content flagging operations
  flagContent(flagData: InsertContentFlag): Promise<ContentFlag>;
  notifyAdminsOfFlag(flag: ContentFlag): Promise<void>;
  getAllFlags(): Promise<(ContentFlag & { reporter: { firstName: string; lastName: string } })[]>;
  updateFlagStatus(flagId: string, updateData: {
    status: string;
    reviewNotes?: string;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<ContentFlag>;

  // Honor system operations
  honorDiscussion(userId: string, discussionId: string): Promise<{ honored: boolean }>;
  honorReply(userId: string, replyId: string): Promise<{ honored: boolean }>;
  getUserHonorStatus(userId: string, discussionIds: string[], replyIds: string[]): Promise<{
    discussionHonors: string[];
    replyHonors: string[];
  }>;
  getUserHonorStats(userId: string): Promise<{
    honorsGiven: number;
    honorsReceived: number;
    discussionHonorsGiven: number;
    replyHonorsGiven: number;
    discussionHonorsReceived: number;
    replyHonorsReceived: number;
  }>;

  // Testimony operations
  getUserTestimony(userId: string): Promise<Testimony | undefined>;
  upsertTestimony(testimony: InsertTestimony): Promise<Testimony>;
  deleteTestimony(userId: string): Promise<void>;
  
  // Discipleship/Tag-based user discovery operations
  getAllTestimonyTags(): Promise<{ tag: string; count: number }[]>;
  getUsersWithPublicTestimonies(): Promise<{
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    testimonyTags: string[];
    tier: string;
  }[]>;
  
  // Brotherhood denial tracking operations
  getBrotherhoodDenial(requesterId: string, recipientId: string): Promise<BrotherhoodDenial | undefined>;
  upsertBrotherhoodDenial(denial: InsertBrotherhoodDenial): Promise<BrotherhoodDenial>;
  checkDenialCooldown(requesterId: string, recipientId: string): Promise<{
    inCooldown: boolean;
    daysRemaining?: number;
    denialCount: number;
    cooldownUntil?: Date;
  }>;
  
  // Hurdle Wall operations
  getHurdleWallPosts(): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    userHasPrayed?: boolean;
    replyCount: number;
  })[]>;
  getHurdleWallPost(postId: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
    userHasPrayed?: boolean;
  }) | undefined>;
  createHurdleWallPost(post: InsertHurdleWallPost): Promise<HurdleWallPost>;
  createHurdleWallReply(reply: InsertHurdleWallReply): Promise<HurdleWallReply>;
  prayForPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }>;
  removePrayerFromPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }>;
  getUserPrayerStats(userId: string): Promise<UserPrayerStats | undefined>;
  ensurePrayerStatsExist(userId: string): Promise<UserPrayerStats>;

  // Fitness Challenge operations
  getFitnessChallenges(): Promise<FitnessChallenge[]>;
  getAllFitnessChallenges(): Promise<FitnessChallenge[]>;
  getFitnessChallengeById(id: string): Promise<FitnessChallenge | undefined>;
  createFitnessChallenge(challenge: InsertFitnessChallenge): Promise<FitnessChallenge>;
  updateFitnessChallenge(id: string, updates: Partial<InsertFitnessChallenge>): Promise<FitnessChallenge>;
  deleteFitnessChallenge(id: string): Promise<void>;
  publishFitnessChallenge(id: string): Promise<FitnessChallenge>;
  getTodaysFitnessChallenge(): Promise<FitnessChallenge | null>;
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

  // Public method to check if title exists
  async checkTitleExists(title: string, excludeStudyId?: string, excludeVideoId?: string): Promise<boolean> {
    return this.checkTitleConflict(title, excludeStudyId, excludeVideoId);
  }
  
  // Helper method to check for title conflicts across studies and videos
  private async checkTitleConflict(title: string, excludeStudyId?: string, excludeVideoId?: string): Promise<boolean> {
    // Check if title exists in studies (excluding current study if updating)
    const studyConditions = [eq(studies.title, title)];
    if (excludeStudyId) {
      studyConditions.push(not(eq(studies.id, excludeStudyId)));
    }
    
    const studyConflict = await db
      .select({ id: studies.id })
      .from(studies)
      .where(and(...studyConditions))
      .limit(1);
    
    if (studyConflict.length > 0) return true;
    
    // Check if title exists in videos (excluding current video if updating)
    const videoConditions = [eq(videos.title, title)];
    if (excludeVideoId) {
      videoConditions.push(not(eq(videos.id, excludeVideoId)));
    }
    
    const videoConflict = await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(...videoConditions))
      .limit(1);
    
    return videoConflict.length > 0;
  }

  async createStudy(study: InsertStudy, createdByUserId?: string): Promise<Study> {
    // Check for title conflicts
    if (await this.checkTitleConflict(study.title)) {
      throw new Error(`Title "${study.title}" already exists. Please choose a different title.`);
    }
    const [newStudy] = await db.insert(studies).values(study).returning();
    
    // Create a discussion for this study using the admin who created it
    if (createdByUserId) {
      const discussionData: InsertDiscussion = {
        title: newStudy.title,
        content: `Welcome to the discussion for "${newStudy.title}". Share your thoughts, questions, and insights about this study here.`,
        category: newStudy.category || 'leadership',
        userId: createdByUserId,
        studyId: newStudy.id, // Link the discussion to the study
      };
      
      await this.createDiscussion(discussionData);
    }
    
    return newStudy;
  }

  async updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study> {
    // Check for title conflicts if title is being updated
    if (study.title && await this.checkTitleConflict(study.title, id)) {
      throw new Error(`Title "${study.title}" already exists. Please choose a different title.`);
    }
    
    // If marking this study as featured, unfeature all other studies first
    if (study.isFeatured === true) {
      await db
        .update(studies)
        .set({ isFeatured: false, updatedAt: new Date() })
        .where(and(eq(studies.isFeatured, true), not(eq(studies.id, id))));
    }
    
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

  // Lesson operations
  async getLesson(studyId: string, lessonNumber: number): Promise<Lesson | undefined> {
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.studyId, studyId), eq(lessons.lessonNumber, lessonNumber)));
    return lesson;
  }

  async getLessonsByStudy(studyId: string): Promise<Lesson[]> {
    return await db
      .select()
      .from(lessons)
      .where(eq(lessons.studyId, studyId))
      .orderBy(lessons.lessonNumber);
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  async updateLesson(id: string, lesson: Partial<InsertLesson>): Promise<Lesson> {
    const [updatedLesson] = await db
      .update(lessons)
      .set(lesson)
      .where(eq(lessons.id, id))
      .returning();
    return updatedLesson;
  }

  async deleteLesson(id: string): Promise<void> {
    await db.delete(lessons).where(eq(lessons.id, id));
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

  async getRecommendedStudies(userId: string, limit: number = 3): Promise<Study[]> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return [];
    
    const userTier = user.subscriptionTier || 'free';
    
    // Get user's completed studies to understand their interests
    const completedProgress = await db
      .select({ category: studies.category })
      .from(userProgress)
      .innerJoin(studies, eq(userProgress.studyId, studies.id))
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.isCompleted, true)
      ));
    
    const studiedCategories = Array.from(new Set(completedProgress.map(p => p.category)));
    
    // Determine tier progression for recommendations
    const getTierRecommendations = async () => {
      const tierOrder = ['free', 'premium', 'vip'];
      const currentTierIndex = tierOrder.indexOf(userTier);
      const nextTier = currentTierIndex < tierOrder.length - 1 ? tierOrder[currentTierIndex + 1] : null;
      
      let recommendations: Study[] = [];
      
      // Get studies from current tier (2 studies)
      const currentTierStudies = await db
        .select()
        .from(studies)
        .where(and(
          eq(studies.isPublished, true),
          eq(studies.requiredTier, userTier),
          studiedCategories.length > 0 ? inArray(studies.category, studiedCategories) : sql`1=1`
        ))
        .orderBy(desc(studies.rating), desc(studies.createdAt))
        .limit(2);
      
      recommendations.push(...currentTierStudies);
      
      // Get 1 study from next tier if available
      if (nextTier && recommendations.length < limit) {
        const nextTierStudies = await db
          .select()
          .from(studies)
          .where(and(
            eq(studies.isPublished, true),
            eq(studies.requiredTier, nextTier),
            studiedCategories.length > 0 ? inArray(studies.category, studiedCategories) : sql`1=1`
          ))
          .orderBy(desc(studies.rating), desc(studies.createdAt))
          .limit(1);
        
        recommendations.push(...nextTierStudies);
      }
      
      // If we still need more recommendations and no next tier, fill from highest available tier
      if (recommendations.length < limit) {
        const highestTier = userTier === 'vip' ? 'vip' : (userTier === 'premium' ? 'premium' : 'free');
        const additionalStudies = await db
          .select()
          .from(studies)
          .where(and(
            eq(studies.isPublished, true),
            eq(studies.requiredTier, highestTier),
            studiedCategories.length > 0 ? inArray(studies.category, studiedCategories) : sql`1=1`,
            recommendations.length > 0 ? not(inArray(studies.id, recommendations.map(s => s.id))) : sql`1=1` // Exclude already selected
          ))
          .orderBy(desc(studies.rating), desc(studies.createdAt))
          .limit(limit - recommendations.length);
        
        recommendations.push(...additionalStudies);
      }
      
      return recommendations;
    };
    
    // If user has no completed studies, get top-rated studies across all categories
    if (studiedCategories.length === 0) {
      const topRatedStudies = await getTierRecommendations();
      if (topRatedStudies.length > 0) {
        return topRatedStudies.slice(0, limit);
      }
      
      // Fallback: get any published studies with tier logic
      return await db
        .select()
        .from(studies)
        .where(and(
          eq(studies.isPublished, true),
          or(
            eq(studies.requiredTier, userTier),
            eq(studies.requiredTier, 'free')
          )
        ))
        .orderBy(desc(studies.rating), desc(studies.createdAt))
        .limit(limit);
    }
    
    // Get recommendations based on studied categories + tier logic
    const categoryBasedRecs = await getTierRecommendations();
    return categoryBasedRecs.slice(0, limit);
  }

  // Progress operations
  async getUserProgress(userId: string, studyId?: string): Promise<(UserProgress & { study: Study | null })[]> {
    const conditions = [eq(userProgress.userId, userId)];
    
    if (studyId) {
      conditions.push(eq(userProgress.studyId, studyId));
    }
    
    return await db
      .select({
        id: userProgress.id,
        userId: userProgress.userId,
        studyId: userProgress.studyId,
        currentLesson: userProgress.currentLesson,
        completedLessons: userProgress.completedLessons,
        isCompleted: userProgress.isCompleted,
        lastAccessedAt: userProgress.lastAccessedAt,
        completedAt: userProgress.completedAt,
        createdAt: userProgress.createdAt,
        study: studies,
      })
      .from(userProgress)
      .leftJoin(studies, eq(userProgress.studyId, studies.id))
      .where(and(...conditions))
      .orderBy(desc(userProgress.lastAccessedAt));
  }

  async updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>, userLocalDate?: Date): Promise<UserProgress> {
    // Update user streak when they make progress
    await this.updateUserStreak(userId, userLocalDate);
    
    const existing = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)));

    // Prepare update data
    const updateData = { ...progress, lastAccessedAt: new Date() };
    
    // Set completedAt timestamp when marking study as completed for the first time
    if (progress.isCompleted === true) {
      if (existing.length > 0 && !existing[0].completedAt) {
        // Only set completedAt if it's not already set (preserve original completion date)
        updateData.completedAt = new Date();
      } else if (existing.length === 0) {
        // New progress record being created as completed
        updateData.completedAt = new Date();
      }
    }

    if (existing.length > 0) {
      const [updated] = await db
        .update(userProgress)
        .set(updateData)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)))
        .returning();
      return updated;
    } else {
      const [newProgress] = await db
        .insert(userProgress)
        .values({
          userId,
          studyId,
          ...updateData,
        })
        .returning();
      return newProgress;
    }
  }

  async markLessonCompleted(userId: string, studyId: string, lessonNumber: number): Promise<UserProgress> {
    // Get current progress
    const existingProgress = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)));
    
    // Get total lessons for this study
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    if (!study) {
      throw new Error('Study not found');
    }
    
    const totalLessons = study.lessonCount || 1;
    const currentProgress = existingProgress[0];
    const currentCompletedLessons = currentProgress?.completedLessons || 0;
    const newCompletedLessons = Math.max(currentCompletedLessons, lessonNumber);
    const newCurrentLesson = Math.min(lessonNumber + 1, totalLessons);
    const isCompleted = newCompletedLessons >= totalLessons;
    
    // Update user streak when they complete a lesson
    await this.updateUserStreak(userId);
    
    const updateData = {
      currentLesson: newCurrentLesson,
      completedLessons: newCompletedLessons,
      isCompleted,
      lastAccessedAt: new Date(),
      completedAt: isCompleted ? new Date() : currentProgress?.completedAt || null,
    };
    
    if (existingProgress.length > 0) {
      const [updated] = await db
        .update(userProgress)
        .set(updateData)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)))
        .returning();
      return updated;
    } else {
      const [newProgress] = await db
        .insert(userProgress)
        .values({
          userId,
          studyId,
          ...updateData,
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
  async getDiscussions(category?: string, limit = 20, sortBy = 'recent', searchTerm?: string, currentUserId?: string): Promise<(Discussion & { user: User; study?: { id: string; title: string; requiredTier: string | null } | null })[]> {
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
      if (category === 'studies') {
        // Special filter for study discussions
        conditions.push(sql`${discussions.studyId} IS NOT NULL`);
      } else {
        // Regular category filter
        conditions.push(eq(discussions.category, category));
      }
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
    
    // Filter out silenced users if currentUserId is provided
    if (currentUserId) {
      const silencedUserIds = await this.getUserSilences(currentUserId);
      if (silencedUserIds.length > 0) {
        conditions.push(not(inArray(discussions.userId, silencedUserIds)));
      }
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

  async getDiscussion(id: string, currentUserId?: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[]; study?: { id: string; title: string; requiredTier: string | null } | null }) | undefined> {
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

    // Get replies, filtering out silenced users if currentUserId is provided
    let repliesQuery = db
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
      .innerJoin(users, eq(discussionReplies.userId, users.id));

    const replyConditions = [eq(discussionReplies.discussionId, id)];
    
    // Filter out silenced users from replies if currentUserId is provided
    if (currentUserId) {
      const silencedUserIds = await this.getUserSilences(currentUserId);
      if (silencedUserIds.length > 0) {
        replyConditions.push(not(inArray(discussionReplies.userId, silencedUserIds)));
      }
    }

    const replies = await repliesQuery
      .where(and(...replyConditions))
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

  async getDiscussionReplies(discussionId: string, currentUserId?: string): Promise<(DiscussionReply & { user: User })[]> {
    const replyConditions = [eq(discussionReplies.discussionId, discussionId)];
    
    // Filter out silenced users from replies if currentUserId is provided
    if (currentUserId) {
      const silencedUserIds = await this.getUserSilences(currentUserId);
      if (silencedUserIds.length > 0) {
        replyConditions.push(not(inArray(discussionReplies.userId, silencedUserIds)));
      }
    }

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
      .where(and(...replyConditions))
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

  // Discussion subscription operations
  async subscribeToDiscussion(subscription: InsertDiscussionSubscription): Promise<DiscussionSubscription> {
    // Check if subscription already exists
    const [existingSubscription] = await db
      .select()
      .from(discussionSubscriptions)
      .where(and(
        eq(discussionSubscriptions.userId, subscription.userId),
        eq(discussionSubscriptions.discussionId, subscription.discussionId)
      ));

    if (existingSubscription) {
      // Update existing subscription to be active
      const [updated] = await db
        .update(discussionSubscriptions)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(discussionSubscriptions.id, existingSubscription.id))
        .returning();
      return updated;
    }

    // Create new subscription
    const [newSubscription] = await db
      .insert(discussionSubscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async unsubscribeFromDiscussion(discussionId: string, userId: string): Promise<void> {
    await db
      .update(discussionSubscriptions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(discussionSubscriptions.userId, userId),
        eq(discussionSubscriptions.discussionId, discussionId)
      ));
  }

  async isSubscribedToDiscussion(discussionId: string, userId: string): Promise<boolean> {
    const [subscription] = await db
      .select()
      .from(discussionSubscriptions)
      .where(and(
        eq(discussionSubscriptions.userId, userId),
        eq(discussionSubscriptions.discussionId, discussionId),
        eq(discussionSubscriptions.isActive, true)
      ));
    
    return !!subscription;
  }

  async getDiscussionSubscribers(discussionId: string): Promise<DiscussionSubscription[]> {
    return await db
      .select()
      .from(discussionSubscriptions)
      .where(and(
        eq(discussionSubscriptions.discussionId, discussionId),
        eq(discussionSubscriptions.isActive, true)
      ));
  }

  // Devotional operations
  async getTodaysDevotional(): Promise<Devotional | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // First try to get exact today's devotional
    const [todayDevotional] = await db
      .select()
      .from(devotionals)
      .where(and(
        sql`${devotionals.date} >= ${today}`,
        sql`${devotionals.date} < ${tomorrow}`
      ))
      .limit(1);

    if (todayDevotional) {
      return todayDevotional;
    }

    // If no devotional for today, get the most recent one
    const [recentDevotional] = await db
      .select()
      .from(devotionals)
      .orderBy(desc(devotionals.date))
      .limit(1);

    return recentDevotional;
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

  async getAvailableDevotionalsWithoutNotifications(): Promise<Devotional[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db
      .select()
      .from(devotionals)
      .where(and(
        sql`${devotionals.date} <= ${today}`,
        eq(devotionals.notificationsSent, false)
      ));
  }

  async markDevotionalNotificationsSent(id: string): Promise<void> {
    await db
      .update(devotionals)
      .set({ notificationsSent: true })
      .where(eq(devotionals.id, id));
  }

  // Streak operations
  async updateUserStreak(userId: string, userLocalDate?: Date): Promise<void> {
    // Use user's local date for streak calculation
    const localToday = userLocalDate || new Date();
    
    // Create date strings in YYYY-MM-DD format for reliable comparison
    // This avoids timezone conversion issues by only comparing date parts
    const todayDateString = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
    
    console.log('=== STREAK UPDATE ===');
    console.log('User:', userId);
    console.log('User provided date:', userLocalDate?.toISOString());
    console.log('User local time:', localToday.toString());
    console.log('Today date string:', todayDateString);
    
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Current streak:', user.streakDays);
    console.log('Last active (database):', user.lastActiveDate);
    
    if (user.lastActiveDate) {
      // Convert stored date to local date string for comparison
      const lastActiveDate = new Date(user.lastActiveDate);
      // Use the local timezone to get the correct date components
      const lastActiveDateString = `${lastActiveDate.getFullYear()}-${String(lastActiveDate.getMonth() + 1).padStart(2, '0')}-${String(lastActiveDate.getDate()).padStart(2, '0')}`;
      
      console.log('Last active date string:', lastActiveDateString);
      console.log('Comparing dates:');
      console.log('  Today:', todayDateString);
      console.log('  Last Active:', lastActiveDateString);
      console.log('  Same day?', lastActiveDateString === todayDateString);
      
      // Check if last active was today (local time)
      if (lastActiveDateString === todayDateString) {
        // Already counted today, no update needed
        console.log('✓ Already counted today - no update');
        return;
      }
      
      // Calculate yesterday's date string
      const yesterdayDate = new Date(localToday);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayDateString = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
      
      console.log('Yesterday date string:', yesterdayDateString);
      console.log('Was active yesterday?', lastActiveDateString === yesterdayDateString);
      
      if (lastActiveDateString === yesterdayDateString) {
        // Consecutive day - increment streak
        const newStreak = (user.streakDays || 0) + 1;
        console.log('✓ Consecutive day - incrementing streak:', user.streakDays, '->', newStreak);
        await db
          .update(users)
          .set({ 
            streakDays: newStreak,
            lastActiveDate: localToday 
          })
          .where(eq(users.id, userId));
        console.log('✓ Streak updated in database');
      } else {
        // Gap in activity - reset streak to 1
        console.log('✓ Gap in activity - resetting streak to 1');
        await db
          .update(users)
          .set({ 
            streakDays: 1,
            lastActiveDate: localToday 
          })
          .where(eq(users.id, userId));
        console.log('✓ Streak reset in database');
      }
    } else {
      // First time active - start streak
      console.log('✓ First time active - starting streak at 1');
      await db
        .update(users)
        .set({ 
          streakDays: 1,
          lastActiveDate: localToday 
        })
        .where(eq(users.id, userId));
      console.log('✓ First streak set in database');
    }
    console.log('=== END STREAK UPDATE ===');
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
    
    // Count active users today (same as community stats)
    const [{ activeToday }] = await db
      .select({ activeToday: count(users.id) })
      .from(users)
      .where(sql`DATE(${users.lastActiveDate}) = DATE(${today})`);

    // Count new discussions created today
    const [{ newDiscussions }] = await db
      .select({ newDiscussions: count(discussions.id) })
      .from(discussions)
      .where(sql`${discussions.createdAt} >= ${today}`);

    // Count new discussion replies created today
    const [{ newReplies }] = await db
      .select({ newReplies: count(discussionReplies.id) })
      .from(discussionReplies)
      .where(sql`${discussionReplies.createdAt} >= ${today}`);

    // Total new posts = new discussions + new replies (same as community stats)
    const newPosts = newDiscussions + newReplies;

    return {
      totalUsers,
      totalStudies,
      activeToday,
      newPosts,
    };
  }

  // Messaging operations
  async getUserConversations(userId: string, currentUserId?: string): Promise<(Conversation & { participants: (ConversationParticipant & { user: User })[] })[]> {
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

    // Get participants for each conversation and filter silenced users
    const conversationsWithParticipants = await Promise.all(
      userConversations.map(async (conversation) => {
        let participants = await db
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

        // Filter out silenced participants from view if currentUserId is provided
        if (currentUserId) {
          const silencedUserIds = await this.getUserSilences(currentUserId);
          if (silencedUserIds.length > 0) {
            participants = participants.filter(participant => 
              !silencedUserIds.includes(participant.userId)
            );
          }
        }

        return { ...conversation, participants };
      })
    );

    // Filter out direct conversations where the other participant is silenced
    const filteredConversations = await Promise.all(
      conversationsWithParticipants.map(async (conversation) => {
        if (conversation.type === 'direct' && currentUserId) {
          const silencedUserIds = await this.getUserSilences(currentUserId);
          const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId);
          
          // Hide conversation if other participant is silenced
          if (otherParticipant && silencedUserIds.includes(otherParticipant.userId)) {
            return null;
          }
        }
        return conversation;
      })
    );

    return filteredConversations.filter(conv => conv !== null) as (Conversation & { participants: (ConversationParticipant & { user: User })[] })[];
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

  async getConversationMessages(conversationId: string, limit = 50, currentUserId?: string): Promise<(Message & { user: User })[]> {
    const messageConditions = [eq(messages.conversationId, conversationId)];
    
    // Filter out messages from silenced users if currentUserId is provided
    if (currentUserId) {
      const silencedUserIds = await this.getUserSilences(currentUserId);
      if (silencedUserIds.length > 0) {
        messageConditions.push(not(inArray(messages.userId, silencedUserIds)));
      }
    }

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
      .where(and(...messageConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

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

  async createMessageWithoutNotifications(message: InsertMessage): Promise<Message> {
    // Same as sendMessage but specifically for cases where we don't want notifications
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

  async getConversationMessageSenders(conversationId: string): Promise<string[]> {
    const senders = await db
      .selectDistinct({ userId: messages.userId })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    
    return senders.map(sender => sender.userId);
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

  // Notification preferences operations
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return preferences || null;
  }

  async createDefaultNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const [newPreferences] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning();
    return newPreferences;
  }

  async updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences | null> {
    const [updatedPreferences] = await db
      .update(notificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return updatedPreferences || null;
  }

  async getOrCreateNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.getUserNotificationPreferences(userId);
    if (!preferences) {
      preferences = await this.createDefaultNotificationPreferences(userId);
    }
    return preferences;
  }

  // Helper function to check if user wants to receive a specific type of notification
  async shouldReceiveNotification(userId: string, notificationType: string): Promise<boolean> {
    // Admin notifications cannot be disabled
    if (notificationType === 'admin') {
      return true;
    }

    const preferences = await this.getOrCreateNotificationPreferences(userId);
    
    // Map notification types to preference fields
    switch (notificationType) {
      case 'study':
      case 'new_study':
        return preferences.studyNotifications ?? true;
      case 'devotional':
      case 'new_devotional':
        return preferences.devotionalNotifications ?? true;
      case 'discussion':
      case 'new_discussion':
        return preferences.discussionNotifications ?? true;
      case 'discussion_reply':
        return preferences.discussionReplyNotifications ?? true;
      case 'message':
      case 'new_message':
      case 'message_request':
      case 'group_message':
        return preferences.messageNotifications ?? true;
      case 'video':
      case 'new_video':
        return preferences.videoNotifications ?? true;
      case 'community':
        return preferences.communityNotifications ?? true;
      case 'live_stream':
        return preferences.liveStreamNotifications ?? true;
      default:
        // For unknown types, default to true (send notification)
        return true;
    }
  }

  // Enhanced createNotification that checks preferences
  async createNotificationWithPreferences(notification: InsertNotification): Promise<Notification | null> {
    const shouldSend = await this.shouldReceiveNotification(notification.userId, notification.type);
    
    if (!shouldSend) {
      console.log(`Skipping notification for user ${notification.userId} - type ${notification.type} disabled in preferences`);
      return null;
    }
    
    return this.createNotification(notification);
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
  async getVideos(category?: string, requiredTier?: string, userTier?: string, sortBy?: string, limit?: number): Promise<Video[]> {
    const conditions = [];
    
    // Filter by category
    if (category && category !== 'all') {
      conditions.push(eq(videos.category, category));
    }
    
    // Filter by user tier access
    if (userTier) {
      const tierHierarchy: { [key: string]: string[] } = {
        'free': ['free'],
        'premium': ['free', 'premium'], 
        'vip': ['free', 'premium', 'vip']
      };
      const allowedTiers = tierHierarchy[userTier] || ['free'];
      conditions.push(inArray(videos.requiredTier, allowedTiers));
    }
    
    // Build order by clauses - always prioritize featured videos first
    let orderClauses;
    switch (sortBy) {
      case 'rating':
        orderClauses = [desc(videos.isFeatured), desc(videos.rating), desc(videos.ratingCount)];
        break;
      case 'reviews':
        orderClauses = [desc(videos.isFeatured), desc(videos.ratingCount)];
        break;
      default: // 'recent'
        orderClauses = [desc(videos.isFeatured), desc(videos.createdAt)];
        break;
    }
    
    // Build final query
    const baseQuery = db.select().from(videos);
    
    if (conditions.length > 0 && limit) {
      return await baseQuery.where(and(...conditions)).orderBy(...orderClauses).limit(limit);
    } else if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)).orderBy(...orderClauses);
    } else if (limit) {
      return await baseQuery.orderBy(...orderClauses).limit(limit);
    } else {
      return await baseQuery.orderBy(...orderClauses);
    }
  }

  async getVideosByUserTier(userTier: string, limit?: number): Promise<Video[]> {
    // Define tier hierarchy: free < premium < vip
    const tierHierarchy: { [key: string]: string[] } = {
      'free': ['free'],
      'premium': ['free', 'premium'], 
      'vip': ['free', 'premium', 'vip']
    };
    
    const allowedTiers = tierHierarchy[userTier] || ['free'];
    
    const query = db
      .select()
      .from(videos)
      .where(inArray(videos.requiredTier, allowedTiers))
      .orderBy(desc(videos.createdAt));
    
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
    // Check for title conflicts
    if (await this.checkTitleConflict(video.title)) {
      throw new Error(`Title "${video.title}" already exists. Please choose a different title.`);
    }
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async updateVideo(id: string, video: Partial<Video>): Promise<Video> {
    // Check for title conflicts if title is being updated
    if (video.title && await this.checkTitleConflict(video.title, undefined, id)) {
      throw new Error(`Title "${video.title}" already exists. Please choose a different title.`);
    }
    
    // If marking this video as featured, unfeature all other videos first
    if (video.isFeatured === true) {
      await db
        .update(videos)
        .set({ isFeatured: false, updatedAt: new Date() })
        .where(and(eq(videos.isFeatured, true), not(eq(videos.id, id))));
    }
    
    const updateData = {
      ...video,
      updatedAt: new Date()
    };
    
    // Remove fields that shouldn't be updated
    delete (updateData as any).id;
    delete (updateData as any).createdAt;
    delete (updateData as any).uploadedBy;
    delete (updateData as any).filename;
    delete (updateData as any).originalName;
    delete (updateData as any).mimeType;
    delete (updateData as any).fileSize;
    
    const [updatedVideo] = await db
      .update(videos)
      .set(updateData)
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

  // Brotherhood methods
  async createBrotherhoodRequest(request: InsertBrotherhoodRequest): Promise<BrotherhoodRequest> {
    const [newRequest] = await db.insert(brotherhoodRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getBrotherhoodRequests(userId: string): Promise<any[]> {
    // Get both incoming (where user is recipient) and outgoing (where user is requester) requests
    return await db.select({
      id: brotherhoodRequests.id,
      requesterId: brotherhoodRequests.requesterId,
      recipientId: brotherhoodRequests.recipientId,
      status: brotherhoodRequests.status,
      message: brotherhoodRequests.message,
      createdAt: brotherhoodRequests.createdAt,
      updatedAt: brotherhoodRequests.updatedAt,
      requester: users,
    })
      .from(brotherhoodRequests)
      .innerJoin(users, eq(brotherhoodRequests.requesterId, users.id))
      .where(and(
        or(
          eq(brotherhoodRequests.recipientId, userId), // incoming requests
          eq(brotherhoodRequests.requesterId, userId)  // outgoing requests
        ),
        eq(brotherhoodRequests.status, 'pending')
      ))
      .orderBy(desc(brotherhoodRequests.createdAt));
  }

  async respondToBrotherhoodRequest(requestId: string, response: 'approved' | 'denied'): Promise<BrotherhoodRequest> {
    // Get the request details before deleting it
    const [request] = await db.select()
      .from(brotherhoodRequests)
      .where(eq(brotherhoodRequests.id, requestId))
      .limit(1);
    
    if (!request) {
      throw new Error('Brotherhood request not found');
    }
    
    // Delete the request from the table (no longer needed after response)
    // The outcome is tracked elsewhere: 
    // - Approved: brotherhood relationship in brothers table
    // - Denied: denial count in brotherhood_denials table
    await db.delete(brotherhoodRequests)
      .where(eq(brotherhoodRequests.id, requestId));
    
    // Return the original request with updated status for API response
    return {
      ...request,
      status: response,
      updatedAt: new Date()
    };
  }

  async createBrotherhood(userId1: string, userId2: string): Promise<Brotherhood> {
    // Ensure consistent ordering (lower ID first)
    const sortedIds = [userId1, userId2].sort();
    const [newBrotherhood] = await db.insert(brotherhoods)
      .values({
        userId1: sortedIds[0],
        userId2: sortedIds[1],
      })
      .returning();
    return newBrotherhood;
  }

  async getUserBrothers(userId: string): Promise<(User & { tag?: string; brotherhoodId: string })[]> {
    const brotherRelations = await db.select({
      brotherId: sql<string>`CASE 
        WHEN ${brotherhoods.userId1} = ${userId} THEN ${brotherhoods.userId2}
        ELSE ${brotherhoods.userId1}
      END`.as('brotherId'),
      tag: sql<string>`CASE 
        WHEN ${brotherhoods.userId1} = ${userId} THEN ${brotherhoods.tagFromUser1}
        ELSE ${brotherhoods.tagFromUser2}
      END`.as('tag'),
      brotherhoodId: brotherhoods.id,
      createdAt: brotherhoods.createdAt,
    })
      .from(brotherhoods)
      .where(or(eq(brotherhoods.userId1, userId), eq(brotherhoods.userId2, userId)));

    if (brotherRelations.length === 0) {
      return [];
    }

    const brotherIds = brotherRelations.map(r => r.brotherId);
    const brothers = await db.select()
      .from(users)
      .where(inArray(users.id, brotherIds));

    // Add the tag and brotherhood info from the relationship
    return brothers.map(brother => ({
      ...brother,
      tag: brotherRelations.find(r => r.brotherId === brother.id)?.tag || undefined,
      brotherhoodId: brotherRelations.find(r => r.brotherId === brother.id)?.brotherhoodId || '',
      createdAt: brotherRelations.find(r => r.brotherId === brother.id)?.createdAt || brother.createdAt,
    })) as (User & { tag?: string; brotherhoodId: string })[];
  }

  async updateBrotherhoodTag(brotherhoodId: string, userId: string, tag: string | null): Promise<void> {
    // First, get the brotherhood to determine which field to update
    const [brotherhood] = await db.select()
      .from(brotherhoods)
      .where(eq(brotherhoods.id, brotherhoodId))
      .limit(1);

    if (!brotherhood) {
      throw new Error('Brotherhood not found');
    }

    // Determine which tag field to update based on the user
    const updateField = brotherhood.userId1 === userId ? 'tagFromUser1' : 'tagFromUser2';
    
    await db.update(brotherhoods)
      .set({
        [updateField]: tag,
        updatedAt: new Date(),
      } as any)
      .where(eq(brotherhoods.id, brotherhoodId));
  }

  async getBrotherhood(brotherhoodId: string): Promise<any> {
    const [brotherhood] = await db.select()
      .from(brotherhoods)
      .where(eq(brotherhoods.id, brotherhoodId))
      .limit(1);
    return brotherhood;
  }

  async removeBrotherhood(brotherhoodId: string): Promise<void> {
    await db.delete(brotherhoods)
      .where(eq(brotherhoods.id, brotherhoodId));
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const searchResults = await db.select()
      .from(users)
      .where(
        and(
          not(eq(users.id, excludeUserId)), // Exclude current user
          or(
            sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
            sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
            sql`LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE ${searchTerm}`
          )
        )
      )
      .limit(10)
      .orderBy(users.firstName, users.lastName);

    return searchResults;
  }

  async checkBrotherhoodExists(userId1: string, userId2: string): Promise<boolean> {
    const sortedIds = [userId1, userId2].sort();
    const [existing] = await db.select()
      .from(brotherhoods)
      .where(and(
        eq(brotherhoods.userId1, sortedIds[0]),
        eq(brotherhoods.userId2, sortedIds[1])
      ))
      .limit(1);
    return !!existing;
  }

  async checkBrotherhoodRequestExists(requesterId: string, recipientId: string): Promise<boolean> {
    // Check for requests in both directions
    const [existing] = await db.select()
      .from(brotherhoodRequests)
      .where(and(
        or(
          and(
            eq(brotherhoodRequests.requesterId, requesterId),
            eq(brotherhoodRequests.recipientId, recipientId)
          ),
          and(
            eq(brotherhoodRequests.requesterId, recipientId),
            eq(brotherhoodRequests.recipientId, requesterId)
          )
        ),
        eq(brotherhoodRequests.status, 'pending')
      ))
      .limit(1);
    return !!existing;
  }

  async getLastDeniedRequest(requesterId: string, recipientId: string): Promise<BrotherhoodRequest | undefined> {
    const [lastDenied] = await db.select()
      .from(brotherhoodRequests)
      .where(and(
        eq(brotherhoodRequests.requesterId, requesterId),
        eq(brotherhoodRequests.recipientId, recipientId),
        eq(brotherhoodRequests.status, 'denied')
      ))
      .orderBy(desc(brotherhoodRequests.updatedAt))
      .limit(1);
    return lastDenied;
  }

  async canSendBrotherhoodRequest(requesterId: string, recipientId: string): Promise<{
    canSend: boolean;
    reason?: string;
    requiresConfirmation?: boolean;
    lastDenied?: Date;
    cooldownUntil?: Date;
  }> {
    // Check if they're already brothers
    const alreadyBrothers = await this.checkBrotherhoodExists(requesterId, recipientId);
    if (alreadyBrothers) {
      return { canSend: false, reason: "You are already brothers with this user" };
    }

    // Check for pending requests
    const pendingRequest = await this.checkBrotherhoodRequestExists(requesterId, recipientId);
    if (pendingRequest) {
      return { canSend: false, reason: "Brotherhood request already sent or pending" };
    }

    // Check for previous denied requests using the new denial tracking table
    const denialCheck = await this.checkDenialCooldown(requesterId, recipientId);
    
    if (denialCheck.inCooldown) {
      return {
        canSend: false,
        reason: `The recipient has denied this request three times. You must wait ${denialCheck.daysRemaining} more days before sending another.`,
        cooldownUntil: denialCheck.cooldownUntil
      };
    } else if (denialCheck.denialCount >= 1 && denialCheck.denialCount <= 2) {
      // 1-2 previous denials - require confirmation
      // Get the last denial date from the brotherhood_denials table
      const [denialRecord] = await db.select()
        .from(brotherhoodDenials)
        .where(and(
          eq(brotherhoodDenials.requesterId, requesterId),
          eq(brotherhoodDenials.recipientId, recipientId)
        ))
        .limit(1);
      
      return {
        canSend: true,
        requiresConfirmation: true,
        denialCount: denialCheck.denialCount,
        lastDenied: denialRecord?.lastDenialAt
      };
    }

    // No previous interactions - can send freely
    return { canSend: true };
  }

  async getBrotherhoodRequest(requestId: string): Promise<BrotherhoodRequest | undefined> {
    const [request] = await db.select()
      .from(brotherhoodRequests)
      .where(eq(brotherhoodRequests.id, requestId))
      .limit(1);
    return request;
  }

  // Video rating operations
  async rateVideo(rating: InsertVideoRating): Promise<VideoRating> {
    // Check if user has already rated this video
    const existingRating = await db
      .select()
      .from(videoRatings)
      .where(and(eq(videoRatings.userId, rating.userId), eq(videoRatings.videoId, rating.videoId)))
      .limit(1);

    let videoRating: VideoRating;
    
    if (existingRating.length > 0) {
      // Update existing rating
      [videoRating] = await db
        .update(videoRatings)
        .set({ rating: rating.rating, review: rating.review })
        .where(eq(videoRatings.id, existingRating[0].id))
        .returning();
    } else {
      // Create new rating
      [videoRating] = await db
        .insert(videoRatings)
        .values(rating)
        .returning();
    }

    // Update video's average rating and count
    const ratingStats = await db
      .select({
        avgRating: sql<number>`AVG(${videoRatings.rating})::numeric`,
        count: count(videoRatings.id)
      })
      .from(videoRatings)
      .where(eq(videoRatings.videoId, rating.videoId))
      .groupBy(videoRatings.videoId);

    if (ratingStats.length > 0) {
      const avgRating = parseFloat(ratingStats[0].avgRating.toString());
      await db
        .update(videos)
        .set({
          rating: avgRating.toFixed(1),
          ratingCount: ratingStats[0].count,
          updatedAt: new Date()
        })
        .where(eq(videos.id, rating.videoId));
    }

    return videoRating;
  }

  async getVideoReviews(videoId: string): Promise<(VideoRating & { user: { firstName: string | null; lastName: string | null; profileImageUrl?: string | null } })[]> {
    return await db
      .select({
        id: videoRatings.id,
        userId: videoRatings.userId,
        videoId: videoRatings.videoId,
        rating: videoRatings.rating,
        review: videoRatings.review,
        createdAt: videoRatings.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(videoRatings)
      .innerJoin(users, eq(videoRatings.userId, users.id))
      .where(eq(videoRatings.videoId, videoId))
      .orderBy(desc(videoRatings.createdAt));
  }

  async sendFeedbackToAdmins(userId: string, feedback: string, category: string): Promise<void> {
    // Get the user who is sending feedback
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all admin and VIP users
    const adminsAndVips = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.subscriptionTier, 'vip')));

    if (adminsAndVips.length === 0) {
      throw new Error("No admin users found to send feedback to");
    }

    // Look for existing feedback conversation
    let feedbackConversation = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.name, 'Feedback & Suggestions'), eq(conversations.type, 'group')))
      .limit(1);

    // Create feedback conversation if it doesn't exist
    if (feedbackConversation.length === 0) {
      const [createdConversation] = await db
        .insert(conversations)
        .values({
          name: 'Feedback & Suggestions',
          type: 'group',
          createdBy: adminsAndVips[0].id, // First admin creates the conversation
        })
        .returning();

      // Add all admins and VIP users as participants
      for (const adminUser of adminsAndVips) {
        await db.insert(conversationParticipants).values({
          conversationId: createdConversation.id,
          userId: adminUser.id,
          role: adminUser.role === 'admin' ? 'admin' : 'member',
        });
      }

      feedbackConversation = [createdConversation];
    }

    // Format the feedback message
    const categoryEmojis: Record<string, string> = {
      'improvement': '💡',
      'feature-request': '✨',
      'bug-report': '🐛',
      'compliment': '👏',
      'complaint': '⚠️',
      'general': '💬'
    };

    const emoji = categoryEmojis[category] || '💬';
    const messageContent = `${emoji} **${category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Feedback**\n\n**From:** ${user.firstName} ${user.lastName} (${user.email})\n\n**Message:**\n${feedback}`;

    // Send the feedback message to the group
    await db.insert(messages).values({
      conversationId: feedbackConversation[0].id,
      userId: userId, // Message appears as sent by the user
      content: messageContent,
      messageType: 'text',
    });

    // Send notifications to all admins and VIP users about the new feedback
    const categoryLabels: Record<string, string> = {
      'improvement': 'Improvement Suggestion',
      'feature-request': 'Feature Request',
      'bug-report': 'Bug Report',
      'compliment': 'Compliment',
      'complaint': 'Issue/Complaint',
      'general': 'General Feedback'
    };

    const categoryLabel = categoryLabels[category] || 'Feedback';
    const notificationTitle = `New ${categoryLabel}`;
    const notificationContent = `${user.firstName} ${user.lastName} submitted: ${categoryLabel.toLowerCase()}`;

    // Create notifications for all admins and VIP users
    for (const adminUser of adminsAndVips) {
      // Don't send notification to the user who sent the feedback
      if (adminUser.id !== userId) {
        await db.insert(notifications).values({
          userId: adminUser.id,
          title: notificationTitle,
          message: notificationContent,
          type: 'message',
          relatedId: feedbackConversation[0].id, // Link to the feedback conversation
          isRead: false,
        });
      }
    }
  }

  // Community stats for public use
  async getCommunityStats(): Promise<{
    totalMembers: number;
    activeToday: number;
    newPosts: number;
    categoryStats: { [key: string]: number };
  }> {
    const [{ totalMembers }] = await db.select({ totalMembers: count(users.id) }).from(users);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [{ activeToday }] = await db
      .select({ activeToday: count(users.id) })
      .from(users)
      .where(sql`DATE(${users.lastActiveDate}) = DATE(${today})`);

    // Count new discussions created today
    const [{ newDiscussions }] = await db
      .select({ newDiscussions: count(discussions.id) })
      .from(discussions)
      .where(sql`${discussions.createdAt} >= ${today}`);

    // Count new discussion replies created today
    const [{ newReplies }] = await db
      .select({ newReplies: count(discussionReplies.id) })
      .from(discussionReplies)
      .where(sql`${discussionReplies.createdAt} >= ${today}`);

    // Total new posts = new discussions + new replies
    const newPosts = newDiscussions + newReplies;

    // Get category counts
    const categories = ['leadership', 'marriage', 'parenting', 'faith'];
    const categoryStats: { [key: string]: number } = {};
    
    for (const category of categories) {
      const [{ count: categoryCount }] = await db
        .select({ count: count(discussions.id) })
        .from(discussions)
        .where(eq(discussions.category, category));
      categoryStats[category] = categoryCount;
    }
    
    // Get study discussions count
    const [{ count: studyDiscussionsCount }] = await db
      .select({ count: count(discussions.id) })
      .from(discussions)
      .where(sql`${discussions.studyId} IS NOT NULL`);
    categoryStats['studies'] = studyDiscussionsCount;

    return {
      totalMembers,
      activeToday,
      newPosts,
      categoryStats,
    };
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<{
    user: User;
    studiesCompleted: number;
    daysActive: number;
    forumPosts: number;
    memberSince: Date;
  } | undefined> {
    // Get user data
    const user = await this.getUser(userId);
    if (!user) return undefined;

    // Calculate studies completed
    const [{ studiesCompleted }] = await db
      .select({ studiesCompleted: count(userProgress.id) })
      .from(userProgress)
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.isCompleted, true)
      ));

    // Calculate days active (unique days with any activity)
    // This counts distinct dates when user accessed studies
    const userActivityDates = await db
      .selectDistinct({
        date: sql<string>`DATE(${userProgress.lastAccessedAt})`
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
    
    const daysActive = userActivityDates.length;

    // Calculate forum posts (discussions + replies)
    const [{ discussionCount }] = await db
      .select({ discussionCount: count(discussions.id) })
      .from(discussions)
      .where(eq(discussions.userId, userId));

    const [{ replyCount }] = await db
      .select({ replyCount: count(discussionReplies.id) })
      .from(discussionReplies)
      .where(eq(discussionReplies.userId, userId));

    const forumPosts = discussionCount + replyCount;

    return {
      user,
      studiesCompleted,
      daysActive,
      forumPosts,
      memberSince: user.createdAt!,
    };
  }

  async createUserReport(report: InsertUserReport): Promise<UserReport> {
    const [newReport] = await db
      .insert(userReports)
      .values(report)
      .returning();

    // Create notification for admins about the new report
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'));

    const reporterUser = await this.getUser(report.reporterUserId);
    const reportedUser = await this.getUser(report.reportedUserId);

    if (reporterUser && reportedUser) {
      for (const admin of admins) {
        await db.insert(notifications).values({
          userId: admin.id,
          title: 'New User Report',
          message: `${reporterUser.firstName} ${reporterUser.lastName} reported ${reportedUser.firstName} ${reportedUser.lastName}`,
          type: 'admin',
          relatedId: newReport.id,
          isRead: false,
        });
      }
    }

    return newReport;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return preferences;
  }

  // User silence operations
  async silenceUser(silencerId: string, silencedId: string): Promise<UserSilence> {
    const [silence] = await db
      .insert(userSilences)
      .values({ silencerId, silencedId })
      .onConflictDoNothing()
      .returning();
    return silence;
  }

  async unsilenceUser(silencerId: string, silencedId: string): Promise<void> {
    await db
      .delete(userSilences)
      .where(and(
        eq(userSilences.silencerId, silencerId),
        eq(userSilences.silencedId, silencedId)
      ));
  }

  async getUserSilences(userId: string): Promise<string[]> {
    const silences = await db
      .select({ silencedId: userSilences.silencedId })
      .from(userSilences)
      .where(eq(userSilences.silencerId, userId));
    return silences.map(s => s.silencedId);
  }

  async isUserSilenced(silencerId: string, silencedId: string): Promise<boolean> {
    const [silence] = await db
      .select()
      .from(userSilences)
      .where(and(
        eq(userSilences.silencerId, silencerId),
        eq(userSilences.silencedId, silencedId)
      ))
      .limit(1);
    return !!silence;
  }

  // Logo settings operations
  async getLogoSettings(): Promise<LogoSettings | undefined> {
    const [settings] = await db
      .select()
      .from(logoSettings)
      .where(eq(logoSettings.isEnabled, true))
      .orderBy(desc(logoSettings.createdAt))
      .limit(1);
    return settings;
  }

  async updateLogoSettings(logoSettingsData: InsertLogoSettings): Promise<LogoSettings> {
    // Disable all existing logo settings first
    await db
      .update(logoSettings)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(logoSettings.isEnabled, true));

    // Insert new logo settings
    const [newSettings] = await db
      .insert(logoSettings)
      .values(logoSettingsData)
      .returning();
    return newSettings;
  }

  async getHeaderLogoSettings(): Promise<HeaderLogoSettings | undefined> {
    const [settings] = await db
      .select()
      .from(headerLogoSettings)
      .where(eq(headerLogoSettings.isEnabled, true))
      .orderBy(desc(headerLogoSettings.createdAt))
      .limit(1);
    return settings;
  }

  async updateHeaderLogoSettings(headerLogoSettingsData: InsertHeaderLogoSettings): Promise<HeaderLogoSettings> {
    // Disable all existing header logo settings first
    await db
      .update(headerLogoSettings)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(headerLogoSettings.isEnabled, true));

    // Insert new header logo settings
    const [newSettings] = await db
      .insert(headerLogoSettings)
      .values(headerLogoSettingsData)
      .returning();
    return newSettings;
  }

  async deleteHeaderLogoSettings(): Promise<void> {
    // Disable all header logo settings
    await db
      .update(headerLogoSettings)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(headerLogoSettings.isEnabled, true));
  }

  async updateLogoSettingsPartial(updateData: Partial<LogoSettings>): Promise<LogoSettings> {
    // Get current enabled settings
    const [currentSettings] = await db
      .select()
      .from(logoSettings)
      .where(eq(logoSettings.isEnabled, true))
      .limit(1);

    if (!currentSettings) {
      throw new Error("No logo settings found to update");
    }

    // Update the existing record
    const [updatedSettings] = await db
      .update(logoSettings)
      .set({ 
        ...updateData, 
        updatedAt: new Date() 
      })
      .where(eq(logoSettings.id, currentSettings.id))
      .returning();
    
    return updatedSettings;
  }

  // Get weekly study completions count for a user
  async getWeeklyStudyCompletions(userId: string): Promise<number> {
    // Calculate date one week ago from today (local timezone)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    // Count distinct studies completed in the past 7 days
    // A study is considered "completed" when progress is 100% (completedLessons >= lessonCount)
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${userProgress.studyId})`
      })
      .from(userProgress)
      .innerJoin(studies, eq(userProgress.studyId, studies.id))
      .where(
        and(
          eq(userProgress.userId, userId),
          sql`${userProgress.completedLessons} >= ${studies.lessonCount}`,
          sql`${userProgress.lastAccessedAt} >= ${oneWeekAgo.toISOString()}`
        )
      );

    return result[0]?.count || 0;
  }

  // System settings operations
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const [settings] = await db
      .select()
      .from(systemSettings)
      .orderBy(desc(systemSettings.createdAt))
      .limit(1);
    return settings;
  }

  async updateSystemSettings(systemSettingsData: InsertSystemSettings): Promise<SystemSettings> {
    // Check if any settings exist
    const [existingSettings] = await db
      .select()
      .from(systemSettings)
      .limit(1);

    if (existingSettings) {
      // Update existing record
      const [updatedSettings] = await db
        .update(systemSettings)
        .set({ 
          ...systemSettingsData, 
          updatedAt: new Date() 
        })
        .where(eq(systemSettings.id, existingSettings.id))
        .returning();
      return updatedSettings;
    } else {
      // Create new record
      const [newSettings] = await db
        .insert(systemSettings)
        .values(systemSettingsData)
        .returning();
      return newSettings;
    }
  }

  // Podcast operations
  async getPodcasts(options: { search?: string; category?: string; sort?: string } = {}): Promise<Podcast[]> {
    let query = db.select().from(podcasts).where(eq(podcasts.isPublished, true));
    
    // Apply filters
    if (options.category) {
      query = query.where(eq(podcasts.category, options.category)) as any;
    }
    
    if (options.search) {
      query = query.where(
        or(
          ilike(podcasts.title, `%${options.search}%`),
          ilike(podcasts.description, `%${options.search}%`)
        )
      ) as any;
    }
    
    // Apply sorting
    switch (options.sort) {
      case 'rating':
        query = query.orderBy(desc(podcasts.rating)) as any;
        break;
      case 'views':
        query = query.orderBy(desc(podcasts.viewCount)) as any;
        break;
      case 'title':
        query = query.orderBy(asc(podcasts.title)) as any;
        break;
      case 'date':
      default:
        query = query.orderBy(desc(podcasts.createdAt)) as any;
        break;
    }
    
    return await query;
  }

  async getAllPodcasts(): Promise<Podcast[]> {
    return await db
      .select()
      .from(podcasts)
      .orderBy(desc(podcasts.createdAt));
  }

  async getPodcastById(id: string): Promise<Podcast | undefined> {
    const [podcast] = await db
      .select()
      .from(podcasts)
      .where(eq(podcasts.id, id));
    return podcast;
  }

  async createPodcast(podcastData: InsertPodcast): Promise<Podcast> {
    const [podcast] = await db
      .insert(podcasts)
      .values(podcastData)
      .returning();
    return podcast;
  }

  async updatePodcast(id: string, updates: Partial<Podcast>): Promise<Podcast> {
    const [podcast] = await db
      .update(podcasts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(podcasts.id, id))
      .returning();
    return podcast;
  }

  async deletePodcast(id: string): Promise<void> {
    await db.delete(podcasts).where(eq(podcasts.id, id));
  }

  async ratePodcast(userId: string, podcastId: string, ratingData: { rating: number; review?: string }): Promise<PodcastRating> {
    // Insert or update rating
    const [rating] = await db
      .insert(podcastRatings)
      .values({ ...ratingData, userId, podcastId })
      .onConflictDoUpdate({
        target: [podcastRatings.userId, podcastRatings.podcastId],
        set: {
          rating: ratingData.rating,
          review: ratingData.review,
          updatedAt: new Date()
        }
      })
      .returning();

    // Recalculate podcast rating
    const [stats] = await db
      .select({
        avgRating: sql`AVG(${podcastRatings.rating})`.as('avgRating'),
        count: sql`COUNT(*)`.as('count')
      })
      .from(podcastRatings)
      .where(eq(podcastRatings.podcastId, podcastId));

    // Update podcast with new rating stats
    await db
      .update(podcasts)
      .set({
        rating: stats.avgRating ? parseFloat(stats.avgRating as string).toFixed(1) : '0.0',
        ratingCount: parseInt(stats.count as string),
        updatedAt: new Date()
      })
      .where(eq(podcasts.id, podcastId));

    return rating;
  }

  async getPodcastRatings(podcastId: string): Promise<PodcastRating[]> {
    return await db
      .select({
        id: podcastRatings.id,
        userId: podcastRatings.userId,
        podcastId: podcastRatings.podcastId,
        rating: podcastRatings.rating,
        review: podcastRatings.review,
        createdAt: podcastRatings.createdAt,
        updatedAt: podcastRatings.updatedAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(podcastRatings)
      .leftJoin(users, eq(podcastRatings.userId, users.id))
      .where(eq(podcastRatings.podcastId, podcastId))
      .orderBy(desc(podcastRatings.createdAt)) as any;
  }

  async getUserPodcastRating(userId: string, podcastId: string): Promise<PodcastRating | undefined> {
    const [rating] = await db
      .select()
      .from(podcastRatings)
      .where(
        and(
          eq(podcastRatings.userId, userId),
          eq(podcastRatings.podcastId, podcastId)
        )
      );
    return rating;
  }

  async incrementPodcastViews(podcastId: string, userId?: string, ipAddress?: string): Promise<void> {
    // Insert view record
    await db.insert(podcastViews).values({
      podcastId,
      userId,
      ipAddress
    });

    // Increment view count on podcast
    await db
      .update(podcasts)
      .set({
        viewCount: sql`${podcasts.viewCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(podcasts.id, podcastId));
  }

  // Create new live session (new podcast entry that's live)
  async createLiveSession(data: {
    title: string;
    description: string;
    category: string;
    type: string;
    liveUrl: string;
    scheduledDate: Date | null;
    uploadedBy: string;
  }): Promise<Podcast> {
    const [podcast] = await db
      .insert(podcasts)
      .values({
        title: data.title,
        description: data.description,
        type: data.type,
        fileUrl: '/placeholder-live-session', // Placeholder, will be updated after recording
        category: data.category,
        uploadedBy: data.uploadedBy,
        isCurrentlyLive: true,
        liveStreamUrl: data.liveUrl,
        liveStartedAt: new Date(),
        scheduledLiveDate: data.scheduledDate,
        liveNotificationsSent: false,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
      
    return podcast;
  }

  // Live streaming operations
  async startLiveStream(podcastId: string, liveUrl: string): Promise<Podcast> {
    const [podcast] = await db
      .update(podcasts)
      .set({
        isCurrentlyLive: true,
        liveStreamUrl: liveUrl,
        liveStartedAt: new Date(),
        liveNotificationsSent: false,
        updatedAt: new Date()
      })
      .where(eq(podcasts.id, podcastId))
      .returning();
    return podcast;
  }

  async endLiveStream(podcastId: string): Promise<Podcast> {
    const [podcast] = await db
      .update(podcasts)
      .set({
        isCurrentlyLive: false,
        liveStreamUrl: null,
        liveEndedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(podcasts.id, podcastId))
      .returning();
    return podcast;
  }

  // Update live session with recorded file URL after stream ends
  async updateLiveSessionRecording(podcastId: string, fileUrl: string, duration?: number): Promise<Podcast> {
    const [podcast] = await db
      .update(podcasts)
      .set({
        fileUrl: fileUrl,
        duration: duration,
        updatedAt: new Date()
      })
      .where(eq(podcasts.id, podcastId))
      .returning();
    return podcast;
  }

  async getLiveStreams(): Promise<Podcast[]> {
    return db.select().from(podcasts).where(eq(podcasts.isCurrentlyLive, true));
  }

  async notifyLiveStreamStart(podcastId: string): Promise<void> {
    const podcast = await this.getPodcastById(podcastId);
    if (!podcast) return;

    // Get all users who want live stream notifications
    const usersToNotify = await db
      .select({ id: users.id })
      .from(users)
      .leftJoin(notificationPreferences, eq(users.id, notificationPreferences.userId))
      .where(
        or(
          eq(notificationPreferences.liveStreamNotifications, true),
          isNull(notificationPreferences.userId) // Users without preferences get notifications by default
        )
      );

    const notificationData = usersToNotify.map(user => ({
      userId: user.id,
      type: 'live_stream',
      title: 'Live Stream Started!',
      message: `${podcast.title} is now streaming live. Join us now!`,
      relatedId: podcastId
    }));

    if (notificationData.length > 0) {
      await db.insert(notifications).values(notificationData);
    }

    // Mark notifications as sent for this live stream
    await db
      .update(podcasts)
      .set({ liveNotificationsSent: true })
      .where(eq(podcasts.id, podcastId));
  }

  // Challenge operations
  async getChallenges(): Promise<Challenge[]> {
    return await db
      .select()
      .from(challenges)
      .orderBy(desc(challenges.releaseDate));
  }

  async getChallengeById(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id));
    return challenge;
  }

  async createChallenge(challengeData: InsertChallenge): Promise<Challenge> {
    // Parse the ISO date and ensure it's stored at noon UTC to avoid timezone issues
    const inputDate = new Date(challengeData.releaseDate);
    const noonUTCDate = new Date(Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      12, 0, 0
    ));
    
    const processedData = {
      ...challengeData,
      releaseDate: noonUTCDate
    };
    
    const [challenge] = await db
      .insert(challenges)
      .values(processedData)
      .returning();
    return challenge;
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<Challenge> {
    const processedUpdates = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Handle releaseDate with proper timezone handling
    if (updates.releaseDate) {
      const inputDate = new Date(updates.releaseDate);
      const noonUTCDate = new Date(Date.UTC(
        inputDate.getUTCFullYear(),
        inputDate.getUTCMonth(),
        inputDate.getUTCDate(),
        12, 0, 0
      ));
      processedUpdates.releaseDate = noonUTCDate;
    }
    
    const [challenge] = await db
      .update(challenges)
      .set(processedUpdates)
      .where(eq(challenges.id, id))
      .returning();
    return challenge;
  }

  async deleteChallenge(id: string): Promise<void> {
    await db.delete(challenges).where(eq(challenges.id, id));
  }

  async getCurrentWeekChallenge(): Promise<Challenge | undefined> {
    // Calculate the Monday of the current week at noon UTC
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
    const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayOfThisWeek = new Date(today);
    mondayOfThisWeek.setDate(today.getDate() + daysUntilMonday);
    
    // Set to noon UTC to match how we store dates
    const mondayAtNoonUTC = new Date(Date.UTC(
      mondayOfThisWeek.getFullYear(),
      mondayOfThisWeek.getMonth(),
      mondayOfThisWeek.getDate(),
      12, 0, 0
    ));

    // Find the most recent challenge released on or before this Monday
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(sql`${challenges.releaseDate} <= ${mondayAtNoonUTC.toISOString()}`)
      .orderBy(desc(challenges.releaseDate))
      .limit(1);
    
    return challenge;
  }

  async pushChallengeToCurrentWeek(id: string): Promise<Challenge> {
    // Calculate the Monday of the current week at noon UTC
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
    const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayOfThisWeek = new Date(today);
    mondayOfThisWeek.setDate(today.getDate() + daysUntilMonday);
    
    const mondayAtNoonUTC = new Date(Date.UTC(
      mondayOfThisWeek.getFullYear(),
      mondayOfThisWeek.getMonth(),
      mondayOfThisWeek.getDate(),
      12, 0, 0
    ));
    
    const sundayBeforeAtNoonUTC = new Date(mondayAtNoonUTC.getTime() - 24 * 60 * 60 * 1000);

    // First, push all other challenges to be before this Monday if they're currently set to this Monday
    // This ensures that only the challenge we're pushing will be the "current" one
    await db
      .update(challenges)
      .set({ 
        releaseDate: sundayBeforeAtNoonUTC,
        updatedAt: new Date() 
      })
      .where(and(
        eq(challenges.releaseDate, mondayAtNoonUTC),
        not(eq(challenges.id, id))
      ));

    // Now update the target challenge's release date to this Monday
    const [challenge] = await db
      .update(challenges)
      .set({ 
        releaseDate: mondayAtNoonUTC,
        updatedAt: new Date() 
      })
      .where(eq(challenges.id, id))
      .returning();
    
    return challenge;
  }

  // Content Flagging Methods
  async flagContent(flagData: InsertContentFlag): Promise<ContentFlag> {
    const [flag] = await db
      .insert(contentFlags)
      .values({
        ...flagData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return flag;
  }

  async notifyAdminsOfFlag(flag: ContentFlag): Promise<void> {
    // Get all admin users
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'));

    // Get the content details for notification
    let contentTitle = '';
    let contentUrl = '';
    
    if (flag.contentType === 'discussion') {
      const [discussion] = await db
        .select({ title: discussions.title })
        .from(discussions)
        .where(eq(discussions.id, flag.contentId));
      
      contentTitle = discussion?.title || 'Discussion';
      contentUrl = `/community?discussion=${flag.contentId}`;
    } else if (flag.contentType === 'reply') {
      const [reply] = await db
        .select({ 
          content: discussionReplies.content,
          discussionId: discussionReplies.discussionId 
        })
        .from(discussionReplies)
        .where(eq(discussionReplies.id, flag.contentId));
      
      contentTitle = `Reply: ${reply?.content?.substring(0, 50) || 'Reply'}...`;
      contentUrl = `/community?discussion=${reply?.discussionId}&reply=${flag.contentId}`;
    }

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      userId: admin.id,
      title: 'Content Flagged',
      message: `A user has flagged ${flag.contentType}: "${contentTitle}" for ${flag.reason}`,
      type: 'admin' as const,
      metadata: JSON.stringify({
        flagId: flag.id,
        contentType: flag.contentType,
        contentId: flag.contentId,
        reason: flag.reason,
        url: contentUrl
      }),
      isRead: false,
      createdAt: new Date()
    }));

    await db.insert(notifications).values(notifications);
  }

  async getAllFlags(): Promise<(ContentFlag & { reporter: { firstName: string; lastName: string } })[]> {
    const flags = await db
      .select({
        id: contentFlags.id,
        reporterId: contentFlags.reporterId,
        contentType: contentFlags.contentType,
        contentId: contentFlags.contentId,
        reason: contentFlags.reason,
        description: contentFlags.description,
        status: contentFlags.status,
        reviewedBy: contentFlags.reviewedBy,
        reviewedAt: contentFlags.reviewedAt,
        reviewNotes: contentFlags.reviewNotes,
        createdAt: contentFlags.createdAt,
        updatedAt: contentFlags.updatedAt,
        reporter: {
          firstName: users.firstName,
          lastName: users.lastName
        }
      })
      .from(contentFlags)
      .leftJoin(users, eq(contentFlags.reporterId, users.id))
      .orderBy(desc(contentFlags.createdAt));

    return flags;
  }

  async updateFlagStatus(flagId: string, updateData: {
    status: string;
    reviewNotes?: string;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<ContentFlag> {
    const [flag] = await db
      .update(contentFlags)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(contentFlags.id, flagId))
      .returning();

    return flag;
  }

  // Honor system operations
  async honorDiscussion(userId: string, discussionId: string): Promise<{ honored: boolean }> {
    try {
      // Check if user already honored this discussion
      const existingHonor = await db
        .select()
        .from(discussionHonors)
        .where(
          and(
            eq(discussionHonors.userId, userId),
            eq(discussionHonors.discussionId, discussionId)
          )
        )
        .limit(1);

      if (existingHonor.length > 0) {
        // Remove honor (toggle off)
        await db
          .delete(discussionHonors)
          .where(
            and(
              eq(discussionHonors.userId, userId),
              eq(discussionHonors.discussionId, discussionId)
            )
          );

        // Decrement likes count
        await db
          .update(discussions)
          .set({ likes: sql`${discussions.likes} - 1` })
          .where(eq(discussions.id, discussionId));

        return { honored: false };
      } else {
        // Add honor
        await db
          .insert(discussionHonors)
          .values({ userId, discussionId });

        // Increment likes count
        await db
          .update(discussions)
          .set({ likes: sql`${discussions.likes} + 1` })
          .where(eq(discussions.id, discussionId));

        return { honored: true };
      }
    } catch (error) {
      console.error('Error toggling discussion honor:', error);
      throw new Error('Failed to toggle discussion honor');
    }
  }

  async honorReply(userId: string, replyId: string): Promise<{ honored: boolean }> {
    try {
      // Check if user already honored this reply
      const existingHonor = await db
        .select()
        .from(replyHonors)
        .where(
          and(
            eq(replyHonors.userId, userId),
            eq(replyHonors.replyId, replyId)
          )
        )
        .limit(1);

      if (existingHonor.length > 0) {
        // Remove honor (toggle off)
        await db
          .delete(replyHonors)
          .where(
            and(
              eq(replyHonors.userId, userId),
              eq(replyHonors.replyId, replyId)
            )
          );

        // Decrement likes count
        await db
          .update(discussionReplies)
          .set({ likes: sql`${discussionReplies.likes} - 1` })
          .where(eq(discussionReplies.id, replyId));

        return { honored: false };
      } else {
        // Add honor
        await db
          .insert(replyHonors)
          .values({ userId, replyId });

        // Increment likes count
        await db
          .update(discussionReplies)
          .set({ likes: sql`${discussionReplies.likes} + 1` })
          .where(eq(discussionReplies.id, replyId));

        return { honored: true };
      }
    } catch (error) {
      console.error('Error toggling reply honor:', error);
      throw new Error('Failed to toggle reply honor');
    }
  }

  async getUserHonorStatus(userId: string, discussionIds: string[], replyIds: string[]) {
    const [discussionHonorsData, replyHonorsData] = await Promise.all([
      discussionIds.length > 0 ? 
        db
          .select({ discussionId: discussionHonors.discussionId })
          .from(discussionHonors)
          .where(
            and(
              eq(discussionHonors.userId, userId),
              inArray(discussionHonors.discussionId, discussionIds)
            )
          ) : [],
      replyIds.length > 0 ?
        db
          .select({ replyId: replyHonors.replyId })
          .from(replyHonors)
          .where(
            and(
              eq(replyHonors.userId, userId),
              inArray(replyHonors.replyId, replyIds)
            )
          ) : []
    ]);

    return {
      discussionHonors: discussionHonorsData.map(h => h.discussionId),
      replyHonors: replyHonorsData.map(h => h.replyId)
    };
  }

  async getUserHonorStats(userId: string) {
    const [honorsGivenResult, honorsReceivedResult] = await Promise.all([
      // Count honors given by this user
      Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(discussionHonors)
          .where(eq(discussionHonors.userId, userId)),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(replyHonors)
          .where(eq(replyHonors.userId, userId))
      ]),
      
      // Count honors received by this user's content
      Promise.all([
        db
          .select({ count: sql<number>`COUNT(dh.id)` })
          .from(discussions)
          .leftJoin(discussionHonors.as('dh'), eq(discussions.id, sql`dh.discussion_id`))
          .where(eq(discussions.userId, userId)),
        db
          .select({ count: sql<number>`COUNT(rh.id)` })
          .from(discussionReplies)
          .leftJoin(replyHonors.as('rh'), eq(discussionReplies.id, sql`rh.reply_id`))
          .where(eq(discussionReplies.userId, userId))
      ])
    ]);

    const discussionHonorsGiven = honorsGivenResult[0][0]?.count || 0;
    const replyHonorsGiven = honorsGivenResult[1][0]?.count || 0;
    const discussionHonorsReceived = honorsReceivedResult[0][0]?.count || 0;
    const replyHonorsReceived = honorsReceivedResult[1][0]?.count || 0;

    return {
      honorsGiven: discussionHonorsGiven + replyHonorsGiven,
      honorsReceived: discussionHonorsReceived + replyHonorsReceived,
      discussionHonorsGiven,
      replyHonorsGiven,
      discussionHonorsReceived,
      replyHonorsReceived
    };
  }

  // Testimony operations
  async getUserTestimony(userId: string): Promise<Testimony | undefined> {
    const [testimony] = await db
      .select()
      .from(testimonies)
      .where(eq(testimonies.userId, userId));
    return testimony;
  }

  async upsertTestimony(testimonyData: InsertTestimony): Promise<Testimony> {
    const [testimony] = await db
      .insert(testimonies)
      .values({
        ...testimonyData,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: testimonies.userId,
        set: {
          content: testimonyData.content,
          tags: testimonyData.tags,
          isPublic: testimonyData.isPublic,
          faithJourneyStage: testimonyData.faithJourneyStage,
          updatedAt: new Date()
        }
      })
      .returning();
    return testimony;
  }

  async deleteTestimony(userId: string): Promise<void> {
    await db
      .delete(testimonies)
      .where(eq(testimonies.userId, userId));
  }

  // Discipleship/Tag-based user discovery operations
  async getAllTestimonyTags(): Promise<{ tag: string; count: number }[]> {
    const testimoniesWithTags = await db
      .select({
        tags: testimonies.tags
      })
      .from(testimonies)
      .where(and(
        eq(testimonies.isPublic, true),
        isNotNull(testimonies.tags)
      ));

    // Flatten all tags and count occurrences
    const tagCounts: { [key: string]: number } = {};
    
    testimoniesWithTags.forEach(testimony => {
      if (testimony.tags && Array.isArray(testimony.tags)) {
        testimony.tags.forEach(tag => {
          if (tag && tag.trim()) {
            const normalizedTag = tag.trim();
            tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
          }
        });
      }
    });

    // Convert to array and sort by count (descending) then by name (ascending)
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count; // Higher counts first
        }
        return a.tag.localeCompare(b.tag); // Alphabetical for same counts
      });
  }

  async getUsersWithPublicTestimonies(): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    testimonyTags: string[];
    faithJourneyStage: string | null;
    tier: string;
  }[]> {
    const usersWithTestimonies = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        subscriptionTier: users.subscriptionTier,
        tags: testimonies.tags,
        faithJourneyStage: testimonies.faithJourneyStage
      })
      .from(users)
      .innerJoin(testimonies, eq(users.id, testimonies.userId))
      .where(and(
        eq(testimonies.isPublic, true),
        isNotNull(testimonies.tags)
      ))
      .orderBy(users.firstName, users.lastName);

    // Format the results
    return usersWithTestimonies.map(user => ({
      id: user.id,
      username: user.email || 'Unknown User', // Use email as username since there's no username field
      displayName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null,
      avatarUrl: user.profileImageUrl,
      testimonyTags: user.tags || [],
      faithJourneyStage: user.faithJourneyStage,
      tier: user.subscriptionTier || 'free'
    }));
  }

  // Brotherhood denial tracking methods
  async getBrotherhoodDenial(requesterId: string, recipientId: string): Promise<BrotherhoodDenial | undefined> {
    const [denial] = await db.select()
      .from(brotherhoodDenials)
      .where(and(
        eq(brotherhoodDenials.requesterId, requesterId),
        eq(brotherhoodDenials.recipientId, recipientId)
      ));
    return denial;
  }

  async upsertBrotherhoodDenial(denial: InsertBrotherhoodDenial): Promise<BrotherhoodDenial> {
    // Update main denial count in brotherhood_denials table
    const [newDenial] = await db.insert(brotherhoodDenials)
      .values({
        ...denial,
        denialCount: 1, // Start with 1 if new record
        lastDenialAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [brotherhoodDenials.requesterId, brotherhoodDenials.recipientId],
        set: {
          denialCount: sql`${brotherhoodDenials.denialCount} + 1`,
          lastDenialAt: new Date(),
          cooldownUntil: sql`CASE WHEN ${brotherhoodDenials.denialCount} + 1 >= 3 THEN NOW() + INTERVAL '10 days' ELSE NULL END`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return newDenial;
  }

  async checkDenialCooldown(requesterId: string, recipientId: string): Promise<{
    inCooldown: boolean;
    daysRemaining?: number;
    denialCount: number;
    cooldownUntil?: Date;
  }> {
    // Get the denial record for this user pair
    const [denialRecord] = await db.select()
      .from(brotherhoodDenials)
      .where(and(
        eq(brotherhoodDenials.requesterId, requesterId),
        eq(brotherhoodDenials.recipientId, recipientId)
      ))
      .limit(1);

    // If no denial record exists, user can send requests freely
    if (!denialRecord) {
      return {
        inCooldown: false,
        denialCount: 0
      };
    }

    const denialCount = denialRecord.denialCount;
    
    // Check if in cooldown (3 or more denials)
    if (denialCount >= 3) {
      // Check if cooldown period has expired
      if (denialRecord.cooldownUntil && denialRecord.cooldownUntil > new Date()) {
        const daysRemaining = Math.ceil(
          (denialRecord.cooldownUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        return {
          inCooldown: true,
          daysRemaining,
          denialCount,
          cooldownUntil: denialRecord.cooldownUntil
        };
      } else {
        // Cooldown has expired, reset the denial count
        await db.update(brotherhoodDenials)
          .set({
            denialCount: 0,
            cooldownUntil: null,
            updatedAt: new Date()
          })
          .where(eq(brotherhoodDenials.id, denialRecord.id));
        
        return {
          inCooldown: false,
          denialCount: 0
        };
      }
    }

    return {
      inCooldown: false,
      denialCount
    };
  }

  // Fitness Challenge methods
  async getFitnessChallenges(): Promise<FitnessChallenge[]> {
    return await db
      .select()
      .from(fitnessChallenge)
      .where(eq(fitnessChallenge.isPublished, true))
      .orderBy(desc(fitnessChallenge.targetDate));
  }

  async getAllFitnessChallenges(): Promise<FitnessChallenge[]> {
    return await db
      .select()
      .from(fitnessChallenge)
      .orderBy(desc(fitnessChallenge.targetDate));
  }

  async getFitnessChallengeById(id: string): Promise<FitnessChallenge | undefined> {
    const [challenge] = await db
      .select()
      .from(fitnessChallenge)
      .where(eq(fitnessChallenge.id, id));
    return challenge;
  }

  async createFitnessChallenge(challengeData: InsertFitnessChallenge): Promise<FitnessChallenge> {
    const [challenge] = await db
      .insert(fitnessChallenge)
      .values(challengeData)
      .returning();
    return challenge;
  }

  async updateFitnessChallenge(id: string, updates: Partial<InsertFitnessChallenge>): Promise<FitnessChallenge> {
    const [challenge] = await db
      .update(fitnessChallenge)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fitnessChallenge.id, id))
      .returning();
    return challenge;
  }

  async deleteFitnessChallenge(id: string): Promise<void> {
    await db
      .delete(fitnessChallenge)
      .where(eq(fitnessChallenge.id, id));
  }

  async publishFitnessChallenge(id: string): Promise<FitnessChallenge> {
    const [challenge] = await db
      .update(fitnessChallenge)
      .set({ 
        isPublished: true, 
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(fitnessChallenge.id, id))
      .returning();
    return challenge;
  }

  async getTodaysFitnessChallenge(): Promise<FitnessChallenge | null> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [challenge] = await db
      .select()
      .from(fitnessChallenge)
      .where(
        and(
          eq(fitnessChallenge.isPublished, true),
          gte(fitnessChallenge.targetDate, startOfDay),
          lte(fitnessChallenge.targetDate, endOfDay)
        )
      );
    
    return challenge || null;
  }

  // Hurdle Wall implementation methods
  async getHurdleWallPosts(): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    userHasPrayed?: boolean;
    replyCount: number;
  })[]> {
    const posts = await db
      .select({
        id: hurdleWallPosts.id,
        userId: hurdleWallPosts.userId,
        content: hurdleWallPosts.content,
        isAnonymous: hurdleWallPosts.isAnonymous,
        postType: hurdleWallPosts.postType,
        prayerCount: hurdleWallPosts.prayerCount,
        replyCount: hurdleWallPosts.replyCount,
        createdAt: hurdleWallPosts.createdAt,
        updatedAt: hurdleWallPosts.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(hurdleWallPosts)
      .innerJoin(users, eq(hurdleWallPosts.userId, users.id))
      .orderBy(desc(hurdleWallPosts.createdAt));
    
    return posts;
  }

  async getHurdleWallPost(postId: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
    userHasPrayed?: boolean;
  }) | undefined> {
    const [post] = await db
      .select({
        id: hurdleWallPosts.id,
        userId: hurdleWallPosts.userId,
        content: hurdleWallPosts.content,
        isAnonymous: hurdleWallPosts.isAnonymous,
        postType: hurdleWallPosts.postType,
        prayerCount: hurdleWallPosts.prayerCount,
        replyCount: hurdleWallPosts.replyCount,
        createdAt: hurdleWallPosts.createdAt,
        updatedAt: hurdleWallPosts.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(hurdleWallPosts)
      .innerJoin(users, eq(hurdleWallPosts.userId, users.id))
      .where(eq(hurdleWallPosts.id, postId));
    
    if (!post) return undefined;
    
    const replies = await db
      .select({
        id: hurdleWallReplies.id,
        postId: hurdleWallReplies.postId,
        userId: hurdleWallReplies.userId,
        content: hurdleWallReplies.content,
        isAnonymous: hurdleWallReplies.isAnonymous,
        createdAt: hurdleWallReplies.createdAt,
        updatedAt: hurdleWallReplies.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(hurdleWallReplies)
      .innerJoin(users, eq(hurdleWallReplies.userId, users.id))
      .where(eq(hurdleWallReplies.postId, postId))
      .orderBy(asc(hurdleWallReplies.createdAt));
    
    return { ...post, replies };
  }

  async createHurdleWallPost(post: InsertHurdleWallPost): Promise<HurdleWallPost> {
    const [newPost] = await db
      .insert(hurdleWallPosts)
      .values(post)
      .returning();
    return newPost;
  }

  async createHurdleWallReply(reply: InsertHurdleWallReply): Promise<HurdleWallReply> {
    const [newReply] = await db
      .insert(hurdleWallReplies)
      .values(reply)
      .returning();
    
    // Update reply count on the post
    await db
      .update(hurdleWallPosts)
      .set({
        replyCount: sql`${hurdleWallPosts.replyCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(hurdleWallPosts.id, reply.postId));
    
    return newReply;
  }

  async prayForPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }> {
    try {
      // Check if user already prayed for this post
      const [existing] = await db
        .select()
        .from(hurdleWallPrayers)
        .where(and(
          eq(hurdleWallPrayers.postId, postId),
          eq(hurdleWallPrayers.userId, userId)
        ));
      
      if (existing) {
        return { success: false, prayerCount: 0 };
      }
      
      // Add the prayer
      await db.insert(hurdleWallPrayers).values({
        postId,
        userId,
      });
      
      // Update prayer count and get the new count
      const [updatedPost] = await db
        .update(hurdleWallPosts)
        .set({
          prayerCount: sql`${hurdleWallPosts.prayerCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(hurdleWallPosts.id, postId))
        .returning({ prayerCount: hurdleWallPosts.prayerCount });
      
      // Update user prayer stats
      await this.updateUserPrayerStats(userId, 'given');
      
      // Update post author's prayer stats
      const [post] = await db
        .select({ userId: hurdleWallPosts.userId })
        .from(hurdleWallPosts)
        .where(eq(hurdleWallPosts.id, postId));
      
      if (post) {
        await this.updateUserPrayerStats(post.userId, 'received');
      }
      
      return { success: true, prayerCount: updatedPost?.prayerCount || 0 };
    } catch (error) {
      console.error('Error praying for post:', error);
      return { success: false, prayerCount: 0 };
    }
  }

  async removePrayerFromPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }> {
    try {
      // Remove the prayer
      const deletedRows = await db
        .delete(hurdleWallPrayers)
        .where(and(
          eq(hurdleWallPrayers.postId, postId),
          eq(hurdleWallPrayers.userId, userId)
        ));
      
      if (deletedRows.length === 0) {
        return { success: false, prayerCount: 0 };
      }
      
      // Update prayer count
      const [updatedPost] = await db
        .update(hurdleWallPosts)
        .set({
          prayerCount: sql`${hurdleWallPosts.prayerCount} - 1`,
          updatedAt: new Date()
        })
        .where(eq(hurdleWallPosts.id, postId))
        .returning({ prayerCount: hurdleWallPosts.prayerCount });
      
      return { success: true, prayerCount: updatedPost?.prayerCount || 0 };
    } catch (error) {
      console.error('Error removing prayer from post:', error);
      return { success: false, prayerCount: 0 };
    }
  }

  async getUserPrayerStats(userId: string): Promise<UserPrayerStats | undefined> {
    const [stats] = await db
      .select()
      .from(userPrayerStats)
      .where(eq(userPrayerStats.userId, userId));
    return stats;
  }

  async ensurePrayerStatsExist(userId: string): Promise<UserPrayerStats> {
    const existing = await this.getUserPrayerStats(userId);
    if (existing) {
      return existing;
    }
    
    const [newStats] = await db
      .insert(userPrayerStats)
      .values({ userId })
      .returning();
    return newStats;
  }

  private async updateUserPrayerStats(userId: string, type: 'given' | 'received'): Promise<void> {
    await this.ensurePrayerStatsExist(userId);
    
    const updateField = type === 'given' ? 'prayersGiven' : 'prayersReceived';
    
    await db
      .update(userPrayerStats)
      .set({
        [updateField]: sql`${userPrayerStats[updateField]} + 1`,
        updatedAt: new Date()
      })
      .where(eq(userPrayerStats.userId, userId));
  }
}

export const storage = new DatabaseStorage();
