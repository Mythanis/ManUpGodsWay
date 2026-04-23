import {
  users,
  studySeries,
  studies,
  studyLessons,
  userLessonProgress,
  userSeriesProgress,
  discussions,
  discussionLikes,
  discussionDislikes,
  discussionReplyDislikes,
  discussionReplies,
  discussionSubscriptions,
  discussionHonors,
  replyHonors,
  userProgress,
  devotionals,
  savedDevotionals,
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
  favoriteExercises,
  fitnessPlans,
  fitnessPlanExercises,
  fitnessPlanReminders,
  exerciseCompletions,
  workoutFeedback,
  workoutStreakResets,
  events,
  eventTiers,
  eventRegistrations,
  hurdleWallPosts,
  hurdleWallReplies,
  hurdleWallPrayers,
  hurdleWallPraises,
  hurdleWallAmens,
  tierPricing,
  subscriptionSettings,
  userPrayerStats,
  userPurchases,
  studyEditableSections,
  userStudyResponses,
  carouselItems,
  carouselDismissals,
  liveStreams,
  type User,
  type UpsertUser,
  type Study,
  type InsertStudy,
  type StudyLesson,
  type InsertStudyLesson,
  type UserLessonProgress,
  type InsertUserLessonProgress,
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
  type SavedDevotional,
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
  challengeParticipants,
  type ChallengeParticipant,
  type InsertChallengeParticipant,
  challengeDailyCheckins,
  type ChallengeDailyCheckin,
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
  type FavoriteExercise,
  type InsertFavoriteExercise,
  type FitnessPlan,
  type InsertFitnessPlan,
  type FitnessPlanExercise,
  type InsertFitnessPlanExercise,
  type FitnessPlanReminder,
  type InsertFitnessPlanReminder,
  type ExerciseCompletion,
  type InsertExerciseCompletion,
  type WorkoutFeedback,
  type Event,
  type InsertEvent,
  type EventTier,
  type InsertEventTier,
  type EventRegistration,
  type InsertEventRegistration,
  type HurdleWallPost,
  type InsertHurdleWallPost,
  type HurdleWallReply,
  type InsertHurdleWallReply,
  type HurdleWallPrayer,
  type InsertHurdleWallPrayer,
  type HurdleWallPraise,
  type HurdleWallAmen,
  accountabilityRequests,
  accountabilitySupports,
  type AccountabilityRequest,
  type UserPrayerStats,
  type InsertUserPrayerStats,
  type UserPurchase,
  type InsertUserPurchase,
  type StudyEditableSection,
  type InsertStudyEditableSection,
  type UserStudyResponse,
  type InsertUserStudyResponse,
  type TierPricing,
  type InsertTierPricing,
  type SubscriptionSettings,
  type InsertSubscriptionSettings,
  type CarouselItem,
  type InsertCarouselItem,
  type LiveStream,
  type InsertLiveStream,
  storeProducts,
  storeRedemptions,
  type StoreProduct,
  type InsertStoreProduct,
  type StoreRedemption,
  type InsertStoreRedemption,
  manUpLinks,
  type ManUpLink,
  type InsertManUpLink,
  bibleReadingPlans,
  bibleReadingPlanDays,
  bibleReadingProgress,
  type BibleReadingPlan,
  type BibleReadingPlanDay,
  type BibleReadingProgress,
  prayerReminders,
  type PrayerReminder,
  dailyAppReminders,
  type DailyAppReminder,
  devotionalReflections,
  type DevotionalReflection,
  foodIntakeEntries,
  type FoodIntakeEntry,
  type InsertFoodIntakeEntry,
  nutritionProfiles,
  type NutritionProfile,
  type InsertNutritionProfile,
  vatmebopChecks,
  type VatmebopCheck,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, sql, ilike, count, inArray, not, gte, lte, isNull, isNotNull, lt, ne, gt } from "drizzle-orm";
import { getNextMidnightInTimezone } from "./drip-utils";
import {
  DEFAULT_TIMEZONE,
  addDaysToYmd,
  getDateStringInTimezone,
  getStartOfDayInTimezone,
  getStartOfNextDayInTimezone,
  getYmdAsUtcMidnight,
} from "./timezone-utils";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Study Series operations
  getStudySeries(category?: string): Promise<any[]>;
  getAllStudySeries(): Promise<any[]>;
  getStudySeriesById(id: string): Promise<any | undefined>;
  getStudiesInSeries(seriesId: string, userId?: string): Promise<any[]>;
  createStudySeries(series: any): Promise<any>;
  updateStudySeries(id: string, series: any): Promise<any>;
  deleteStudySeries(id: string): Promise<void>;
  startUserSeries(userId: string, seriesId: string): Promise<any>;
  getUserSeriesProgress(userId: string, seriesId: string): Promise<any | null>;

  // Study operations
  getStudies(category?: string, requiredTier?: string, isAdmin?: boolean): Promise<Study[]>;
  getIndividualStudies(category?: string): Promise<Study[]>;
  getStudy(id: string): Promise<Study | undefined>;
  createStudy(study: InsertStudy, createdByUserId?: string): Promise<Study>;
  updateStudy(id: string, study: Partial<InsertStudy>): Promise<Study>;
  deleteStudy(id: string): Promise<void>;
  searchStudies(query: string): Promise<Study[]>;
  getFeaturedStudy(): Promise<Study | null>;
  getRecommendedStudies(userId: string, limit?: number): Promise<Study[]>;
  
  // Study lesson operations
  getStudyLessons(studyId: string): Promise<StudyLesson[]>;
  getStudyLesson(lessonId: string): Promise<StudyLesson | undefined>;
  createStudyLesson(lesson: InsertStudyLesson): Promise<StudyLesson>;
  updateStudyLesson(id: string, lesson: Partial<InsertStudyLesson>): Promise<StudyLesson>;
  deleteStudyLesson(id: string): Promise<void>;
  deleteAllStudyLessons(studyId: string): Promise<void>;
  
  // Lesson progress operations
  getUserLessonProgress(userId: string, studyId?: string): Promise<UserLessonProgress[]>;
  getLessonProgressForLessons(userId: string, lessonIds: string[]): Promise<UserLessonProgress[]>;
  markLessonComplete(userId: string, lessonId: string, answers?: Record<string, string>, userTimezone?: string): Promise<UserLessonProgress>;
  saveLessonNotes(userId: string, lessonId: string, notes: string): Promise<UserLessonProgress>;
  
  // Purchase operations
  checkUserPurchase(userId: string, studyId: string): Promise<boolean>;
  getUserPurchases(userId: string): Promise<UserPurchase[]>;
  createPurchase(purchase: InsertUserPurchase): Promise<UserPurchase>;
  
  // Study editable sections operations
  getStudyEditableSections(studyId: string): Promise<StudyEditableSection[]>;
  createEditableSection(section: InsertStudyEditableSection): Promise<StudyEditableSection>;
  updateEditableSection(id: string, section: Partial<InsertStudyEditableSection>): Promise<StudyEditableSection>;
  deleteEditableSection(id: string): Promise<void>;
  
  // User study responses operations
  getUserStudyResponses(userId: string, studyId: string): Promise<UserStudyResponse[]>;
  saveUserResponse(response: InsertUserStudyResponse): Promise<UserStudyResponse>;
  updateUserResponse(userId: string, sectionId: string, responseText: string): Promise<UserStudyResponse>;
  
  // Tier pricing operations (legacy)
  getTierPricing(): Promise<TierPricing[]>;
  getTierPricingByTier(tier: string): Promise<TierPricing | undefined>;
  updateTierPricing(tier: string, pricing: Partial<InsertTierPricing>): Promise<TierPricing>;
  
  // Subscription settings operations
  getSubscriptionSettings(): Promise<SubscriptionSettings | undefined>;
  updateSubscriptionSettings(settings: Partial<InsertSubscriptionSettings>): Promise<SubscriptionSettings>;

  // Trial study access operations
  getStudiesTrialAccess(): Promise<{ id: string; title: string; isTrialAccessible: boolean }[]>;
  updateStudyTrialAccess(studyIds: string[]): Promise<void>;
  
  // Progress operations
  getUserProgress(userId: string, studyId?: string): Promise<UserProgress[]>;
  updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>, userLocalDate?: Date, userTimezone?: string): Promise<UserProgress>;
  fixUserStudyProgress(userId: string): Promise<{ fixedCount: number; checkedCount: number }>;
  updateUserStreak(userId: string, userLocalDate?: Date, userTimezone?: string): Promise<void>;
  getWeeklyStudyCompletions(userId: string): Promise<number>;
  markStudyStarted(userId: string, studyId: string): Promise<void>;

  getUserActiveStudyInfo(userId: string): Promise<{
    activeSeriesId: string | null;
    activeTopicalStudyId: string | null;
  }>;

  getStudyTimeGateStatus(userId: string, studyId: string, userTimezone: string): Promise<{
    isLocked: boolean;
    unlockTime: Date | null;
    previousStudyTitle: string | null;
    message: string | null;
  }>;
  
  getStudyConsecutiveLockStatus(userId: string, studyId: string): Promise<{
    isLocked: boolean;
    previousStudyTitle: string | null;
    previousStudyId: string | null;
    message: string | null;
    studyNumber: number;
    totalStudiesInSeries: number;
    isLockedByDrip?: boolean;
    unlocksAt?: string;
  }>;
  
  // Study-specific methods
  getStudyDiscussion(studyId: string): Promise<(Discussion & { user: User }) | null>;
  createDiscussionsForExistingStudies(): Promise<void>;

  // Discussion operations
  getDiscussions(category?: string, limit?: number, sortBy?: string, searchTerm?: string): Promise<(Discussion & { user: User })[]>;
  getDiscussion(id: string): Promise<(Discussion & { user: User; replies: (DiscussionReply & { user: User })[] }) | undefined>;
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  updateDiscussion(id: string, updates: { title?: string; content?: string }): Promise<Discussion>;
  
  // Reply operations
  createReply(reply: InsertDiscussionReply): Promise<DiscussionReply>;
  getDiscussionReplies(discussionId: string): Promise<(DiscussionReply & { user: User })[]>;
  updateDiscussionReply(replyId: string, userId: string, content: string, discussionId?: string): Promise<DiscussionReply | null>;
  updateHurdleWallReply(replyId: string, userId: string, content: string): Promise<HurdleWallReply | null>;
  
  // Like/Dislike operations
  toggleDiscussionLike(discussionId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }>;
  getDiscussionLikers(discussionId: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null }[]>;
  toggleDiscussionDislike(discussionId: string, userId: string): Promise<{ disliked: boolean; totalDislikes: number }>;
  toggleDiscussionReplyDislike(replyId: string, userId: string): Promise<{ disliked: boolean; totalDislikes: number }>;
  
  // Discussion subscription operations
  subscribeToDiscussion(subscription: InsertDiscussionSubscription): Promise<DiscussionSubscription>;
  unsubscribeFromDiscussion(discussionId: string, userId: string): Promise<void>;
  isSubscribedToDiscussion(discussionId: string, userId: string): Promise<boolean>;
  getDiscussionSubscribers(discussionId: string): Promise<DiscussionSubscription[]>;
  
  // Devotional operations
  getTodaysDevotional(): Promise<Devotional | undefined>;
  getDevotional(id: string): Promise<Devotional | undefined>;
  getDevotionals(limit?: number): Promise<Devotional[]>;
  createDevotional(devotional: InsertDevotional): Promise<Devotional>;
  updateDevotional(id: string, devotional: Partial<InsertDevotional>): Promise<Devotional | undefined>;
  getSavedDevotionals(userId: string): Promise<(SavedDevotional & { devotional: Devotional })[]>;
  isDevotionalSaved(userId: string, devotionalId: string): Promise<boolean>;
  toggleSaveDevotional(userId: string, devotionalId: string): Promise<boolean>;
  deleteDevotional(id: string): Promise<void>;
  saveDevotionalReflection(userId: string, devotionalId: string, text: string): Promise<void>;
  getDevotionalReflections(userId: string): Promise<(DevotionalReflection & { devotional: Devotional })[]>;
  getDevotionalReflection(userId: string, devotionalId: string): Promise<DevotionalReflection | undefined>;
  
  // Rating operations
  rateStudy(rating: InsertStudyRating): Promise<StudyRating>;
  getStudyReviews(studyId: string): Promise<(StudyRating & { user: { firstName: string | null; lastName: string | null; profileImageUrl?: string | null } })[]>;
  deleteStudyRating(ratingId: string): Promise<boolean>;
  
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
  deleteVideoRating(ratingId: string): Promise<boolean>;
  
  // Title validation
  checkTitleExists(title: string, excludeStudyId?: string, excludeVideoId?: string): Promise<boolean>;
  
  // Admin operations
  getAllUsers(limit?: number): Promise<User[]>;
  getAdminUsersPage(options: { page: number; pageSize: number; sortBy: string; search?: string; statusFilter?: string; subscriptionFilter?: string | null }): Promise<{ users: User[]; total: number }>;
  updateUserRole(userId: string, role: string): Promise<User>;
  updateUserSubscription(userId: string, subscriptionTier: string): Promise<User>;
  setUserFitnessAccess(userId: string, hasAccess: boolean): Promise<User>;
  updateUserSubscriptionDetails(userId: string, details: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    trialStartDate?: Date;
    trialEndDate?: Date;
  }): Promise<User>;
  cancelUserSubscription(userId: string): Promise<User>;
  reactivateUserSubscription(userId: string, currentPeriodEnd?: Date): Promise<User>;
  checkExpiredSubscriptions(): Promise<User[]>;
  banUser(userId: string, reason: string): Promise<User>;
  unbanUser(userId: string): Promise<User>;
  deleteUserPermanently(userId: string): Promise<void>;
  getSystemStats(): Promise<{
    totalUsers: number;
    totalStudies: number;
    activeToday: number;
    newPosts: number;
    activeSubscribers: number;
    cancelledAfter7Days: number;
    nonSubscribersAfter7Days: number;
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
  deletePodcastRating(ratingId: string): Promise<boolean>;
  getUserPodcastRating(userId: string, podcastId: string): Promise<PodcastRating | undefined>;
  incrementPodcastViews(podcastId: string, userId?: string, ipAddress?: string): Promise<void>;
  // Live streaming operations
  startLiveStream(podcastId: string, liveUrl: string): Promise<Podcast>;
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
  
  // Challenge participation operations
  acceptChallenge(userId: string, challengeId: string): Promise<ChallengeParticipant>;
  getChallengeParticipantCount(challengeId: string): Promise<number>;
  hasUserAcceptedChallenge(userId: string, challengeId: string): Promise<boolean>;
  getChallengeParticipation(userId: string, challengeId: string): Promise<ChallengeParticipant | undefined>;
  completeChallenge(userId: string, challengeId: string): Promise<void>;
  getChallenge(id: string): Promise<Challenge | undefined>;

  // Daily challenge check-ins
  getDailyChallengeCheckins(userId: string, challengeId: string): Promise<ChallengeDailyCheckin[]>;
  addDailyChallengeCheckin(userId: string, challengeId: string, dayNumber: number): Promise<ChallengeDailyCheckin>;
  hasDailyCheckin(userId: string, challengeId: string, dayNumber: number): Promise<boolean>;

  // Content flagging operations
  flagContent(flagData: InsertContentFlag): Promise<ContentFlag>;
  notifyAdminsOfFlag(flag: ContentFlag): Promise<void>;
  getAllFlags(): Promise<(ContentFlag & { reporter: { firstName: string | null; lastName: string | null }; contentUrl: string })[]>;
  updateFlagStatus(flagId: string, updateData: {
    status: string;
    reviewNotes?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
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
    id: string;
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
  getHurdleWallPosts(userId?: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    userHasPrayed: boolean;
    userHasAmened: boolean;
    replyCount: number;
    praise: HurdleWallPraise | null;
    amenCount: number;
  })[]>;
  getHurdleWallPost(postId: string, userId?: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
    userHasPrayed: boolean;
    userHasAmened: boolean;
    praise: HurdleWallPraise | null;
    amenCount: number;
  }) | undefined>;
  createHurdleWallPost(post: InsertHurdleWallPost): Promise<HurdleWallPost>;
  createHurdleWallReply(reply: InsertHurdleWallReply): Promise<HurdleWallReply>;
  prayForPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }>;
  removePrayerFromPost(userId: string, postId: string): Promise<{ success: boolean; prayerCount: number }>;
  createHurdleWallPraise(postId: string, userId: string, content: string): Promise<{ success: boolean; praise?: HurdleWallPraise }>;
  updateHurdleWallPraise(postId: string, userId: string, content: string): Promise<HurdleWallPraise | null>;
  deleteHurdleWallPraise(postId: string, userId: string): Promise<boolean>;
  addAmenToPost(postId: string, userId: string): Promise<{ success: boolean; amenCount: number }>;
  removeAmenFromPost(postId: string, userId: string): Promise<{ success: boolean; amenCount: number }>;
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

  // Favorite exercises operations
  getFavoriteExercises(userId: string): Promise<FavoriteExercise[]>;
  addFavoriteExercise(exercise: InsertFavoriteExercise): Promise<FavoriteExercise>;
  removeFavoriteExercise(userId: string, exerciseId: string): Promise<void>;
  isFavoriteExercise(userId: string, exerciseId: string): Promise<boolean>;

  // Fitness plans operations
  getFitnessPlans(userId: string): Promise<(FitnessPlan & { exercises: FitnessPlanExercise[] })[]>;
  getFitnessPlan(id: string): Promise<FitnessPlan | undefined>;
  createFitnessPlan(plan: InsertFitnessPlan): Promise<FitnessPlan>;
  updateFitnessPlan(id: string, updates: Partial<InsertFitnessPlan>): Promise<FitnessPlan>;
  deleteFitnessPlan(id: string): Promise<void>;
  getFitnessPlanWithExercises(id: string): Promise<(FitnessPlan & { exercises: FitnessPlanExercise[] }) | undefined>;

  // Fitness plan exercises operations
  getFitnessPlanExercises(planId: string): Promise<FitnessPlanExercise[]>;
  addExerciseToPlan(exercise: InsertFitnessPlanExercise): Promise<FitnessPlanExercise>;
  updatePlanExercise(id: string, updates: Partial<InsertFitnessPlanExercise>): Promise<FitnessPlanExercise>;
  removePlanExercise(id: string): Promise<void>;
  reorderPlanExercises(planId: string, exerciseOrders: { id: string; orderIndex: number }[]): Promise<void>;

  // Fitness plan reminders operations
  getFitnessPlanReminders(planId: string): Promise<FitnessPlanReminder[]>;
  addReminderToPlan(reminder: InsertFitnessPlanReminder): Promise<FitnessPlanReminder>;
  updatePlanReminder(id: string, updates: Partial<InsertFitnessPlanReminder>): Promise<FitnessPlanReminder>;
  removePlanReminder(id: string): Promise<void>;
  getActiveReminders(): Promise<(FitnessPlanReminder & { plan: { name: string; userId: string } })[]>;
  getDueFitnessReminders(dayOfWeek: string, currentTime: string): Promise<Array<FitnessPlanReminder & { plan: FitnessPlan }>>;
  getTodayFitnessPlanExercises(planId: string, dayOfWeek: string): Promise<FitnessPlanExercise[]>;
  markFitnessReminderSent(reminderId: string): Promise<void>;
  
  // Exercise completion operations for weekly progression
  markExerciseComplete(userId: string, planId: string, exerciseId: string): Promise<ExerciseCompletion>;
  unmarkExerciseComplete(userId: string, exerciseId: string): Promise<void>;
  recordWorkoutFeedback(userId: string, planId: string, workoutType: string, feeling: 'too_hard' | 'just_right' | 'too_easy', completionPct?: number): Promise<WorkoutFeedback>;
  getRecentWorkoutFeedback(userId: string, workoutType: string, limit?: number): Promise<WorkoutFeedback[]>;
  resetWorkoutStreaks(userId: string, reason?: string, workoutTypes?: string[]): Promise<void>;
  getExerciseCompletions(userId: string, planId: string): Promise<ExerciseCompletion[]>;

  // Food intake operations
  addFoodIntakeEntry(entry: InsertFoodIntakeEntry): Promise<FoodIntakeEntry>;
  getFoodIntakeEntries(userId: string, startDate: string, endDate: string): Promise<FoodIntakeEntry[]>;
  deleteFoodIntakeEntry(id: string, userId: string): Promise<void>;

  // VATMEBOP accountability chart
  getVatmebopChart(userId: string, year: number): Promise<VatmebopCheck[]>;
  upsertVatmebopCheck(userId: string, year: number, week: number, disciplines: Partial<Record<'v'|'a'|'t'|'m'|'e'|'b'|'o'|'p', number>>): Promise<VatmebopCheck>;

  // Events operations
  getEvents(): Promise<(Event & { tiers: EventTier[] })[]>;
  getEventById(id: string): Promise<(Event & { tiers: EventTier[] }) | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  getEventTiers(eventId: string): Promise<EventTier[]>;
  replaceEventTiers(eventId: string, tiers: Omit<InsertEventTier, 'eventId'>[]): Promise<EventTier[]>;
  registerForEvent(registration: InsertEventRegistration): Promise<EventRegistration>;
  getEventRegistration(eventId: string, userId: string): Promise<EventRegistration | undefined>;
  getUserEventRegistrations(userId: string): Promise<(EventRegistration & { event: Event })[]>;
  getEventRegistrations(eventId: string): Promise<{ registrationId: string; userId: string; firstName: string | null; lastName: string | null; email: string | null; registrationType: string; paymentStatus: string; amountPaid: string | null; tierName: string | null; registeredAt: Date | null }[]>;

  // Live stream operations
  getLiveStreams(): Promise<LiveStream[]>;
  getActiveLiveStream(): Promise<LiveStream | null>;
  getLiveStream(id: string): Promise<LiveStream | undefined>;
  createLiveStream(stream: InsertLiveStream): Promise<LiveStream>;
  startLiveStream(id: string): Promise<LiveStream>;
  endLiveStream(id: string): Promise<LiveStream>;
  deleteLiveStream(id: string): Promise<void>;

  // Store operations
  getStoreProducts(tier?: string): Promise<StoreProduct[]>;
  getStoreProduct(id: string): Promise<StoreProduct | undefined>;
  createStoreProduct(product: InsertStoreProduct): Promise<StoreProduct>;
  updateStoreProduct(id: string, product: Partial<InsertStoreProduct>): Promise<StoreProduct>;
  deleteStoreProduct(id: string): Promise<void>;
  
  // Store redemption operations
  redeemProduct(userId: string, productId: string, shippingInfo?: {
    shippingName?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingZip?: string;
    shippingPhone?: string;
    shippingEmail?: string;
  }, selectedSize?: string): Promise<StoreRedemption>;
  getUserRedemptions(userId: string): Promise<(StoreRedemption & { product: StoreProduct })[]>;
  getAllRedemptions(status?: string): Promise<(StoreRedemption & { product: StoreProduct; user: User })[]>;
  updateRedemptionStatus(id: string, status: string, fulfilledBy?: string, trackingNumber?: string): Promise<StoreRedemption>;
  
  // Accountability requests operations
  getAccountabilityRequests(currentUserId?: string): Promise<any[]>;
  getAccountabilityRequestById(id: string): Promise<any | undefined>;
  createAccountabilityRequest(request: { userId: string; content: string }): Promise<any>;
  markAccountabilityRequestAssisted(requestId: string, assisterId: string): Promise<any>;
  unassistAccountabilityRequest(requestId: string): Promise<any>;
  deleteAccountabilityRequest(id: string): Promise<void>;
  toggleAccountabilitySupport(requestId: string, userId: string): Promise<{ supported: boolean; totalSupports: number }>;

  getActiveManUpLinks(): Promise<ManUpLink[]>;
  getAllManUpLinks(): Promise<ManUpLink[]>;
  getBibleReadingPlans(): Promise<BibleReadingPlan[]>;
  getBibleReadingPlanDays(planId: string): Promise<BibleReadingPlanDay[]>;
  getBibleReadingProgress(userId: string, planId: string): Promise<BibleReadingProgress[]>;
  markBibleReadingDayComplete(userId: string, planId: string, dayNumber: number): Promise<BibleReadingProgress>;
  unmarkBibleReadingDayComplete(userId: string, planId: string, dayNumber: number): Promise<void>;
  getBibleReadingConsecutiveDays(userId: string, planId: string): Promise<number>;
  seedBiblePlan(planData: { name: string; description: string; planType: string }, days: Array<{ dayNumber: number; title: string; passages: string }>): Promise<BibleReadingPlan>;
  getManUpLink(id: string): Promise<ManUpLink | undefined>;
  createManUpLink(link: InsertManUpLink): Promise<ManUpLink>;
  updateManUpLink(id: string, link: Partial<InsertManUpLink>): Promise<ManUpLink>;
  deleteManUpLink(id: string): Promise<void>;

  // Prayer reminder operations
  getPrayerReminders(userId: string): Promise<PrayerReminder | undefined>;
  upsertPrayerReminders(userId: string, data: Partial<PrayerReminder>): Promise<PrayerReminder>;
  getAllPrayerReminders(): Promise<PrayerReminder[]>;

  // Daily app reminder operations
  getDailyReminder(userId: string): Promise<DailyAppReminder | undefined>;
  upsertDailyReminder(userId: string, data: Partial<DailyAppReminder>): Promise<DailyAppReminder>;
  getAllDailyReminders(): Promise<DailyAppReminder[]>;
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

  // Study Series operations
  async getStudySeries(category?: string): Promise<any[]> {
    const conditions = [eq(studySeries.isPublished, true)];
    if (category && category !== 'all') {
      conditions.push(eq(studySeries.category, category));
    }
    
    const seriesList = await db.select().from(studySeries)
      .where(and(...conditions))
      .orderBy(asc(studySeries.displayOrder), desc(studySeries.createdAt));
    
    if (seriesList.length === 0) return [];

    // Batch-fetch all published studies for all series in one query
    const allStudies = await db.select().from(studies)
      .where(and(
        inArray(studies.seriesId, seriesList.map(s => s.id)),
        eq(studies.isPublished, true)
      ));

    // Group by seriesId in memory
    const studiesBySeriesId = new Map<string, typeof allStudies>();
    for (const study of allStudies) {
      if (!studiesBySeriesId.has(study.seriesId!)) studiesBySeriesId.set(study.seriesId!, []);
      studiesBySeriesId.get(study.seriesId!)!.push(study);
    }

    return seriesList.map(s => {
      const seriesStudies = studiesBySeriesId.get(s.id) ?? [];
      const totalLessons = seriesStudies.reduce((sum, study) => sum + (study.totalDays || 0), 0);
      return { ...s, studyCount: seriesStudies.length, totalLessons };
    });
  }

  async getAllStudySeries(): Promise<any[]> {
    const seriesList = await db.select().from(studySeries)
      .orderBy(asc(studySeries.displayOrder), desc(studySeries.createdAt));

    if (seriesList.length === 0) return [];

    // Batch-fetch all studies for all series in one query
    const allStudies = await db.select({ seriesId: studies.seriesId })
      .from(studies)
      .where(inArray(studies.seriesId, seriesList.map(s => s.id)));

    // Count studies per seriesId in memory
    const countBySeriesId = new Map<string, number>();
    for (const s of allStudies) {
      countBySeriesId.set(s.seriesId!, (countBySeriesId.get(s.seriesId!) ?? 0) + 1);
    }

    return seriesList.map(s => ({ ...s, studyCount: countBySeriesId.get(s.id) ?? 0 }));
  }

  async getStudySeriesById(id: string): Promise<any | undefined> {
    const [series] = await db.select().from(studySeries).where(eq(studySeries.id, id));
    return series;
  }

  async getStudiesInSeries(seriesId: string, userId?: string): Promise<any[]> {
    // First get the series to check if it requires consecutive completion
    const [series] = await db.select().from(studySeries)
      .where(eq(studySeries.id, seriesId));
    
    const requiresConsecutive = series?.requiresConsecutiveCompletion ?? false;
    
    const seriesStudies = await db.select().from(studies)
      .where(and(
        eq(studies.seriesId, seriesId),
        eq(studies.isPublished, true)
        // Note: future-scheduled studies are included so the full series roadmap is visible
        // They are shown as locked with their scheduled unlock date
      ))
      .orderBy(asc(studies.seriesOrder), asc(studies.createdAt));
    
    const allStudyIds = seriesStudies.map(s => s.id);

    // Batch-fetch all lessons for all studies in one query
    const allLessons = allStudyIds.length > 0
      ? await db.select().from(studyLessons)
        .where(inArray(studyLessons.studyId, allStudyIds))
      : [];

    // Group lessons by studyId in memory
    const lessonsByStudyId = new Map<string, typeof allLessons>();
    for (const l of allLessons) {
      if (!lessonsByStudyId.has(l.studyId)) lessonsByStudyId.set(l.studyId, []);
      lessonsByStudyId.get(l.studyId)!.push(l);
    }

    // Get progress for each study if user is logged in
    if (userId) {
      const allLessonIds = allLessons.map(l => l.id);

      // Batch-fetch all lesson progress for all lessons in one query
      const allLessonProgress = allLessonIds.length > 0
        ? await db.select().from(userLessonProgress)
          .where(and(
            eq(userLessonProgress.userId, userId),
            inArray(userLessonProgress.lessonId, allLessonIds)
          ))
        : [];

      // Map lesson progress by lessonId for O(1) lookup
      const lessonProgressByLessonId = new Map(allLessonProgress.map(lp => [lp.lessonId, lp]));

      // Batch-fetch all study-level progress for all studies in one query
      const allUserProgress = allStudyIds.length > 0
        ? await db.select().from(userProgress)
          .where(and(
            eq(userProgress.userId, userId),
            inArray(userProgress.studyId, allStudyIds)
          ))
        : [];

      const userProgressByStudyId = new Map(allUserProgress.map(p => [p.studyId, p]));

      // Pre-calculate completion status for consecutive-locking logic (pure in-memory)
      const studyCompletionStatus: Map<string, boolean> = new Map();
      const studyCompletionTime: Map<string, Date | null> = new Map();

      for (const study of seriesStudies) {
        const lessons = lessonsByStudyId.get(study.id) ?? [];
        if (lessons.length === 0) {
          const progress = userProgressByStudyId.get(study.id);
          studyCompletionStatus.set(study.id, progress?.completed ?? false);
          studyCompletionTime.set(study.id, progress?.completedAt ? new Date(progress.completedAt) : null);
        } else {
          const completedLessons = lessons.filter(l => !!lessonProgressByLessonId.get(l.id)?.completedAt);
          const isComplete = completedLessons.length >= lessons.length;
          studyCompletionStatus.set(study.id, isComplete);
          if (isComplete && completedLessons.length > 0) {
            const latestCompletion = completedLessons.reduce((latest, l) => {
              const t = lessonProgressByLessonId.get(l.id)?.completedAt
                ? new Date(lessonProgressByLessonId.get(l.id)!.completedAt!)
                : new Date(0);
              return t > latest ? t : latest;
            }, new Date(0));
            studyCompletionTime.set(study.id, latestCompletion);
          } else {
            studyCompletionTime.set(study.id, null);
          }
        }
      }

      // Build enriched study list purely in memory — no further DB queries
      const enrichedStudies = seriesStudies.map((study, index) => {
        const progress = userProgressByStudyId.get(study.id) ?? null;
        const lessons = lessonsByStudyId.get(study.id) ?? [];

        const completedLessonsCount = lessons.filter(
          l => !!lessonProgressByLessonId.get(l.id)?.completedAt
        ).length;

        let isLockedByPrevious = false;
        let isLockedByDrip = false;
        let isScheduledFuture = false;
        let unlocksAt: Date | null = null;

        // Check if this study has a future scheduled publish date
        if (study.scheduledPublishDate) {
          const now = new Date();
          const scheduleDate = new Date(study.scheduledPublishDate);
          if (scheduleDate > now) {
            isScheduledFuture = true;
            unlocksAt = scheduleDate;
          }
        }

        if (requiresConsecutive && index > 0) {
          const previousStudyId = seriesStudies[index - 1].id;
          const previousComplete = studyCompletionStatus.get(previousStudyId) ?? false;
          isLockedByPrevious = !previousComplete;
          // No inter-week drip: once the previous week is fully complete the next week
          // opens immediately. The per-lesson 24-hour drip within each week already
          // enforces the daily cadence, so an extra midnight gate here is redundant
          // and causes users to see the week remain locked after completing the previous one.
        }

        const isLocked = isLockedByDrip || isLockedByPrevious || isScheduledFuture;

        const sortedLessons = [...lessons].sort((a, b) =>
          (a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0)
        );

        // Cross-study drip: find the previous study's last lesson completion time
        // so Day 1 of this study is gated until midnight after Day 7 of the prior study.
        let prevStudyLastCompletedAt: Date | null = null;
        if (index > 0) {
          const prevStudy = seriesStudies[index - 1];
          const prevStudyLessons = (lessonsByStudyId.get(prevStudy.id) ?? [])
            .slice()
            .sort((a, b) => (a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0));
          if (prevStudyLessons.length > 0) {
            const lastLesson = prevStudyLessons[prevStudyLessons.length - 1];
            const lastProg = lessonProgressByLessonId.get(lastLesson.id);
            if (lastProg?.completedAt) {
              prevStudyLastCompletedAt = new Date(lastProg.completedAt);
            }
          }
        }

        const lessonList = sortedLessons.map((l, li) => {
          const prog = lessonProgressByLessonId.get(l.id);
          const isCompleted = !!prog?.completedAt;
          let lessonIsLocked = false;
          let lessonUnlocksAt: string | null = null;
          // drip_bypassed=true means admin unlocked this lesson — skip drip gate entirely
          const dripBypassed = !!prog?.dripBypassed;
          if (!dripBypassed) {
            if (li === 0) {
              // Day 1: gate against the previous study's last lesson completion time
              if (prevStudyLastCompletedAt) {
                const unlockTime = getNextMidnightInTimezone(prevStudyLastCompletedAt, 'America/New_York');
                if (new Date() < unlockTime) {
                  lessonIsLocked = true;
                  lessonUnlocksAt = unlockTime.toISOString();
                }
              }
            } else {
              const prevLesson = sortedLessons[li - 1];
              const prevProg = lessonProgressByLessonId.get(prevLesson.id);
              if (!prevProg?.completedAt) {
                lessonIsLocked = true;
              } else {
                const prevCompleted = new Date(prevProg.completedAt);
                const unlockTime = getNextMidnightInTimezone(prevCompleted, 'America/New_York');
                if (new Date() < unlockTime) {
                  lessonIsLocked = true;
                  lessonUnlocksAt = unlockTime.toISOString();
                }
              }
            }
          }
          return {
            id: l.id,
            title: l.title,
            dayNumber: l.dayNumber,
            isCompleted,
            isLocked: lessonIsLocked,
            unlocksAt: lessonUnlocksAt,
            dripBypassed,
          };
        });

        return {
          ...study,
          progress: progress || null,
          completedLessons: completedLessonsCount,
          totalLessons: lessons.length,
          lessons: lessonList,
          isLockedByPrevious: isLocked,
          isLockedByDrip,
          isScheduledFuture,
          unlocksAt: unlocksAt?.toISOString() || null,
          studyNumber: index + 1,
          totalStudiesInSeries: seriesStudies.length,
        };
      });

      return enrichedStudies;
    }

    // For non-authenticated users — all data already in memory, no more queries
    return seriesStudies.map((study, index) => {
      const lessons = lessonsByStudyId.get(study.id) ?? [];
      const isScheduledFuture = !!(study.scheduledPublishDate && new Date(study.scheduledPublishDate) > new Date());
      const isLocked = (requiresConsecutive && index > 0) || isScheduledFuture;

      return {
        ...study,
        progress: null,
        completedLessons: 0,
        totalLessons: lessons.length,
        lessons: lessons.map(l => ({ id: l.id, title: l.title, dayNumber: l.dayNumber, isCompleted: false })),
        isLockedByPrevious: isLocked,
        isScheduledFuture,
        unlocksAt: isScheduledFuture ? new Date(study.scheduledPublishDate!).toISOString() : null,
        studyNumber: index + 1,
        totalStudiesInSeries: seriesStudies.length,
      };
    });
  }

  async startUserSeries(userId: string, seriesId: string): Promise<any> {
    // Check if already started
    const [existing] = await db.select().from(userSeriesProgress)
      .where(and(
        eq(userSeriesProgress.userId, userId),
        eq(userSeriesProgress.seriesId, seriesId)
      ));
    
    if (existing) {
      return existing;
    }
    
    // Create new series progress
    const [progress] = await db.insert(userSeriesProgress)
      .values({
        userId,
        seriesId,
        startedAt: new Date(),
      })
      .returning();
    
    return progress;
  }

  async getUserSeriesProgress(userId: string, seriesId: string): Promise<any | null> {
    const [progress] = await db.select().from(userSeriesProgress)
      .where(and(
        eq(userSeriesProgress.userId, userId),
        eq(userSeriesProgress.seriesId, seriesId)
      ));
    return progress || null;
  }

  async createStudySeries(series: any): Promise<any> {
    const [newSeries] = await db.insert(studySeries).values(series).returning();
    return newSeries;
  }

  async updateStudySeries(id: string, series: any): Promise<any> {
    const [updated] = await db.update(studySeries)
      .set({ ...series, updatedAt: new Date() })
      .where(eq(studySeries.id, id))
      .returning();
    return updated;
  }

  async deleteStudySeries(id: string): Promise<void> {
    await db.delete(studySeries).where(eq(studySeries.id, id));
  }

  // Auto-publish scheduled studies that are due
  async autoPublishScheduledStudies(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(studies)
      .set({ isPublished: true, updatedAt: now })
      .where(and(
        eq(studies.isPublished, false),
        sql`${studies.scheduledPublishDate} IS NOT NULL AND ${studies.scheduledPublishDate} <= NOW()`
      ))
      .returning({ id: studies.id });
    
    return result.length;
  }

  // Study operations
  async getStudies(category?: string, requiredTier?: string, isAdmin?: boolean): Promise<Study[]> {
    // Auto-publish any scheduled studies that are now due
    await this.autoPublishScheduledStudies();
    const conditions = [];
    
    // Only filter by published status if not admin
    if (!isAdmin) {
      conditions.push(eq(studies.isPublished, true));
      // Exclude studies scheduled for the future (not yet published)
      conditions.push(
        sql`(${studies.scheduledPublishDate} IS NULL OR ${studies.scheduledPublishDate} <= NOW())`
      );
    }
    
    if (category) {
      conditions.push(eq(studies.category, category));
    }
    
    if (requiredTier) {
      conditions.push(eq(studies.requiredTier, requiredTier));
    }
    
    return await db.select().from(studies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(studies.displayOrder), desc(studies.createdAt));
  }

  async getIndividualStudies(category?: string): Promise<Study[]> {
    const conditions = [
      eq(studies.isPublished, true),
      isNull(studies.seriesId),
      // Exclude studies scheduled for the future
      sql`(${studies.scheduledPublishDate} IS NULL OR ${studies.scheduledPublishDate} <= NOW())`
    ];
    
    if (category && category !== 'all') {
      conditions.push(eq(studies.category, category));
    }
    
    return await db.select().from(studies)
      .where(and(...conditions))
      .orderBy(asc(studies.displayOrder), desc(studies.createdAt));
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
    
    const isSubscriber = (user.subscriptionStatus === 'active') || (user.subscriptionStatus === 'past_due') || (user.subscriptionTier === 'subscriber');
    
    // Get user's completed studies to understand their interests
    const completedProgress = await db
      .select({ category: studies.category })
      .from(userProgress)
      .innerJoin(studies, eq(userProgress.studyId, studies.id))
      .where(and(
        eq(userProgress.userId, userId),
        isNotNull(userProgress.completedAt)
      ));
    
    const studiedCategories = Array.from(new Set(completedProgress.map(p => p.category)));
    
    // Get recommendations based on subscription status
    const getTierRecommendations = async () => {
      let recommendations: Study[] = [];
      
      // Get accessible studies for this user
      const accessibleStudies = await db
        .select()
        .from(studies)
        .where(and(
          eq(studies.isPublished, true),
          isSubscriber ? sql`1=1` : eq(studies.requiredTier, 'free'),
          studiedCategories.length > 0 ? inArray(studies.category, studiedCategories) : sql`1=1`
        ))
        .orderBy(desc(studies.rating), desc(studies.createdAt))
        .limit(limit);
      
      recommendations.push(...accessibleStudies);
      return recommendations;
    };
    
    // If user has no completed studies, get top-rated studies across all categories
    if (studiedCategories.length === 0) {
      const topRatedStudies = await getTierRecommendations();
      if (topRatedStudies.length > 0) {
        return topRatedStudies.slice(0, limit);
      }
      
      // Fallback: get any published studies accessible at the user's tier
      return await db
        .select()
        .from(studies)
        .where(and(
          eq(studies.isPublished, true),
          isSubscriber ? sql`1=1` : eq(studies.requiredTier, 'free')
        ))
        .orderBy(desc(studies.rating), desc(studies.createdAt))
        .limit(limit);
    }
    
    // Get recommendations based on studied categories + tier logic
    const categoryBasedRecs = await getTierRecommendations();
    return categoryBasedRecs.slice(0, limit);
  }

  // Study lesson operations
  async getStudyLessons(studyId: string): Promise<StudyLesson[]> {
    return await db
      .select()
      .from(studyLessons)
      .where(eq(studyLessons.studyId, studyId))
      .orderBy(asc(studyLessons.displayOrder));
  }

  async getStudyLesson(lessonId: string): Promise<StudyLesson | undefined> {
    const [lesson] = await db
      .select()
      .from(studyLessons)
      .where(eq(studyLessons.id, lessonId))
      .limit(1);
    return lesson;
  }

  async createStudyLesson(lesson: InsertStudyLesson): Promise<StudyLesson> {
    const [newLesson] = await db
      .insert(studyLessons)
      .values(lesson)
      .returning();
    return newLesson;
  }

  async updateStudyLesson(id: string, lesson: Partial<InsertStudyLesson>): Promise<StudyLesson> {
    const [updatedLesson] = await db
      .update(studyLessons)
      .set({ ...lesson, updatedAt: new Date() })
      .where(eq(studyLessons.id, id))
      .returning();
    return updatedLesson;
  }

  async deleteStudyLesson(id: string): Promise<void> {
    await db.delete(studyLessons).where(eq(studyLessons.id, id));
  }

  async deleteAllStudyLessons(studyId: string): Promise<void> {
    await db.delete(studyLessons).where(eq(studyLessons.studyId, studyId));
  }

  // Lesson progress operations
  async getLessonProgressForLessons(userId: string, lessonIds: string[]): Promise<UserLessonProgress[]> {
    if (lessonIds.length === 0) return [];
    return await db.select()
      .from(userLessonProgress)
      .where(and(
        eq(userLessonProgress.userId, userId),
        inArray(userLessonProgress.lessonId, lessonIds)
      ));
  }

  async getUserLessonProgress(userId: string, studyId?: string): Promise<UserLessonProgress[]> {
    const conditions = [eq(userLessonProgress.userId, userId)];
    
    if (studyId) {
      // Filter by studyId through a join with studyLessons — select ALL columns
      const result = await db
        .select({
          id: userLessonProgress.id,
          userId: userLessonProgress.userId,
          lessonId: userLessonProgress.lessonId,
          completedAt: userLessonProgress.completedAt,
          isCompleted: userLessonProgress.isCompleted,
          dripBypassed: userLessonProgress.dripBypassed,
          answers: userLessonProgress.answers,
          createdAt: userLessonProgress.createdAt,
          updatedAt: userLessonProgress.updatedAt,
        })
        .from(userLessonProgress)
        .innerJoin(studyLessons, eq(userLessonProgress.lessonId, studyLessons.id))
        .where(and(
          eq(userLessonProgress.userId, userId),
          eq(studyLessons.studyId, studyId)
        ));
      
      return result;
    }
    
    return await db
      .select()
      .from(userLessonProgress)
      .where(and(...conditions));
  }

  async markLessonComplete(userId: string, lessonId: string, answers?: Record<string, string>, userTimezone?: string): Promise<UserLessonProgress> {
    // First, get the lesson to find its studyId
    const [lesson] = await db
      .select()
      .from(studyLessons)
      .where(eq(studyLessons.id, lessonId));

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(userLessonProgress)
      .where(and(
        eq(userLessonProgress.userId, userId),
        eq(userLessonProgress.lessonId, lessonId)
      ));

    const now = new Date();

    let result: UserLessonProgress;

    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(userLessonProgress)
        .set({
          isCompleted: true,
          completedAt: now,
          answers: answers || existing.answers,
          updatedAt: now,
        })
        .where(and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.lessonId, lessonId)
        ))
        .returning();
      
      result = updated;
    } else {
      // Create new progress record
      const [newProgress] = await db
        .insert(userLessonProgress)
        .values({
          userId,
          lessonId,
          isCompleted: true,
          completedAt: now,
          answers,
        })
        .returning();
      
      result = newProgress;
    }

    // Ensure userProgress entry exists for this study
    const [existingStudyProgress] = await db
      .select()
      .from(userProgress)
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.studyId, lesson.studyId)
      ));

    if (!existingStudyProgress) {
      // Create userProgress entry for the study
      await db
        .insert(userProgress)
        .values({
          userId,
          studyId: lesson.studyId,
          status: 'in_progress',
          lastAccessedAt: now,
        });
    } else {
      // Update last accessed time
      await db
        .update(userProgress)
        .set({
          lastAccessedAt: now,
        })
        .where(and(
          eq(userProgress.userId, userId),
          eq(userProgress.studyId, lesson.studyId)
        ));
    }

    // Auto-complete the study if every lesson in it is now complete.
    // We ALWAYS recompute (no early-out) so historical rows that drifted
    // out of sync — e.g. from older code that didn't flip status, or from
    // the admin force-complete endpoint that didn't set isCompleted — get
    // healed the next time any lesson in the study is touched.
    const studyLessonRows = await db
      .select({ id: studyLessons.id })
      .from(studyLessons)
      .where(eq(studyLessons.studyId, lesson.studyId));

    const totalLessons = studyLessonRows.length;
    if (totalLessons > 0) {
      const lessonIds = studyLessonRows.map(l => l.id);
      const completedRows = await db
        .select({ id: userLessonProgress.lessonId })
        .from(userLessonProgress)
        .where(and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.isCompleted, true),
          inArray(userLessonProgress.lessonId, lessonIds)
        ));

      const completedCount = new Set(completedRows.map(r => r.id)).size;
      if (completedCount >= totalLessons) {
        // Idempotent upsert — guarantees status / isCompleted / completedAt
        // are all set together, regardless of whether the row existed before.
        // Preserve the original completedAt if one is already set so the
        // public profile doesn't keep "shifting" the completion date forward.
        const preservedCompletedAt = existingStudyProgress?.completedAt ?? now;
        await db
          .insert(userProgress)
          .values({
            userId,
            studyId: lesson.studyId,
            status: 'completed',
            isCompleted: true,
            completedAt: preservedCompletedAt,
            lastAccessedAt: now,
          })
          .onConflictDoUpdate({
            target: [userProgress.userId, userProgress.studyId],
            set: {
              status: 'completed',
              isCompleted: true,
              completedAt: preservedCompletedAt,
              lastAccessedAt: now,
            },
          });
      }
    }

    // Update user's streak when they complete a lesson
    // Note: updateUserStreak has a guard clause that prevents multiple updates per day,
    // so this is safe to call even if the user completes multiple lessons in one day
    await this.updateUserStreak(userId, now, userTimezone);
    
    // Track daily activity for totalActiveDays (never resets) - use same date as streak
    await this.trackStudyActivityDay(userId, now, userTimezone);

    return result;
  }

  async saveLessonNotes(userId: string, lessonId: string, notes: string): Promise<UserLessonProgress> {
    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(userLessonProgress)
      .where(and(
        eq(userLessonProgress.userId, userId),
        eq(userLessonProgress.lessonId, lessonId)
      ));

    const now = new Date();

    if (existing) {
      // Update existing progress with notes
      const [updated] = await db
        .update(userLessonProgress)
        .set({
          notes,
          updatedAt: now,
        })
        .where(and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.lessonId, lessonId)
        ))
        .returning();
      
      return updated;
    } else {
      // Create new progress record with notes
      const [newProgress] = await db
        .insert(userLessonProgress)
        .values({
          userId,
          lessonId,
          notes,
        })
        .returning();
      
      return newProgress;
    }
  }

  // Purchase operations
  async checkUserPurchase(userId: string, studyId: string): Promise<boolean> {
    const [purchase] = await db
      .select()
      .from(userPurchases)
      .where(and(
        eq(userPurchases.userId, userId),
        eq(userPurchases.studyId, studyId),
        eq(userPurchases.status, 'completed')
      ))
      .limit(1);

    return !!purchase;
  }

  async getUserPurchases(userId: string): Promise<UserPurchase[]> {
    return await db
      .select()
      .from(userPurchases)
      .where(eq(userPurchases.userId, userId))
      .orderBy(desc(userPurchases.createdAt));
  }

  async createPurchase(purchase: InsertUserPurchase): Promise<UserPurchase> {
    const [newPurchase] = await db
      .insert(userPurchases)
      .values(purchase)
      .returning();
    return newPurchase;
  }

  // Study editable sections operations
  async getStudyEditableSections(studyId: string): Promise<StudyEditableSection[]> {
    return await db
      .select()
      .from(studyEditableSections)
      .where(eq(studyEditableSections.studyId, studyId))
      .orderBy(asc(studyEditableSections.displayOrder));
  }

  async createEditableSection(section: InsertStudyEditableSection): Promise<StudyEditableSection> {
    // Validate required fields
    if (!section.anchorKey || section.displayOrder === undefined || section.displayOrder === null) {
      throw new Error("anchorKey and displayOrder are required");
    }
    
    const [newSection] = await db
      .insert(studyEditableSections)
      .values({
        ...section,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newSection;
  }

  async updateEditableSection(id: string, section: Partial<InsertStudyEditableSection>): Promise<StudyEditableSection> {
    const [updatedSection] = await db
      .update(studyEditableSections)
      .set({ ...section, updatedAt: new Date() })
      .where(eq(studyEditableSections.id, id))
      .returning();
    return updatedSection;
  }

  async deleteEditableSection(id: string): Promise<void> {
    await db
      .delete(studyEditableSections)
      .where(eq(studyEditableSections.id, id));
  }

  // User study responses operations
  async getUserStudyResponses(userId: string, studyId: string): Promise<UserStudyResponse[]> {
    return await db
      .select()
      .from(userStudyResponses)
      .where(and(
        eq(userStudyResponses.userId, userId),
        eq(userStudyResponses.studyId, studyId)
      ));
  }

  async saveUserResponse(response: InsertUserStudyResponse): Promise<UserStudyResponse> {
    const [savedResponse] = await db
      .insert(userStudyResponses)
      .values({
        ...response,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [userStudyResponses.userId, userStudyResponses.studyId, userStudyResponses.sectionId],
        set: {
          responseText: response.responseText,
          updatedAt: new Date()
        }
      })
      .returning();
    return savedResponse;
  }

  async updateUserResponse(userId: string, sectionId: string, responseText: string): Promise<UserStudyResponse> {
    const [updatedResponse] = await db
      .update(userStudyResponses)
      .set({ responseText, updatedAt: new Date() })
      .where(and(
        eq(userStudyResponses.userId, userId),
        eq(userStudyResponses.sectionId, sectionId)
      ))
      .returning();
    return updatedResponse;
  }

  // Tier pricing operations
  async getTierPricing(): Promise<TierPricing[]> {
    return await db
      .select()
      .from(tierPricing)
      .where(eq(tierPricing.isActive, true))
      .orderBy(asc(tierPricing.tier));
  }

  async getTierPricingByTier(tier: string): Promise<TierPricing | undefined> {
    const [pricing] = await db
      .select()
      .from(tierPricing)
      .where(and(
        eq(tierPricing.tier, tier),
        eq(tierPricing.isActive, true)
      ))
      .limit(1);
    return pricing;
  }

  async updateTierPricing(tier: string, pricing: Partial<InsertTierPricing>): Promise<TierPricing> {
    const [updated] = await db
      .update(tierPricing)
      .set({
        ...pricing,
        updatedAt: new Date(),
      })
      .where(eq(tierPricing.tier, tier))
      .returning();
    return updated;
  }

  // Subscription settings operations
  async getSubscriptionSettings(): Promise<SubscriptionSettings | undefined> {
    const [settings] = await db
      .select()
      .from(subscriptionSettings)
      .where(eq(subscriptionSettings.isActive, true))
      .limit(1);
    return settings;
  }

  async updateSubscriptionSettings(settings: Partial<InsertSubscriptionSettings>): Promise<SubscriptionSettings> {
    const existing = await this.getSubscriptionSettings();
    if (existing) {
      const [updated] = await db
        .update(subscriptionSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(subscriptionSettings)
        .values({
          ...settings,
        })
        .returning();
      return created;
    }
  }

  async getStudiesTrialAccess(): Promise<{ id: string; title: string; isTrialAccessible: boolean }[]> {
    const allStudies = await db
      .select({
        id: studies.id,
        title: studies.title,
        isTrialAccessible: studies.isTrialAccessible,
      })
      .from(studies)
      .orderBy(asc(studies.title));
    return allStudies.map(s => ({
      id: s.id,
      title: s.title,
      isTrialAccessible: s.isTrialAccessible ?? false,
    }));
  }

  async updateStudyTrialAccess(studyIds: string[]): Promise<void> {
    await db
      .update(studies)
      .set({ isTrialAccessible: false });
    if (studyIds.length > 0) {
      await db
        .update(studies)
        .set({ isTrialAccessible: true })
        .where(inArray(studies.id, studyIds));
    }
  }

  // Carousel operations
  async getActiveCarouselItems(): Promise<CarouselItem[]> {
    return await db
      .select()
      .from(carouselItems)
      .where(eq(carouselItems.isActive, true))
      .orderBy(asc(carouselItems.displayOrder), asc(carouselItems.position));
  }

  async getAllCarouselItems(): Promise<CarouselItem[]> {
    return await db
      .select()
      .from(carouselItems)
      .orderBy(asc(carouselItems.displayOrder), asc(carouselItems.position));
  }

  async getCarouselItem(id: string): Promise<CarouselItem | undefined> {
    const [item] = await db
      .select()
      .from(carouselItems)
      .where(eq(carouselItems.id, id))
      .limit(1);
    return item;
  }

  async createCarouselItem(item: InsertCarouselItem): Promise<CarouselItem> {
    const [created] = await db
      .insert(carouselItems)
      .values(item)
      .returning();
    return created;
  }

  async updateCarouselItem(id: string, item: Partial<InsertCarouselItem>): Promise<CarouselItem> {
    const [updated] = await db
      .update(carouselItems)
      .set({
        ...item,
        updatedAt: new Date(),
      })
      .where(eq(carouselItems.id, id))
      .returning();
    return updated;
  }

  async deleteCarouselItem(id: string): Promise<void> {
    await db
      .delete(carouselItems)
      .where(eq(carouselItems.id, id));
  }

  async getActiveCarouselItemsForUser(userId: string): Promise<CarouselItem[]> {
    const allActive = await db
      .select()
      .from(carouselItems)
      .where(eq(carouselItems.isActive, true))
      .orderBy(asc(carouselItems.displayOrder), asc(carouselItems.position));

    const dismissals = await db
      .select({ carouselItemId: carouselDismissals.carouselItemId })
      .from(carouselDismissals)
      .where(eq(carouselDismissals.userId, userId));

    const dismissedIds = new Set(dismissals.map(d => d.carouselItemId));

    return allActive.filter(item => {
      if (item.isOneTime && dismissedIds.has(item.id)) {
        return false;
      }
      return true;
    });
  }

  async dismissCarouselItem(userId: string, carouselItemId: string): Promise<void> {
    await db
      .insert(carouselDismissals)
      .values({ userId, carouselItemId })
      .onConflictDoNothing();
  }

  // Progress operations
  async getUserProgress(userId: string, studyId?: string): Promise<(UserProgress & { study: Study | null; completedLessons?: number })[]> {
    const conditions = [eq(userProgress.userId, userId)];
    
    if (studyId) {
      conditions.push(eq(userProgress.studyId, studyId));
    }
    
    const progressRecords = await db
      .select({
        id: userProgress.id,
        userId: userProgress.userId,
        studyId: userProgress.studyId,
        currentDay: userProgress.currentDay,
        status: userProgress.status,
        // Include isCompleted so the profile/account page can count
        // completed studies — the frontend filters on `p.isCompleted`
        // and without this field every record looked unfinished.
        isCompleted: userProgress.isCompleted,
        documentScrollPosition: userProgress.documentScrollPosition,
        lastAccessedAt: userProgress.lastAccessedAt,
        completedAt: userProgress.completedAt,
        createdAt: userProgress.createdAt,
        studyTitle: studies.title,
        studyDescription: studies.description,
        studyCategory: studies.category,
        studyTotalDays: studies.totalDays,
        studyThumbnail: studies.thumbnailUrl,
        studyRequiredTier: studies.requiredTier,
      })
      .from(userProgress)
      .leftJoin(studies, eq(userProgress.studyId, studies.id))
      .where(and(...conditions))
      .orderBy(desc(userProgress.lastAccessedAt));
    
    // For each progress record, count completed lessons and total lessons
    const enrichedProgress = await Promise.all(
      progressRecords.map(async (record) => {
        // Count completed lessons for this user and study using a join
        const completedResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userLessonProgress)
          .innerJoin(studyLessons, eq(userLessonProgress.lessonId, studyLessons.id))
          .where(and(
            eq(userLessonProgress.userId, userId),
            eq(studyLessons.studyId, record.studyId),
            sql`${userLessonProgress.completedAt} IS NOT NULL`
          ));
        
        // Count total lessons for this study
        const totalResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(studyLessons)
          .where(eq(studyLessons.studyId, record.studyId));
        
        const completedLessons = Number(completedResult[0]?.count || 0);
        const totalLessons = Number(totalResult[0]?.count || 0);
        
        // Reconstruct the study object from individual fields (or null if study was deleted)
        const study = record.studyTitle ? {
          id: record.studyId,
          title: record.studyTitle,
          description: record.studyDescription,
          category: record.studyCategory,
          totalDays: record.studyTotalDays,
          thumbnailUrl: record.studyThumbnail,
          requiredTier: record.studyRequiredTier,
        } : null;
        
        return {
          id: record.id,
          userId: record.userId,
          studyId: record.studyId,
          currentDay: record.currentDay,
          status: record.status,
          documentScrollPosition: record.documentScrollPosition,
          lastAccessedAt: record.lastAccessedAt,
          completedAt: record.completedAt,
          createdAt: record.createdAt,
          study,
          completedLessons,
          totalLessons,
        };
      })
    );
    
    return enrichedProgress;
  }

  async updateProgress(userId: string, studyId: string, progress: Partial<InsertUserProgress>, userLocalDate?: Date, userTimezone?: string): Promise<UserProgress> {
    // Update user streak when they make progress
    await this.updateUserStreak(userId, userLocalDate, userTimezone);
    
    // Track daily activity for totalActiveDays (never resets) - use same local date as streak
    await this.trackStudyActivityDay(userId, userLocalDate, userTimezone);
    
    const existing = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)));

    // Prepare update data
    const updateData = { ...progress, lastAccessedAt: new Date() };
    
    // Set completedAt timestamp when marking study as completed for the first time
    if (progress.isCompleted === true) {
      const isNewCompletion = existing.length === 0 || !existing[0].completedAt;
      
      if (existing.length > 0 && !existing[0].completedAt) {
        // Only set completedAt if it's not already set (preserve original completion date)
        updateData.completedAt = new Date();
      } else if (existing.length === 0) {
        // New progress record being created as completed
        updateData.completedAt = new Date();
      }
      
      // Increment totalStudiesCompleted for first-time completion (never resets)
      if (isNewCompletion) {
        await this.incrementTotalStudiesCompleted(userId);
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

  // Backfill `user_progress` rows by reading `user_lesson_progress`.
  // For every study where the user has completed lessons, recompute whether
  // *all* lessons are now done. If so, ensure the parent `user_progress`
  // row reflects (status='completed', isCompleted=true, completedAt=set).
  //
  // The completedAt is set to YESTERDAY at noon (server time) so that the
  // user can still complete TODAY's next-study-in-series lesson without
  // running into the 24-hr drip gate (which uses completedAt + next midnight).
  async fixUserStudyProgress(userId: string): Promise<{ fixedCount: number; checkedCount: number }> {
    // Yesterday at noon — gives the drip gate plenty of margin.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    // Find every study this user has any completed lesson in.
    const studyIdRows = await db
      .selectDistinct({ studyId: studyLessons.studyId })
      .from(studyLessons)
      .innerJoin(userLessonProgress, eq(userLessonProgress.lessonId, studyLessons.id))
      .where(and(
        eq(userLessonProgress.userId, userId),
        eq(userLessonProgress.isCompleted, true),
      ));

    let fixedCount = 0;
    const checkedCount = studyIdRows.length;

    for (const { studyId } of studyIdRows) {
      const allLessonRows = await db
        .select({ id: studyLessons.id })
        .from(studyLessons)
        .where(eq(studyLessons.studyId, studyId));
      const total = allLessonRows.length;
      if (total === 0) continue;

      const lessonIds = allLessonRows.map(l => l.id);
      const completedRows = await db
        .select({ id: userLessonProgress.lessonId })
        .from(userLessonProgress)
        .where(and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.isCompleted, true),
          inArray(userLessonProgress.lessonId, lessonIds),
        ));
      const completedCount = new Set(completedRows.map(r => r.id)).size;
      if (completedCount < total) continue; // not actually complete — skip

      const [existing] = await db
        .select()
        .from(userProgress)
        .where(and(
          eq(userProgress.userId, userId),
          eq(userProgress.studyId, studyId),
        ));

      const needsFix =
        !existing ||
        existing.status !== 'completed' ||
        existing.isCompleted !== true ||
        !existing.completedAt;

      if (!needsFix) continue;

      // Preserve any existing completedAt timestamp; only invent yesterday
      // when none has ever been recorded.
      const completedAt = existing?.completedAt ?? yesterday;

      await db
        .insert(userProgress)
        .values({
          userId,
          studyId,
          status: 'completed',
          isCompleted: true,
          completedAt,
          lastAccessedAt: existing?.lastAccessedAt ?? yesterday,
        })
        .onConflictDoUpdate({
          target: [userProgress.userId, userProgress.studyId],
          set: {
            status: 'completed',
            isCompleted: true,
            completedAt,
          },
        });

      fixedCount++;
    }

    return { fixedCount, checkedCount };
  }

  // Track study activity for a new day - increments totalActiveDays once per calendar day
  async trackStudyActivityDay(userId: string, userLocalDate?: Date, userTimezone?: string): Promise<void> {
    // Anchor "today" to the user's timezone (default America/Chicago) so the
    // YYYY-MM-DD comparison rolls at the user's local midnight, not UTC.
    const tz = userTimezone || DEFAULT_TIMEZONE;
    const dateToUse = userLocalDate || new Date();
    const today = getDateStringInTimezone(dateToUse, tz);
    
    const [user] = await db
      .select({ lastStudyActivityDate: users.lastStudyActivityDate, totalActiveDays: users.totalActiveDays })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) return;
    
    // If today is a new activity day, increment the counter
    if (user.lastStudyActivityDate !== today) {
      await db
        .update(users)
        .set({
          lastStudyActivityDate: today,
          totalActiveDays: (user.totalActiveDays || 0) + 1,
        })
        .where(eq(users.id, userId));
    }
  }
  
  // Increment totalStudiesCompleted - called when a study is completed for the first time
  async incrementTotalStudiesCompleted(userId: string): Promise<void> {
    const [user] = await db
      .select({ totalStudiesCompleted: users.totalStudiesCompleted })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) return;
    
    await db
      .update(users)
      .set({
        totalStudiesCompleted: (user.totalStudiesCompleted || 0) + 1,
      })
      .where(eq(users.id, userId));
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
        mediaUrls: discussions.mediaUrls,
        mediaTypes: discussions.mediaTypes,
        postType: discussions.postType,
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
        // Regular category filter — always exclude study discussions
        conditions.push(sql`${discussions.studyId} IS NULL`);
        conditions.push(eq(discussions.category, category));
      }
    } else {
      // Default: exclude study discussions — they live on study pages only
      conditions.push(sql`${discussions.studyId} IS NULL`);
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
    
    let rows;
    if (conditions.length > 0) {
      rows = await query.where(and(...conditions)).orderBy(...orderBy).limit(limit);
    } else {
      rows = await query.orderBy(...orderBy).limit(limit);
    }

    if (currentUserId && rows.length > 0) {
      const discussionIds = rows.map((r: any) => r.id);
      const [likedRows, dislikedRows, dislikeCounts] = await Promise.all([
        db.select({ discussionId: discussionLikes.discussionId })
          .from(discussionLikes)
          .where(and(eq(discussionLikes.userId, currentUserId), inArray(discussionLikes.discussionId, discussionIds))),
        db.select({ discussionId: discussionDislikes.discussionId })
          .from(discussionDislikes)
          .where(and(eq(discussionDislikes.userId, currentUserId), inArray(discussionDislikes.discussionId, discussionIds))),
        db.select({ discussionId: discussionDislikes.discussionId, count: sql<number>`count(*)` })
          .from(discussionDislikes)
          .where(inArray(discussionDislikes.discussionId, discussionIds))
          .groupBy(discussionDislikes.discussionId),
      ]);
      const likedSet = new Set(likedRows.map((r) => r.discussionId));
      const dislikedSet = new Set(dislikedRows.map((r) => r.discussionId));
      const dislikeCountMap: Record<string, number> = {};
      for (const row of dislikeCounts) { dislikeCountMap[row.discussionId] = Number(row.count); }
      return rows.map((r: any) => ({
        ...r,
        likedByMe: likedSet.has(r.id),
        dislikedByMe: dislikedSet.has(r.id),
        dislikes: dislikeCountMap[r.id] || 0,
      }));
    }

    // No current user — still return dislike counts
    if (rows.length > 0) {
      const discussionIds = rows.map((r: any) => r.id);
      const dislikeCounts = await db.select({ discussionId: discussionDislikes.discussionId, count: sql<number>`count(*)` })
        .from(discussionDislikes)
        .where(inArray(discussionDislikes.discussionId, discussionIds))
        .groupBy(discussionDislikes.discussionId);
      const dislikeCountMap: Record<string, number> = {};
      for (const row of dislikeCounts) { dislikeCountMap[row.discussionId] = Number(row.count); }
      return rows.map((r: any) => ({ ...r, likedByMe: false, dislikedByMe: false, dislikes: dislikeCountMap[r.id] || 0 }));
    }

    return rows.map((r: any) => ({ ...r, likedByMe: false, dislikedByMe: false, dislikes: 0 }));
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
        mediaUrls: discussions.mediaUrls,
        mediaTypes: discussions.mediaTypes,
        postType: discussions.postType,
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

  async updateDiscussion(id: string, updates: { title?: string; content?: string }): Promise<Discussion> {
    const [updatedDiscussion] = await db
      .update(discussions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, id))
      .returning();
    return updatedDiscussion;
  }

  async deleteDiscussion(discussionId: string, userId: string, isAdmin = false): Promise<boolean> {
    try {
      const [discussion] = await db
        .select()
        .from(discussions)
        .where(eq(discussions.id, discussionId))
        .limit(1);

      if (!discussion) return false;
      if (!isAdmin && discussion.userId !== userId) return false;

      await db.delete(discussionReplies).where(eq(discussionReplies.discussionId, discussionId));
      await db.delete(discussions).where(eq(discussions.id, discussionId));
      return true;
    } catch (error) {
      console.error('Error deleting discussion:', error);
      return false;
    }
  }

  async deleteDiscussionReply(replyId: string, userId: string, isAdmin = false): Promise<boolean> {
    try {
      const [reply] = await db
        .select()
        .from(discussionReplies)
        .where(eq(discussionReplies.id, replyId))
        .limit(1);

      if (!reply) return false;
      if (!isAdmin && reply.userId !== userId) return false;

      await db.delete(discussionReplies).where(eq(discussionReplies.id, replyId));

      await db
        .update(discussions)
        .set({ replyCount: sql`GREATEST(${discussions.replyCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(discussions.id, reply.discussionId));

      return true;
    } catch (error) {
      console.error('Error deleting discussion reply:', error);
      return false;
    }
  }

  async updateDiscussionReply(replyId: string, userId: string, content: string, discussionId?: string): Promise<DiscussionReply | null> {
    const [reply] = await db.select().from(discussionReplies).where(eq(discussionReplies.id, replyId)).limit(1);
    if (!reply || reply.userId !== userId) return null;
    if (discussionId && reply.discussionId !== discussionId) return null;
    const [updated] = await db
      .update(discussionReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(discussionReplies.id, replyId))
      .returning();
    return updated ?? null;
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

  async getDiscussionReplies(discussionId: string, currentUserId?: string): Promise<(DiscussionReply & { user: User; likedByMe: boolean; dislikedByMe: boolean; dislikes: number })[]> {
    const replyConditions = [eq(discussionReplies.discussionId, discussionId)];
    
    // Filter out silenced users from replies if currentUserId is provided
    if (currentUserId) {
      const silencedUserIds = await this.getUserSilences(currentUserId);
      if (silencedUserIds.length > 0) {
        replyConditions.push(not(inArray(discussionReplies.userId, silencedUserIds)));
      }
    }

    const rows = await db
      .select({
        id: discussionReplies.id,
        discussionId: discussionReplies.discussionId,
        userId: discussionReplies.userId,
        parentReplyId: discussionReplies.parentReplyId,
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

    if (!currentUserId || rows.length === 0) {
      return rows.map(r => ({ ...r, likedByMe: false, dislikedByMe: false, dislikes: 0 }));
    }

    const replyIds = rows.map(r => r.id);
    const [honored, dislikedRows, dislikeCounts] = await Promise.all([
      db.select({ replyId: replyHonors.replyId })
        .from(replyHonors)
        .where(and(eq(replyHonors.userId, currentUserId), inArray(replyHonors.replyId, replyIds))),
      db.select({ replyId: discussionReplyDislikes.replyId })
        .from(discussionReplyDislikes)
        .where(and(eq(discussionReplyDislikes.userId, currentUserId), inArray(discussionReplyDislikes.replyId, replyIds))),
      db.select({ replyId: discussionReplyDislikes.replyId, count: sql<number>`count(*)` })
        .from(discussionReplyDislikes)
        .where(inArray(discussionReplyDislikes.replyId, replyIds))
        .groupBy(discussionReplyDislikes.replyId),
    ]);
    const honoredSet = new Set(honored.map(h => h.replyId));
    const dislikedSet = new Set(dislikedRows.map(d => d.replyId));
    const dislikeCountMap: Record<string, number> = {};
    for (const row of dislikeCounts) { dislikeCountMap[row.replyId] = Number(row.count); }

    return rows.map(r => ({
      ...r,
      likedByMe: honoredSet.has(r.id),
      dislikedByMe: dislikedSet.has(r.id),
      dislikes: dislikeCountMap[r.id] ?? 0,
    }));
  }

  async toggleDiscussionLike(discussionId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }> {
    const [existing] = await db
      .select()
      .from(discussionLikes)
      .where(and(eq(discussionLikes.discussionId, discussionId), eq(discussionLikes.userId, userId)));

    if (existing) {
      await db.delete(discussionLikes).where(
        and(eq(discussionLikes.discussionId, discussionId), eq(discussionLikes.userId, userId))
      );
      const [updated] = await db
        .update(discussions)
        .set({ likes: sql`GREATEST(0, ${discussions.likes} - 1)` })
        .where(eq(discussions.id, discussionId))
        .returning({ likes: discussions.likes });
      return { liked: false, totalLikes: updated?.likes ?? 0 };
    } else {
      await db.insert(discussionLikes).values({ discussionId, userId });
      const [updated] = await db
        .update(discussions)
        .set({ likes: sql`COALESCE(${discussions.likes}, 0) + 1` })
        .where(eq(discussions.id, discussionId))
        .returning({ likes: discussions.likes });
      return { liked: true, totalLikes: updated?.likes ?? 0 };
    }
  }

  async getDiscussionLikers(discussionId: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null }[]> {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(discussionLikes)
      .innerJoin(users, eq(discussionLikes.userId, users.id))
      .where(eq(discussionLikes.discussionId, discussionId))
      .orderBy(desc(discussionLikes.createdAt));
    return rows;
  }

  async toggleDiscussionDislike(discussionId: string, userId: string): Promise<{ disliked: boolean; totalDislikes: number }> {
    const [existing] = await db
      .select()
      .from(discussionDislikes)
      .where(and(eq(discussionDislikes.discussionId, discussionId), eq(discussionDislikes.userId, userId)));

    if (existing) {
      await db.delete(discussionDislikes).where(
        and(eq(discussionDislikes.discussionId, discussionId), eq(discussionDislikes.userId, userId))
      );
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(discussionDislikes).where(eq(discussionDislikes.discussionId, discussionId));
      return { disliked: false, totalDislikes: Number(count) };
    } else {
      await db.insert(discussionDislikes).values({ discussionId, userId });
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(discussionDislikes).where(eq(discussionDislikes.discussionId, discussionId));
      return { disliked: true, totalDislikes: Number(count) };
    }
  }

  async toggleDiscussionReplyDislike(replyId: string, userId: string): Promise<{ disliked: boolean; totalDislikes: number }> {
    const [existing] = await db
      .select()
      .from(discussionReplyDislikes)
      .where(and(eq(discussionReplyDislikes.replyId, replyId), eq(discussionReplyDislikes.userId, userId)));

    if (existing) {
      await db.delete(discussionReplyDislikes).where(
        and(eq(discussionReplyDislikes.replyId, replyId), eq(discussionReplyDislikes.userId, userId))
      );
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(discussionReplyDislikes).where(eq(discussionReplyDislikes.replyId, replyId));
      return { disliked: false, totalDislikes: Number(count) };
    } else {
      await db.insert(discussionReplyDislikes).values({ replyId, userId });
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(discussionReplyDislikes).where(eq(discussionReplyDislikes.replyId, replyId));
      return { disliked: true, totalDislikes: Number(count) };
    }
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
    // Devotionals are stored as UTC-midnight "date labels" (admin UI inserts
    // `new Date(data.date + 'T00:00:00Z')`). To roll over at midnight CST/CDT
    // (not midnight UTC, which is 7pm local), we compute today's YYYY-MM-DD
    // in the ministry's timezone and compare against the matching UTC labels.
    const todayYmd = getDateStringInTimezone(new Date(), DEFAULT_TIMEZONE);
    const tomorrowYmd = addDaysToYmd(todayYmd, 1);
    const todayLabel = getYmdAsUtcMidnight(todayYmd);
    const tomorrowLabel = getYmdAsUtcMidnight(tomorrowYmd);

    // First try to get a devotional with today's exact date
    const [todayDevotional] = await db
      .select()
      .from(devotionals)
      .where(and(
        sql`${devotionals.date} >= ${todayLabel}`,
        sql`${devotionals.date} < ${tomorrowLabel}`
      ))
      .limit(1);

    if (todayDevotional) {
      return todayDevotional;
    }

    // No exact match — rotate through all devotionals by day so it changes daily
    const allDevotionals = await db
      .select()
      .from(devotionals)
      .orderBy(asc(devotionals.date));

    if (allDevotionals.length === 0) return undefined;

    // Use a fixed epoch (Jan 1, 2026) as a UTC-midnight date label and compute
    // the day index from today's CST-anchored UTC-midnight label. Both are
    // UTC-midnight Dates 24h apart per calendar day, so dayIndex advances at
    // midnight CST (not midnight UTC).
    const epoch = getYmdAsUtcMidnight('2026-01-01').getTime();
    const dayIndex = Math.floor((todayLabel.getTime() - epoch) / (1000 * 60 * 60 * 24));
    const index = ((dayIndex % allDevotionals.length) + allDevotionals.length) % allDevotionals.length;

    return allDevotionals[index];
  }

  async getDevotional(id: string): Promise<Devotional | undefined> {
    const [devotional] = await db
      .select()
      .from(devotionals)
      .where(eq(devotionals.id, id))
      .limit(1);
    return devotional;
  }

  async getDevotionals(limit = 100): Promise<Devotional[]> {
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

  async updateDevotional(id: string, devotional: Partial<InsertDevotional>): Promise<Devotional | undefined> {
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

  async getSavedDevotionals(userId: string): Promise<(SavedDevotional & { devotional: Devotional })[]> {
    const rows = await db
      .select()
      .from(savedDevotionals)
      .innerJoin(devotionals, eq(savedDevotionals.devotionalId, devotionals.id))
      .where(eq(savedDevotionals.userId, userId))
      .orderBy(desc(savedDevotionals.savedAt));
    return rows.map(r => ({ ...r.saved_devotionals, devotional: r.devotionals }));
  }

  async isDevotionalSaved(userId: string, devotionalId: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(savedDevotionals)
      .where(and(eq(savedDevotionals.userId, userId), eq(savedDevotionals.devotionalId, devotionalId)))
      .limit(1);
    return !!row;
  }

  async toggleSaveDevotional(userId: string, devotionalId: string): Promise<boolean> {
    const existing = await this.isDevotionalSaved(userId, devotionalId);
    if (existing) {
      await db.delete(savedDevotionals)
        .where(and(eq(savedDevotionals.userId, userId), eq(savedDevotionals.devotionalId, devotionalId)));
      return false;
    } else {
      await db.insert(savedDevotionals).values({ userId, devotionalId });
      return true;
    }
  }

  async saveDevotionalReflection(userId: string, devotionalId: string, text: string): Promise<void> {
    await db.insert(devotionalReflections)
      .values({ userId, devotionalId, text })
      .onConflictDoUpdate({
        target: [devotionalReflections.userId, devotionalReflections.devotionalId],
        set: { text, createdAt: new Date() },
      });
  }

  async getDevotionalReflections(userId: string): Promise<(DevotionalReflection & { devotional: Devotional })[]> {
    const rows = await db
      .select()
      .from(devotionalReflections)
      .innerJoin(devotionals, eq(devotionalReflections.devotionalId, devotionals.id))
      .where(eq(devotionalReflections.userId, userId))
      .orderBy(desc(devotionalReflections.createdAt));
    return rows.map(r => ({ ...r.devotional_reflections, devotional: r.devotionals }));
  }

  async getDevotionalReflection(userId: string, devotionalId: string): Promise<DevotionalReflection | undefined> {
    const [row] = await db
      .select()
      .from(devotionalReflections)
      .where(and(eq(devotionalReflections.userId, userId), eq(devotionalReflections.devotionalId, devotionalId)))
      .limit(1);
    return row;
  }

  async getAvailableDevotionalsWithoutNotifications(): Promise<Devotional[]> {
    // Devotionals are stored as UTC-midnight date labels. We want a row to
    // become "available" only once we've crossed midnight CST/CDT for that
    // label — so compare against tomorrow's CST date converted back to its
    // UTC-midnight label. (At 11:30pm CST the row is excluded; at 12:05am
    // CST the next day, it's included.)
    const todayYmdCst = getDateStringInTimezone(new Date(), DEFAULT_TIMEZONE);
    const tomorrowLabel = getYmdAsUtcMidnight(addDaysToYmd(todayYmdCst, 1));

    return await db
      .select()
      .from(devotionals)
      .where(and(
        sql`${devotionals.date} < ${tomorrowLabel}`,
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
  async updateUserStreak(userId: string, userLocalDate?: Date, userTimezone?: string): Promise<void> {
    // All comparisons are done as YYYY-MM-DD in the user's timezone (defaults
    // to America/Chicago, the ministry's home TZ — never the container's UTC).
    const tz = userTimezone || DEFAULT_TIMEZONE;
    const localToday = userLocalDate || new Date();

    // Create date strings in YYYY-MM-DD format for reliable comparison
    // This avoids timezone conversion issues by only comparing date parts
    const todayDateString = getDateStringInTimezone(localToday, tz);
    
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
      // Convert stored date to user-TZ date string for comparison
      const lastActiveDate = new Date(user.lastActiveDate);
      const lastActiveDateString = getDateStringInTimezone(lastActiveDate, tz);
      
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
      
      // DST-safe: derive yesterday from today's calendar date, not -24h ms.
      const yesterdayDateString = addDaysToYmd(todayDateString, -1);
      
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

  async deleteStudyRating(ratingId: string): Promise<boolean> {
    const result = await db.delete(studyRatings).where(eq(studyRatings.id, ratingId));
    return (result.rowCount ?? 0) > 0;
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
  async getAllUsers(limit = 10000): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .limit(limit);
  }

  async getAdminUsersPage({ page, pageSize, sortBy, search, statusFilter, subscriptionFilter }: { page: number; pageSize: number; sortBy: string; search?: string; statusFilter?: string; subscriptionFilter?: string | null }): Promise<{ users: User[]; total: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const conditions: any[] = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(users.email, term)
        )
      );
    }

    if (subscriptionFilter === 'active') {
      conditions.push(eq(users.subscriptionStatus, 'active'));
    } else if (subscriptionFilter === 'cancelled') {
      conditions.push(
        and(
          eq(users.subscriptionStatus, 'cancelled'),
          lte(users.createdAt, sevenDaysAgo)
        )
      );
    } else if (subscriptionFilter === 'non-subscriber') {
      conditions.push(
        and(
          or(
            eq(users.subscriptionStatus, 'trial'),
            eq(users.subscriptionStatus, 'expired')
          ),
          lte(users.createdAt, sevenDaysAgo)
        )
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(users.subscriptionStatus, statusFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderClause = (() => {
      switch (sortBy) {
        case 'oldest': return asc(users.createdAt);
        case 'recent-online': return desc(users.updatedAt);
        case 'longest-offline': return asc(users.updatedAt);
        default: return desc(users.createdAt);
      }
    })();

    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(whereClause);

    const result = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { users: result, total };
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

  async setUserFitnessAccess(userId: string, hasAccess: boolean): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ hasFitnessAccess: hasAccess, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateUserSubscriptionDetails(userId: string, details: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    trialStartDate?: Date;
    trialEndDate?: Date;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        ...details,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async cancelUserSubscription(userId: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        subscriptionStatus: 'cancelled',
        subscriptionTier: 'expired',
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async reactivateUserSubscription(userId: string, currentPeriodEnd?: Date): Promise<User> {
    const updateData: Partial<User> & { updatedAt: Date } = {
      subscriptionStatus: 'active',
      subscriptionTier: 'subscriber',
      updatedAt: new Date(),
    };
    if (currentPeriodEnd !== undefined) {
      updateData.subscriptionExpiresAt = currentPeriodEnd;
    }
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async checkExpiredSubscriptions(): Promise<User[]> {
    const now = new Date();
    
    // Check for expired trials
    const expiredTrialUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'trial'),
          lt(users.trialEndDate, now)
        )
      );

    if (expiredTrialUsers.length > 0) {
      await db
        .update(users)
        .set({ 
          subscriptionTier: 'free',
          subscriptionStatus: 'expired',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(users.subscriptionStatus, 'trial'),
            lt(users.trialEndDate, now)
          )
        );
    }

    // Check for cancelled subscriptions past their expiration
    const expiredSubUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'cancelled'),
          lt(users.subscriptionExpiresAt, now)
        )
      );

    if (expiredSubUsers.length > 0) {
      await db
        .update(users)
        .set({ 
          subscriptionTier: 'free',
          subscriptionStatus: 'expired',
          subscriptionExpiresAt: null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(users.subscriptionStatus, 'cancelled'),
            lt(users.subscriptionExpiresAt, now)
          )
        );
    }

    return [...expiredTrialUsers, ...expiredSubUsers];
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

  async deleteUserPermanently(userId: string): Promise<void> {
    // Clear accountability_requests where this user was the assistant
    await db.update(accountabilityRequests)
      .set({ assistedById: null, assistedAt: null })
      .where(eq(accountabilityRequests.assistedById, userId));
    
    // Now delete the user (cascade will handle other references)
    await db.delete(users).where(eq(users.id, userId));
  }

  async getSystemStats(): Promise<{
    totalUsers: number;
    totalStudies: number;
    activeToday: number;
    newPosts: number;
    activeSubscribers: number;
    cancelledAfter7Days: number;
    nonSubscribersAfter7Days: number;
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

    // Subscription insight counts
    const [{ activeSubscribers }] = await db
      .select({ activeSubscribers: count(users.id) })
      .from(users)
      .where(eq(users.subscriptionStatus, 'active'));

    // Cancelled users whose accounts are older than 7 days
    const [{ cancelledAfter7Days }] = await db
      .select({ cancelledAfter7Days: count(users.id) })
      .from(users)
      .where(
        sql`${users.subscriptionStatus} = 'cancelled'
            AND ${users.createdAt} <= NOW() - INTERVAL '7 days'`
      );

    // Users still on trial or expired whose accounts are older than 7 days
    const [{ nonSubscribersAfter7Days }] = await db
      .select({ nonSubscribersAfter7Days: count(users.id) })
      .from(users)
      .where(
        sql`${users.subscriptionStatus} IN ('trial', 'expired')
            AND ${users.createdAt} <= NOW() - INTERVAL '7 days'`
      );

    return {
      totalUsers,
      totalStudies,
      activeToday,
      newPosts,
      activeSubscribers,
      cancelledAfter7Days,
      nonSubscribersAfter7Days,
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
  async createNotification(notification: InsertNotification, options?: { pushUrl?: string }): Promise<Notification> {
    const [newNotification] = await db.insert(notifications)
      .values(notification)
      .returning();

    // Fire push notification for every in-app notification created
    try {
      const { sendPushNotification, getPushUrl } = await import('./pushNotificationService');
      const url = options?.pushUrl ?? getPushUrl(notification.type, notification.relatedId);
      await sendPushNotification(notification.userId, {
        title: notification.title,
        body: notification.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: notification.type,
        url,
      });
    } catch (error: any) {
      console.error(`[Push] createNotification push error (type=${notification.type}, user=${notification.userId}):`, error?.message ?? error);
    }

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
    const EXCLUDED_TYPES = ['new_discussion', 'discussion', 'discussion_reply', 'war_room_post', 'under_fire_post'];
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        not(inArray(notifications.type, EXCLUDED_TYPES))
      ));
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

  async updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    const [updatedPreferences] = await db
      .update(notificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    
    if (!updatedPreferences) {
      throw new Error('Failed to update notification preferences');
    }
    
    return updatedPreferences;
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
      case 'war_room_post':
        return preferences.warRoomNotifications ?? true;
      case 'under_fire_post':
        return preferences.underFireNotifications ?? true;
      default:
        // For unknown types, default to true (send notification)
        return true;
    }
  }

  // Enhanced createNotification that checks preferences and sends push notification
  async createNotificationWithPreferences(notification: InsertNotification, pushPayload?: { url?: string }): Promise<Notification | null> {
    const shouldSend = await this.shouldReceiveNotification(notification.userId, notification.type);
    
    if (!shouldSend) {
      console.log(`Skipping notification for user ${notification.userId} - type ${notification.type} disabled in preferences`);
      return null;
    }
    
    const newNotification = await this.createNotification(notification);
    // Push notification is fired automatically inside createNotification
    return newNotification;
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
    
    // Filter by user tier access — subscribers see all, others see only free
    if (userTier) {
      const isSubscriber = userTier === 'subscriber';
      if (!isSubscriber) {
        conditions.push(eq(videos.requiredTier, 'free'));
      }
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
    // Subscribers see all tiers; others see only free
    const isSubscriber = userTier === 'subscriber';
    const allowedTiers = isSubscriber ? ['free', 'subscriber'] : ['free'];
    
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
        lastDenied: denialRecord?.lastDenialAt || undefined
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

  async deleteVideoRating(ratingId: string): Promise<boolean> {
    const result = await db.delete(videoRatings).where(eq(videoRatings.id, ratingId));
    return (result.rowCount ?? 0) > 0;
  }

  async sendFeedbackToAdmins(userId: string, feedback: string, category: string): Promise<void> {
    // Get the user who is sending feedback
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all admin/owner users
    const adminUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'owner')));

    if (adminUsers.length === 0) {
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
          createdBy: adminUsers[0].id, // First admin creates the conversation
        })
        .returning();

      // Add all admin/owner users as participants
      for (const adminUser of adminUsers) {
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

    // Send notifications to all admin/owner users about the new feedback
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

    // Create notifications for all admin/owner users
    for (const adminUser of adminUsers) {
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

    // Use persistent counters from user profile (never reset)
    const studiesCompleted = user.totalStudiesCompleted || 0;
    const daysActive = user.totalActiveDays || 0;

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
    // A study is considered "completed" when status is "completed"
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${userProgress.studyId})`
      })
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId),
          eq(userProgress.status, 'completed'),
          sql`${userProgress.lastAccessedAt} >= ${oneWeekAgo.toISOString()}`
        )
      );

    return result[0]?.count || 0;
  }

  async markStudyStarted(userId: string, studyId: string): Promise<void> {
    // Create an in_progress record only if no progress exists yet for this study.
    // Does NOT update streak or activity-day counters — those should only fire on
    // lesson completion, not on first study open.
    const [existing] = await db
      .select({ id: userProgress.id })
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.studyId, studyId)));

    if (!existing) {
      await db.insert(userProgress).values({
        userId,
        studyId,
        status: 'in_progress',
        lastAccessedAt: new Date(),
      });
    }
  }

  async getUserActiveStudyInfo(userId: string): Promise<{
    activeSeriesId: string | null;
    activeTopicalStudyId: string | null;
  }> {
    // Find all in-progress studies for this user, joined with the study to get seriesId
    const inProgressRecords = await db
      .select({ studyId: userProgress.studyId, seriesId: studies.seriesId })
      .from(userProgress)
      .innerJoin(studies, eq(userProgress.studyId, studies.id))
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.status, 'in_progress'),
      ));

    let activeSeriesId: string | null = null;
    let activeTopicalStudyId: string | null = null;
    for (const row of inProgressRecords) {
      if (row.seriesId && !activeSeriesId) {
        activeSeriesId = row.seriesId;
      } else if (!row.seriesId && !activeTopicalStudyId) {
        activeTopicalStudyId = row.studyId;
      }
    }
    return { activeSeriesId, activeTopicalStudyId };
  }

  async getStudyTimeGateStatus(userId: string, studyId: string, userTimezone: string): Promise<{
    isLocked: boolean;
    unlockTime: Date | null;
    previousStudyTitle: string | null;
    message: string | null;
  }> {
    // Get the current study
    const study = await this.getStudy(studyId);
    if (!study) {
      return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
    }

    // If study is not part of a series, it's not time-gated
    if (!study.seriesId) {
      return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
    }

    // If this is the first study in the series (order 0 or 1), it's always unlocked
    const currentOrder = study.seriesOrder || 0;
    if (currentOrder <= 1) {
      return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
    }

    // Find the previous study in the series
    const [previousStudy] = await db.select().from(studies)
      .where(and(
        eq(studies.seriesId, study.seriesId),
        eq(studies.seriesOrder, currentOrder - 1)
      ));

    if (!previousStudy) {
      // No previous study found, unlock this one
      return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
    }

    // Check if the previous study was completed
    const [prevProgress] = await db.select().from(userProgress)
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.studyId, previousStudy.id),
        eq(userProgress.status, 'completed')
      ));

    if (!prevProgress || !prevProgress.completedAt) {
      // Previous study not completed yet
      return {
        isLocked: true,
        unlockTime: null,
        previousStudyTitle: previousStudy.title,
        message: `Complete "${previousStudy.title}" first to unlock this study`
      };
    }

    // Calculate midnight in user's timezone after the completion
    const completedAt = new Date(prevProgress.completedAt);
    
    // Calculate the next midnight in the user's timezone
    try {
      // Helper function to get date parts in a specific timezone
      const getDatePartsInTimezone = (date: Date, tz: string) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
        return {
          year: parseInt(getPart('year')),
          month: parseInt(getPart('month')),
          day: parseInt(getPart('day')),
          hour: parseInt(getPart('hour')),
          minute: parseInt(getPart('minute')),
          second: parseInt(getPart('second'))
        };
      };

      // Get completion date parts in user's timezone
      const completionParts = getDatePartsInTimezone(completedAt, userTimezone);
      
      // Get now's date parts in user's timezone
      const now = new Date();
      const nowParts = getDatePartsInTimezone(now, userTimezone);

      // Calculate the next day after completion
      const nextDayAfterCompletion = new Date(completionParts.year, completionParts.month - 1, completionParts.day + 1);
      
      // Create comparison date for "now" in same format
      const nowDate = new Date(nowParts.year, nowParts.month - 1, nowParts.day);
      const nowDateTime = new Date(nowParts.year, nowParts.month - 1, nowParts.day, nowParts.hour, nowParts.minute, nowParts.second);
      const nextDayMidnight = new Date(nextDayAfterCompletion.getFullYear(), nextDayAfterCompletion.getMonth(), nextDayAfterCompletion.getDate(), 0, 0, 0);

      // Check if current date in user's timezone is >= next day after completion
      if (nowDate >= nextDayAfterCompletion) {
        return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
      }

      // Still locked - calculate time remaining until midnight
      const msUntilMidnight = nextDayMidnight.getTime() - nowDateTime.getTime();
      const unlockTimeUTC = new Date(now.getTime() + msUntilMidnight);

      return {
        isLocked: true,
        unlockTime: unlockTimeUTC,
        previousStudyTitle: previousStudy.title,
        message: `This study unlocks at midnight`
      };
    } catch (e) {
      // If timezone parsing fails, default to unlocked
      console.error('Error calculating timezone:', e);
      return { isLocked: false, unlockTime: null, previousStudyTitle: null, message: null };
    }
  }

  async getStudyConsecutiveLockStatus(userId: string, studyId: string): Promise<{
    isLocked: boolean;
    previousStudyTitle: string | null;
    previousStudyId: string | null;
    message: string | null;
    studyNumber: number;
    totalStudiesInSeries: number;
  }> {
    // Get the current study
    const study = await this.getStudy(studyId);
    if (!study) {
      return { isLocked: false, previousStudyTitle: null, previousStudyId: null, message: null, studyNumber: 1, totalStudiesInSeries: 1 };
    }

    // If study is not part of a series, it's not subject to consecutive completion
    if (!study.seriesId) {
      return { isLocked: false, previousStudyTitle: null, previousStudyId: null, message: null, studyNumber: 1, totalStudiesInSeries: 1 };
    }

    // Get the series to check if it requires consecutive completion
    const [series] = await db.select().from(studySeries)
      .where(eq(studySeries.id, study.seriesId));
    
    if (!series?.requiresConsecutiveCompletion) {
      return { isLocked: false, previousStudyTitle: null, previousStudyId: null, message: null, studyNumber: 1, totalStudiesInSeries: 1 };
    }

    // Get all studies in the series ordered by seriesOrder
    const seriesStudiesData = await db.select().from(studies)
      .where(and(
        eq(studies.seriesId, study.seriesId),
        eq(studies.isPublished, true)
      ))
      .orderBy(asc(studies.seriesOrder), asc(studies.createdAt));

    const studyIndex = seriesStudiesData.findIndex(s => s.id === studyId);
    const studyNumber = studyIndex + 1;
    const totalStudiesInSeries = seriesStudiesData.length;

    // First study is never locked
    if (studyIndex <= 0) {
      return { isLocked: false, previousStudyTitle: null, previousStudyId: null, message: null, studyNumber, totalStudiesInSeries };
    }

    // Check if previous study is complete
    const previousStudy = seriesStudiesData[studyIndex - 1];
    
    const prevLessons = await db.select().from(studyLessons)
      .where(eq(studyLessons.studyId, previousStudy.id));
    
    let previousComplete = false;
    let prevCompletionTime: Date | null = null;
    
    if (prevLessons.length === 0) {
      const [progress] = await db.select().from(userProgress)
        .where(and(
          eq(userProgress.userId, userId),
          eq(userProgress.studyId, previousStudy.id)
        ));
      previousComplete = progress?.completed ?? false;
      prevCompletionTime = progress?.completedAt ? new Date(progress.completedAt) : null;
    } else {
      const completedLessons = await db.select().from(userLessonProgress)
        .where(and(
          eq(userLessonProgress.userId, userId),
          inArray(userLessonProgress.lessonId, prevLessons.map(l => l.id)),
          sql`${userLessonProgress.completedAt} IS NOT NULL`
        ));
      previousComplete = completedLessons.length >= prevLessons.length;
      if (previousComplete && completedLessons.length > 0) {
        prevCompletionTime = completedLessons.reduce((latest, lp) => {
          const t = lp.completedAt ? new Date(lp.completedAt) : new Date(0);
          return t > latest ? t : latest;
        }, new Date(0));
      }
    }

    // If previous study is not complete, lock this study
    if (!previousComplete) {
      return {
        isLocked: true,
        previousStudyTitle: previousStudy.title,
        previousStudyId: previousStudy.id,
        message: `Complete "${previousStudy.title}" first`,
        studyNumber,
        totalStudiesInSeries
      };
    }

    // Previous study is complete — unlock immediately (no inter-week drip).
    // The per-lesson 24-hour drip within each week already enforces the daily
    // cadence; an extra midnight gate here is redundant.
    if (previousComplete) {
      return { isLocked: false, previousStudyTitle: null, previousStudyId: null, message: null, studyNumber, totalStudiesInSeries };
    }

    return {
      isLocked: true,
      previousStudyTitle: previousStudy.title,
      previousStudyId: previousStudy.id,
      message: `Complete "${previousStudy.title}" first to unlock this study`,
      studyNumber,
      totalStudiesInSeries
    };
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
    let conditions = [eq(podcasts.isPublished, true)];
    
    // Apply filters
    if (options.category) {
      conditions.push(eq(podcasts.category, options.category));
    }
    
    if (options.search) {
      conditions.push(
        or(
          ilike(podcasts.title, `%${options.search}%`),
          ilike(podcasts.description, `%${options.search}%`)
        )!
      );
    }
    
    let query = db.select().from(podcasts).where(and(...conditions));
    
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
        // Sort by episode number (highest first: 115, 114, ..., 1), then by createdAt for non-episode podcasts
        query = query.orderBy(desc(podcasts.episodeNumber), desc(podcasts.createdAt)) as any;
        break;
    }
    
    return await query;
  }

  async getAllPodcasts(): Promise<Podcast[]> {
    return await db
      .select()
      .from(podcasts)
      .orderBy(desc(podcasts.episodeNumber), desc(podcasts.createdAt));
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

  async deletePodcastRating(ratingId: string): Promise<boolean> {
    const result = await db.delete(podcastRatings).where(eq(podcastRatings.id, ratingId));
    return (result.rowCount ?? 0) > 0;
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

  // Challenge participation methods
  async acceptChallenge(userId: string, challengeId: string): Promise<ChallengeParticipant> {
    // Check if user already accepted this challenge
    const [existing] = await db
      .select()
      .from(challengeParticipants)
      .where(and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.challengeId, challengeId)
      ));
    
    if (existing) {
      return existing; // Already accepted, return existing record
    }
    
    // Create new participation
    const [participant] = await db
      .insert(challengeParticipants)
      .values({ userId, challengeId })
      .returning();
    
    return participant;
  }

  async getChallengeParticipantCount(challengeId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challengeId));
    
    return result?.count || 0;
  }

  async hasUserAcceptedChallenge(userId: string, challengeId: string): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(challengeParticipants)
      .where(and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.challengeId, challengeId)
      ));
    
    return !!participant;
  }

  async getChallengeParticipation(userId: string, challengeId: string): Promise<ChallengeParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(challengeParticipants)
      .where(and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.challengeId, challengeId)
      ));
    
    return participant;
  }

  async completeChallenge(userId: string, challengeId: string): Promise<void> {
    await db
      .update(challengeParticipants)
      .set({ completedAt: new Date() })
      .where(and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.challengeId, challengeId)
      ));
  }

  async getChallenge(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id));
    
    return challenge;
  }

  async getDailyChallengeCheckins(userId: string, challengeId: string): Promise<ChallengeDailyCheckin[]> {
    return await db
      .select()
      .from(challengeDailyCheckins)
      .where(and(
        eq(challengeDailyCheckins.userId, userId),
        eq(challengeDailyCheckins.challengeId, challengeId)
      ))
      .orderBy(challengeDailyCheckins.dayNumber);
  }

  async addDailyChallengeCheckin(userId: string, challengeId: string, dayNumber: number): Promise<ChallengeDailyCheckin> {
    const [checkin] = await db
      .insert(challengeDailyCheckins)
      .values({ userId, challengeId, dayNumber })
      .onConflictDoNothing()
      .returning();
    return checkin;
  }

  async hasDailyCheckin(userId: string, challengeId: string, dayNumber: number): Promise<boolean> {
    const [row] = await db
      .select({ id: challengeDailyCheckins.id })
      .from(challengeDailyCheckins)
      .where(and(
        eq(challengeDailyCheckins.userId, userId),
        eq(challengeDailyCheckins.challengeId, challengeId),
        eq(challengeDailyCheckins.dayNumber, dayNumber)
      ));
    return !!row;
  }

  // Get all challenges completed by a user
  async getUserCompletedChallenges(userId: string): Promise<ChallengeParticipant[]> {
    return await db
      .select()
      .from(challengeParticipants)
      .where(and(
        eq(challengeParticipants.userId, userId),
        isNotNull(challengeParticipants.completedAt)
      ));
  }

  // Get challenges with unlock status for progressive drip
  async getChallengesWithUnlockStatus(userId: string | null): Promise<(Challenge & { isUnlocked: boolean; unlockIndex: number })[]> {
    // Get all challenges ordered by release date (oldest first for progressive unlock)
    const allChallenges = await db
      .select()
      .from(challenges)
      .orderBy(asc(challenges.releaseDate));
    
    if (!userId) {
      // Non-authenticated users can only see the first challenge
      return allChallenges.map((challenge, index) => ({
        ...challenge,
        isUnlocked: index === 0,
        unlockIndex: index
      }));
    }
    
    // Get user's completed challenges
    const completedChallenges = await this.getUserCompletedChallenges(userId);
    const completedChallengeIds = new Set(completedChallenges.map(cp => cp.challengeId));
    
    // Progressive unlock logic:
    // - Challenge 0 (oldest) is always unlocked
    // - Challenge N is unlocked if challenge N-1 is completed
    // - Current week's challenge is always unlocked (special case)
    const currentWeekChallenge = await this.getCurrentWeekChallenge();
    
    return allChallenges.map((challenge, index) => {
      // First challenge is always unlocked
      if (index === 0) {
        return { ...challenge, isUnlocked: true, unlockIndex: index };
      }
      
      // Current week's challenge is always unlocked
      if (currentWeekChallenge && challenge.id === currentWeekChallenge.id) {
        return { ...challenge, isUnlocked: true, unlockIndex: index };
      }
      
      // Check if user has completed all previous challenges
      let allPreviousCompleted = true;
      for (let i = 0; i < index; i++) {
        if (!completedChallengeIds.has(allChallenges[i].id)) {
          allPreviousCompleted = false;
          break;
        }
      }
      
      return { ...challenge, isUnlocked: allPreviousCompleted, unlockIndex: index };
    });
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
    // Get all admin AND owner users
    const admins = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'owner')));

    if (admins.length === 0) return;

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

    // Create notifications for all admins and owners
    const notificationData = admins.map(admin => ({
      userId: admin.id,
      title: 'Content Flagged',
      message: `A user has flagged ${flag.contentType}: "${contentTitle}" for ${flag.reason}`,
      type: 'content_flag' as string,
      metadata: JSON.stringify({
        flagId: flag.id,
        contentType: flag.contentType,
        contentId: flag.contentId,
        reason: flag.reason,
        contentUrl
      }),
      isRead: false,
      createdAt: new Date()
    }));

    await db.insert(notifications).values(notificationData);
  }

  async getAllFlags(): Promise<(ContentFlag & { reporter: { firstName: string | null; lastName: string | null }; contentUrl: string })[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const COMPLETED_STATUSES = ['completed', 'resolved', 'dismissed'] as const;

    const rawFlags = await db
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
      .where(
        or(
          // NULL status treated as pending — always show
          isNull(contentFlags.status),
          // Non-completed flags always show
          not(inArray(contentFlags.status, COMPLETED_STATUSES as unknown as string[])),
          // Completed flags only show for 30 days
          and(
            inArray(contentFlags.status, COMPLETED_STATUSES as unknown as string[]),
            gte(contentFlags.updatedAt, thirtyDaysAgo)
          )
        )
      )
      .orderBy(desc(contentFlags.createdAt));

    // Resolve contentUrl for reply-type flags by looking up discussionId
    const replyFlagIds = rawFlags
      .filter(f => f.contentType === 'reply')
      .map(f => f.contentId);

    const replyDiscussionMap = new Map<string, string>();
    if (replyFlagIds.length > 0) {
      const replyRows = await db
        .select({ id: discussionReplies.id, discussionId: discussionReplies.discussionId })
        .from(discussionReplies)
        .where(inArray(discussionReplies.id, replyFlagIds));
      for (const row of replyRows) {
        replyDiscussionMap.set(row.id, row.discussionId);
      }
    }

    // Return relative paths so the URL works on any host (dev and production)
    return rawFlags.map(flag => {
      let contentUrl: string;
      if (flag.contentType === 'reply') {
        const discussionId = replyDiscussionMap.get(flag.contentId);
        contentUrl = discussionId
          ? `/community?discussion=${discussionId}&reply=${flag.contentId}`
          : '/community';
      } else if (flag.contentType === 'discussion') {
        contentUrl = `/community?discussion=${flag.contentId}`;
      } else {
        contentUrl = '/community';
      }
      return { ...flag, contentUrl };
    });
  }

  async updateFlagStatus(flagId: string, updateData: {
    status: string;
    reviewNotes?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
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
      .values([challengeData])
      .returning();
    return challenge;
  }

  async updateFitnessChallenge(id: string, updates: Partial<InsertFitnessChallenge>): Promise<FitnessChallenge> {
    // Convert targetDate string to Date if needed
    const processedUpdates = { ...updates };
    if (processedUpdates.targetDate && typeof processedUpdates.targetDate === 'string') {
      processedUpdates.targetDate = new Date(processedUpdates.targetDate);
    }
    
    const [challenge] = await db
      .update(fitnessChallenge)
      .set({ ...processedUpdates, updatedAt: new Date() })
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

  // Favorite exercises implementation methods
  async getFavoriteExercises(userId: string): Promise<FavoriteExercise[]> {
    return await db
      .select()
      .from(favoriteExercises)
      .where(eq(favoriteExercises.userId, userId))
      .orderBy(desc(favoriteExercises.createdAt));
  }

  async addFavoriteExercise(exercise: InsertFavoriteExercise): Promise<FavoriteExercise> {
    const [favorite] = await db
      .insert(favoriteExercises)
      .values(exercise)
      .returning();
    return favorite;
  }

  async removeFavoriteExercise(userId: string, exerciseId: string): Promise<void> {
    await db
      .delete(favoriteExercises)
      .where(
        and(
          eq(favoriteExercises.userId, userId),
          eq(favoriteExercises.exerciseId, exerciseId)
        )
      );
  }

  async isFavoriteExercise(userId: string, exerciseId: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favoriteExercises)
      .where(
        and(
          eq(favoriteExercises.userId, userId),
          eq(favoriteExercises.exerciseId, exerciseId)
        )
      )
      .limit(1);
    return !!favorite;
  }

  // Fitness plans implementation methods
  async getFitnessPlans(userId: string): Promise<(FitnessPlan & { exercises: FitnessPlanExercise[] })[]> {
    const plans = await db
      .select()
      .from(fitnessPlans)
      .where(eq(fitnessPlans.userId, userId))
      .orderBy(desc(fitnessPlans.createdAt));
    
    // Fetch exercises for each plan
    const plansWithExercises = await Promise.all(
      plans.map(async (plan) => {
        const exercises = await this.getFitnessPlanExercises(plan.id);
        return { ...plan, exercises };
      })
    );
    
    return plansWithExercises;
  }

  async getFitnessPlan(id: string): Promise<FitnessPlan | undefined> {
    const [plan] = await db
      .select()
      .from(fitnessPlans)
      .where(eq(fitnessPlans.id, id));
    return plan;
  }

  async createFitnessPlan(plan: InsertFitnessPlan): Promise<FitnessPlan> {
    const [newPlan] = await db
      .insert(fitnessPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateFitnessPlan(id: string, updates: Partial<InsertFitnessPlan>): Promise<FitnessPlan> {
    const [plan] = await db
      .update(fitnessPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fitnessPlans.id, id))
      .returning();
    return plan;
  }

  async deleteFitnessPlan(id: string): Promise<void> {
    await db
      .delete(fitnessPlans)
      .where(eq(fitnessPlans.id, id));
  }

  async getFitnessPlanWithExercises(id: string): Promise<(FitnessPlan & { exercises: FitnessPlanExercise[] }) | undefined> {
    const plan = await this.getFitnessPlan(id);
    if (!plan) return undefined;
    
    const exercises = await this.getFitnessPlanExercises(id);
    return { ...plan, exercises };
  }

  // Fitness plan exercises implementation methods
  async getFitnessPlanExercises(planId: string): Promise<FitnessPlanExercise[]> {
    return await db
      .select()
      .from(fitnessPlanExercises)
      .where(eq(fitnessPlanExercises.planId, planId))
      .orderBy(asc(fitnessPlanExercises.orderIndex));
  }

  async addExerciseToPlan(exercise: InsertFitnessPlanExercise): Promise<FitnessPlanExercise> {
    const [planExercise] = await db
      .insert(fitnessPlanExercises)
      .values(exercise)
      .returning();
    return planExercise;
  }

  async updatePlanExercise(id: string, updates: Partial<InsertFitnessPlanExercise>): Promise<FitnessPlanExercise> {
    const [exercise] = await db
      .update(fitnessPlanExercises)
      .set(updates)
      .where(eq(fitnessPlanExercises.id, id))
      .returning();
    return exercise;
  }

  async removePlanExercise(id: string): Promise<void> {
    await db
      .delete(fitnessPlanExercises)
      .where(eq(fitnessPlanExercises.id, id));
  }

  async reorderPlanExercises(planId: string, exerciseOrders: { id: string; orderIndex: number }[]): Promise<void> {
    // Use a transaction to ensure all updates happen atomically
    await db.transaction(async (tx) => {
      for (const { id, orderIndex } of exerciseOrders) {
        await tx
          .update(fitnessPlanExercises)
          .set({ orderIndex })
          .where(
            and(
              eq(fitnessPlanExercises.id, id),
              eq(fitnessPlanExercises.planId, planId)
            )
          );
      }
    });
  }

  // Fitness plan reminders implementation methods
  async getFitnessPlanReminders(planId: string): Promise<FitnessPlanReminder[]> {
    return await db
      .select()
      .from(fitnessPlanReminders)
      .where(eq(fitnessPlanReminders.planId, planId))
      .orderBy(asc(fitnessPlanReminders.dayOfWeek), asc(fitnessPlanReminders.time));
  }

  async addReminderToPlan(reminder: InsertFitnessPlanReminder): Promise<FitnessPlanReminder> {
    const [planReminder] = await db
      .insert(fitnessPlanReminders)
      .values(reminder)
      .returning();
    return planReminder;
  }

  async updatePlanReminder(id: string, updates: Partial<InsertFitnessPlanReminder>): Promise<FitnessPlanReminder> {
    const [reminder] = await db
      .update(fitnessPlanReminders)
      .set(updates)
      .where(eq(fitnessPlanReminders.id, id))
      .returning();
    return reminder;
  }

  async removePlanReminder(id: string): Promise<void> {
    await db
      .delete(fitnessPlanReminders)
      .where(eq(fitnessPlanReminders.id, id));
  }

  async getActiveReminders(): Promise<(FitnessPlanReminder & { plan: { name: string; userId: string } })[]> {
    return await db
      .select({
        id: fitnessPlanReminders.id,
        planId: fitnessPlanReminders.planId,
        dayOfWeek: fitnessPlanReminders.dayOfWeek,
        time: fitnessPlanReminders.time,
        isActive: fitnessPlanReminders.isActive,
        lastSent: fitnessPlanReminders.lastSent,
        createdAt: fitnessPlanReminders.createdAt,
        plan: {
          name: fitnessPlans.name,
          userId: fitnessPlans.userId,
        }
      })
      .from(fitnessPlanReminders)
      .innerJoin(fitnessPlans, eq(fitnessPlanReminders.planId, fitnessPlans.id))
      .where(eq(fitnessPlanReminders.isActive, true));
  }

  async getDueFitnessReminders(dayOfWeek: string, currentTime: string): Promise<Array<FitnessPlanReminder & { plan: FitnessPlan }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    
    const results = await db
      .select()
      .from(fitnessPlanReminders)
      .innerJoin(fitnessPlans, eq(fitnessPlanReminders.planId, fitnessPlans.id))
      .where(
        and(
          eq(fitnessPlanReminders.isActive, true),
          eq(fitnessPlanReminders.dayOfWeek, dayOfWeek),
          eq(fitnessPlanReminders.time, currentTime)
        )
      );
    
    // Filter in-memory to avoid toISOString errors
    const filtered = results.filter(r => {
      const reminder = r.fitness_plan_reminders;
      if (!reminder.lastSent) return true;
      
      const lastSentDate = new Date(reminder.lastSent);
      lastSentDate.setHours(0, 0, 0, 0);
      
      return lastSentDate.getTime() < today.getTime();
    });
    
    return filtered.map(r => ({
      ...r.fitness_plan_reminders,
      plan: r.fitness_plans
    })) as Array<FitnessPlanReminder & { plan: FitnessPlan }>;
  }

  async getTodayFitnessPlanExercises(planId: string, dayOfWeek: string): Promise<FitnessPlanExercise[]> {
    return await db
      .select()
      .from(fitnessPlanExercises)
      .where(
        and(
          eq(fitnessPlanExercises.planId, planId),
          like(fitnessPlanExercises.daysOfWeek, `%${dayOfWeek}%`)
        )
      )
      .orderBy(asc(fitnessPlanExercises.orderIndex));
  }

  async markFitnessReminderSent(reminderId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    
    await db
      .update(fitnessPlanReminders)
      .set({ lastSent: today })
      .where(eq(fitnessPlanReminders.id, reminderId));
  }

  // Exercise completion implementation methods
  async markExerciseComplete(userId: string, planId: string, exerciseId: string): Promise<ExerciseCompletion> {
    const [completion] = await db
      .insert(exerciseCompletions)
      .values({
        userId,
        planId,
        exerciseId,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exerciseCompletions.userId, exerciseCompletions.exerciseId],
        set: {
          completedAt: new Date(),
        },
      })
      .returning();
    return completion;
  }

  async recordWorkoutFeedback(
    userId: string,
    planId: string,
    workoutType: string,
    feeling: 'too_hard' | 'just_right' | 'too_easy',
    completionPct: number = 1,
  ): Promise<WorkoutFeedback> {
    const safe = Number.isFinite(completionPct)
      ? Math.max(0, Math.min(1, completionPct))
      : 1;
    const [row] = await db
      .insert(workoutFeedback)
      .values({ userId, planId, workoutType, feeling, completionPct: safe })
      .returning();
    return row;
  }

  async getRecentWorkoutFeedback(
    userId: string,
    workoutType: string,
    limit: number = 10,
  ): Promise<WorkoutFeedback[]> {
    // Honor any streak-reset markers — feedback older than the most
    // recent reset for this (user, workoutType) is excluded so a manual
    // level change starts the streak counter from scratch.
    const [latestReset] = await db
      .select()
      .from(workoutStreakResets)
      .where(and(
        eq(workoutStreakResets.userId, userId),
        eq(workoutStreakResets.workoutType, workoutType),
      ))
      .orderBy(desc(workoutStreakResets.resetAt))
      .limit(1);

    const baseConditions = [
      eq(workoutFeedback.userId, userId),
      eq(workoutFeedback.workoutType, workoutType),
    ];
    if (latestReset?.resetAt) {
      baseConditions.push(gt(workoutFeedback.createdAt, latestReset.resetAt));
    }

    return await db
      .select()
      .from(workoutFeedback)
      .where(and(...baseConditions))
      .orderBy(desc(workoutFeedback.createdAt))
      .limit(limit);
  }

  // Insert a streak-reset marker. Called when the plan's level changes
  // (manually or via Lever 6) — wipes the effective streak counter for
  // every workout type for that user without deleting historical data.
  async resetWorkoutStreaks(
    userId: string,
    reason: string = 'manual_level_change',
    workoutTypes: string[] = ['standard', 'standard-cardio', 'hiit', 'stretching'],
  ): Promise<void> {
    if (workoutTypes.length === 0) return;
    await db.insert(workoutStreakResets).values(
      workoutTypes.map(wt => ({ userId, workoutType: wt, reason })),
    );
  }

  async unmarkExerciseComplete(userId: string, exerciseId: string): Promise<void> {
    await db
      .delete(exerciseCompletions)
      .where(and(
        eq(exerciseCompletions.userId, userId),
        eq(exerciseCompletions.exerciseId, exerciseId)
      ));
  }

  async getExerciseCompletions(userId: string, planId: string): Promise<ExerciseCompletion[]> {
    return await db
      .select()
      .from(exerciseCompletions)
      .where(and(
        eq(exerciseCompletions.userId, userId),
        eq(exerciseCompletions.planId, planId)
      ))
      .orderBy(desc(exerciseCompletions.completedAt));
  }

  // Hurdle Wall implementation methods
  async getHurdleWallPosts(userId?: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    userHasPrayed: boolean;
    userHasAmened: boolean;
    replyCount: number;
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
    praise: HurdleWallPraise | null;
    amenCount: number;
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
        amenCount: hurdleWallPosts.amenCount,
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
    
    if (posts.length === 0) return [];

    const postIds = posts.map(p => p.id);

    // Batch-fetch all replies for all posts in one query
    const allReplies = await db
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
      .where(inArray(hurdleWallReplies.postId, postIds))
      .orderBy(asc(hurdleWallReplies.createdAt));

    // Batch-fetch praises, current-user amens, and current-user prayers in parallel
    const [allPraises, userAmens, userPrayers] = await Promise.all([
      db.select().from(hurdleWallPraises).where(inArray(hurdleWallPraises.postId, postIds)),
      userId
        ? db.select({ postId: hurdleWallAmens.postId }).from(hurdleWallAmens)
            .where(and(inArray(hurdleWallAmens.postId, postIds), eq(hurdleWallAmens.userId, userId)))
        : Promise.resolve([] as { postId: string }[]),
      userId
        ? db.select({ postId: hurdleWallPrayers.postId }).from(hurdleWallPrayers)
            .where(and(inArray(hurdleWallPrayers.postId, postIds), eq(hurdleWallPrayers.userId, userId)))
        : Promise.resolve([] as { postId: string }[]),
    ]);

    // Build lookup sets
    const repliesByPostId = new Map<string, typeof allReplies>();
    for (const reply of allReplies) {
      if (!repliesByPostId.has(reply.postId)) repliesByPostId.set(reply.postId, []);
      repliesByPostId.get(reply.postId)!.push(reply);
    }
    const praiseByPostId = new Map<string, HurdleWallPraise>();
    for (const praise of allPraises) {
      praiseByPostId.set(praise.postId, praise);
    }
    const amenedPostIds = new Set(userAmens.map(a => a.postId));
    const prayedPostIds = new Set(userPrayers.map(p => p.postId));

    return posts.map(post => ({
      ...post,
      amenCount: post.amenCount ?? 0,
      userHasPrayed: prayedPostIds.has(post.id),
      userHasAmened: amenedPostIds.has(post.id),
      replies: repliesByPostId.get(post.id) ?? [],
      praise: praiseByPostId.get(post.id) ?? null,
    }));
  }

  async getHurdleWallPost(postId: string, userId?: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
    userHasPrayed: boolean;
    userHasAmened: boolean;
    praise: HurdleWallPraise | null;
    amenCount: number;
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
        amenCount: hurdleWallPosts.amenCount,
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
    
    const [replies, praises, userAmens, userPrayers] = await Promise.all([
      db
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
        .orderBy(asc(hurdleWallReplies.createdAt)),
      db
        .select()
        .from(hurdleWallPraises)
        .where(eq(hurdleWallPraises.postId, postId)),
      userId
        ? db.select({ postId: hurdleWallAmens.postId }).from(hurdleWallAmens)
            .where(and(eq(hurdleWallAmens.postId, postId), eq(hurdleWallAmens.userId, userId)))
        : Promise.resolve([] as { postId: string }[]),
      userId
        ? db.select({ postId: hurdleWallPrayers.postId }).from(hurdleWallPrayers)
            .where(and(eq(hurdleWallPrayers.postId, postId), eq(hurdleWallPrayers.userId, userId)))
        : Promise.resolve([] as { postId: string }[]),
    ]);

    return {
      ...post,
      amenCount: post.amenCount ?? 0,
      userHasPrayed: userPrayers.length > 0,
      userHasAmened: userAmens.length > 0,
      replies,
      praise: praises[0] ?? null,
    };
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
        ))
        .returning({ postId: hurdleWallPrayers.postId });
      
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

  async createHurdleWallPraise(postId: string, userId: string, content: string): Promise<{ success: boolean; praise?: HurdleWallPraise }> {
    try {
      const [existing] = await db.select().from(hurdleWallPraises).where(eq(hurdleWallPraises.postId, postId));
      if (existing) return { success: false };
      const [praise] = await db.insert(hurdleWallPraises).values({ postId, userId, content }).returning();
      return { success: true, praise };
    } catch (error) {
      console.error('Error creating praise:', error);
      return { success: false };
    }
  }

  async updateHurdleWallPraise(postId: string, userId: string, content: string): Promise<HurdleWallPraise | null> {
    try {
      const [updated] = await db
        .update(hurdleWallPraises)
        .set({ content })
        .where(and(eq(hurdleWallPraises.postId, postId), eq(hurdleWallPraises.userId, userId)))
        .returning();
      return updated ?? null;
    } catch (error) {
      console.error('Error updating praise:', error);
      return null;
    }
  }

  async deleteHurdleWallPraise(postId: string, userId: string): Promise<boolean> {
    try {
      const deleted = await db
        .delete(hurdleWallPraises)
        .where(and(eq(hurdleWallPraises.postId, postId), eq(hurdleWallPraises.userId, userId)))
        .returning({ postId: hurdleWallPraises.postId });
      if (deleted.length === 0) return false;
      // Cascade: clear all amens for this post and reset amenCount to 0
      await db.delete(hurdleWallAmens).where(eq(hurdleWallAmens.postId, postId));
      await db.update(hurdleWallPosts).set({ amenCount: 0 }).where(eq(hurdleWallPosts.id, postId));
      return true;
    } catch (error) {
      console.error('Error deleting praise:', error);
      return false;
    }
  }

  async addAmenToPost(postId: string, userId: string): Promise<{ success: boolean; amenCount: number }> {
    try {
      const [existing] = await db.select().from(hurdleWallAmens).where(and(eq(hurdleWallAmens.postId, postId), eq(hurdleWallAmens.userId, userId)));
      if (existing) return { success: false, amenCount: 0 };
      await db.insert(hurdleWallAmens).values({ postId, userId });
      const [updated] = await db
        .update(hurdleWallPosts)
        .set({ amenCount: sql`${hurdleWallPosts.amenCount} + 1`, updatedAt: new Date() })
        .where(eq(hurdleWallPosts.id, postId))
        .returning({ amenCount: hurdleWallPosts.amenCount });
      return { success: true, amenCount: updated?.amenCount ?? 0 };
    } catch (error) {
      console.error('Error adding amen:', error);
      return { success: false, amenCount: 0 };
    }
  }

  async removeAmenFromPost(postId: string, userId: string): Promise<{ success: boolean; amenCount: number }> {
    try {
      const deleted = await db.delete(hurdleWallAmens).where(and(eq(hurdleWallAmens.postId, postId), eq(hurdleWallAmens.userId, userId))).returning({ postId: hurdleWallAmens.postId });
      if (deleted.length === 0) return { success: false, amenCount: 0 };
      const [updated] = await db
        .update(hurdleWallPosts)
        .set({ amenCount: sql`GREATEST(${hurdleWallPosts.amenCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(hurdleWallPosts.id, postId))
        .returning({ amenCount: hurdleWallPosts.amenCount });
      return { success: true, amenCount: updated?.amenCount ?? 0 };
    } catch (error) {
      console.error('Error removing amen:', error);
      return { success: false, amenCount: 0 };
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

  async deleteHurdleWallPost(postId: string, userId: string, isAdmin = false): Promise<boolean> {
    try {
      // First verify the user owns this post (or is admin)
      const [post] = await db
        .select()
        .from(hurdleWallPosts)
        .where(eq(hurdleWallPosts.id, postId));
      
      if (!post || (!isAdmin && post.userId !== userId)) {
        return false;
      }
      
      // Delete all related data first
      await db.delete(hurdleWallPrayers).where(eq(hurdleWallPrayers.postId, postId));
      await db.delete(hurdleWallReplies).where(eq(hurdleWallReplies.postId, postId));
      
      // Delete the post
      await db.delete(hurdleWallPosts).where(eq(hurdleWallPosts.id, postId));
      
      return true;
    } catch (error) {
      console.error('Error deleting hurdle wall post:', error);
      return false;
    }
  }

  async deleteHurdleWallReply(replyId: string, userId: string, isAdmin = false): Promise<boolean> {
    try {
      // First verify the user owns this reply (or is admin)
      const [reply] = await db
        .select()
        .from(hurdleWallReplies)
        .where(eq(hurdleWallReplies.id, replyId));
      
      if (!reply || (!isAdmin && reply.userId !== userId)) {
        return false;
      }
      
      // Delete the reply
      await db.delete(hurdleWallReplies).where(eq(hurdleWallReplies.id, replyId));
      
      // Update the reply count on the post
      await db
        .update(hurdleWallPosts)
        .set({
          replyCount: sql`${hurdleWallPosts.replyCount} - 1`,
          updatedAt: new Date()
        })
        .where(eq(hurdleWallPosts.id, reply.postId));
      
      return true;
    } catch (error) {
      console.error('Error deleting hurdle wall reply:', error);
      return false;
    }
  }

  async updateHurdleWallReply(replyId: string, userId: string, content: string): Promise<HurdleWallReply | null> {
    const [reply] = await db.select().from(hurdleWallReplies).where(eq(hurdleWallReplies.id, replyId)).limit(1);
    if (!reply || reply.userId !== userId) return null;
    const [updated] = await db
      .update(hurdleWallReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(hurdleWallReplies.id, replyId))
      .returning();
    return updated ?? null;
  }



  async getUserHurdleWallPosts(userId: string): Promise<(HurdleWallPost & { 
    user: { id: string; firstName: string; lastName: string }; 
    userHasPrayed?: boolean;
    replyCount: number;
    replies: (HurdleWallReply & { user: { id: string; firstName: string; lastName: string } })[];
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
      .where(eq(hurdleWallPosts.userId, userId))
      .orderBy(desc(hurdleWallPosts.createdAt));
    
    if (posts.length === 0) return [];

    // Batch-fetch all replies for all posts in one query
    const allReplies = await db
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
      .where(inArray(hurdleWallReplies.postId, posts.map(p => p.id)))
      .orderBy(asc(hurdleWallReplies.createdAt));

    // Group replies by postId in memory
    const repliesByPostId = new Map<string, typeof allReplies>();
    for (const reply of allReplies) {
      if (!repliesByPostId.has(reply.postId)) repliesByPostId.set(reply.postId, []);
      repliesByPostId.get(reply.postId)!.push(reply);
    }

    return posts.map(post => ({ ...post, replies: repliesByPostId.get(post.id) ?? [] }));
  }

  // Events implementation methods
  async getEvents(): Promise<(Event & { tiers: EventTier[] })[]> {
    const allEvents = await db
      .select()
      .from(events)
      .orderBy(desc(events.eventDate));
    const allTiers = await db.select().from(eventTiers).orderBy(asc(eventTiers.sortOrder));
    return allEvents.map(ev => ({
      ...ev,
      tiers: allTiers.filter(t => t.eventId === ev.id),
    }));
  }

  async getEventById(id: string): Promise<(Event & { tiers: EventTier[] }) | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id));
    if (!event) return undefined;
    const tiers = await db.select().from(eventTiers).where(eq(eventTiers.eventId, id)).orderBy(asc(eventTiers.sortOrder));
    return { ...event, tiers };
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values(event)
      .returning();
    return newEvent;
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await db
      .delete(events)
      .where(eq(events.id, id));
  }

  async getEventTiers(eventId: string): Promise<EventTier[]> {
    return await db
      .select()
      .from(eventTiers)
      .where(eq(eventTiers.eventId, eventId))
      .orderBy(asc(eventTiers.sortOrder));
  }

  async replaceEventTiers(eventId: string, tiers: Omit<InsertEventTier, 'eventId'>[]): Promise<EventTier[]> {
    await db.delete(eventTiers).where(eq(eventTiers.eventId, eventId));
    if (tiers.length === 0) return [];
    const inserted = await db
      .insert(eventTiers)
      .values(tiers.map((t, i) => ({ ...t, eventId, sortOrder: i })))
      .returning();
    return inserted;
  }

  async registerForEvent(registration: InsertEventRegistration): Promise<EventRegistration> {
    const [newRegistration] = await db
      .insert(eventRegistrations)
      .values(registration)
      .returning();
    return newRegistration;
  }

  async getEventRegistration(eventId: string, userId: string): Promise<EventRegistration | undefined> {
    const [registration] = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, userId)
        )
      );
    return registration;
  }

  async getEventRegistrations(eventId: string): Promise<{ registrationId: string; userId: string; firstName: string | null; lastName: string | null; email: string | null; registrationType: string; paymentStatus: string; amountPaid: string | null; tierName: string | null; registeredAt: Date | null }[]> {
    const rows = await db
      .select({
        registrationId: eventRegistrations.id,
        userId: eventRegistrations.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        registrationType: eventRegistrations.registrationType,
        paymentStatus: eventRegistrations.paymentStatus,
        amountPaid: eventRegistrations.amountPaid,
        tierName: eventRegistrations.tierName,
        registeredAt: eventRegistrations.registeredAt,
      })
      .from(eventRegistrations)
      .innerJoin(users, eq(eventRegistrations.userId, users.id))
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(asc(eventRegistrations.registeredAt));
    return rows;
  }

  async getUserEventRegistrations(userId: string): Promise<(EventRegistration & { event: Event })[]> {
    const registrations = await db
      .select({
        id: eventRegistrations.id,
        eventId: eventRegistrations.eventId,
        userId: eventRegistrations.userId,
        registrationType: eventRegistrations.registrationType,
        paymentStatus: eventRegistrations.paymentStatus,
        paymentIntentId: eventRegistrations.paymentIntentId,
        amountPaid: eventRegistrations.amountPaid,
        registeredAt: eventRegistrations.registeredAt,
        cancelledAt: eventRegistrations.cancelledAt,
        event: {
          id: events.id,
          title: events.title,
          description: events.description,
          eventDate: events.eventDate,
          eventTime: events.eventTime,
          location: events.location,
          url: events.url,
          requiresPurchase: events.requiresPurchase,
          price: events.price,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt
        }
      })
      .from(eventRegistrations)
      .innerJoin(events, eq(eventRegistrations.eventId, events.id))
      .where(eq(eventRegistrations.userId, userId))
      .orderBy(desc(events.eventDate));

    return registrations.map(r => ({
      id: r.id,
      eventId: r.eventId,
      userId: r.userId,
      registrationType: r.registrationType,
      paymentStatus: r.paymentStatus,
      stripePaymentIntentId: (r as any).paymentIntentId ?? null,
      registeredAt: r.registeredAt,
      event: r.event
    }));
  }

  // Live stream operations
  async getLiveStreams(): Promise<LiveStream[]> {
    return await db
      .select()
      .from(liveStreams)
      .orderBy(desc(liveStreams.createdAt));
  }

  async getActiveLiveStream(): Promise<LiveStream | null> {
    const [stream] = await db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.status, 'live'))
      .limit(1);
    return stream || null;
  }

  async getLiveStream(id: string): Promise<LiveStream | undefined> {
    const [stream] = await db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.id, id));
    return stream;
  }

  async createLiveStream(stream: InsertLiveStream): Promise<LiveStream> {
    const [newStream] = await db
      .insert(liveStreams)
      .values(stream)
      .returning();
    return newStream;
  }

  async startLiveStream(id: string): Promise<LiveStream> {
    const [stream] = await db
      .update(liveStreams)
      .set({ 
        status: 'live', 
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(liveStreams.id, id))
      .returning();
    return stream;
  }

  async endLiveStream(id: string): Promise<LiveStream> {
    const [stream] = await db
      .update(liveStreams)
      .set({ 
        status: 'ended', 
        endedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(liveStreams.id, id))
      .returning();
    return stream;
  }

  async deleteLiveStream(id: string): Promise<void> {
    await db
      .delete(liveStreams)
      .where(eq(liveStreams.id, id));
  }

  // Store operations
  async getStoreProducts(tier?: string): Promise<StoreProduct[]> {
    const conditions = [eq(storeProducts.isActive, true)];
    if (tier) {
      conditions.push(eq(storeProducts.tier, tier));
    }
    return await db
      .select()
      .from(storeProducts)
      .where(and(...conditions))
      .orderBy(asc(storeProducts.displayOrder), asc(storeProducts.rationCost));
  }

  async getStoreProduct(id: string): Promise<StoreProduct | undefined> {
    const [product] = await db
      .select()
      .from(storeProducts)
      .where(eq(storeProducts.id, id));
    return product;
  }

  async createStoreProduct(product: InsertStoreProduct): Promise<StoreProduct> {
    const [newProduct] = await db
      .insert(storeProducts)
      .values(product)
      .returning();
    return newProduct;
  }

  async updateStoreProduct(id: string, product: Partial<InsertStoreProduct>): Promise<StoreProduct> {
    const [updatedProduct] = await db
      .update(storeProducts)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(storeProducts.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteStoreProduct(id: string): Promise<void> {
    await db
      .delete(storeProducts)
      .where(eq(storeProducts.id, id));
  }

  // Store redemption operations
  async redeemProduct(userId: string, productId: string, shippingInfo?: {
    shippingName?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingZip?: string;
    shippingPhone?: string;
    shippingEmail?: string;
  }, selectedSize?: string): Promise<StoreRedemption> {
    // Get product and verify it exists and is active
    const product = await this.getStoreProduct(productId);
    if (!product || !product.isActive) {
      throw new Error("Product not found or no longer available");
    }

    // Check stock
    if (product.stock !== null && product.stock <= 0) {
      throw new Error("Product is out of stock");
    }

    // Validate size is required for products with sizes
    if (product.hasSizes && (!selectedSize || selectedSize.trim() === '')) {
      throw new Error("Please select a size for this product");
    }

    // Get user and check rations balance
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const userRations = user.rations || 0;
    if (userRations < product.rationCost) {
      throw new Error(`Insufficient rations. You need ${product.rationCost} rations but have ${userRations}`);
    }

    // Deduct rations from user
    await db
      .update(users)
      .set({ 
        rations: userRations - product.rationCost,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Reduce stock if applicable
    if (product.stock !== null) {
      await db
        .update(storeProducts)
        .set({ 
          stock: product.stock - 1,
          updatedAt: new Date()
        })
        .where(eq(storeProducts.id, productId));
    }

    // Create redemption record
    const [redemption] = await db
      .insert(storeRedemptions)
      .values({
        userId,
        productId,
        rationsCost: product.rationCost,
        selectedSize: selectedSize || null,
        status: 'pending',
        ...shippingInfo
      })
      .returning();

    return redemption;
  }

  async getUserRedemptions(userId: string): Promise<(StoreRedemption & { product: StoreProduct })[]> {
    const results = await db
      .select({
        redemption: storeRedemptions,
        product: storeProducts
      })
      .from(storeRedemptions)
      .innerJoin(storeProducts, eq(storeRedemptions.productId, storeProducts.id))
      .where(eq(storeRedemptions.userId, userId))
      .orderBy(desc(storeRedemptions.createdAt));

    return results.map(r => ({
      ...r.redemption,
      product: r.product
    }));
  }

  async getAllRedemptions(status?: string): Promise<(StoreRedemption & { product: StoreProduct; user: User })[]> {
    const conditions = [];
    if (status) {
      conditions.push(eq(storeRedemptions.status, status));
    }

    const results = await db
      .select({
        redemption: storeRedemptions,
        product: storeProducts,
        user: users
      })
      .from(storeRedemptions)
      .innerJoin(storeProducts, eq(storeRedemptions.productId, storeProducts.id))
      .innerJoin(users, eq(storeRedemptions.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(storeRedemptions.createdAt));

    return results.map(r => ({
      ...r.redemption,
      product: r.product,
      user: r.user
    }));
  }

  async updateRedemptionStatus(id: string, status: string, fulfilledBy?: string, trackingNumber?: string): Promise<StoreRedemption> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'shipped' || status === 'delivered') {
      updateData.fulfilledAt = new Date();
      if (fulfilledBy) {
        updateData.fulfilledBy = fulfilledBy;
      }
    }

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    const [redemption] = await db
      .update(storeRedemptions)
      .set(updateData)
      .where(eq(storeRedemptions.id, id))
      .returning();

    return redemption;
  }

  // Accountability requests operations
  async getAccountabilityRequests(currentUserId?: string): Promise<any[]> {
    const requests = await db
      .select()
      .from(accountabilityRequests)
      .orderBy(desc(accountabilityRequests.createdAt));

    // Pre-fetch support counts and current user's support status in bulk
    const requestIds = requests.map(r => r.id);
    let supportCountsMap: Record<string, number> = {};
    let userSupportedSet = new Set<string>();

    if (requestIds.length > 0) {
      const supportRows = await db
        .select({ requestId: accountabilitySupports.requestId, userId: accountabilitySupports.userId })
        .from(accountabilitySupports)
        .where(inArray(accountabilitySupports.requestId, requestIds));
      for (const row of supportRows) {
        supportCountsMap[row.requestId] = (supportCountsMap[row.requestId] || 0) + 1;
        if (currentUserId && row.userId === currentUserId) {
          userSupportedSet.add(row.requestId);
        }
      }
    }

    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const [user] = await db.select().from(users).where(eq(users.id, request.userId));
        let assister = null;
        if (request.assistedById) {
          const [assisterUser] = await db.select().from(users).where(eq(users.id, request.assistedById));
          assister = assisterUser;
        }
        return {
          ...request,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          } : null,
          assister: assister ? {
            id: assister.id,
            firstName: assister.firstName,
            lastName: assister.lastName,
            profileImageUrl: assister.profileImageUrl,
          } : null,
          supportCount: supportCountsMap[request.id] || 0,
          gotYour6ByMe: userSupportedSet.has(request.id),
        };
      })
    );

    return requestsWithUsers;
  }

  async toggleAccountabilitySupport(requestId: string, userId: string): Promise<{ supported: boolean; totalSupports: number }> {
    const [existing] = await db
      .select()
      .from(accountabilitySupports)
      .where(and(eq(accountabilitySupports.requestId, requestId), eq(accountabilitySupports.userId, userId)));

    if (existing) {
      await db.delete(accountabilitySupports).where(
        and(eq(accountabilitySupports.requestId, requestId), eq(accountabilitySupports.userId, userId))
      );
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(accountabilitySupports).where(eq(accountabilitySupports.requestId, requestId));
      return { supported: false, totalSupports: Number(count) };
    } else {
      await db.insert(accountabilitySupports).values({ requestId, userId });
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(accountabilitySupports).where(eq(accountabilitySupports.requestId, requestId));
      return { supported: true, totalSupports: Number(count) };
    }
  }

  async getAccountabilityRequestById(id: string): Promise<AccountabilityRequest | undefined> {
    const [request] = await db
      .select()
      .from(accountabilityRequests)
      .where(eq(accountabilityRequests.id, id));
    return request;
  }

  async createAccountabilityRequest(request: { userId: string; content: string }): Promise<AccountabilityRequest> {
    const [newRequest] = await db
      .insert(accountabilityRequests)
      .values({
        userId: request.userId,
        content: request.content,
      })
      .returning();
    return newRequest;
  }

  async markAccountabilityRequestAssisted(requestId: string, assisterId: string): Promise<AccountabilityRequest> {
    const [updated] = await db
      .update(accountabilityRequests)
      .set({
        assistedById: assisterId,
        assistedAt: new Date(),
      })
      .where(eq(accountabilityRequests.id, requestId))
      .returning();
    return updated;
  }

  async unassistAccountabilityRequest(requestId: string): Promise<AccountabilityRequest> {
    const [updated] = await db
      .update(accountabilityRequests)
      .set({
        assistedById: null,
        assistedAt: null,
      })
      .where(eq(accountabilityRequests.id, requestId))
      .returning();
    return updated;
  }

  async deleteAccountabilityRequest(id: string): Promise<void> {
    await db.delete(accountabilityRequests).where(eq(accountabilityRequests.id, id));
  }

  async getActiveManUpLinks(): Promise<ManUpLink[]> {
    return await db
      .select()
      .from(manUpLinks)
      .where(eq(manUpLinks.isActive, true))
      .orderBy(asc(manUpLinks.displayOrder));
  }

  async getAllManUpLinks(): Promise<ManUpLink[]> {
    return await db
      .select()
      .from(manUpLinks)
      .orderBy(asc(manUpLinks.displayOrder));
  }

  async getManUpLink(id: string): Promise<ManUpLink | undefined> {
    const [item] = await db
      .select()
      .from(manUpLinks)
      .where(eq(manUpLinks.id, id))
      .limit(1);
    return item;
  }

  async createManUpLink(link: InsertManUpLink): Promise<ManUpLink> {
    const [created] = await db
      .insert(manUpLinks)
      .values(link)
      .returning();
    return created;
  }

  async updateManUpLink(id: string, link: Partial<InsertManUpLink>): Promise<ManUpLink> {
    const [updated] = await db
      .update(manUpLinks)
      .set({
        ...link,
        updatedAt: new Date(),
      })
      .where(eq(manUpLinks.id, id))
      .returning();
    return updated;
  }

  async deleteManUpLink(id: string): Promise<void> {
    await db
      .delete(manUpLinks)
      .where(eq(manUpLinks.id, id));
  }

  async getBibleReadingPlans(): Promise<BibleReadingPlan[]> {
    return db
      .select()
      .from(bibleReadingPlans)
      .where(eq(bibleReadingPlans.isActive, true))
      .orderBy(asc(bibleReadingPlans.createdAt));
  }

  async getBibleReadingPlanDays(planId: string): Promise<BibleReadingPlanDay[]> {
    return db
      .select()
      .from(bibleReadingPlanDays)
      .where(eq(bibleReadingPlanDays.planId, planId))
      .orderBy(asc(bibleReadingPlanDays.dayNumber));
  }

  async getBibleReadingProgress(userId: string, planId: string): Promise<BibleReadingProgress[]> {
    return db
      .select()
      .from(bibleReadingProgress)
      .where(and(
        eq(bibleReadingProgress.userId, userId),
        eq(bibleReadingProgress.planId, planId)
      ))
      .orderBy(asc(bibleReadingProgress.dayNumber));
  }

  async markBibleReadingDayComplete(userId: string, planId: string, dayNumber: number): Promise<BibleReadingProgress> {
    const existing = await db
      .select()
      .from(bibleReadingProgress)
      .where(and(
        eq(bibleReadingProgress.userId, userId),
        eq(bibleReadingProgress.planId, planId),
        eq(bibleReadingProgress.dayNumber, dayNumber)
      ))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [created] = await db
      .insert(bibleReadingProgress)
      .values({ userId, planId, dayNumber })
      .returning();
    return created;
  }

  async unmarkBibleReadingDayComplete(userId: string, planId: string, dayNumber: number): Promise<void> {
    await db
      .delete(bibleReadingProgress)
      .where(and(
        eq(bibleReadingProgress.userId, userId),
        eq(bibleReadingProgress.planId, planId),
        eq(bibleReadingProgress.dayNumber, dayNumber)
      ));
  }

  async getBibleReadingConsecutiveDays(userId: string, planId: string): Promise<number> {
    const rows = await db
      .select({ dayNumber: bibleReadingProgress.dayNumber, completedAt: bibleReadingProgress.completedAt })
      .from(bibleReadingProgress)
      .where(and(
        eq(bibleReadingProgress.userId, userId),
        eq(bibleReadingProgress.planId, planId)
      ))
      .orderBy(desc(bibleReadingProgress.completedAt));

    if (rows.length === 0) return 0;

    const completedDays = new Set(rows.map(r => r.dayNumber));
    let streak = 0;
    let check = rows[0].dayNumber;
    while (completedDays.has(check)) {
      streak++;
      check--;
    }
    return streak;
  }

  async seedBiblePlan(
    planData: { name: string; description: string; planType: string },
    days: Array<{ dayNumber: number; title: string; passages: string }>
  ): Promise<BibleReadingPlan> {
    const [plan] = await db
      .insert(bibleReadingPlans)
      .values({ name: planData.name, description: planData.description, planType: planData.planType, totalDays: days.length })
      .returning();

    const BATCH = 100;
    for (let i = 0; i < days.length; i += BATCH) {
      const batch = days.slice(i, i + BATCH).map(d => ({
        planId: plan.id,
        dayNumber: d.dayNumber,
        title: d.title,
        passages: d.passages,
      }));
      await db.insert(bibleReadingPlanDays).values(batch);
    }
    return plan;
  }

  // Prayer reminder operations
  async getPrayerReminders(userId: string): Promise<PrayerReminder | undefined> {
    const [row] = await db.select().from(prayerReminders).where(eq(prayerReminders.userId, userId));
    return row;
  }

  async upsertPrayerReminders(userId: string, data: Partial<PrayerReminder>): Promise<PrayerReminder> {
    const existing = await this.getPrayerReminders(userId);
    if (existing) {
      const [row] = await db
        .update(prayerReminders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(prayerReminders.userId, userId))
        .returning();
      return row;
    } else {
      const [row] = await db
        .insert(prayerReminders)
        .values({ userId, ...data, updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  async getAllPrayerReminders(): Promise<PrayerReminder[]> {
    return db.select().from(prayerReminders);
  }

  // Daily app reminder operations
  async getDailyReminder(userId: string): Promise<DailyAppReminder | undefined> {
    const [row] = await db.select().from(dailyAppReminders).where(eq(dailyAppReminders.userId, userId));
    return row;
  }

  async upsertDailyReminder(userId: string, data: Partial<DailyAppReminder>): Promise<DailyAppReminder> {
    const existing = await this.getDailyReminder(userId);
    if (existing) {
      const [row] = await db
        .update(dailyAppReminders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dailyAppReminders.userId, userId))
        .returning();
      return row;
    } else {
      const [row] = await db
        .insert(dailyAppReminders)
        .values({ userId, ...data, updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  async getAllDailyReminders(): Promise<DailyAppReminder[]> {
    return db.select().from(dailyAppReminders);
  }

  // ─── Food Intake ───────────────────────────────────────────────────────────

  async addFoodIntakeEntry(entry: InsertFoodIntakeEntry): Promise<FoodIntakeEntry> {
    const [row] = await db.insert(foodIntakeEntries).values(entry).returning();
    return row;
  }

  async getFoodIntakeEntries(userId: string, startDate: string, endDate: string): Promise<FoodIntakeEntry[]> {
    return db
      .select()
      .from(foodIntakeEntries)
      .where(
        and(
          eq(foodIntakeEntries.userId, userId),
          gte(foodIntakeEntries.date, startDate),
          lte(foodIntakeEntries.date, endDate),
        ),
      )
      .orderBy(asc(foodIntakeEntries.date), asc(foodIntakeEntries.createdAt));
  }

  async deleteFoodIntakeEntry(id: string, userId: string): Promise<void> {
    await db
      .delete(foodIntakeEntries)
      .where(and(eq(foodIntakeEntries.id, id), eq(foodIntakeEntries.userId, userId)));
  }

  // ─── Nutrition Profile ─────────────────────────────────────────────────────

  async getNutritionProfile(userId: string): Promise<NutritionProfile | undefined> {
    const [row] = await db
      .select()
      .from(nutritionProfiles)
      .where(eq(nutritionProfiles.userId, userId));
    return row;
  }

  async upsertNutritionProfile(profile: InsertNutritionProfile): Promise<NutritionProfile> {
    const { userId, ...rest } = profile;
    const [row] = await db
      .insert(nutritionProfiles)
      .values({ ...profile, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: nutritionProfiles.userId,
        set: { ...rest, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  // ─── VATMEBOP Accountability Chart ─────────────────────────────────────────

  async getVatmebopChart(userId: string, year: number): Promise<VatmebopCheck[]> {
    return db
      .select()
      .from(vatmebopChecks)
      .where(and(eq(vatmebopChecks.userId, userId), eq(vatmebopChecks.year, year)))
      .orderBy(asc(vatmebopChecks.week));
  }

  async upsertVatmebopCheck(
    userId: string,
    year: number,
    week: number,
    disciplines: Partial<Record<'v'|'a'|'t'|'m'|'e'|'b'|'o'|'p', number>>,
  ): Promise<VatmebopCheck> {
    const [row] = await db
      .insert(vatmebopChecks)
      .values({ userId, year, week, ...disciplines })
      .onConflictDoUpdate({
        target: [vatmebopChecks.userId, vatmebopChecks.year, vatmebopChecks.week],
        set: disciplines,
      })
      .returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
