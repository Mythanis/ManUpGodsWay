import type { Express } from "express";
import { maskMentionIds } from './mentionUtils';
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "@shared/termsContent";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWorker } from 'tesseract.js';
import { pdfToPng } from 'pdf-to-png-converter';
import { createRequire } from 'module';

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);
import { storage } from "./storage";
import { startAuditJob, getAuditJobStatus, isAuditJobRunning, auditSingleExercise } from "./exerciseAuditJob";
import { reclassifyExerciseSidedness } from "./exerciseSidednessJob";
import { getNextMidnightInTimezone } from "./drip-utils";
import { safeTimezone } from "./timezone-utils";
import { warGroupsService } from "./warGroupsService";
import { extractMentionsAndFanOut } from "./mentions";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import * as schema from "@shared/schema";
import { evaluateExerciseAgainstInjuries } from "@shared/injuryFilter";
import { eq, and, sql, desc, asc, gt, gte, ne, count, or, isNull, inArray, ilike, isNotNull } from "drizzle-orm";
import { 
  insertStudySchema, 
  insertStudySeriesSchema,
  insertDiscussionSchema, 
  insertDiscussionReplySchema,
  insertDiscussionSubscriptionSchema,
  insertDevotionalSchema,
  insertStudyRatingSchema,
  insertVideoRatingSchema,
  insertLogoSettingsSchema,
  insertHeaderLogoSettingsSchema,
  insertSystemSettingsSchema,
  insertPodcastSchema,
  insertPodcastRatingSchema,
  insertContentFlagSchema,
  insertTestimonySchema,
  insertFitnessChallengeSchema,
  insertPreBuiltFitnessPlanSchema,
  insertFavoriteExerciseSchema,
  insertFitnessPlanSchema,
  insertFitnessPlanExerciseSchema,
  insertFitnessPlanReminderSchema,
  insertEventSchema,
  insertEventRegistrationSchema,
  insertStudyEditableSectionSchema,
  insertUserStudyResponseSchema,
  insertWarGroupSchema,
  insertWarGroupMemberSchema,
  insertFitnessPostSchema,
  insertExerciseSchema,
  insertHealthMetricSchema,
  type HealthMetricType,
  insertUserInjurySchema,
  insertWorkoutInjuryAcknowledgementSchema,
} from "@shared/schema";
import { z, ZodError } from "zod";
import { devotionalNotificationService } from "./devotionalNotificationService";
import { strictWriteLimiter } from "./rateLimiter";
import { uploadPublicFile, uploadPublicFileFromPath, uploadPrivateFile, deleteStorageFile, streamVideoFromStorage, streamPublicFileFromStorage, isStorageUrl, countStorageFiles } from "./objectStorage";
import os from "os";
import { 
  savePushSubscription, 
  removePushSubscription, 
  removeAllPushSubscriptionsForUser,
  getUserSubscriptionCount,
  sendPushNotification,
  sendPushToAllUsers
} from "./pushNotificationService";
import { selectLeverForStreak } from "./fitness-adjustment-levers";
import {
  applyTooHardLever,
  applyLever6Decision,
  type Level as TooHardLevel,
  type WorkoutType as TooHardWorkoutType,
  type LeverId as TooHardLeverId,
} from "./fitness-too-hard-adjustments";
import {
  applyTooEasyLever,
  applyLever6Decision as applyTooEasyLever6Decision,
} from "./fitness-too-easy-adjustments";
import {
  logAdjustmentBatch,
  partialUndoLastBatch,
  restoreFieldBaselines,
  fullRollback,
} from "./fitness-rollback";
import { db as dbForLever6 } from "./db";
import { fitnessPlans as fitnessPlansForLever6 } from "@shared/schema";
import { eq as eqForLever6 } from "drizzle-orm";
import Parser from 'rss-parser';
import { sendFeedbackEmail, sendHelpRequestEmail } from './emailService';

// Pull a media filename out of an exercise JSON entry, accepting any of the
// common key spellings. Strips whitespace and returns "" when nothing usable
// is present so the column always holds a string.
function pickMediaFileName(ex: any): string {
  const candidates = [
    ex?.media_file,
    ex?.mediaFile,
    ex?.media,
    ex?.image,
    ex?.image_file,
    ex?.imageFile,
    ex?.video,
    ex?.video_file,
    ex?.videoFile,
    ex?.gif,
    ex?.filename,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim();
  }
  return '';
}

// Role checking helper functions
function isAdmin(user: any): boolean {
  return user && (user.role === 'admin' || user.role === 'owner');
}

function isOwner(user: any): boolean {
  return user && user.role === 'owner';
}

function isModerator(user: any): boolean {
  return user && (user.role === 'moderator' || user.role === 'admin' || user.role === 'owner');
}

function hasAdminPrivileges(user: any): boolean {
  return isAdmin(user);
}

function hasOwnerPrivileges(user: any): boolean {
  return isOwner(user);
}


// Subscription access checking helpers
function hasActiveSubscription(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'owner') return true;
  if (user.subscriptionStatus === 'active') return true;
  // past_due = payment failed but Stripe is still retrying; keep access during retry window
  if (user.subscriptionStatus === 'past_due') return true;
  // Platform trial: non-Stripe trial with a valid end date
  if (user.subscriptionStatus === 'trial' && user.trialEndDate && new Date(user.trialEndDate) > new Date()) return true;
  // Cancelled users retain full access until their expiration date
  if (user.subscriptionStatus === 'cancelled' && user.subscriptionExpiresAt) {
    return new Date(user.subscriptionExpiresAt) > new Date();
  }
  // Fallback: subscriptionTier still shows 'subscriber' (e.g. tier wasn't downgraded)
  if (user.subscriptionTier === 'subscriber') return true;
  return false;
}

function isOnTrial(user: any): boolean {
  if (!user || user.subscriptionStatus !== 'trial') return false;
  if (!user.trialEndDate) return false;
  return new Date(user.trialEndDate) > new Date();
}

function hasAnyAccess(user: any): boolean {
  return hasActiveSubscription(user) || isOnTrial(user);
}

async function canAccessContentArea(user: any, area: string): Promise<boolean> {
  if (hasActiveSubscription(user)) return true;
  if (!isOnTrial(user)) return false;
  
  try {
    const settings = await storage.getSubscriptionSettings();
    if (!settings?.trialContentAreas) return false;
    const trialAreas = settings.trialContentAreas as Record<string, boolean>;
    return trialAreas[area] === true;
  } catch {
    return false;
  }
}

async function canAccessContent(user: any, area: string, isTrialAccessible?: boolean): Promise<boolean> {
  if (hasActiveSubscription(user)) return true;
  if (!isOnTrial(user)) return false;
  
  // Check if specific item is marked as trial accessible
  if (isTrialAccessible) return true;
  
  // Check if the whole content area is enabled for trial
  return canAccessContentArea(user, area);
}

// Admin middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user || !isAdmin(user)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Feedback schema
const feedbackSchema = z.object({
  feedback: z.string().min(1, "Feedback is required").max(1000, "Feedback must be 1000 characters or less"),
  category: z.enum(["improvement", "feature-request", "bug-report", "compliment", "complaint", "general"])
});

// Configure multer for video uploads with memory storage (uploads to Object Storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'));
    }
  }
});

// Configure multer for image uploads (logos)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Configure multer for exercise JSON file imports (admin only)
const exerciseJsonUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB — easily covers thousands of exercises
  },
  fileFilter: function (req, file, cb) {
    const isJson =
      file.mimetype === 'application/json' ||
      file.mimetype === 'text/json' ||
      file.mimetype === 'text/plain' ||
      file.originalname.toLowerCase().endsWith('.json');
    if (isJson) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed!'));
    }
  }
});

// Configure multer for thumbnail uploads with memory storage (uploads to Object Storage)
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Configure multer for blog thumbnail uploads with memory storage (uploads to Object Storage)
const blogThumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed!'));
    }
  }
});

// Configure multer for store product images with memory storage (uploads to Object Storage)
const storeProductImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed!'));
    }
  }
});

// Configure multer for document uploads (PDF/Word) with disk storage
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Sanitize filename: extract and validate extension
    // Reject filenames with NUL bytes and whitelist only allowed extensions
    if (file.originalname.includes('\0')) {
      return cb(new Error('Invalid filename: contains null byte'));
    }
    
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.docx', '.doc']; // Both .doc and .docx supported
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`));
    }
    
    cb(null, `document-${uniqueSuffix}${ext}`);
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for documents
  },
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents (.doc/.docx) are allowed!'));
    }
  }
});

// Allowed mime types for exercise media (single & bulk)
const EXERCISE_MEDIA_MIMES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
];

// Configure multer for single exercise media uploads (memory storage — one file at a time, safe).
const exerciseMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: function (req, file, cb) {
    if (EXERCISE_MEDIA_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, GIF, or MP4/WebM video files are allowed for exercise media'));
    }
  },
});

// Temp directory for bulk media uploads. Created once at module load; the OS
// cleans it between reboots and we delete each file immediately after upload.
const BULK_MEDIA_TMP_DIR = path.join(os.tmpdir(), 'exercise-bulk-media');
if (!fs.existsSync(BULK_MEDIA_TMP_DIR)) {
  fs.mkdirSync(BULK_MEDIA_TMP_DIR, { recursive: true });
}

// Configure multer for BULK exercise media imports — disk storage so that
// thousands of large files are written to disk one by one instead of all
// being held in RAM simultaneously. Each temp file is deleted after its
// upload to GCS completes (or fails).
const exerciseBulkMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BULK_MEDIA_TMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  fileFilter: function (req, file, cb) {
    if (EXERCISE_MEDIA_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, GIF, or MP4/WebM video files are allowed for exercise media'));
    }
  },
});

// Configure multer for community media uploads (images, videos, gifs) — memory storage → Object Storage
const communityMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos, smaller files for images
  },
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM) are allowed!'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // ── Public media proxy ────────────────────────────────────────────────────
  // Serves public files stored in GCS (thumbnails, images, community media).
  // GCS direct URLs are not publicly accessible (uniform bucket-level ACL),
  // so all public uploads are routed through this endpoint.
  // Route: GET /api/media/public/uploads/*  (no authentication required)
  app.get('/api/media/public/uploads/*', async (req: any, res) => {
    try {
      // req.params[0] is everything after /api/media/public/uploads/
      const filePath = req.params[0] as string;
      if (!filePath) return res.status(400).json({ message: "No file path specified" });
      const objectName = `public/uploads/${filePath}`;
      await streamPublicFileFromStorage(objectName, res, req.headers.range);
    } catch (error) {
      console.error("[MediaProxy] Error serving public file:", error);
      if (!res.headersSent) res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Owner-only system control routes
  app.post('/api/owners/system/clear-cache', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!hasOwnerPrivileges(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      // Return success - cache clearing happens on frontend
      res.json({ success: true, message: "Cache clear operation completed" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ message: "Failed to clear cache" });
    }
  });

  app.post('/api/owners/system/emergency-reset', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!hasOwnerPrivileges(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      // Return success - emergency reset happens on frontend
      res.json({ success: true, message: "Emergency reset operation completed" });
    } catch (error) {
      console.error("Error performing emergency reset:", error);
      res.status(500).json({ message: "Failed to perform emergency reset" });
    }
  });

  // Count users eligible for bulk trial extension (expired + trial status only)
  app.get('/api/owners/users/grant-trial-extension/count', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }
      const eligibleCount = await storage.countEligibleForTrialExtension();
      let trialDays = 7;
      try {
        const settings = await storage.getSubscriptionSettings();
        if (settings?.trialDurationDays) trialDays = settings.trialDurationDays;
      } catch {}
      res.json({ eligibleCount, trialDays });
    } catch (error) {
      console.error("Error counting eligible trial users:", error);
      res.status(500).json({ message: "Failed to count eligible users" });
    }
  });

  // Bulk grant trial extension to all expired + trial non-privileged users
  app.post('/api/owners/users/grant-trial-extension', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }
      let trialDays = 7;
      try {
        const settings = await storage.getSubscriptionSettings();
        if (settings?.trialDurationDays) trialDays = settings.trialDurationDays;
      } catch {}
      const count = await storage.bulkGrantTrialExtension(trialDays);
      const updatedAt = new Date().toISOString();
      console.log(`[TrialBoost] Owner ${user.id} granted ${trialDays}-day trial to ${count} users`);
      res.json({ count, trialDays, updatedAt });
    } catch (error) {
      console.error("Error granting bulk trial extension:", error);
      res.status(500).json({ message: "Failed to grant trial extension" });
    }
  });

  // Update user theme preference
  app.put('/api/user/theme', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themePreference } = req.body;
      
      if (!['light', 'dark', 'system'].includes(themePreference)) {
        return res.status(400).json({ message: 'Invalid theme preference' });
      }
      
      // Get current user data first, then update with new theme preference
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const updatedUser = await storage.upsertUser({
        ...currentUser,
        themePreference
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user theme:", error);
      res.status(500).json({ message: "Failed to update theme preference" });
    }
  });

  // Mark app tour as completed for authenticated user
  app.post('/api/user/complete-tour', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      const updatedUser = await storage.upsertUser({
        ...currentUser,
        hasCompletedTour: true,
      });
      res.json({ success: true, hasCompletedTour: updatedUser.hasCompletedTour });
    } catch (error) {
      console.error("Error completing tour:", error);
      res.status(500).json({ message: "Failed to update tour status" });
    }
  });

  // Mark fitness tour as completed for authenticated user
  app.post('/api/user/complete-fitness-tour', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      const updatedUser = await storage.upsertUser({
        ...currentUser,
        hasCompletedFitnessTour: true,
      });
      res.json({ success: true, hasCompletedFitnessTour: updatedUser.hasCompletedFitnessTour });
    } catch (error) {
      console.error("Error completing fitness tour:", error);
      res.status(500).json({ message: "Failed to update fitness tour status" });
    }
  });

  // Push Notification routes
  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscription } = req.body;
      
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: 'Invalid subscription data' });
      }

      const success = await savePushSubscription(
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        req.headers['user-agent']
      );

      if (success) {
        res.json({ success: true, message: 'Push subscription saved' });
      } else {
        res.status(500).json({ message: 'Failed to save subscription' });
      }
    } catch (error) {
      console.error('Error saving push subscription:', error);
      res.status(500).json({ message: 'Failed to save push subscription' });
    }
  });

  app.post('/api/push/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint is required' });
      }

      const success = await removePushSubscription(endpoint);
      res.json({ success });
    } catch (error) {
      console.error('Error removing push subscription:', error);
      res.status(500).json({ message: 'Failed to remove push subscription' });
    }
  });

  app.post('/api/push/unsubscribe-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await removeAllPushSubscriptionsForUser(userId);
      res.json({ success });
    } catch (error) {
      console.error('Error removing all push subscriptions:', error);
      res.status(500).json({ message: 'Failed to remove push subscriptions' });
    }
  });

  app.get('/api/push/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await getUserSubscriptionCount(userId);
      res.json({ hasSubscription: count > 0, subscriptionCount: count });
    } catch (error) {
      console.error('Error checking push status:', error);
      res.status(500).json({ message: 'Failed to check push status' });
    }
  });

  // Check if the current device's push subscription endpoint is active in the DB.
  // Used by the client to detect stale/deactivated subscriptions and auto-renew.
  app.post('/api/push/check-endpoint', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ active: false });

      const rows = await db
        .select({ isActive: schema.pushSubscriptions.isActive })
        .from(schema.pushSubscriptions)
        .where(and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, endpoint)))
        .limit(1);

      const active = rows.length > 0 && rows[0].isActive;
      res.json({ active, found: rows.length > 0 });
    } catch (error) {
      console.error('Error checking push endpoint:', error);
      res.status(500).json({ active: false });
    }
  });

  app.get('/api/push/vapid-public-key', (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
    if (vapidPublicKey) {
      res.json({ vapidPublicKey });
    } else {
      res.status(404).json({ message: 'VAPID public key not configured' });
    }
  });

  // Prayer timer scheduling
  const prayerTimers = new Map<string, NodeJS.Timeout>();

  app.post('/api/prayer/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { endTime } = req.body;

      if (!endTime || typeof endTime !== 'number') {
        return res.status(400).json({ message: 'endTime (Unix ms) is required' });
      }

      const delay = endTime - Date.now();
      if (delay <= 0) {
        return res.status(400).json({ message: 'endTime must be in the future' });
      }

      // Cancel any existing timer for this user
      if (prayerTimers.has(userId)) {
        clearTimeout(prayerTimers.get(userId)!);
        prayerTimers.delete(userId);
      }

      const timer = setTimeout(async () => {
        prayerTimers.delete(userId);
        await sendPushNotification(userId, {
          title: 'Prayer Time Complete',
          body: 'Your prayer time has ended. May you feel refreshed and blessed.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'prayer-complete',
          url: '/',
        });
      }, delay);

      prayerTimers.set(userId, timer);
      res.json({ success: true, scheduledIn: delay });
    } catch (error) {
      console.error('Error scheduling prayer notification:', error);
      res.status(500).json({ message: 'Failed to schedule prayer notification' });
    }
  });

  app.delete('/api/prayer/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (prayerTimers.has(userId)) {
        clearTimeout(prayerTimers.get(userId)!);
        prayerTimers.delete(userId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error cancelling prayer notification:', error);
      res.status(500).json({ message: 'Failed to cancel prayer notification' });
    }
  });

  // Prayer Reminders routes
  app.get('/api/prayer/reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let reminders = await storage.getPrayerReminders(userId);
      if (!reminders) {
        reminders = await storage.upsertPrayerReminders(userId, {
          hourlyEnabled: false,
          hourlyStartTime: '08:00',
          hourlyEndTime: '21:00',
          middayEnabled: false,
          customTimes: [],
        });
      }
      res.json(reminders);
    } catch (error) {
      console.error('Error fetching prayer reminders:', error);
      res.status(500).json({ message: 'Failed to fetch prayer reminders' });
    }
  });

  app.put('/api/prayer/reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { hourlyEnabled, hourlyStartTime, hourlyEndTime, middayEnabled, customTimes, timezone } = req.body;
      if (Array.isArray(customTimes) && customTimes.length > 15) {
        return res.status(400).json({ message: 'Maximum 15 custom reminder times allowed' });
      }
      const result = await storage.upsertPrayerReminders(userId, {
        hourlyEnabled: !!hourlyEnabled,
        hourlyStartTime: hourlyStartTime || '08:00',
        hourlyEndTime: hourlyEndTime || '21:00',
        middayEnabled: !!middayEnabled,
        customTimes: Array.isArray(customTimes) ? customTimes : [],
        timezone: typeof timezone === 'string' && timezone.length > 0 ? timezone : 'UTC',
      });
      res.json(result);
    } catch (error) {
      console.error('Error saving prayer reminders:', error);
      res.status(500).json({ message: 'Failed to save prayer reminders' });
    }
  });

  // Prayer reminder test — sends a test notification, optionally after a delay (seconds)
  app.post('/api/prayer/test-notification', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const delaySeconds = typeof req.body.delaySeconds === 'number' ? Math.min(req.body.delaySeconds, 120) : 0;

      const sendIt = async () => {
        const result = await sendPushNotification(userId, {
          title: 'Time to Pray',
          body: delaySeconds > 0
            ? 'Background delivery test — if you see this with the app closed, push is working!'
            : 'Take a moment to connect with God. This is a test of your prayer reminder.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'prayer-reminder-test',
          url: '/?openPrayerDialog=true',
        });
        console.log(`[Push] Test notification result for ${userId}: ${JSON.stringify(result)}`);
        return result;
      };

      if (delaySeconds > 0) {
        // Respond immediately and send after delay so user can close the app
        res.json({ success: true, message: `Notification will arrive in ${delaySeconds} seconds — close the app now!` });
        setTimeout(async () => {
          try { await sendIt(); } catch (e) { console.error('[Push] Delayed test failed:', e); }
        }, delaySeconds * 1000);
        return;
      }

      const result = await sendIt();
      if (result.success > 0) {
        res.json({ success: true, message: 'Test notification sent' });
      } else {
        res.status(400).json({ success: false, message: 'No active push subscriptions found. Please enable notifications first.' });
      }
    } catch (error) {
      console.error('Error sending prayer test notification:', error);
      res.status(500).json({ message: 'Failed to send test notification' });
    }
  });

  // Daily App Reminder routes
  app.get('/api/daily-reminder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let reminder = await storage.getDailyReminder(userId);
      if (!reminder) {
        reminder = await storage.upsertDailyReminder(userId, {
          enabled: false,
          reminderTime: '08:00',
          timezone: 'UTC',
        });
      }
      res.json(reminder);
    } catch (error) {
      console.error('Error fetching daily reminder:', error);
      res.status(500).json({ message: 'Failed to fetch daily reminder' });
    }
  });

  app.put('/api/daily-reminder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { enabled, reminderTime, timezone } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be a boolean' });
      }
      if (typeof reminderTime !== 'string' || !/^\d{2}:\d{2}$/.test(reminderTime)) {
        return res.status(400).json({ message: 'reminderTime must be HH:MM format' });
      }
      const result = await storage.upsertDailyReminder(userId, {
        enabled,
        reminderTime,
        timezone: typeof timezone === 'string' && timezone.length > 0 ? timezone : 'UTC',
      });
      res.json(result);
    } catch (error) {
      console.error('Error saving daily reminder:', error);
      res.status(500).json({ message: 'Failed to save daily reminder' });
    }
  });

  // Test push notification (admin only)
  app.post('/api/push/test', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!hasAdminPrivileges(user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const result = await sendPushNotification(req.user.claims.sub, {
        title: 'Test Notification',
        body: 'This is a test push notification from Man Up God\'s Way!',
        url: '/'
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error sending test push:', error);
      res.status(500).json({ message: 'Failed to send test notification' });
    }
  });

  // Study Series routes
  app.get('/api/study-series', async (req: any, res) => {
    try {
      const { category } = req.query;
      const series = await storage.getStudySeries(category as string);
      res.json(series);
    } catch (error) {
      console.error("Error fetching study series:", error);
      res.status(500).json({ message: "Failed to fetch study series" });
    }
  });

  app.get('/api/study-series/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const series = await storage.getStudySeriesById(id);
      if (!series) {
        return res.status(404).json({ message: "Series not found" });
      }
      res.json(series);
    } catch (error) {
      console.error("Error fetching study series:", error);
      res.status(500).json({ message: "Failed to fetch study series" });
    }
  });

  app.get('/api/study-series/:id/studies', async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      const studies = await storage.getStudiesInSeries(id, userId);
      res.json(studies);
    } catch (error) {
      console.error("Error fetching studies in series:", error);
      res.status(500).json({ message: "Failed to fetch studies in series" });
    }
  });

  // Start a series (records when user begins for daily drip)
  app.post('/api/study-series/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const progress = await storage.startUserSeries(userId, id);
      res.json(progress);
    } catch (error) {
      console.error("Error starting series:", error);
      res.status(500).json({ message: "Failed to start series" });
    }
  });

  // Get user's series progress
  app.get('/api/study-series/:id/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const progress = await storage.getUserSeriesProgress(userId, id);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching series progress:", error);
      res.status(500).json({ message: "Failed to fetch series progress" });
    }
  });

  // Admin Study Series routes
  app.get('/api/admin/study-series', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const series = await storage.getAllStudySeries();
      res.json(series);
    } catch (error) {
      console.error("Error fetching all study series:", error);
      res.status(500).json({ message: "Failed to fetch study series" });
    }
  });

  app.post('/api/admin/study-series', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const seriesData = insertStudySeriesSchema.parse(req.body);
      const series = await storage.createStudySeries(seriesData);
      res.status(201).json(series);
    } catch (error) {
      console.error("Error creating study series:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid series data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create study series" });
    }
  });

  app.put('/api/admin/study-series/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const seriesData = insertStudySeriesSchema.partial().parse(req.body);
      const series = await storage.updateStudySeries(req.params.id, seriesData);
      res.json(series);
    } catch (error) {
      console.error("Error updating study series:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid series data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update study series" });
    }
  });

  app.delete('/api/admin/study-series/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      await storage.deleteStudySeries(req.params.id);
      res.json({ message: "Series deleted successfully" });
    } catch (error) {
      console.error("Error deleting study series:", error);
      res.status(500).json({ message: "Failed to delete study series" });
    }
  });

  // Assign study to series
  const assignStudyToSeriesSchema = z.object({
    seriesId: z.string().uuid().nullable().optional(),
    seriesOrder: z.number().int().min(0).default(0),
  });

  app.put('/api/admin/studies/:studyId/series', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const validatedData = assignStudyToSeriesSchema.parse(req.body);
      
      // Validate that the series exists if seriesId is provided
      if (validatedData.seriesId) {
        const series = await storage.getStudySeriesById(validatedData.seriesId);
        if (!series) {
          return res.status(400).json({ message: "Series not found" });
        }
      }
      
      const study = await storage.updateStudy(req.params.studyId, { 
        seriesId: validatedData.seriesId || null, 
        seriesOrder: validatedData.seriesOrder 
      });
      res.json(study);
    } catch (error) {
      console.error("Error assigning study to series:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to assign study to series" });
    }
  });

  // Study routes
  app.get('/api/studies', async (req: any, res) => {
    try {
      const { category, tier, individual } = req.query;
      
      // Check user roles and subscription status
      let isAdmin = false;
      let isTrialUser = false;
      if (req.user) {
        try {
          const user = await storage.getUser(req.user.claims.sub);
          isAdmin = hasAdminPrivileges(user);
          isTrialUser = user?.subscriptionStatus === 'trial';
        } catch (error) {
          // If there's an error getting user info, continue as non-admin
          console.log("Could not verify admin status:", error);
        }
      }
      
      // If individual=true, only return studies not in any series
      if (individual === 'true') {
        const studies = await storage.getIndividualStudies(category as string);
        const filtered = isTrialUser ? studies.filter(s => s.isTrialAccessible) : studies;
        return res.json(filtered);
      }
      
      const studies = await storage.getStudies(
        category as string, 
        tier as string,
        isAdmin
      );
      // Trial users only see trial-accessible studies
      const filtered = isTrialUser ? studies.filter(s => s.isTrialAccessible) : studies;
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching studies:", error);
      res.status(500).json({ message: "Failed to fetch studies" });
    }
  });

  // Check if title exists across studies and videos
  app.get('/api/check-title/:title', async (req, res) => {
    try {
      const title = decodeURIComponent(req.params.title);
      const excludeStudyId = req.query.excludeStudyId as string;
      const excludeVideoId = req.query.excludeVideoId as string;
      
      const titleExists = await storage.checkTitleExists(title, excludeStudyId, excludeVideoId);
      res.json({ exists: titleExists });
    } catch (error) {
      console.error("Error checking title:", error);
      res.status(500).json({ message: "Failed to check title" });
    }
  });

  // Get featured study
  app.get('/api/studies/featured', async (req, res) => {
    try {
      const featuredStudy = await storage.getFeaturedStudy();
      res.json(featuredStudy);
    } catch (error) {
      console.error("Error fetching featured study:", error);
      res.status(500).json({ message: "Failed to fetch featured study" });
    }
  });

  app.get('/api/nav/badges', isAuthenticated, async (req: any, res) => {
    try {
      const studiesSince = req.query.studiesSince ? new Date(parseInt(req.query.studiesSince as string)) : null;
      const communitySince = req.query.communitySince ? new Date(parseInt(req.query.communitySince as string)) : null;
      const warRoomSince = req.query.warRoomSince ? new Date(parseInt(req.query.warRoomSince as string)) : null;
      const underFireSince = req.query.underFireSince ? new Date(parseInt(req.query.underFireSince as string)) : null;

      const [studyRow] = studiesSince
        ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.studies)
            .where(gt(schema.studies.createdAt, studiesSince))
        : [{ count: 0 }];

      const [discussionRow] = communitySince
        ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.discussions)
            .where(gt(schema.discussions.createdAt, communitySince))
        : [{ count: 0 }];

      const [warRoomRow] = warRoomSince
        ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.hurdleWallPosts)
            .where(gt(schema.hurdleWallPosts.createdAt, warRoomSince))
        : [{ count: 0 }];

      const [underFireRow] = underFireSince
        ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.accountabilityRequests)
            .where(gt(schema.accountabilityRequests.createdAt, underFireSince))
        : [{ count: 0 }];

      res.json({
        studies: studyRow?.count ?? 0,
        community: discussionRow?.count ?? 0,
        warRoom: warRoomRow?.count ?? 0,
        underFire: underFireRow?.count ?? 0,
      });
    } catch (error) {
      res.json({ studies: 0, community: 0, warRoom: 0, underFire: 0 });
    }
  });

  app.get('/api/studies/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 3;
      const recommendations = await storage.getRecommendedStudies(userId, limit);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.get('/api/studies/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const studies = await storage.searchStudies(q as string);
      res.json(studies);
    } catch (error) {
      console.error("Error searching studies:", error);
      res.status(500).json({ message: "Failed to search studies" });
    }
  });

  app.get('/api/studies/:id', async (req, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      res.json(study);
    } catch (error) {
      console.error("Error fetching study:", error);
      res.status(500).json({ message: "Failed to fetch study" });
    }
  });

  // Check time-gate status for a study in a series
  app.get('/api/studies/:id/time-gate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studyId = req.params.id;
      const timezone = req.query.timezone as string || 'America/New_York';
      
      // Check if user is admin - admins bypass time gates
      const user = await storage.getUser(userId);
      if (user && isAdmin(user)) {
        return res.json({
          isLocked: false,
          unlockTime: null,
          previousStudyTitle: null,
          message: null,
          isAdmin: true
        });
      }
      
      const status = await storage.getStudyTimeGateStatus(userId, studyId, timezone);
      res.json(status);
    } catch (error) {
      console.error("Error checking time gate status:", error);
      res.status(500).json({ message: "Failed to check time gate status" });
    }
  });

  // Check if study is locked due to consecutive completion requirement
  app.get('/api/studies/:id/consecutive-lock', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studyId = req.params.id;
      
      // Check if user is admin - admins bypass consecutive locks
      const user = await storage.getUser(userId);
      if (user && isAdmin(user)) {
        return res.json({
          isLocked: false,
          previousStudyTitle: null,
          message: null,
          isAdmin: true
        });
      }
      
      const status = await storage.getStudyConsecutiveLockStatus(userId, studyId);
      res.json(status);
    } catch (error) {
      console.error("Error checking consecutive lock status:", error);
      res.status(500).json({ message: "Failed to check consecutive lock status" });
    }
  });

  // Return the user's currently active series and topical study (for "one active per type" lock)
  app.get('/api/user/active-studies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      // Admins/owners bypass all type locks — return empty so nothing appears locked
      if (user && hasAdminPrivileges(user)) {
        return res.json({ activeSeriesId: null, activeTopicalStudyId: null });
      }
      const info = await storage.getUserActiveStudyInfo(userId);
      res.json(info);
    } catch (error) {
      console.error("Error fetching active study info:", error);
      res.status(500).json({ message: "Failed to fetch active study info" });
    }
  });

  // Check if user has purchased a study
  app.get('/api/purchases/check/:studyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studyId = req.params.studyId;
      
      const hasPurchased = await storage.checkUserPurchase(userId, studyId);
      res.json(hasPurchased);
    } catch (error) {
      console.error("Error checking purchase:", error);
      res.status(500).json({ message: "Failed to check purchase" });
    }
  });

  // Get all user purchases
  app.get('/api/purchases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const purchases = await storage.getUserPurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching user purchases:", error);
      res.status(500).json({ message: "Failed to fetch user purchases" });
    }
  });

  // Create payment intent for study purchase
  app.post('/api/purchases/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      // Check if Stripe keys are configured
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ 
          message: "Payment system not configured. Please contact administrator." 
        });
      }

      // Import Stripe here to avoid issues if not configured
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      const { studyId, amount } = req.body;
      const userId = req.user.claims.sub;

      if (!studyId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid study ID or amount" });
      }

      if (amount < 0.50) {
        return res.status(400).json({ message: "Amount must be at least $0.50 USD" });
      }

      // Verify study exists and has a price
      const study = await storage.getStudy(studyId);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

      if (!study.price || parseFloat(study.price) !== amount) {
        return res.status(400).json({ message: "Invalid amount for this study" });
      }

      // Check if user already purchased this study
      const existingPurchase = await storage.checkUserPurchase(userId, studyId);
      if (existingPurchase) {
        return res.status(400).json({ message: "Study already purchased" });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          userId,
          studyId,
          studyTitle: study.title,
          type: 'study_purchase'
        },
        description: `Study Purchase: ${study.title}`,
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error("Error creating study purchase payment intent:", error);
      res.status(500).json({ 
        message: "Failed to create payment intent: " + error.message 
      });
    }
  });

  // Get study discussion
  app.get('/api/studies/:id/discussion', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studyId = req.params.id;
      
      // Check if user has access to this study
      const study = await storage.getStudy(studyId);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      // Check subscription access
      const studyAccess = await canAccessContent(user, 'studies', study.isTrialAccessible ?? false);
      if (!studyAccess) {
        return res.status(403).json({ message: "Active subscription required to access this study discussion" });
      }
      
      const discussion = await storage.getStudyDiscussion(studyId);
      res.json(discussion);
    } catch (error) {
      console.error("Error fetching study discussion:", error);
      res.status(500).json({ message: "Failed to fetch study discussion" });
    }
  });

  // Create discussions for existing studies (one-time migration)
  app.post('/api/admin/create-study-discussions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.createDiscussionsForExistingStudies();
      res.json({ message: "Study discussions created successfully" });
    } catch (error) {
      console.error("Error creating study discussions:", error);
      res.status(500).json({ message: "Failed to create study discussions" });
    }
  });

  app.post('/api/studies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const studyData = insertStudySchema.parse(req.body);
      const study = await storage.createStudy(studyData, user.id);
      
      // Send real-time notifications to users based on tier access
      try {
        const allUsers = await storage.getAllUsers();
        let targetUsers: any[] = [];
        
        // Determine target users based on study's required tier
        targetUsers = allUsers.filter(targetUser => 
          targetUser.id !== user.id && hasAnyAccess(targetUser)
        );
        
        // Send notifications to eligible users
        if (targetUsers.length > 0) {
          const notificationPromises = targetUsers.map(async (targetUser) => {
            return await storage.createNotificationWithPreferences({
              userId: targetUser.id,
              type: 'study',
              title: '📚 New Study Available',
              message: `"${study.title}" has been published and is now available in the Library.`,
              relatedId: study.id,
            });
          });
          
          await Promise.all(notificationPromises.filter(Boolean));
          console.log(`Sent new study notifications to ${targetUsers.length} users`);
        }
      } catch (notificationError) {
        console.error('Error sending study notifications:', notificationError);
        // Don't fail the study creation if notification fails
      }
      
      res.status(201).json(study);
    } catch (error) {
      console.error("Error creating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid study data", errors: error.errors });
      }
      // Check for title conflict errors
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create study" });
    }
  });

  app.put('/api/studies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get the current study to check if it's being published
      const currentStudy = await storage.getStudy(req.params.id);
      const studyData = insertStudySchema.partial().parse(req.body);
      const study = await storage.updateStudy(req.params.id, studyData);
      
      // Check if study is being published (was unpublished, now published)
      const wasUnpublished = !currentStudy?.isPublished;
      const isBeingPublished = studyData.isPublished === true;
      
      if (wasUnpublished && isBeingPublished) {
        // Send real-time notifications to users with active subscriptions/trials
        try {
          const allUsers = await storage.getAllUsers();
          let targetUsers = allUsers.filter(targetUser => 
            targetUser.id !== user.id && hasAnyAccess(targetUser)
          );
          
          // Send notifications to eligible users
          if (targetUsers.length > 0) {
            const notificationPromises = targetUsers.map(async (targetUser) => {
              return await storage.createNotification({
                userId: targetUser.id,
                type: 'study',
                title: '📚 New Study Available',
                message: `"${study.title}" has been published and is now available in the Library.`,
                relatedId: study.id,
              });
            });
            
            await Promise.all(notificationPromises.filter(Boolean));
            console.log(`Sent study publication notifications to ${targetUsers.length} users`);
          }
        } catch (notificationError) {
          console.error('Error sending study publication notifications:', notificationError);
          // Don't fail the study update if notification fails
        }
      }
      
      res.json(study);
    } catch (error) {
      console.error("Error updating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid study data", errors: error.errors });
      }
      // Check for title conflict errors
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update study" });
    }
  });

  // PATCH handler for study updates (same as PUT)
  app.patch('/api/studies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get the current study to check if it's being published
      const currentStudy = await storage.getStudy(req.params.id);
      const studyData = insertStudySchema.partial().parse(req.body);
      const study = await storage.updateStudy(req.params.id, studyData);
      
      // Check if study is being published (was unpublished, now published)
      const wasUnpublished = !currentStudy?.isPublished;
      const isBeingPublished = studyData.isPublished === true;
      
      if (wasUnpublished && isBeingPublished) {
        // Send real-time notifications to users with active subscriptions/trials
        try {
          const allUsers = await storage.getAllUsers();
          let targetUsers = allUsers.filter(targetUser => 
            targetUser.id !== user.id && hasAnyAccess(targetUser)
          );
          
          if (targetUsers.length > 0) {
            const notificationPromises = targetUsers.map(async (targetUser) => {
              return await storage.createNotification({
                userId: targetUser.id,
                type: 'study',
                title: '📚 New Study Available',
                message: `"${study.title}" has been published and is now available in the Library.`,
                relatedId: study.id,
              });
            });
            
            await Promise.all(notificationPromises.filter(Boolean));
            console.log(`Sent study publication notifications to ${targetUsers.length} users`);
          }
        } catch (notificationError) {
          console.error('Error sending study publication notifications:', notificationError);
        }
      }
      
      res.json(study);
    } catch (error) {
      console.error("Error updating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid study data", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update study" });
    }
  });

  app.delete('/api/studies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteStudy(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting study:", error);
      res.status(500).json({ message: "Failed to delete study" });
    }
  });

  // Upload PDF document for study
  app.post('/api/studies/:id/upload-pdf', isAuthenticated, documentUpload.single('pdf'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "PDF file is required" });
      }

      const updateData = {
        pdfFilename: file.filename, // Use the filename generated by multer diskStorage
        pdfOriginalName: file.originalname,
        pdfMimeType: file.mimetype,
        pdfFileSize: file.size,
      };

      const study = await storage.updateStudy(req.params.id, updateData);
      res.json(study);
    } catch (error) {
      console.error("Error uploading PDF:", error);
      res.status(500).json({ message: "Failed to upload PDF" });
    }
  });

  // Upload Word document for study
  app.post('/api/studies/:id/upload-word', isAuthenticated, documentUpload.single('word'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Word document is required" });
      }

      const updateData = {
        wordFilename: file.filename, // Use the filename generated by multer diskStorage
        wordOriginalName: file.originalname,
        wordMimeType: file.mimetype,
        wordFileSize: file.size,
      };

      const study = await storage.updateStudy(req.params.id, updateData);
      res.json(study);
    } catch (error) {
      console.error("Error uploading Word document:", error);
      res.status(500).json({ message: "Failed to upload Word document" });
    }
  });

  // Parse Word document to extract daily lessons
  app.post('/api/parse-word-lessons', isAuthenticated, documentUpload.single('word'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Word document is required" });
      }

      // Check if file is .docx
      if (!file.originalname.toLowerCase().endsWith('.docx')) {
        return res.status(400).json({ message: "Only .docx files are supported" });
      }

      const mammoth = require('mammoth');
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, file.filename);
      
      // Convert Word to HTML to preserve formatting (paragraphs, bold, etc.)
      const htmlResult = await mammoth.convertToHtml({ path: filePath });
      const htmlContent = htmlResult.value;
      
      // Also get raw text for pattern matching
      const textResult = await mammoth.extractRawText({ path: filePath });
      const text = textResult.value;
      
      console.log("Parsed Word document text length:", text.length);
      console.log("HTML content length:", htmlContent.length);
      console.log("First 500 chars of text:", text.substring(0, 500));
      
      // Parse daily lessons - look for various "Day X" patterns in both text and HTML
      // Supports: "Day 1:", "Day 1 -", "DAY 1", "Day One:", "Day 1.", "Day 1)", etc.
      const dayPatterns = [
        /Day\s+(\d+)\s*[:\-–—.)\]]\s*([^\n]*)/gi,
        /DAY\s+(\d+)\s*[:\-–—.)\]]\s*([^\n]*)/gi,
        /Lesson\s+(\d+)\s*[:\-–—.)\]]\s*([^\n]*)/gi,
        /Week\s+(\d+)\s*[:\-–—.)\]]\s*([^\n]*)/gi,
        /Session\s+(\d+)\s*[:\-–—.)\]]\s*([^\n]*)/gi,
      ];
      
      // HTML patterns for splitting - look for day markers in HTML
      const htmlDayPatterns = [
        /<p[^>]*>(?:<strong>|<b>)?(?:<em>|<i>)?Day\s+(\d+)\s*[:\-–—.)\]]\s*([^<]*)/gi,
        /<p[^>]*>(?:<strong>|<b>)?DAY\s+(\d+)\s*[:\-–—.)\]]\s*([^<]*)/gi,
        /<h[1-6][^>]*>(?:<strong>|<b>)?Day\s+(\d+)\s*[:\-–—.)\]]\s*([^<]*)/gi,
        /<p[^>]*>(?:<strong>|<b>)?Lesson\s+(\d+)\s*[:\-–—.)\]]\s*([^<]*)/gi,
      ];
      
      const lessons: Array<{
        dayNumber: number;
        title: string;
        content: string;
        scripture?: string;
        keyTakeaway?: string;
      }> = [];
      
      // Try to find day markers in HTML first to preserve formatting
      let htmlMatches: RegExpMatchArray[] = [];
      for (const pattern of htmlDayPatterns) {
        htmlMatches = [...htmlContent.matchAll(pattern)];
        if (htmlMatches.length > 0) {
          console.log("Found HTML matches with pattern:", pattern.source, "Count:", htmlMatches.length);
          break;
        }
      }
      
      // If HTML patterns work, split HTML content directly
      if (htmlMatches.length > 0) {
        for (let i = 0; i < htmlMatches.length; i++) {
          const match = htmlMatches[i];
          const dayNumber = parseInt(match[1], 10);
          const title = match[2]?.trim().replace(/<[^>]*>/g, '') || `Day ${dayNumber}`;
          
          // Get HTML content between this day and the next
          const startIndex = match.index! + match[0].length;
          const endIndex = i < htmlMatches.length - 1 ? htmlMatches[i + 1].index! : htmlContent.length;
          let content = htmlContent.substring(startIndex, endIndex).trim();
          
          // Clean up any incomplete HTML tags at the end
          const lastCloseTag = content.lastIndexOf('</p>');
          if (lastCloseTag > 0) {
            content = content.substring(0, lastCloseTag + 4);
          }
          
          // Extract scripture from HTML content
          let scripture: string | undefined;
          const scriptureHtmlMatch = content.match(/Scripture[:\s]*<\/strong>?\s*([^<]+)|<em>([^<]+)<\/em>\s*[-–—]\s*([A-Za-z]+\s+\d+)/i);
          if (scriptureHtmlMatch) {
            scripture = (scriptureHtmlMatch[1] || `${scriptureHtmlMatch[2]} - ${scriptureHtmlMatch[3]}`).trim();
          }
          
          // Extract key takeaway from HTML content
          let keyTakeaway: string | undefined;
          const takeawayHtmlMatch = content.match(/Key\s*Takeaway[:\s]*<\/strong>?\s*([^<]+)|Takeaway[:\s]*<\/strong>?\s*([^<]+)/i);
          if (takeawayHtmlMatch) {
            keyTakeaway = (takeawayHtmlMatch[1] || takeawayHtmlMatch[2]).trim();
          }
          
          lessons.push({
            dayNumber,
            title,
            content,
            scripture,
            keyTakeaway,
          });
        }
        console.log("Parsed", lessons.length, "lessons from HTML with formatting preserved");
      }
      
      // Fallback: Try plain text patterns if HTML parsing didn't work
      if (lessons.length === 0) {
        let matches: RegExpMatchArray[] = [];
        for (const pattern of dayPatterns) {
          matches = [...text.matchAll(pattern)];
          if (matches.length > 0) {
            console.log("Found text matches with pattern:", pattern.source, "Count:", matches.length);
            break;
          }
        }
        
        // Helper function to find HTML content for a text section
        const findHtmlForText = (textContent: string): string => {
          if (!textContent) return '';
          
          // Try to find a matching segment in HTML by looking for first few words
          const words = textContent.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
          if (words.length === 0) return `<p>${textContent}</p>`;
          
          const searchPhrase = words.join('\\s*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const searchRegex = new RegExp(searchPhrase, 'i');
          const matchInHtml = htmlContent.match(searchRegex);
          
          if (matchInHtml && matchInHtml.index !== undefined) {
            // Find the start of the containing paragraph
            let startPos = htmlContent.lastIndexOf('<p', matchInHtml.index);
            if (startPos === -1) startPos = matchInHtml.index;
            
            // Try to find a reasonable end point
            const endWords = textContent.split(/\s+/).filter(w => w.length > 3).slice(-5);
            if (endWords.length > 0) {
              const endPhrase = endWords.join('\\s*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const endRegex = new RegExp(endPhrase, 'i');
              const searchFromPos = startPos + 100;
              const endMatch = htmlContent.substring(searchFromPos).match(endRegex);
              if (endMatch && endMatch.index !== undefined) {
                let endPos = searchFromPos + endMatch.index + endMatch[0].length;
                // Find the next closing tag
                const closingMatch = htmlContent.substring(endPos).match(/<\/p>/);
                if (closingMatch && closingMatch.index !== undefined) {
                  endPos += closingMatch.index + 4;
                }
                return htmlContent.substring(startPos, endPos);
              }
            }
            // Fallback: take a chunk proportional to text length
            return htmlContent.substring(startPos, Math.min(startPos + textContent.length * 3, htmlContent.length));
          }
          
          // Last resort: convert plain text to HTML preserving line breaks
          return textContent.split(/\n\n+/).map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');
        };
        
        if (matches.length > 0) {
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const dayNumber = parseInt(match[1], 10);
            const title = match[2]?.trim() || `Day ${dayNumber}`;
            
            // Get content between this day and the next
            const startIndex = match.index! + match[0].length;
            const endIndex = i < matches.length - 1 ? matches[i + 1].index! : text.length;
            const rawContent = text.substring(startIndex, endIndex).trim();
            
            // Try to get HTML version with formatting preserved
            let content = findHtmlForText(rawContent);
            
            // Extract scripture and takeaway from raw content
            let scripture: string | undefined;
            const scripturePatterns = [
              /Scripture[:\s]+([^\n]+)/i,
              /Read[:\s]+([^\n]+)/i,
              /Text[:\s]+([^\n]+)/i,
            ];
            for (const pattern of scripturePatterns) {
              const scriptureMatch = rawContent.match(pattern);
              if (scriptureMatch) {
                scripture = scriptureMatch[1].trim();
                break;
              }
            }
            
            let keyTakeaway: string | undefined;
            const takeawayPatterns = [
              /Key\s*Takeaway[:\s]+([^\n]+)/i,
              /Takeaway[:\s]+([^\n]+)/i,
              /Summary[:\s]+([^\n]+)/i,
            ];
            for (const pattern of takeawayPatterns) {
              const takeawayMatch = rawContent.match(pattern);
              if (takeawayMatch) {
                keyTakeaway = takeawayMatch[1].trim();
                break;
              }
            }
            
            lessons.push({
              dayNumber,
              title,
              content,
              scripture,
              keyTakeaway,
            });
          }
        }
        
        // Last fallback: split by sections
        if (lessons.length === 0) {
          console.log("No day patterns found, trying section-based parsing...");
          const sections = text.split(/\n{3,}|\r\n{3,}|_{5,}|-{5,}|={5,}/);
          if (sections.length > 1) {
            sections.forEach((section, index) => {
              const trimmed = section.trim();
              if (trimmed.length > 50) {
                const firstLine = trimmed.split('\n')[0].trim();
                const content = findHtmlForText(trimmed);
                lessons.push({
                  dayNumber: index + 1,
                  title: firstLine.substring(0, 100) || `Day ${index + 1}`,
                  content,
                });
              }
            });
          }
        }
        
        // Final fallback: If still no lessons found, create a single lesson with all content
        // This supports individual studies that don't have day markers
        if (lessons.length === 0 && htmlContent.length > 0) {
          console.log("No sections found, creating single lesson with full content");
          // Try to extract title from first heading or first line
          const titleMatch = htmlContent.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
                            htmlContent.match(/<p[^>]*><strong>([^<]+)<\/strong><\/p>/i);
          const title = titleMatch ? titleMatch[1].trim() : "Study Content";
          
          lessons.push({
            dayNumber: 1,
            title,
            content: htmlContent,
          });
        }
      }
      
      // Clean up the temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      res.json({ lessons, totalFound: lessons.length });
    } catch (error) {
      console.error("Error parsing Word document:", error);
      res.status(500).json({ message: "Failed to parse Word document" });
    }
  });

  // Delete PDF document for study
  app.delete('/api/studies/:id/delete-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const study = await storage.getStudy(req.params.id);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

      // Delete file from disk if it exists
      if (study.pdfFilename) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
        const filePath = path.resolve(uploadsDir, study.pdfFilename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Update database to remove PDF references
      const updateData = {
        pdfFilename: null,
        pdfOriginalName: null,
        pdfMimeType: null,
        pdfFileSize: null,
      };

      const updatedStudy = await storage.updateStudy(req.params.id, updateData);
      res.json(updatedStudy);
    } catch (error) {
      console.error("Error deleting PDF:", error);
      res.status(500).json({ message: "Failed to delete PDF" });
    }
  });

  // Delete Word document for study
  app.delete('/api/studies/:id/delete-word', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const study = await storage.getStudy(req.params.id);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

      // Delete file from disk if it exists
      if (study.wordFilename) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
        const filePath = path.resolve(uploadsDir, study.wordFilename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Update database to remove Word references
      const updateData = {
        wordFilename: null,
        wordOriginalName: null,
        wordMimeType: null,
        wordFileSize: null,
      };

      const updatedStudy = await storage.updateStudy(req.params.id, updateData);
      res.json(updatedStudy);
    } catch (error) {
      console.error("Error deleting Word document:", error);
      res.status(500).json({ message: "Failed to delete Word document" });
    }
  });

  // ============================================
  // Interactive Study Sections API Routes
  // ============================================
  
  // Get all editable sections for a study
  app.get('/api/studies/:id/editable-sections', isAuthenticated, async (req: any, res) => {
    try {
      const sections = await storage.getStudyEditableSections(req.params.id);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching editable sections:", error);
      res.status(500).json({ message: "Failed to fetch editable sections" });
    }
  });

  // Create a new editable section (admin only)
  app.post('/api/studies/:id/editable-sections', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertStudyEditableSectionSchema.parse({
        ...req.body,
        studyId: req.params.id
      });

      const section = await storage.createEditableSection(validatedData);
      if (!section) {
        return res.status(404).json({ message: "Failed to create section" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error creating editable section:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("required")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create editable section" });
    }
  });

  // Update an editable section (admin only)
  app.put('/api/editable-sections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Create update schema that omits immutable fields (id, studyId)
      const updateSchema = insertStudyEditableSectionSchema.omit({ 
        id: true,
        studyId: true 
      }).partial();
      
      const validatedData = updateSchema.parse(req.body);

      const section = await storage.updateEditableSection(req.params.id, validatedData);
      if (!section) {
        return res.status(404).json({ message: "Editable section not found" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error updating editable section:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update editable section" });
    }
  });

  // Delete an editable section (admin only)
  app.delete('/api/editable-sections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteEditableSection(req.params.id);
      res.json({ message: "Editable section deleted successfully" });
    } catch (error) {
      console.error("Error deleting editable section:", error);
      res.status(500).json({ message: "Failed to delete editable section" });
    }
  });

  // Get all user responses for a study
  app.get('/api/studies/:id/user-responses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const responses = await storage.getUserStudyResponses(userId, req.params.id);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching user responses:", error);
      res.status(500).json({ message: "Failed to fetch user responses" });
    }
  });

  // Save/update a user response (autosave endpoint)
  app.post('/api/user-responses', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertUserStudyResponseSchema.parse({
        ...req.body,
        userId: req.user.claims.sub
      });

      const response = await storage.saveUserResponse(validatedData);
      if (!response) {
        return res.status(404).json({ message: "Failed to save response" });
      }
      res.json(response);
    } catch (error) {
      console.error("Error saving user response:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save user response" });
    }
  });

  // Upload thumbnail image for study
  app.post('/api/studies/:id/upload-thumbnail', isAuthenticated, thumbnailUpload.single('thumbnail'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Thumbnail image is required" });
      }

      const key = `thumbnails/study_thumbnail_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const thumbnailUrl = await uploadPublicFile(file.buffer, key, file.mimetype);
      const updateData = {
        thumbnailFilename: key,
        thumbnailUrl,
        thumbnailMimeType: file.mimetype,
        thumbnailFileSize: file.size,
      };

      const study = await storage.updateStudy(req.params.id, updateData);
      res.json(study);
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      res.status(500).json({ message: "Failed to upload thumbnail" });
    }
  });

  // Delete thumbnail image for study
  app.delete('/api/studies/:id/delete-thumbnail', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const study = await storage.getStudy(req.params.id);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

      // Delete from Object Storage if applicable
      if (study.thumbnailUrl) await deleteStorageFile(study.thumbnailUrl);
      // Also try legacy disk path
      if (study.thumbnailFilename && !study.thumbnailFilename.startsWith('thumbnails/')) {
        const filePath = path.resolve(process.cwd(), 'uploads', 'thumbnails', study.thumbnailFilename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      // Clear thumbnail data in database
      const updatedStudy = await storage.updateStudy(req.params.id, {
        thumbnailFilename: null,
        thumbnailMimeType: null,
        thumbnailFileSize: null,
        thumbnailUrl: null
      });

      res.json(updatedStudy);
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      res.status(500).json({ message: "Failed to delete thumbnail" });
    }
  });

  // Upload thumbnail for study series
  app.post('/api/study-series/:id/upload-thumbnail', isAuthenticated, thumbnailUpload.single('thumbnail'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Thumbnail image is required" });
      }
      const key = `thumbnails/series_thumbnail_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const thumbnailUrl = await uploadPublicFile(file.buffer, key, file.mimetype);
      const series = await storage.updateStudySeries(req.params.id, { thumbnailUrl });
      res.json(series);
    } catch (error) {
      console.error("Error uploading series thumbnail:", error);
      res.status(500).json({ message: "Failed to upload thumbnail" });
    }
  });

  // Delete thumbnail for study series
  app.delete('/api/study-series/:id/delete-thumbnail', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const existing = await storage.getStudySeries(req.params.id);
      if (existing?.thumbnailUrl) await deleteStorageFile(existing.thumbnailUrl);
      const series = await storage.updateStudySeries(req.params.id, { thumbnailUrl: null });
      res.json(series);
    } catch (error) {
      console.error("Error deleting series thumbnail:", error);
      res.status(500).json({ message: "Failed to delete thumbnail" });
    }
  });

  // Download PDF document for study
  app.get('/api/studies/:id/download-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.pdfFilename) {
        return res.status(404).json({ message: "PDF not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.pdfFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      res.setHeader('Content-Type', study.pdfMimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${study.pdfOriginalName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  // Download Word document for study
  app.get('/api/studies/:id/download-word', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.wordFilename) {
        return res.status(404).json({ message: "Word document not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.wordFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Word file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      res.setHeader('Content-Type', study.wordMimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${study.wordOriginalName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading Word document:", error);
      res.status(500).json({ message: "Failed to download Word document" });
    }
  });

  // Get thumbnail image for study
  app.get('/api/studies/:id/thumbnail', async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.thumbnailFilename) {
        return res.status(404).json({ message: "Thumbnail not found" });
      }

      // In a real implementation, this would retrieve the file from storage
      // For now, we'll return file metadata
      res.json({
        filename: study.thumbnailFilename,
        mimeType: study.thumbnailMimeType,
        size: study.thumbnailFileSize,
        url: `/api/studies/${req.params.id}/thumbnail-file`
      });
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      res.status(500).json({ message: "Failed to fetch thumbnail" });
    }
  });

  // Serve PDF file for inline viewing
  app.get('/api/studies/:id/pdf-file', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.pdfFilename) {
        return res.status(404).json({ message: "PDF not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.pdfFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      res.setHeader('Content-Type', study.pdfMimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${study.pdfOriginalName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving PDF:", error);
      res.status(500).json({ message: "Failed to serve PDF" });
    }
  });

  // Serve Word file for download
  app.get('/api/studies/:id/word-file', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.wordFilename) {
        return res.status(404).json({ message: "Word document not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.wordFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Word file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      res.setHeader('Content-Type', study.wordMimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${study.wordOriginalName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving Word document:", error);
      res.status(500).json({ message: "Failed to serve Word document" });
    }
  });

  // Convert Word document to HTML for viewing
  app.get('/api/studies/:id/word-html', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.wordFilename) {
        return res.status(404).json({ message: "Word document not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.wordFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Word file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      // Check if file is .docx (mammoth only supports .docx, not .doc)
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension === '.doc') {
        // .doc files cannot be converted, return download-only flag
        return res.json({ 
          downloadOnly: true,
          message: "This is a .doc file. Download it to view in Microsoft Word or convert to .docx for browser viewing.",
          fileType: '.doc',
          filename: study.wordOriginalName || study.wordFilename
        });
      }

      // Convert Word document to HTML using mammoth
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml(
        { path: filePath },
        {
          styleMap: [
            // Preserve paragraph styles
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
            // Preserve character styles
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          convertImage: mammoth.images.imgElement((image: any) => {
            return image.read("base64").then((imageBuffer: string) => {
              return {
                src: `data:${image.contentType};base64,${imageBuffer}`
              };
            });
          })
        }
      );

      // Return HTML with embedded styles for proper rendering
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${study.wordOriginalName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      line-height: 1.6;
      padding: 40px;
      max-width: 8.5in;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-weight: bold;
      line-height: 1.3;
    }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.17em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.83em; }
    h6 { font-size: 0.67em; }
    p {
      margin-bottom: 1em;
      text-align: justify;
    }
    strong, b {
      font-weight: bold;
    }
    em, i {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    ul, ol {
      margin-left: 2em;
      margin-bottom: 1em;
    }
    li {
      margin-bottom: 0.5em;
    }
    table {
      border-collapse: collapse;
      margin-bottom: 1em;
      width: 100%;
    }
    td, th {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em 0;
    }
    a {
      color: #0563c1;
      text-decoration: underline;
    }
    blockquote {
      margin: 1em 0;
      padding-left: 1em;
      border-left: 3px solid #ccc;
      font-style: italic;
    }
    code {
      font-family: 'Courier New', monospace;
      background-color: #f4f4f4;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background-color: #f4f4f4;
      padding: 1em;
      overflow-x: auto;
      margin-bottom: 1em;
      border-radius: 3px;
    }
    @media print {
      body {
        padding: 0;
      }
    }
    @media (max-width: 768px) {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  ${result.value}
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);
    } catch (error) {
      console.error("Error converting Word document to HTML:", error);
      res.status(500).json({ message: "Failed to convert Word document" });
    }
  });

  // Extract PDF text content
  app.get('/api/studies/:id/pdf-text', isAuthenticated, async (req: any, res) => {
    try {
      const study = await storage.getStudy(req.params.id);
      if (!study || !study.pdfFilename) {
        return res.status(404).json({ message: "PDF not found" });
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      const filePath = path.resolve(uploadsDir, study.pdfFilename);
      
      // Security: Ensure the resolved path is within the uploads directory
      const relative = path.relative(uploadsDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Security: Verify the path points to a regular file, not a directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on disk" });
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      // Read and parse PDF
      const dataBuffer = fs.readFileSync(filePath);
      
      // Use require for pdf-parse (CommonJS module)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      
      // Check if text extraction succeeded
      let extractedText = data.text || '';
      let extractionMethod = 'text';
      
      // If no text was extracted, use OCR on PDF images
      if (extractedText.trim().length === 0) {
        console.log('No text found in PDF, attempting OCR extraction...');
        extractionMethod = 'ocr';
        
        try {
          // Convert PDF pages to PNG images
          const pngPages = await pdfToPng(filePath, {
            disableFontFace: false,
            useSystemFonts: false,
            viewportScale: 2.0,
          });
          
          // Initialize Tesseract worker
          const worker = await createWorker('eng');
          
          // Process each page with OCR
          const ocrTexts: string[] = [];
          for (const page of pngPages) {
            const { data: { text } } = await worker.recognize(page.content);
            ocrTexts.push(text);
          }
          
          await worker.terminate();
          
          extractedText = ocrTexts.join('\n\n--- Page Break ---\n\n');
          console.log(`OCR extraction completed: ${extractedText.length} characters extracted`);
        } catch (ocrError) {
          console.error('OCR extraction failed:', ocrError);
          // If OCR fails, return empty text with the original metadata
        }
      }
      
      res.json({
        text: extractedText,
        numpages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version,
        extractionMethod // Let frontend know if OCR was used
      });
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      res.status(500).json({ message: "Failed to extract PDF text" });
    }
  });

  // Progress routes
  app.get('/api/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.query;
      const progress = await storage.getUserProgress(userId, studyId as string);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Get progress for specific study
  app.get('/api/progress/:studyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const progress = await storage.getUserProgress(userId, studyId);
      // Return the first item if it's an array, since we're looking for a specific study
      const studyProgress = Array.isArray(progress) && progress.length > 0 ? progress[0] : null;
      res.json(studyProgress);
    } catch (error) {
      console.error("Error fetching study progress:", error);
      res.status(500).json({ message: "Failed to fetch study progress" });
    }
  });

  // Get weekly study completion count
  app.get('/api/progress/weekly-completions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const weeklyCompletions = await storage.getWeeklyStudyCompletions(userId);
      res.json({ count: weeklyCompletions });
    } catch (error) {
      console.error("Error fetching weekly completions:", error);
      res.status(500).json({ message: "Failed to fetch weekly completions" });
    }
  });

  app.post('/api/progress/:studyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const progressData = req.body;
      
      // Extract user's local date and timezone if provided
      const userLocalDate = progressData.userLocalDate ? new Date(progressData.userLocalDate) : undefined;
      const userTimezone = progressData.timezone ? safeTimezone(progressData.timezone) : undefined;
      // Remove transport-only fields before passing to storage
      const { userLocalDate: _ulDate, timezone: _tz, ...cleanProgressData } = progressData;

      const progress = await storage.updateProgress(userId, studyId, cleanProgressData, userLocalDate, userTimezone);
      res.json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Update document scroll position
  app.patch('/api/progress/:studyId/scroll-position', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const { scrollPosition } = req.body;
      
      const progress = await storage.updateProgress(userId, studyId, { 
        documentScrollPosition: scrollPosition 
      });
      res.json(progress);
    } catch (error) {
      console.error("Error updating scroll position:", error);
      res.status(500).json({ message: "Failed to update scroll position" });
    }
  });

  // Discussion routes
  app.get('/api/discussions', async (req: any, res) => {
    try {
      const { category, limit, sortBy, search } = req.query;
      // Get current user ID if authenticated (optional for this endpoint)
      const currentUserId = req.user?.claims?.sub;
      
      const discussions = await storage.getDiscussions(
        category as string,
        limit ? parseInt(limit as string) : undefined,
        sortBy as string,
        search as string,
        currentUserId
      );
      res.json(discussions.map((d: any) => ({ ...d, content: maskMentionIds(d.content) })));
    } catch (error) {
      console.error("Error fetching discussions:", error);
      res.status(500).json({ message: "Failed to fetch discussions" });
    }
  });

  app.get('/api/discussions/:id', async (req: any, res) => {
    try {
      // Get current user ID if authenticated (optional for this endpoint)
      const currentUserId = req.user?.claims?.sub;
      const discussion = await storage.getDiscussion(req.params.id, currentUserId);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      res.json({
        ...discussion,
        content: maskMentionIds(discussion.content),
        replies: Array.isArray(discussion.replies)
          ? discussion.replies.map((r: any) => ({ ...r, content: maskMentionIds(r.content) }))
          : discussion.replies,
      });
    } catch (error) {
      console.error("Error fetching discussion:", error);
      res.status(500).json({ message: "Failed to fetch discussion" });
    }
  });

  // Check subscription status for a discussion
  app.get("/api/discussions/:id/subscription-status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const isSubscribed = await storage.isSubscribedToDiscussion(id, userId);
      
      res.json({ isSubscribed });
    } catch (error) {
      console.error('Error checking subscription status:', error);
      res.status(500).json({ error: "Failed to check subscription status" });
    }
  });

  // Subscribe to discussion notifications
  app.post("/api/discussions/:id/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const subscription = await storage.subscribeToDiscussion({
        userId,
        discussionId: id,
        isActive: true,
      });
      
      res.json({ success: true, subscription });
    } catch (error) {
      console.error('Error subscribing to discussion:', error);
      res.status(500).json({ error: "Failed to subscribe to discussion" });
    }
  });

  // Unsubscribe from discussion notifications
  app.delete("/api/discussions/:id/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.unsubscribeFromDiscussion(id, userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error unsubscribing from discussion:', error);
      res.status(500).json({ error: "Failed to unsubscribe from discussion" });
    }
  });

  // Community media upload endpoint
  app.post('/api/community/upload-media', isAuthenticated, communityMediaUpload.array('media', 10), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      for (const file of files) {
        const ext = file.originalname.split('.').pop() || 'bin';
        const key = `community/community-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const url = await uploadPublicFile(file.buffer, key, file.mimetype);
        mediaUrls.push(url);
        
        // Determine media type
        if (file.mimetype.startsWith('image/')) {
          if (file.mimetype === 'image/gif') {
            mediaTypes.push('gif');
          } else {
            mediaTypes.push('image');
          }
        } else if (file.mimetype.startsWith('video/')) {
          mediaTypes.push('video');
        }
      }

      res.json({ mediaUrls, mediaTypes });
    } catch (error) {
      console.error("Error uploading community media:", error);
      res.status(500).json({ message: "Failed to upload media" });
    }
  });

  app.post('/api/discussions', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const body = { ...req.body };
      if (typeof body.content === 'string') {
        body.content = body.content.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim();
      }
      const discussionData = insertDiscussionSchema.parse({
        ...body,
        userId,
      }) as any;
      // Preserve pollOptions — drizzle-zod may treat jsonb as unknown and strip it
      if (body.pollOptions !== undefined) {
        discussionData.pollOptions = body.pollOptions;
      }
      
      const discussion = await storage.createDiscussion(discussionData);

      // @-mention fan-out
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: discussion.content,
          authorId: userId,
          sourceType: 'discussion',
          sourceId: discussion.id,
          linkUrl: `/community?discussion=${discussion.id}`,
          surfaceLabel: `the discussion "${discussion.title}"`,
          isAuthorOwner: author?.role === 'owner',
        });
      }

      // Send notification to all users about the new discussion
      try {
        const allUsers = await storage.getAllUsers();
        const creator = await storage.getUser(userId);
        const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Someone';
        
        // Filter out the creator from notification recipients
        const otherUsers = allUsers.filter(user => user.id !== userId);
        
        if (otherUsers.length > 0) {
          const notificationPromises = otherUsers.map(async (targetUser) => {
            return await storage.createNotificationWithPreferences({
              userId: targetUser.id,
              type: 'new_discussion',
              title: '💬 New Community Discussion',
              message: `${creatorName} started a new discussion: "${discussion.title}"`,
              relatedId: discussion.id,
              linkUrl: `/community?discussion=${discussion.id}`,
            }, { url: `/community?discussion=${discussion.id}` });
          });
          
          await Promise.allSettled(notificationPromises);
        }
      } catch (notificationError) {
        console.error("Error sending discussion notifications:", notificationError);
        // Don't fail the discussion creation if notifications fail
      }
      
      res.status(201).json({ ...discussion, content: maskMentionIds(discussion.content) });
    } catch (error) {
      console.error("Error creating discussion:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid discussion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create discussion" });
    }
  });

  // Update discussion (only by owner)
  app.patch('/api/discussions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      const { title, content } = req.body;
      
      // Get the discussion to verify ownership
      const discussion = await storage.getDiscussion(discussionId);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      // Check if user owns this discussion
      if (discussion.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own discussions" });
      }
      
      // Update the discussion
      const updatedDiscussion = await storage.updateDiscussion(discussionId, { title, content });

      // @-mention fan-out
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: updatedDiscussion.content,
          authorId: userId,
          sourceType: 'discussion',
          sourceId: updatedDiscussion.id,
          linkUrl: `/community?discussion=${updatedDiscussion.id}`,
          surfaceLabel: `the discussion "${updatedDiscussion.title}"`,
          isAuthorOwner: author?.role === 'owner',
        });
      }

      res.json({ ...updatedDiscussion, content: maskMentionIds(updatedDiscussion.content) });
    } catch (error) {
      console.error("Error updating discussion:", error);
      res.status(500).json({ message: "Failed to update discussion" });
    }
  });

  app.get('/api/discussions/:id/replies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replies = await storage.getDiscussionReplies(req.params.id, userId);
      res.json(replies.map((r: any) => ({ ...r, content: maskMentionIds(r.content) })));
    } catch (error) {
      console.error("Error fetching replies:", error);
      res.status(500).json({ message: "Failed to fetch replies" });
    }
  });

  app.post('/api/discussions/:id/replies', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      // Check if this is a study discussion and verify tier access
      const discussion = await storage.getDiscussion(discussionId);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      if (discussion.studyId) {
        // This is a study discussion, check tier access
        const study = await storage.getStudy(discussion.studyId);
        const user = await storage.getUser(userId);
        
        if (!study || !user) {
          return res.status(403).json({ message: "Access denied" });
        }
        
        const studyAccess = await canAccessContent(user, 'studies', study.isTrialAccessible ?? false);
        if (!studyAccess) {
          return res.status(403).json({ message: "Active subscription required to participate in this study discussion" });
        }
      }
      
      const replyData = insertDiscussionReplySchema.parse({
        ...req.body,
        userId,
        discussionId,
      });
      
      const reply = await storage.createReply(replyData);

      // @-mention fan-out
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: reply.content,
          authorId: userId,
          sourceType: 'discussion_reply',
          sourceId: reply.id,
          linkUrl: `/community?discussion=${discussionId}&reply=${reply.id}`,
          surfaceLabel: `a reply to "${discussion.title}"`,
          isAuthorOwner: author?.role === 'owner',
        });
      }

      // Automatically subscribe the user to the discussion so they get notified of future replies
      try {
        await storage.subscribeToDiscussion({
          userId,
          discussionId,
          isActive: true,
        });
      } catch (subscribeError) {
        console.error("Error auto-subscribing user to discussion:", subscribeError);
        // Don't fail the reply creation if auto-subscription fails
      }
      
      // Send notifications to discussion subscribers (but not the person who posted the reply)
      try {
        const subscribers = await storage.getDiscussionSubscribers(discussionId);
        const replier = await storage.getUser(userId);
        const replierName = replier ? `${replier.firstName} ${replier.lastName}` : 'Someone';
        
        // Filter out the replier from notification recipients
        const otherSubscribers = subscribers.filter(sub => sub.userId !== userId);
        
        if (otherSubscribers.length > 0) {
          const notificationPromises = otherSubscribers.map(async (subscriber) => {
            return await storage.createNotificationWithPreferences({
              userId: subscriber.userId,
              type: 'discussion_reply',
              title: '💬 New Reply in Subscribed Discussion',
              message: `${replierName} replied to "${discussion.title}"`,
              relatedId: `${discussion.id}__reply__${reply.id}`,
              linkUrl: `/community?discussion=${discussion.id}&reply=${reply.id}`,
            }, { url: `/community?discussion=${discussion.id}&reply=${reply.id}` });
          });
          
          await Promise.allSettled(notificationPromises);
        }
      } catch (notificationError) {
        console.error("Error sending reply notifications:", notificationError);
        // Don't fail the reply creation if notifications fail
      }
      
      res.status(201).json({ ...reply, content: maskMentionIds(reply.content) });
    } catch (error) {
      console.error("Error creating reply:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reply data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  app.delete('/api/discussions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const canModerate = isModerator(user);
      const success = await storage.deleteDiscussion(req.params.id, userId, canModerate);
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own discussions" });
      }
      res.json({ message: "Discussion deleted successfully" });
    } catch (error) {
      console.error("Error deleting discussion:", error);
      res.status(500).json({ message: "Failed to delete discussion" });
    }
  });

  app.delete('/api/discussions/:id/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const canModerate = isModerator(user);
      const success = await storage.deleteDiscussionReply(req.params.replyId, userId, canModerate);
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own replies" });
      }
      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Error deleting discussion reply:", error);
      res.status(500).json({ message: "Failed to delete reply" });
    }
  });

  app.patch('/api/discussions/:id/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content is required" });
      const updated = await storage.updateDiscussionReply(req.params.replyId, userId, content.trim(), req.params.id);
      if (!updated) return res.status(403).json({ message: "You can only edit your own replies" });

      // @-mention fan-out (only newly added mentions get notified)
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: updated.content,
          authorId: userId,
          sourceType: 'discussion_reply',
          sourceId: updated.id,
          linkUrl: `/community?discussion=${req.params.id}&reply=${updated.id}`,
          surfaceLabel: 'a community reply',
          isAuthorOwner: author?.role === 'owner',
        });
      }

      res.json({ ...updated, content: maskMentionIds(updated.content) });
    } catch (error) {
      console.error("Error updating discussion reply:", error);
      res.status(500).json({ message: "Failed to update reply" });
    }
  });

  app.post('/api/discussions/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      const result = await storage.toggleDiscussionLike(discussionId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to update like" });
    }
  });

  app.post('/api/discussions/:id/dislike', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      const result = await storage.toggleDiscussionDislike(discussionId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling dislike:", error);
      res.status(500).json({ message: "Failed to update dislike" });
    }
  });

  app.get('/api/discussions/:id/likers', async (req: any, res) => {
    try {
      const likers = await storage.getDiscussionLikers(req.params.id);
      res.json(likers);
    } catch (error) {
      console.error("Error fetching likers:", error);
      res.status(500).json({ message: "Failed to fetch likers" });
    }
  });

  app.get('/api/discussions/:id/dislikers', isAuthenticated, async (req: any, res) => {
    try {
      const dislikers = await storage.getDiscussionDislikers(req.params.id);
      res.json(dislikers);
    } catch (error) {
      console.error("Error fetching dislikers:", error);
      res.status(500).json({ message: "Failed to fetch dislikers" });
    }
  });

  app.post('/api/discussions/:id/poll/vote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      const { optionIndex } = req.body;
      if (typeof optionIndex !== 'number') return res.status(400).json({ message: 'optionIndex required' });
      const result = await storage.votePoll(discussionId, userId, optionIndex);
      res.json(result);
    } catch (error) {
      console.error("Error voting on poll:", error);
      res.status(500).json({ message: "Failed to vote on poll" });
    }
  });

  app.get('/api/discussions/:id/replies/:replyId/likers', isAuthenticated, async (req: any, res) => {
    try {
      const likers = await storage.getReplyLikers(req.params.replyId);
      res.json(likers);
    } catch (error) {
      console.error("Error fetching reply likers:", error);
      res.status(500).json({ message: "Failed to fetch reply likers" });
    }
  });

  app.get('/api/discussions/:id/replies/:replyId/dislikers', isAuthenticated, async (req: any, res) => {
    try {
      const dislikers = await storage.getReplyDislikers(req.params.replyId);
      res.json(dislikers);
    } catch (error) {
      console.error("Error fetching reply dislikers:", error);
      res.status(500).json({ message: "Failed to fetch reply dislikers" });
    }
  });

  app.post('/api/discussions/:id/replies/:replyId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { replyId } = req.params;
      const result = await storage.honorReply(userId, replyId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling reply like:", error);
      res.status(500).json({ message: "Failed to update reply like" });
    }
  });

  // Reply dislike (Oh Me!) route
  app.post('/api/discussions/:id/replies/:replyId/dislike', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { replyId } = req.params;
      const result = await storage.toggleDiscussionReplyDislike(replyId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling reply dislike:", error);
      res.status(500).json({ message: "Failed to update reply dislike" });
    }
  });

  // Discussion subscription routes
  app.post('/api/discussions/:id/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      // Verify discussion exists
      const discussion = await storage.getDiscussion(discussionId);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      
      const subscriptionData = insertDiscussionSubscriptionSchema.parse({
        userId,
        discussionId,
        isActive: true,
      });
      
      const subscription = await storage.subscribeToDiscussion(subscriptionData);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error subscribing to discussion:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to subscribe to discussion" });
    }
  });

  app.delete('/api/discussions/:id/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      await storage.unsubscribeFromDiscussion(discussionId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unsubscribing from discussion:", error);
      res.status(500).json({ message: "Failed to unsubscribe from discussion" });
    }
  });

  app.get('/api/discussions/:id/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      const isSubscribed = await storage.isSubscribedToDiscussion(discussionId, userId);
      res.json({ isSubscribed });
    } catch (error) {
      console.error("Error checking subscription status:", error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  // Honor system routes
  app.post('/api/discussions/:id/honor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionId = req.params.id;
      
      const result = await storage.honorDiscussion(userId, discussionId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling discussion honor:", error);
      res.status(500).json({ message: "Failed to toggle honor" });
    }
  });

  app.post('/api/replies/:id/honor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replyId = req.params.id;
      
      const result = await storage.honorReply(userId, replyId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling reply honor:", error);
      res.status(500).json({ message: "Failed to toggle honor" });
    }
  });

  app.get('/api/users/:id/honor-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { discussionIds, replyIds } = req.query;
      
      const discussionIdsArray = discussionIds ? (Array.isArray(discussionIds) ? discussionIds : [discussionIds]) : [];
      const replyIdsArray = replyIds ? (Array.isArray(replyIds) ? replyIds : [replyIds]) : [];
      
      const honorStatus = await storage.getUserHonorStatus(userId, discussionIdsArray, replyIdsArray);
      res.json(honorStatus);
    } catch (error) {
      console.error("Error getting user honor status:", error);
      res.status(500).json({ message: "Failed to get honor status" });
    }
  });

  app.get('/api/users/:id/honor-stats', isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      
      const honorStats = await storage.getUserHonorStats(targetUserId);
      res.json(honorStats);
    } catch (error) {
      console.error("Error getting user honor stats:", error);
      res.status(500).json({ message: "Failed to get honor stats" });
    }
  });

  // Live stream routes (admin-only)
  app.get('/api/live-streams', async (req, res) => {
    try {
      const streams = await storage.getLiveStreams();
      res.json(streams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  app.get('/api/live-streams/active', async (req, res) => {
    try {
      const stream = await storage.getActiveLiveStream();
      if (!stream) return res.json(null);

      res.json(stream);
    } catch (error) {
      console.error("Error fetching active live stream:", error);
      res.status(500).json({ message: "Failed to fetch active stream" });
    }
  });

  app.post('/api/live-streams', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required for live streaming" });
      }

      const { title, description, simulcastYoutubeKey, simulcastFacebookKey } = req.body;

      // Create stream in Mux
      const { createMuxLiveStream } = await import('./mux.js');
      const muxData = await createMuxLiveStream({ simulcastYoutubeKey, simulcastFacebookKey });

      const streamData = {
        title,
        description,
        createdBy: user.id,
        status: 'scheduled',
        streamType: 'mux',
        muxStreamId: muxData.muxStreamId,
        muxStreamKey: muxData.muxStreamKey,
        muxRtmpUrl: muxData.muxRtmpUrl,
        muxPlaybackId: muxData.muxPlaybackId,
        simulcastYoutubeKey: simulcastYoutubeKey || null,
        simulcastFacebookKey: simulcastFacebookKey || null,
      };

      const stream = await storage.createLiveStream(streamData as any);
      res.status(201).json(stream);
    } catch (error: any) {
      console.error("Error creating live stream:", error);
      const msg = error?.message || "";
      if (msg.includes("free plan") || msg.includes("unavailable on the free")) {
        return res.status(402).json({ message: "Live streaming requires a paid Mux plan. Go to dashboard.mux.com → Settings → Billing to add a payment method." });
      }
      res.status(500).json({ message: "Failed to create live stream" });
    }
  });

  app.patch('/api/live-streams/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stream = await storage.startLiveStream(req.params.id);
      res.json(stream);

      // Send push notification to all users
      try {
        const { sendPushToAllUsers } = await import('./pushNotificationService.js');
        await sendPushToAllUsers({
          title: "🔴 We're Live!",
          body: `${stream.title} — Tap to watch now.`,
          url: "/live",
        });
      } catch (notifErr) {
        console.error("Live stream notification error:", notifErr);
      }
    } catch (error) {
      console.error("Error starting live stream:", error);
      res.status(500).json({ message: "Failed to start live stream" });
    }
  });

  app.patch('/api/live-streams/:id/end', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const existing = await storage.getLiveStream(req.params.id);
      if (existing?.muxStreamId) {
        try {
          const { disableMuxLiveStream } = await import('./mux.js');
          await disableMuxLiveStream(existing.muxStreamId);
        } catch (muxErr) {
          console.error("Mux disable error (non-fatal):", muxErr);
        }
      }

      const stream = await storage.endLiveStream(req.params.id);
      res.json(stream);
    } catch (error) {
      console.error("Error ending live stream:", error);
      res.status(500).json({ message: "Failed to end live stream" });
    }
  });

  app.delete('/api/live-streams/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const existing = await storage.getLiveStream(req.params.id);
      if (existing?.muxStreamId) {
        try {
          const { deleteMuxLiveStream } = await import('./mux.js');
          await deleteMuxLiveStream(existing.muxStreamId);
        } catch (muxErr) {
          console.error("Mux delete error (non-fatal):", muxErr);
        }
      }

      await storage.deleteLiveStream(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting live stream:", error);
      res.status(500).json({ message: "Failed to delete live stream" });
    }
  });

  // Returns the Mux WHIP URL for direct browser→Mux connection (admin only).
  // Exposes the stream key in the URL, but only to authenticated admins.
  app.get('/api/live-streams/:id/whip-url', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Forbidden' });
      const stream = await storage.getLiveStream(req.params.id);
      if (!stream || !stream.muxStreamKey) return res.status(404).json({ message: 'Stream not found' });
      res.json({ whipUrl: `https://global-live.mux.com/app/${stream.muxStreamKey}/whip` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // WHIP proxy — forwards the WebRTC SDP offer from the browser to Mux's WHIP endpoint.
  // Uses Node.js https module (HTTP/1.1) because undici/fetch tries HTTP/2 which Mux WHIP rejects.
  app.post('/api/live-streams/:id/whip', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).send('Forbidden');

      const stream = await storage.getLiveStream(req.params.id);
      if (!stream || !stream.muxStreamKey) return res.status(404).send('Stream not found');

      // Read SDP body from the raw request stream (express.text middleware may or may not have run)
      let sdpBody: string;
      if (typeof req.body === 'string' && req.body.length > 0) {
        sdpBody = req.body;
      } else {
        // Fallback: read directly from the stream
        sdpBody = await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      if (!sdpBody || sdpBody.trim().length === 0) {
        return res.status(400).send('Empty SDP body');
      }

      const streamKey = stream.muxStreamKey;
      const bodyBuf = Buffer.from(sdpBody, 'utf-8');

      console.log(`WHIP proxy: sending ${bodyBuf.length} bytes to Mux, stream key prefix: ${streamKey?.slice(0, 8)}...`);
      console.log(`WHIP SDP preview: ${sdpBody.slice(0, 120).replace(/\r?\n/g, '|')}`);

      // Mux WHIP authenticates via the stream key in the URL — no Authorization header needed.
      // The API token (MUX_TOKEN_ID/SECRET) is for the REST API only, not WHIP ingestion.
      // ALPNProtocols forces HTTP/1.1 — Mux WHIP does not support HTTP/2.

      const https = await import('https');
      const result = await new Promise<{ status: number; contentType: string; body: string }>((resolve, reject) => {
        const options: any = {
          hostname: 'global-live.mux.com',
          port: 443,
          path: `/app/${streamKey}/whip`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
            'Content-Length': bodyBuf.length,
            'User-Agent': 'ManUpGodsWay/1.0',
          },
          // Explicitly negotiate HTTP/1.1 only — prevents TLS ALPN from upgrading to HTTP/2
          ALPNProtocols: ['http/1.1'],
        };

        const httpReq = https.request(options, (httpRes) => {
          let body = '';
          httpRes.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          httpRes.on('end', () => {
            resolve({
              status: httpRes.statusCode || 500,
              contentType: (httpRes.headers['content-type'] as string) || 'application/sdp',
              body,
            });
          });
        });

        httpReq.on('error', reject);
        httpReq.setTimeout(15000, () => {
          httpReq.destroy(new Error('WHIP request timed out'));
        });
        httpReq.write(bodyBuf);
        httpReq.end();
      });

      console.log(`WHIP proxy response: ${result.status} body="${result.body.slice(0, 300)}"`);
      res.status(result.status)
        .set('Content-Type', result.contentType)
        .send(result.body);
    } catch (error: any) {
      console.error('WHIP proxy error:', error?.message, 'cause:', error?.cause?.message ?? 'none');
      res.status(502).send('Streaming server connection failed: ' + error.message);
    }
  });

  // Mux webhook - updates stream status automatically
  app.post('/api/mux/webhook', async (req: any, res) => {
    try {
      const { type, data } = req.body;
      if (!type || !data) return res.status(400).send('Invalid webhook');

      const muxStreamId = data.id;

      if (type === 'video.live_stream.active') {
        // Stream went live - find by muxStreamId and mark as live
        const streams = await storage.getLiveStreams();
        const match = streams.find((s: any) => s.muxStreamId === muxStreamId);
        if (match) {
          const liveStream = await storage.startLiveStream(match.id);
          // Notify all users
          try {
            const { sendPushToAllUsers } = await import('./pushNotificationService.js');
            await sendPushToAllUsers({
              title: "🔴 We're Live!",
              body: `${liveStream.title} — Tap to watch now.`,
              url: "/live",
            });
          } catch (notifErr) {
            console.error("Live stream notification error:", notifErr);
          }
        }
      } else if (type === 'video.live_stream.idle') {
        // Stream went idle (broadcaster stopped) - mark as ended
        const streams = await storage.getLiveStreams();
        const match = streams.find((s: any) => s.muxStreamId === muxStreamId && s.status === 'live');
        if (match) await storage.endLiveStream(match.id);
      } else if (type === 'video.asset.ready') {
        // A VOD asset was created - check if it came from a live stream
        const liveStreamId = data.live_stream_id;
        if (liveStreamId && data.playback_ids?.length > 0) {
          const playbackId = data.playback_ids[0].id;
          const streams = await storage.getLiveStreams();
          const match = streams.find((s: any) => s.muxStreamId === liveStreamId);
          if (match) {
            // Create a video record for the recording
            const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;
            const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
            const durationSecs = data.duration ? Math.round(data.duration) : null;
            await storage.createVideo({
              title: `${match.title} (Recording)`,
              description: match.description || null,
              videoUrl,
              thumbnailUrl,
              uploadedBy: match.createdBy,
              category: 'general',
              isProcessed: true,
              processingStatus: 'completed',
              ...(durationSecs ? { duration: durationSecs } : {}),
            } as any);
            console.log(`[Mux] Auto-saved recording for live stream "${match.title}" (playback: ${playbackId})`);
          }
        }
      }

      res.status(200).send('ok');
    } catch (error) {
      console.error("Mux webhook error:", error);
      res.status(500).send('error');
    }
  });

  // Manual save-recording endpoint (fallback if webhook didn't fire)
  app.post('/api/live-streams/:id/save-recording', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: "Admin access required" });

      const stream = await storage.getLiveStream(req.params.id);
      if (!stream) return res.status(404).json({ message: "Stream not found" });
      if (!stream.muxStreamId) return res.status(400).json({ message: "No Mux stream ID on this record" });

      // Fetch assets linked to this live stream from Mux
      const Mux = (await import('@mux/mux-node')).default;
      const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID!, tokenSecret: process.env.MUX_TOKEN_SECRET! });
      const assets = await mux.video.assets.list({ live_stream_id: stream.muxStreamId });
      const readyAsset = (assets.data || []).find((a: any) => a.status === 'ready' && a.playback_ids?.length > 0);

      if (!readyAsset) {
        return res.status(202).json({ message: "Recording is still processing. Try again in a few minutes." });
      }

      const playbackId = readyAsset.playback_ids[0].id;
      const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      const durationSecs = readyAsset.duration ? Math.round(readyAsset.duration) : null;

      const video = await storage.createVideo({
        title: `${stream.title} (Recording)`,
        description: stream.description || null,
        videoUrl,
        thumbnailUrl,
        uploadedBy: stream.createdBy,
        category: 'general',
        isProcessed: true,
        processingStatus: 'completed',
        ...(durationSecs ? { duration: durationSecs } : {}),
      } as any);

      res.json({ message: "Recording saved to Videos", video });
    } catch (error) {
      console.error("Error saving recording:", error);
      res.status(500).json({ message: "Failed to save recording" });
    }
  });

  // Study lesson routes
  app.get('/api/studies/:studyId/lessons', async (req: any, res) => {
    try {
      const studyId = req.params.studyId;
      const lessons = await storage.getStudyLessons(studyId);
      const userId = req.user?.claims?.sub;
      if (userId && lessons.length > 0) {
        const lessonIds = lessons.map((l: any) => l.id);
        const progress = await storage.getLessonProgressForLessons(userId, lessonIds);
        const progressMap = new Map(progress.map(p => [p.lessonId, p]));
        const sorted = [...lessons].sort((a: any, b: any) =>
          (a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0)
        );
        const timezone = (req.query.timezone as string) || 'America/New_York';

        // Cross-study drip: find the previous study's last lesson completion time
        // so Day 1 of this study is also gated until midnight after Day 7 of the prior study.
        let prevStudyLastCompletedAt: Date | null = null;
        const [thisStudy] = await db.select().from(schema.studies).where(eq(schema.studies.id, studyId));
        if (thisStudy?.seriesId) {
          const seriesStudies = await db.select().from(schema.studies)
            .where(and(eq(schema.studies.seriesId, thisStudy.seriesId), eq(schema.studies.isPublished, true)))
            .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));
          const thisIdx = seriesStudies.findIndex(s => s.id === studyId);
          if (thisIdx > 0) {
            const prevStudy = seriesStudies[thisIdx - 1];
            const prevLessons = await db.select().from(schema.studyLessons)
              .where(eq(schema.studyLessons.studyId, prevStudy.id))
              .orderBy(desc(schema.studyLessons.displayOrder), desc(schema.studyLessons.dayNumber));
            if (prevLessons.length > 0) {
              const lastLesson = prevLessons[0];
              const [lastProg] = await db.select().from(schema.userLessonProgress)
                .where(and(
                  eq(schema.userLessonProgress.userId, userId),
                  eq(schema.userLessonProgress.lessonId, lastLesson.id)
                ));
              if (lastProg?.completedAt) {
                prevStudyLastCompletedAt = new Date(lastProg.completedAt);
              }
            }
          }
        }

        const withLock = sorted.map((lesson: any, index: number) => {
          const thisProg = progressMap.get(lesson.id);
          const isCompleted = !!thisProg?.completedAt;
          // Admin bypass always takes precedence
          if (thisProg?.dripBypassed) return { ...lesson, isLocked: false, unlocksAt: null, isCompleted };
          if (index === 0) {
            // Day 1: apply cross-study drip gate if the previous week's last lesson was just completed
            if (prevStudyLastCompletedAt) {
              const unlockTime = getNextMidnightInTimezone(prevStudyLastCompletedAt, timezone);
              if (new Date() < unlockTime) return { ...lesson, isLocked: true, unlocksAt: unlockTime.toISOString(), isCompleted };
            }
            return { ...lesson, isLocked: false, unlocksAt: null, isCompleted };
          }
          const prevLesson = sorted[index - 1];
          const prevProg = progressMap.get(prevLesson.id);
          if (!prevProg?.completedAt) return { ...lesson, isLocked: true, unlocksAt: null, isCompleted };
          const prevCompleted = new Date(prevProg.completedAt);
          const unlockTime = getNextMidnightInTimezone(prevCompleted, timezone);
          if (new Date() < unlockTime) return { ...lesson, isLocked: true, unlocksAt: unlockTime.toISOString(), isCompleted };
          return { ...lesson, isLocked: false, unlocksAt: null, isCompleted };
        });
        return res.json(withLock);
      }
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching study lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.post('/api/studies/:studyId/lessons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const lessonData = {
        ...req.body,
        studyId: req.params.studyId,
      };

      const newLesson = await storage.createStudyLesson(lessonData);
      
      // Update total_days count on the study
      const lessons = await storage.getStudyLessons(req.params.studyId);
      await storage.updateStudy(req.params.studyId, { totalDays: lessons.length });
      
      res.status(201).json(newLesson);
    } catch (error) {
      console.error("Error creating lesson:", error);
      res.status(500).json({ message: "Failed to create lesson" });
    }
  });

  app.patch('/api/studies/:studyId/lessons/:lessonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updatedLesson = await storage.updateStudyLesson(req.params.lessonId, req.body);
      res.json(updatedLesson);
    } catch (error) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: "Failed to update lesson" });
    }
  });

  app.delete('/api/studies/:studyId/lessons/:lessonId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteStudyLesson(req.params.lessonId);
      
      // Update total_days count on the study
      const lessons = await storage.getStudyLessons(req.params.studyId);
      await storage.updateStudy(req.params.studyId, { totalDays: lessons.length });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lesson:", error);
      res.status(500).json({ message: "Failed to delete lesson" });
    }
  });

  // Delete ALL lessons for a study (used by admin re-import flow)
  app.delete('/api/studies/:studyId/lessons', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      await storage.deleteAllStudyLessons(req.params.studyId);
      await storage.updateStudy(req.params.studyId, { totalDays: 0 });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting all lessons:", error);
      res.status(500).json({ message: "Failed to delete lessons" });
    }
  });

  // Track "Start a Study" activity - awards rations on first study view and marks study as in_progress
  app.post('/api/studies/:studyId/track-start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;

      // Check if study exists
      const study = await storage.getStudy(studyId);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

      // Ensure a user_progress record exists with status = 'in_progress' so the
      // "one active per type" lock fires as soon as the user opens the study —
      // not only after they complete their first lesson.
      await storage.markStudyStarted(userId, studyId);

      // Award rations for starting a study (RationsService handles deduplication via missionKey + referenceId)
      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardRations(userId, 'start_study', studyId, 'study');

      // Return appropriate status based on whether rations were actually awarded
      if (rationResult && rationResult.awarded > 0) {
        res.json({ 
          success: true, 
          message: "Study start tracked",
          rationsAwarded: rationResult.awarded 
        });
      } else {
        res.json({ 
          success: true, 
          message: "Already tracked",
          rationsAwarded: 0 
        });
      }
    } catch (error) {
      console.error("Error tracking study start:", error);
      res.status(500).json({ message: "Failed to track study start" });
    }
  });

  // Mark lesson as complete
  app.post('/api/studies/:studyId/lessons/:lessonId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId, lessonId } = req.params;
      const { answers } = req.body;

      // Check lesson-a-day drip: block if previous lesson not yet completed or not yet midnight of the next day
      // Skip the drip gate entirely when an admin explicitly bypassed it for this lesson.
      const allLessons = await storage.getStudyLessons(studyId);
      const sortedForDrip = [...allLessons].sort((a: any, b: any) =>
        (a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0)
      );
      const lessonIndexForDrip = sortedForDrip.findIndex((l: any) => l.id === lessonId);
      const [thisLessonProg] = await storage.getLessonProgressForLessons(userId, [lessonId]);
      const dripBypassed = !!thisLessonProg?.dripBypassed;
      const lessonTimezone = safeTimezone(req.body.timezone);

      if (!dripBypassed) {
        if (lessonIndexForDrip === 0) {
          // Day 1: check the previous study's last lesson as the drip anchor
          const [thisStudy] = await db.select().from(schema.studies).where(eq(schema.studies.id, studyId));
          if (thisStudy?.seriesId) {
            const seriesStudies = await db.select().from(schema.studies)
              .where(and(eq(schema.studies.seriesId, thisStudy.seriesId), eq(schema.studies.isPublished, true)))
              .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));
            const thisIdx = seriesStudies.findIndex(s => s.id === studyId);
            if (thisIdx > 0) {
              const prevStudy = seriesStudies[thisIdx - 1];
              const prevLessons = await db.select().from(schema.studyLessons)
                .where(eq(schema.studyLessons.studyId, prevStudy.id))
                .orderBy(desc(schema.studyLessons.displayOrder), desc(schema.studyLessons.dayNumber));
              if (prevLessons.length > 0) {
                const [lastProg] = await db.select().from(schema.userLessonProgress)
                  .where(and(
                    eq(schema.userLessonProgress.userId, userId),
                    eq(schema.userLessonProgress.lessonId, prevLessons[0].id)
                  ));
                if (lastProg?.completedAt) {
                  const unlockTime = getNextMidnightInTimezone(new Date(lastProg.completedAt), lessonTimezone);
                  if (new Date() < unlockTime) {
                    return res.status(403).json({
                      message: "This lesson isn't available yet. Come back tomorrow!",
                      unlocksAt: unlockTime.toISOString(),
                    });
                  }
                }
              }
            }
          }
        } else {
          // Day 2+: standard within-study drip check
          const prevLesson = sortedForDrip[lessonIndexForDrip - 1];
          const [prevProg] = await storage.getLessonProgressForLessons(userId, [prevLesson.id]);
          if (!prevProg?.completedAt) {
            return res.status(403).json({ message: "Complete the previous lesson first." });
          }
          const prevCompleted = new Date(prevProg.completedAt);
          const unlockTime = getNextMidnightInTimezone(prevCompleted, lessonTimezone);
          if (new Date() < unlockTime) {
            return res.status(403).json({
              message: "This lesson isn't available yet. Come back tomorrow!",
              unlocksAt: unlockTime.toISOString(),
            });
          }
        }
      }

      // Check if lesson was already completed
      const existingProgress = await storage.getUserLessonProgress(userId);
      const wasAlreadyComplete = existingProgress.some(p => p.lessonId === lessonId && p.isCompleted);

      const progress = await storage.markLessonComplete(userId, lessonId, answers, lessonTimezone);
      
      // Award rations for lesson completion (only if first time completing)
      let rationResult = null;
      let studyCompleted = false;
      let nextStudyData: any = null;

      if (!wasAlreadyComplete) {
        const { rationsService } = await import('./rations-service');
        
        // Get the lesson's configured reward from DB
        const [lesson] = await db.select({ rationReward: schema.studyLessons.rationReward, title: schema.studyLessons.title })
          .from(schema.studyLessons).where(eq(schema.studyLessons.id, lessonId));
        const lessonReward = lesson?.rationReward || 25;
        
        rationResult = await rationsService.awardCustomRations(
          userId, lessonReward, 'study', `Completed lesson: ${lesson?.title || 'Unknown'}`, 'complete_lesson', lessonId, 'lesson'
        );
        
        // Check if this completes the study
        const lessons = await storage.getStudyLessons(studyId);
        const updatedProgress = await storage.getUserLessonProgress(userId);
        const studyLessonIds = lessons.map(l => l.id);
        const completedLessons = updatedProgress.filter(
          p => studyLessonIds.includes(p.lessonId) && p.isCompleted
        );

        if (completedLessons.length === lessons.length && lessons.length > 0) {
          studyCompleted = true;
          // Get the study's configured reward from DB
          const [study] = await db.select({ 
            rationReward: schema.studies.rationReward, 
            title: schema.studies.title,
            seriesId: schema.studies.seriesId,
            seriesOrder: schema.studies.seriesOrder
          }).from(schema.studies).where(eq(schema.studies.id, studyId));
          const studyReward = study?.rationReward || 100;

          // Dedup: only award study completion once
          const [studyTx] = await db.select({ id: schema.rationTransactions.id })
            .from(schema.rationTransactions)
            .where(and(
              eq(schema.rationTransactions.userId, userId),
              eq(schema.rationTransactions.missionType, 'complete_study'),
              eq(schema.rationTransactions.referenceId, studyId)
            ))
            .limit(1);
          if (!studyTx) {
            await rationsService.awardCustomRations(
              userId, studyReward, 'study', `Completed study: ${study?.title || 'Unknown'}`, 'complete_study', studyId, 'study'
            );
          }
          
          // Find next study in the same series (any series, consecutive or not)
          if (study?.seriesId) {
            const [series] = await db.select()
              .from(schema.studySeries)
              .where(eq(schema.studySeries.id, study.seriesId));
            
            const allSeriesStudies = await db.select()
              .from(schema.studies)
              .where(and(
                eq(schema.studies.seriesId, study.seriesId),
                eq(schema.studies.isPublished, true)
              ))
              .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));
            
            const currentIndex = allSeriesStudies.findIndex(s => s.id === studyId);
            const nextStudy = currentIndex >= 0 && currentIndex < allSeriesStudies.length - 1
              ? allSeriesStudies[currentIndex + 1]
              : null;
            
            if (nextStudy) {
              nextStudyData = {
                id: nextStudy.id,
                title: nextStudy.title,
                description: nextStudy.description,
                thumbnailUrl: nextStudy.thumbnailUrl,
                totalDays: nextStudy.totalDays,
                seriesTitle: series?.title,
              };

              // Send notification for consecutive series
              if (series?.requiresConsecutiveCompletion) {
                const [userPrefs] = await db.select()
                  .from(schema.notificationPreferences)
                  .where(eq(schema.notificationPreferences.userId, userId));
                
                const shouldNotify = userPrefs?.nextStudyNotifications !== false;
                if (shouldNotify) {
                  await storage.createNotification({
                    userId,
                    type: 'study',
                    title: 'Next Study Unlocked!',
                    message: `"${nextStudy.title}" is now available. Continue your journey in ${series.title}!`,
                    relatedId: nextStudy.id,
                  });
                }
              }
            }
          }

          // If no series next study, find a recommended study
          if (!nextStudyData) {
            const [recommended] = await db.select({
              id: schema.studies.id,
              title: schema.studies.title,
              description: schema.studies.description,
              thumbnailUrl: schema.studies.thumbnailUrl,
              totalDays: schema.studies.totalDays,
            })
              .from(schema.studies)
              .where(and(
                eq(schema.studies.isPublished, true),
                ne(schema.studies.id, studyId)
              ))
              .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt))
              .limit(1);
            if (recommended) nextStudyData = recommended;
          }
        }
      }

      res.json({ ...progress, rations: rationResult, studyCompleted, nextStudy: nextStudyData });
    } catch (error) {
      console.error("Error marking lesson complete:", error);
      res.status(500).json({ message: "Failed to mark lesson complete" });
    }
  });

  // Save lesson notes (reflection)
  app.post('/api/studies/:studyId/lessons/:lessonId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { lessonId } = req.params;
      const { notes } = req.body;

      const progress = await storage.saveLessonNotes(userId, lessonId, notes);
      
      // Award rations for writing a reflection (only if notes are substantial)
      let rationResult = null;
      if (notes && notes.trim().length >= 50) {
        const { rationsService } = await import('./rations-service');
        rationResult = await rationsService.awardRations(userId, 'write_study_reflection', lessonId, 'lesson');
      }

      res.json({ ...progress, rations: rationResult });
    } catch (error) {
      console.error("Error saving lesson notes:", error);
      res.status(500).json({ message: "Failed to save notes" });
    }
  });

  // Get journal entries - all saved notes + free-form entries across all studies
  app.get('/api/journal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Lesson notes
      const notesResult = await db.execute(sql`
        SELECT
          ulp.id,
          ulp.notes AS content,
          ulp.updated_at AS "createdAt",
          sl.day_number AS "dayNumber",
          sl.title AS "lessonTitle",
          s.id AS "studyId",
          s.title AS "studyTitle",
          'lesson_note' AS type
        FROM user_lesson_progress ulp
        JOIN study_lessons sl ON ulp.lesson_id = sl.id
        JOIN studies s ON sl.study_id = s.id
        WHERE ulp.user_id = ${userId}
          AND ulp.notes IS NOT NULL
          AND ulp.notes != ''
      `);
      // Free-form journal entries
      const entriesResult = await db.execute(sql`
        SELECT
          je.id,
          je.content,
          je.created_at AS "createdAt",
          NULL AS "dayNumber",
          NULL AS "lessonTitle",
          je.study_id AS "studyId",
          s.title AS "studyTitle",
          'journal_entry' AS type
        FROM journal_entries je
        LEFT JOIN studies s ON je.study_id = s.id
        WHERE je.user_id = ${userId}
      `);
      // Merge and sort by createdAt desc
      const all = [...notesResult.rows, ...entriesResult.rows].sort((a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      res.json(all);
    } catch (error) {
      console.error("Error fetching journal:", error);
      res.status(500).json({ message: "Failed to fetch journal" });
    }
  });

  // Get lesson notes for a specific study
  app.get('/api/studies/:studyId/journal-notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const result = await db.execute(sql`
        SELECT
          ulp.id,
          ulp.notes AS content,
          ulp.updated_at AS "createdAt",
          sl.day_number AS "dayNumber",
          sl.title AS "lessonTitle",
          'lesson_note' AS type
        FROM user_lesson_progress ulp
        JOIN study_lessons sl ON ulp.lesson_id = sl.id
        WHERE ulp.user_id = ${userId}
          AND sl.study_id = ${studyId}
          AND ulp.notes IS NOT NULL
          AND ulp.notes != ''
        ORDER BY sl.day_number ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching study journal notes:", error);
      res.status(500).json({ message: "Failed to fetch journal notes" });
    }
  });

  // Get free-form journal entries for a specific study
  app.get('/api/studies/:studyId/journal-entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const result = await db.execute(sql`
        SELECT id, content, created_at AS "createdAt", 'journal_entry' AS type
        FROM journal_entries
        WHERE user_id = ${userId} AND study_id = ${studyId}
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  // Add a free-form journal entry for a study
  app.post('/api/studies/:studyId/journal-entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      const result = await db.execute(sql`
        INSERT INTO journal_entries (user_id, study_id, content)
        VALUES (${userId}, ${studyId}, ${content.trim()})
        RETURNING id, content, created_at AS "createdAt"
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error adding journal entry:", error);
      res.status(500).json({ message: "Failed to add journal entry" });
    }
  });

  // Delete a free-form journal entry
  app.delete('/api/journal-entries/:entryId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { entryId } = req.params;
      await db.execute(sql`
        DELETE FROM journal_entries WHERE id = ${entryId} AND user_id = ${userId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // Get user's lesson progress
  app.get('/api/users/:userId/lesson-progress', isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const { userId } = req.params;

      // Users can only view their own progress
      if (requestingUserId !== userId) {
        const user = await storage.getUser(requestingUserId);
        if (!user || !isAdmin(user)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const progress = await storage.getUserLessonProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching lesson progress:", error);
      res.status(500).json({ message: "Failed to fetch lesson progress" });
    }
  });

  // Devotional routes
  
  // Download Word document template for bulk devotional import
  app.get('/api/devotionals/template', isAuthenticated, async (req: any, res) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = await import('docx');
      
      const devotionalCount = 30;
      const children: any[] = [];
      
      // Title
      children.push(
        new Paragraph({
          text: "Man Up God's Way - Devotional Bulk Import Template",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
      
      // Instructions
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "INSTRUCTIONS:",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "1. Fill in each devotional below. Each section is separated by '---'",
              size: 22,
            }),
          ],
          spacing: { after: 50 },
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "2. Keep the field labels (TITLE:, REFERENCE:, VERSE:, CONTENT:) exactly as shown",
              size: 22,
            }),
          ],
          spacing: { after: 50 },
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "3. Copy all text from this document and paste into the Bulk Import text area",
              size: 22,
            }),
          ],
          spacing: { after: 50 },
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "4. Set your start date in the admin panel - dates will be assigned sequentially",
              size: 22,
            }),
          ],
          spacing: { after: 300 },
        })
      );
      
      // Generate 30 devotional templates
      for (let i = 1; i <= devotionalCount; i++) {
        // Separator (except for first)
        if (i > 1) {
          children.push(
            new Paragraph({
              text: "---",
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 300 },
            })
          );
        }
        
        // Day header
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `DEVOTIONAL ${i} OF 30`,
                bold: true,
                size: 26,
                color: "B8860B", // Dark goldenrod
              }),
            ],
            spacing: { before: 200, after: 200 },
          })
        );
        
        // TITLE field
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "TITLE: ", bold: true, size: 22 }),
              new TextRun({ text: "[Enter devotional title here]", italics: true, size: 22, color: "808080" }),
            ],
            spacing: { after: 100 },
          })
        );
        
        // REFERENCE field
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "REFERENCE: ", bold: true, size: 22 }),
              new TextRun({ text: "[e.g., John 3:16 or Romans 8:28-30]", italics: true, size: 22, color: "808080" }),
            ],
            spacing: { after: 100 },
          })
        );
        
        // VERSE field
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "VERSE: ", bold: true, size: 22 }),
              new TextRun({ text: "[Enter the full scripture text here]", italics: true, size: 22, color: "808080" }),
            ],
            spacing: { after: 100 },
          })
        );
        
        // CONTENT field
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "CONTENT:", bold: true, size: 22 }),
            ],
            spacing: { after: 50 },
          })
        );
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: "[Write your devotional content here. This can span multiple paragraphs. Share the spiritual insight, application, and encouragement for the day.]", 
                italics: true, 
                size: 22, 
                color: "808080" 
              }),
            ],
            spacing: { after: 100 },
          })
        );
        
        // PRAYER field
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "PRAYER:", bold: true, size: 22 }),
            ],
            spacing: { after: 50 },
          })
        );
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: "[Write a closing prayer for this devotional. Help readers connect with God through prayer.]", 
                italics: true, 
                size: 22, 
                color: "808080" 
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });
      
      const buffer = await Packer.toBuffer(doc);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="devotional-bulk-import-template.docx"');
      res.send(Buffer.from(buffer));
      
    } catch (error) {
      console.error("Error generating devotional template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.get('/api/devotionals/today', async (req, res) => {
    try {
      const devotional = await storage.getTodaysDevotional();
      res.json(devotional);
    } catch (error) {
      console.error("Error fetching today's devotional:", error);
      res.status(500).json({ message: "Failed to fetch devotional" });
    }
  });

  app.get('/api/devotionals', async (req, res) => {
    try {
      const { limit } = req.query;
      const devotionals = await storage.getDevotionals(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(devotionals);
    } catch (error) {
      console.error("Error fetching devotionals:", error);
      res.status(500).json({ message: "Failed to fetch devotionals" });
    }
  });

  // Get saved devotionals for current user
  app.get('/api/devotionals/saved', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const saved = await storage.getSavedDevotionals(userId);
      res.json(saved);
    } catch (error) {
      console.error("Error fetching saved devotionals:", error);
      res.status(500).json({ message: "Failed to fetch saved devotionals" });
    }
  });

  // Check if a devotional is saved
  app.get('/api/devotionals/:id/saved', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isSaved = await storage.isDevotionalSaved(userId, req.params.id);
      res.json({ isSaved });
    } catch (error) {
      res.status(500).json({ message: "Failed to check saved status" });
    }
  });

  // Toggle save/unsave a devotional
  app.post('/api/devotionals/:id/save', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isSaved = await storage.toggleSaveDevotional(userId, req.params.id);
      res.json({ isSaved });
    } catch (error) {
      console.error("Error toggling devotional save:", error);
      res.status(500).json({ message: "Failed to save devotional" });
    }
  });

  // Generate shareable devotional image
  app.get('/api/devotionals/:id/share-image', async (req, res) => {
    try {
      const { id } = req.params;
      const devotional = await storage.getDevotional(id);
      
      if (!devotional) {
        return res.status(404).json({ message: "Devotional not found" });
      }

      const { createCanvas, loadImage } = await import('canvas');
      const nodePath = await import('path');

      // 1200x800 — close to reference image proportions (3:2)
      const W = 1200, H = 800;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      // === STEP 1: Draw Bible background image, cover-scaled ===
      const bgPath = nodePath.join(process.cwd(), 'client/public/devotional-bg.jpg');
      try {
        const bgImg = await loadImage(bgPath);
        // Cover-scale: fill canvas while maintaining aspect ratio
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const sw = bgImg.width * scale;
        const sh = bgImg.height * scale;
        const sx = (W - sw) / 2;
        const sy = (H - sh) / 2;
        ctx.drawImage(bgImg, sx, sy, sw, sh);
      } catch (bgErr) {
        // Fallback to dark background if image fails to load
        ctx.fillStyle = '#111110';
        ctx.fillRect(0, 0, W, H);
      }

      // === STEP 2: Subtle dark overlays so text pops without killing the image ===
      // Light global tint — just enough to ensure contrast
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(0, 0, W, H);

      // Left panel: slightly darker so gold title is very legible
      const leftDark = ctx.createLinearGradient(0, 0, W * 0.55, 0);
      leftDark.addColorStop(0,   'rgba(0,0,0,0.40)');
      leftDark.addColorStop(0.8, 'rgba(0,0,0,0)');
      ctx.fillStyle = leftDark;
      ctx.fillRect(0, 0, W, H);

      // Edge vignette for cinematic depth
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.20, W/2, H/2, H * 0.90);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.50)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // === LAYOUT ===
      const splitX = Math.round(W * 0.46);   // 46% left / 54% right
      const leftPad = 54;
      const rightPad = 80;                    // generous gap from split to verse
      const rightX = splitX + rightPad;
      const rightW = W - rightX - 40;

      // Thin gold separator line between panels
      ctx.strokeStyle = 'rgba(252,208,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, 28);
      ctx.lineTo(splitX, H - 28);
      ctx.stroke();

      // === BOTTOM LOGO BAR: dark gradient so logo always readable ===
      const barTop = H - 100;
      const barGrad = ctx.createLinearGradient(0, barTop, 0, H);
      barGrad.addColorStop(0,   'rgba(0,0,0,0)');
      barGrad.addColorStop(0.35,'rgba(0,0,0,0.72)');
      barGrad.addColorStop(1,   'rgba(0,0,0,0.88)');
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, barTop, W, H - barTop);

      // === LEFT PANEL: "DAILY DEVOTION" label + huge gold title ===
      ctx.fillStyle = '#ccccbb';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DAILY DEVOTION', leftPad, 62);
      // Gold underline
      ctx.fillStyle = '#FCD000';
      ctx.fillRect(leftPad, 70, 148, 2);

      // Auto-size the title to fill the left panel
      const titleRaw = devotional.title.toUpperCase();
      const titleAreaTop = 88;
      const titleAreaBot = H - 108;          // leave room for logo bar
      const titleMaxW = splitX - leftPad - 20;
      let tfs = 120;                          // start smaller — max 120px
      let tLines: string[] = [];
      while (tfs > 36) {
        ctx.font = `bold ${tfs}px sans-serif`;
        tLines = wrapTextSimple(ctx, titleRaw, titleMaxW);
        const needed = tLines.length * tfs * 1.08;
        const maxLineW = Math.max(...tLines.map(l => ctx.measureText(l).width));
        if (tLines.length <= 5 && needed <= (titleAreaBot - titleAreaTop) && maxLineW <= titleMaxW) break;
        tfs -= 3;
      }
      const tLH = tfs * 1.08;
      const totalTH = tLines.length * tLH;
      let ty = titleAreaTop + (titleAreaBot - titleAreaTop - totalTH) / 2 + tfs;
      ctx.fillStyle = '#FCD000';
      ctx.textAlign = 'left';
      // Hard clip so title can never bleed past the separator
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX - 4, H);
      ctx.clip();
      tLines.forEach(line => {
        ctx.fillText(line, leftPad, ty);
        ty += tLH;
      });
      ctx.restore();

      // === RIGHT PANEL: verse text + reference ===
      const verseRaw = `\u201C${devotional.verse || ''}\u201D`;
      const verseTop = 52;
      const verseBot = H - 108;             // leave room for logo bar

      let vfs = 38;
      let vLines: string[] = [];
      while (vfs > 20) {
        ctx.font = `italic ${vfs}px sans-serif`;
        vLines = wrapTextSimple(ctx, verseRaw, rightW);
        const vNeeded = vLines.length * vfs * 1.5 + vfs;
        if (vLines.length <= 9 && vNeeded <= (verseBot - verseTop)) break;
        vfs -= 2;
      }
      const vLH = vfs * 1.5;
      const refH = vfs * 0.85;
      const totalVH = vLines.length * vLH + 20 + refH;
      let vy = verseTop + (verseBot - verseTop - totalVH) / 2 + vfs;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `italic ${vfs}px sans-serif`;
      ctx.textAlign = 'left';
      vLines.forEach(line => {
        ctx.fillText(line, rightX, vy);
        vy += vLH;
      });
      vy += 20;
      ctx.fillStyle = '#FCD000';
      ctx.font = `bold ${Math.round(vfs * 0.80)}px sans-serif`;
      ctx.fillText(devotional.verseReference || '', rightX, vy);

      // === BOTTOM CENTER: Real Man Up God's Way logo ===
      const logoPath = nodePath.join(process.cwd(), 'client/public/man-up-logo.png');
      try {
        const logoImg = await loadImage(logoPath);
        // Logo raised higher to leave room for URL
        const logoH = 70;
        const logoW = Math.round(logoImg.width * (logoH / logoImg.height));
        const logoX = Math.round((W - logoW) / 2);
        const logoY = H - logoH - 34;
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        // URL in gold directly below logo
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#FCD000';
        ctx.font = 'bold 19px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('manupgodsway.org/app/', W / 2, H - 10);
        ctx.restore();
      } catch (logoErr) {
        // Fallback text if logo fails to load
        ctx.fillStyle = '#FCD000';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("MAN UP GOD'S WAY", W / 2, H - 20);
      }

      // Set response headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      const buffer = canvas.toBuffer('image/png');
      res.send(buffer);
    } catch (error) {
      console.error("Error generating share image:", error);
      res.status(500).json({ message: "Failed to generate share image" });
    }
  });
  
  // Simple text wrapping helper - handles newlines and spaces
  function wrapTextSimple(ctx: any, text: string, maxWidth: number): string[] {
    // First, normalize the text - replace newlines with spaces and collapse multiple spaces
    const normalizedText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalizedText.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Helper function to wrap text
  function wrapText(ctx: any, text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  app.post('/api/devotionals', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Transform string date to Date object before validation
      const requestData = { ...req.body };
      if (requestData.date && typeof requestData.date === 'string') {
        requestData.date = new Date(requestData.date);
      }

      const devotionalData = insertDevotionalSchema.parse(requestData);
      const devotional = await storage.createDevotional(devotionalData);

      // Send real-time notifications to all users about the new devotional
      try {
        const allUsers = await storage.getAllUsers();
        // Filter out the admin who created it
        const targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
        
        if (targetUsers.length > 0) {
          const notificationPromises = targetUsers.map(async (targetUser) => {
            return await storage.createNotificationWithPreferences({
              userId: targetUser.id,
              type: 'devotional',
              title: '📖 New Daily Devotional Available',
              message: `"${devotional.title}" is ready for your daily spiritual growth.`,
              relatedId: devotional.id,
            });
          });
          
          await Promise.all(notificationPromises.filter(Boolean));
          console.log(`Sent new devotional notifications to ${targetUsers.length} users`);
          
          // Mark notifications as sent for this devotional
          await storage.markDevotionalNotificationsSent(devotional.id);
        }
      } catch (notificationError) {
        console.error('Error sending devotional notifications:', notificationError);
        // Don't fail the devotional creation if notification fails
      }

      res.status(201).json(devotional);
    } catch (error) {
      console.error("Error creating devotional:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid devotional data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create devotional" });
    }
  });

  app.put('/api/devotionals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Transform string date to Date object before validation
      const requestData = { ...req.body };
      if (requestData.date && typeof requestData.date === 'string') {
        requestData.date = new Date(requestData.date);
      }

      const devotionalData = insertDevotionalSchema.parse(requestData);
      const devotional = await storage.updateDevotional(req.params.id, devotionalData);
      if (!devotional) {
        return res.status(404).json({ message: "Devotional not found" });
      }
      res.json(devotional);
    } catch (error) {
      console.error("Error updating devotional:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid devotional data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update devotional" });
    }
  });

  app.delete('/api/devotionals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteDevotional(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting devotional:", error);
      res.status(500).json({ message: "Failed to delete devotional" });
    }
  });

  // Upload thumbnail image for devotional
  app.post('/api/devotionals/:id/upload-thumbnail', isAuthenticated, thumbnailUpload.single('thumbnail'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const key = `thumbnails/devotional_thumbnail_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const thumbnailUrl = await uploadPublicFile(file.buffer, key, file.mimetype);
      const devotional = await storage.updateDevotional(req.params.id, {
        imageUrl: thumbnailUrl,
      });

      res.json(devotional);
    } catch (error) {
      console.error("Error uploading devotional thumbnail:", error);
      res.status(500).json({ message: "Failed to upload thumbnail" });
    }
  });

  // Delete thumbnail image for devotional
  app.delete('/api/devotionals/:id/delete-thumbnail', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const devotional = await storage.getDevotional(req.params.id);
      if (!devotional) {
        return res.status(404).json({ message: "Devotional not found" });
      }

      // Delete from Object Storage if applicable, or remove legacy disk file
      if (devotional.imageUrl) {
        if (isStorageUrl(devotional.imageUrl)) {
          await deleteStorageFile(devotional.imageUrl);
        } else if (devotional.imageUrl.startsWith('/uploads/thumbnails/')) {
          const filename = devotional.imageUrl.split('/').pop();
          if (filename) {
            const filePath = path.resolve(process.cwd(), 'uploads', 'thumbnails', filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }
      }

      // Update devotional to remove the image URL
      const updated = await storage.updateDevotional(req.params.id, {
        imageUrl: null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error deleting devotional thumbnail:", error);
      res.status(500).json({ message: "Failed to delete thumbnail" });
    }
  });

  // Bulk import devotionals (admin only)
  app.post('/api/devotionals/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { devotionals } = req.body;
      if (!Array.isArray(devotionals) || devotionals.length === 0) {
        return res.status(400).json({ message: "Devotionals array is required" });
      }

      if (devotionals.length > 30) {
        return res.status(400).json({ message: "Maximum 30 devotionals can be imported at once" });
      }

      // Validate each devotional
      const validatedDevotionals = [];
      for (let i = 0; i < devotionals.length; i++) {
        const item = devotionals[i];
        try {
          const validated = insertDevotionalSchema.parse({
            title: item.title,
            date: new Date(item.date),
            verse: item.verse,
            verseReference: item.verseReference,
            content: item.content,
          });
          validatedDevotionals.push(validated);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ 
              message: `Invalid data for devotional #${i + 1}`, 
              errors: error.errors 
            });
          }
          throw error;
        }
      }

      // Create all devotionals
      const created = [];
      for (const devotional of validatedDevotionals) {
        const result = await storage.createDevotional(devotional);
        created.push(result);
      }

      res.status(201).json({ 
        message: `Successfully created ${created.length} devotionals`,
        devotionals: created 
      });
    } catch (error) {
      console.error("Error bulk importing devotionals:", error);
      res.status(500).json({ message: "Failed to bulk import devotionals" });
    }
  });

  // Mark devotional as complete (awards rations — once per devotional per user)
  app.post('/api/devotionals/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id: devotionalId } = req.params;
      
      // Deduplication: only award if this user hasn't already completed this devotional
      const [existing] = await db
        .select({ id: schema.rationTransactions.id })
        .from(schema.rationTransactions)
        .where(and(
          eq(schema.rationTransactions.userId, userId),
          eq(schema.rationTransactions.missionType, 'devotional_complete'),
          eq(schema.rationTransactions.referenceId, devotionalId)
        ))
        .limit(1);

      if (existing) {
        // Already awarded — return success but no new rations
        return res.json({ success: true, alreadyAwarded: true, rations: { success: false, amount: 0 } });
      }

      const { rationsService } = await import('./rations-service');
      
      // Get the devotional's configured reward from DB
      const [devotional] = await db.select({ rationReward: schema.devotionals.rationReward, title: schema.devotionals.title })
        .from(schema.devotionals).where(eq(schema.devotionals.id, devotionalId));
      const devotionalReward = devotional?.rationReward || 20;
      
      const rationResult = await rationsService.awardCustomRations(
        userId, devotionalReward, 'devotional', `Completed devotional: ${devotional?.title || 'Daily Devotional'}`, 
        'devotional_complete', devotionalId, 'devotional'
      );
      
      // Update user streak
      await storage.upsertUser({ id: userId, lastActiveDate: new Date() });
      
      res.json({ 
        success: true, 
        rations: rationResult 
      });
    } catch (error) {
      console.error("Error completing devotional:", error);
      res.status(500).json({ message: "Failed to complete devotional" });
    }
  });

  // Submit devotional reflection (saves text + awards rations)
  app.post('/api/devotionals/:id/reflection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id: devotionalId } = req.params;
      const { reflection } = req.body;
      
      if (!reflection || reflection.trim().length < 50) {
        return res.status(400).json({ message: "Reflection must be at least 50 characters" });
      }
      
      // Persist the reflection text
      await storage.saveDevotionalReflection(userId, devotionalId, reflection.trim());

      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardRations(userId, 'devotional_reflection', devotionalId, 'devotional');
      
      res.json({ 
        success: true, 
        rations: rationResult 
      });
    } catch (error) {
      console.error("Error submitting devotional reflection:", error);
      res.status(500).json({ message: "Failed to submit reflection" });
    }
  });

  // Get all devotional reflections for current user
  app.get('/api/devotionals/reflections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reflections = await storage.getDevotionalReflections(userId);
      res.json(reflections);
    } catch (error) {
      console.error("Error fetching reflections:", error);
      res.status(500).json({ message: "Failed to fetch reflections" });
    }
  });

  // Get reflection for a specific devotional
  app.get('/api/devotionals/:id/reflection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reflection = await storage.getDevotionalReflection(userId, req.params.id);
      res.json(reflection || null);
    } catch (error) {
      console.error("Error fetching reflection:", error);
      res.status(500).json({ message: "Failed to fetch reflection" });
    }
  });

  // Devotional notification service management routes (admin only)
  app.get('/api/admin/devotional-notifications/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const status = devotionalNotificationService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting devotional notification service status:", error);
      res.status(500).json({ message: "Failed to get service status" });
    }
  });

  app.post('/api/admin/devotional-notifications/trigger', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await devotionalNotificationService.triggerCheck();
      res.json({ message: "Devotional notification check triggered successfully" });
    } catch (error) {
      console.error("Error triggering devotional notification check:", error);
      res.status(500).json({ message: "Failed to trigger notification check" });
    }
  });

  // Messaging routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId, userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/conversations/direct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      const conversation = await storage.getOrCreateDirectConversation(userId, targetUserId);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating direct conversation:", error);
      res.status(500).json({ message: "Failed to create direct conversation" });
    }
  });

  app.post('/api/conversations/group', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, participantIds } = req.body;
      
      if (!name || !participantIds || !Array.isArray(participantIds)) {
        return res.status(400).json({ message: "Name and participant IDs are required" });
      }

      // Check if all participants allow group invites
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          const participant = await storage.getUser(participantId);
          if (!participant?.allowGroupInvites) {
            return res.status(403).json({ 
              message: `One or more users have disabled group invites` 
            });
          }
        }
      }

      const conversationData = {
        type: "group",
        name,
        description,
        createdBy: userId,
      };

      const allParticipantIds = Array.from(new Set([userId, ...participantIds]));
      const conversation = await storage.createGroupConversation(conversationData, allParticipantIds);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating group conversation:", error);
      res.status(500).json({ message: "Failed to create group conversation" });
    }
  });

  app.get('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const { limit } = req.query;

      // TODO: Verify user is participant of conversation
      const messages = await storage.getConversationMessages(
        conversationId,
        limit ? parseInt(limit as string) : undefined,
        userId
      );
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/conversations/:id/messages', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const { content, messageType = "text" } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Get conversation details to check if it's a direct conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // For direct conversations, check if we need to restore removed participants
      if (conversation.type === 'direct') {
        const currentParticipants = conversation.participants;
        
        // If there's only 1 participant, check if we need to re-add the other
        if (currentParticipants.length === 1) {
          // Get all users who have sent messages in this conversation
          const messageSenders = await storage.getConversationMessageSenders(conversationId);
          
          // Find the missing participant (someone who sent messages but isn't currently a participant)
          const missingParticipants = messageSenders.filter((senderId: string) => 
            !currentParticipants.some((p: any) => p.userId === senderId)
          );
          
          // Re-add missing participants
          for (const missingUserId of missingParticipants) {
            try {
              await storage.addParticipantToConversation(conversationId, missingUserId, "member");
            } catch (error) {
              console.error(`Error re-adding participant ${missingUserId}:`, error);
            }
          }
        }
      }

      const messageData = {
        conversationId,
        userId,
        content,
        messageType,
      };

      const message = await storage.sendMessage(messageData);

      // @-mention fan-out within the conversation
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: message.content,
          authorId: userId,
          sourceType: 'message',
          sourceId: message.id,
          linkUrl: `/messages?conversation=${conversationId}`,
          surfaceLabel: 'a message',
          isAuthorOwner: author?.role === 'owner',
        });
      }

      // Create notifications for other participants in the conversation
      try {
        // Get updated conversation with all current participants
        const updatedConversation = await storage.getConversation(conversationId);
        if (updatedConversation) {
          const otherParticipants = updatedConversation.participants.filter((p: any) => p.userId !== userId);
          const senderUser = await storage.getUser(userId);
          
          for (const participant of otherParticipants) {
            await storage.createNotificationWithPreferences({
              userId: participant.userId,
              type: updatedConversation.type === 'direct' ? 'new_message' : 'group_message',
              title: updatedConversation.type === 'direct' ? 'New Message' : `New Group Message in ${updatedConversation.name}`,
              message: `${senderUser?.firstName || 'Someone'} sent a message`,
              relatedId: conversationId,
            });
          }
        }
      } catch (notifError) {
        console.error("Error creating notifications:", notifError);
        // Don't fail the message creation if notifications fail
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post('/api/conversations/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const { targetUserId, role = "member" } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      // TODO: Verify user has permission to add participants
      const participant = await storage.addParticipantToConversation(conversationId, targetUserId, role);
      res.status(201).json(participant);
    } catch (error) {
      console.error("Error adding participant:", error);
      res.status(500).json({ message: "Failed to add participant" });
    }
  });

  // Delete a message (user can delete their own messages)
  app.delete('/api/conversations/:id/messages/:messageId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const messageId = req.params.messageId;

      // Get the message to verify ownership
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Only message sender can delete their own message
      if (message.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      await storage.softDeleteMessage(messageId, userId);
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Delete/leave a conversation
  app.delete('/api/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const { isAdmin } = req.body;

      // Get conversation details
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some((p: any) => p.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this conversation" });
      }

      if (conversation.type === "direct") {
        // For direct messages, use soft delete approach
        // Mark conversation as deleted for this user only
        await storage.removeParticipantFromConversation(conversationId, userId);
        
        // Check if both participants have left, if so, hard delete the conversation
        const remainingParticipants = await storage.getConversationParticipants(conversationId);
        if (remainingParticipants.length === 0) {
          await storage.deleteConversation(conversationId);
        }
        
        res.json({ message: "Direct conversation deleted successfully" });
      } else if (conversation.type === "group") {
        // Check if user is admin trying to delete group
        const userProfile = await storage.getUser(userId);
        if (isAdmin && hasAdminPrivileges(userProfile)) {
          // Admin can delete entire group
          await storage.deleteConversation(conversationId);
          res.json({ message: "Group chat deleted successfully" });
        } else {
          // Regular user leaves the group
          await storage.removeParticipantFromConversation(conversationId, userId);
          res.json({ message: "Left group chat successfully" });
        }
      }
    } catch (error) {
      console.error("Error deleting/leaving conversation:", error);
      res.status(500).json({ message: "Failed to delete/leave conversation" });
    }
  });

  app.delete('/api/conversations/:id/participants/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const conversationId = req.params.id;
      const targetUserId = req.params.userId;

      // TODO: Verify user has permission to remove participants
      await storage.removeParticipantFromConversation(conversationId, targetUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({ message: "Failed to remove participant" });
    }
  });

  app.post('/api/conversations/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;

      await storage.markMessagesAsRead(conversationId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Rating routes
  app.post('/api/studies/:id/rate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studyId = req.params.id;
      const ratingData = insertStudyRatingSchema.parse({
        ...req.body,
        userId,
        studyId,
      });
      
      const rating = await storage.rateStudy(ratingData);
      res.json(rating);
    } catch (error) {
      console.error("Error rating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rating data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to rate study" });
    }
  });

  // Get study reviews
  app.get('/api/studies/:id/reviews', async (req, res) => {
    try {
      const studyId = req.params.id;
      const reviews = await storage.getStudyReviews(studyId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching study reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Delete a study rating (moderator/admin only, or own rating)
  app.delete('/api/studies/:id/ratings/:ratingId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!isModerator(user)) {
        return res.status(403).json({ message: "Moderator access required" });
      }
      const success = await storage.deleteStudyRating(req.params.ratingId);
      if (!success) return res.status(404).json({ message: "Rating not found" });
      res.json({ message: "Rating deleted" });
    } catch (error) {
      console.error("Error deleting study rating:", error);
      res.status(500).json({ message: "Failed to delete rating" });
    }
  });

  // Admin routes
  // Users endpoint for messaging (accessible to all authenticated users)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const users = await storage.getAllUsers(
        limit ? parseInt(limit as string) : undefined
      );
      
      // Return only necessary fields for messaging (no email — prevents mass email harvest)
      const publicUsers = users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        allowDirectMessages: user.allowDirectMessages,
        allowGroupInvites: user.allowGroupInvites
      }));
      
      res.json(publicUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(10000, Math.max(1, parseInt(req.query.pageSize as string) || 100));
      const sortBy = (req.query.sortBy as string) || 'newest';
      const search = (req.query.search as string) || '';
      const statusFilter = (req.query.statusFilter as string) || 'all';
      const subscriptionFilter = (req.query.subscriptionFilter as string) || null;

      const result = await storage.getAdminUsersPage({ page, pageSize, sortBy, search, statusFilter, subscriptionFilter });
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Export emails for a filtered set of users (admin only) — returns CSV
  app.get('/api/admin/users/export-emails', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const statusFilter = (req.query.statusFilter as string) || 'all';
      const subscriptionFilter = (req.query.subscriptionFilter as string) || null;
      const search = (req.query.search as string) || '';

      // Fetch all matching users (no pagination)
      const result = await storage.getAdminUsersPage({
        page: 1,
        pageSize: 100000,
        sortBy: 'newest',
        search,
        statusFilter,
        subscriptionFilter,
      });

      const rows = result.users
        .filter(u => u.email)
        .map(u => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
          const safeName = `"${(name || '').replace(/"/g, '""')}"`;
          const safeEmail = `"${(u.email || '').replace(/"/g, '""')}"`;
          return `${safeName},${safeEmail}`;
        });

      const csv = `Name,Email\n${rows.join('\n')}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user-emails.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting emails:", error);
      res.status(500).json({ message: "Failed to export emails" });
    }
  });

  // Get count of active push subscriptions for a user (admin only)
  app.get('/api/admin/users/:id/push-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.pushSubscriptions)
        .where(
          and(
            eq(schema.pushSubscriptions.userId, req.params.id),
            eq(schema.pushSubscriptions.isActive, true)
          )
        );
      const count = result[0]?.count ?? 0;
      res.json({ enabled: count > 0, deviceCount: count });
    } catch (error) {
      console.error("Error fetching push status:", error);
      res.status(500).json({ message: "Failed to fetch push status" });
    }
  });

  app.put('/api/admin/users/:id/role', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { role } = req.body;
      if (!role || !['user', 'moderator', 'admin', 'owner'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Block self-modification
      if (req.params.id === req.user.claims.sub) {
        return res.status(400).json({ message: "You cannot change your own role" });
      }

      // Only owners can assign or revoke the owner role
      if (role === 'owner' && user.role !== 'owner') {
        return res.status(403).json({ message: "Only owners can assign the owner role" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only owners can modify existing owner accounts
      if (targetUser.role === 'owner' && user.role !== 'owner') {
        return res.status(403).json({ message: "Only owners can modify owner accounts" });
      }

      // Prevent downgrading the last owner — another owner must exist first
      if (targetUser.role === 'owner' && role !== 'owner') {
        const allUsers = await storage.getAllUsers();
        const ownerCount = allUsers.filter((u: any) => u.role === 'owner').length;
        if (ownerCount <= 1) {
          return res.status(400).json({
            message: "Cannot change role: this is the last owner. Appoint another owner first."
          });
        }
      }

      const updatedUser = await storage.updateUserRole(req.params.id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.put('/api/admin/users/:id/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      let { subscriptionStatus, subscriptionTier, subscriptionExpiresAt } = req.body;

      // Accept subscriptionTier from the frontend and translate to subscriptionStatus
      if (!subscriptionStatus && subscriptionTier) {
        if (subscriptionTier === 'free') subscriptionStatus = 'expired';
        else if (subscriptionTier === 'subscriber') subscriptionStatus = 'active';
      }

      if (!subscriptionStatus || !['trial', 'active', 'expired', 'cancelled', 'past_due'].includes(subscriptionStatus)) {
        return res.status(400).json({ message: "Invalid subscription status" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData: any = { subscriptionStatus };
      if (subscriptionStatus === 'active') {
        updateData.subscriptionTier = 'subscriber';
      } else if (subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled' || subscriptionStatus === 'past_due') {
        updateData.subscriptionTier = 'expired';
      } else if (subscriptionStatus === 'trial') {
        const now = new Date();
        const trialEnd = new Date(now);
        let trialDays = 7;
        try {
          const settings = await storage.getSubscriptionSettings();
          if (settings?.trialDurationDays) trialDays = settings.trialDurationDays;
        } catch {}
        trialEnd.setDate(now.getDate() + trialDays);
        updateData.trialStartDate = now;
        updateData.trialEndDate = trialEnd;
        updateData.subscriptionTier = 'trial';
      }

      // Apply admin-supplied expiry date override (null clears it, string sets it)
      if (subscriptionExpiresAt !== undefined) {
        if (subscriptionExpiresAt === null || subscriptionExpiresAt === '') {
          updateData.subscriptionExpiresAt = null;
        } else {
          const parsed = new Date(subscriptionExpiresAt);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ message: "Invalid subscriptionExpiresAt date" });
          }
          updateData.subscriptionExpiresAt = parsed;
        }
      }

      const updatedUser = await storage.updateUserSubscriptionDetails(req.params.id, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user subscription:", error);
      res.status(500).json({ message: "Failed to update user subscription" });
    }
  });

  // Admin: query Stripe for the user's subscription and reconcile local state.
  // - active + !cancel_at_period_end → active / subscriber / expiresAt = current_period_end
  // - active +  cancel_at_period_end → cancelled / subscriber / expiresAt = current_period_end
  // - past_due / unpaid               → past_due / subscriber / expiresAt = current_period_end
  // - canceled (already ended)        → expired / free / expiresAt cleared
  app.post('/api/admin/users/:id/sync-stripe', isAuthenticated, async (req: any, res) => {
    try {
      const admin = await storage.getUser(req.user.claims.sub);
      if (!admin || !isAdmin(admin)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (!targetUser.stripeSubscriptionId) {
        return res.status(400).json({ message: "User has no Stripe subscription linked" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ message: "Stripe not configured" });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

      let sub: any;
      try {
        sub = await stripe.subscriptions.retrieve(targetUser.stripeSubscriptionId);
      } catch (err: any) {
        return res.status(400).json({ message: `Stripe lookup failed: ${err.message}` });
      }

      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined;
      const updateData: {
        subscriptionTier?: string;
        subscriptionStatus?: string;
        subscriptionExpiresAt?: Date;
      } = {};

      if (sub.status === 'active' && !sub.cancel_at_period_end) {
        updateData.subscriptionStatus = 'active';
        updateData.subscriptionTier = 'subscriber';
        if (periodEnd) updateData.subscriptionExpiresAt = periodEnd;
      } else if (sub.status === 'active' && sub.cancel_at_period_end) {
        updateData.subscriptionStatus = 'cancelled';
        updateData.subscriptionTier = 'subscriber';
        if (periodEnd) updateData.subscriptionExpiresAt = periodEnd;
      } else if (sub.status === 'trialing') {
        updateData.subscriptionStatus = 'trial';
        updateData.subscriptionTier = 'trial';
        if (periodEnd) updateData.subscriptionExpiresAt = periodEnd;
      } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
        updateData.subscriptionStatus = 'past_due';
        updateData.subscriptionTier = 'subscriber';
        if (periodEnd) updateData.subscriptionExpiresAt = periodEnd;
      } else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
        updateData.subscriptionStatus = 'expired';
        updateData.subscriptionTier = 'free';
      } else {
        updateData.subscriptionStatus = 'expired';
        updateData.subscriptionTier = 'free';
      }

      const updatedUser = await storage.updateUserSubscriptionDetails(req.params.id, updateData);

      res.json({
        message: 'Subscription state synced from Stripe',
        stripeStatus: sub.status,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
        user: updatedUser,
      });
    } catch (error: any) {
      console.error("Error syncing Stripe subscription:", error);
      res.status(500).json({ message: error.message || "Failed to sync from Stripe" });
    }
  });

  // Link an existing Stripe subscription to a user account
  app.put('/api/admin/users/:id/link-stripe-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const admin = await storage.getUser(req.user.claims.sub);
      if (!admin || !isAdmin(admin)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { stripeSubscriptionId } = req.body;
      if (!stripeSubscriptionId || !stripeSubscriptionId.startsWith('sub_')) {
        return res.status(400).json({ message: "A valid Stripe subscription ID (sub_...) is required" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ message: "Stripe not configured" });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

      // Verify the subscription exists on Stripe
      let subscription: any;
      try {
        subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      } catch (err: any) {
        return res.status(400).json({ message: `Subscription not found in Stripe: ${err.message}` });
      }

      if (subscription.status === 'canceled') {
        return res.status(400).json({ message: "That subscription is already cancelled in Stripe" });
      }

      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;

      await storage.updateUserSubscriptionDetails(targetUser.id, {
        subscriptionTier: 'subscriber',
        subscriptionStatus: 'active',
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        subscriptionExpiresAt: periodEnd ?? undefined,
      });

      console.log(`[Admin] Linked Stripe subscription ${subscription.id} to user ${targetUser.id}`);
      res.json({ success: true, stripeSubscriptionId: subscription.id, stripeCustomerId: subscription.customer });
    } catch (error: any) {
      console.error("Error linking Stripe subscription:", error);
      res.status(500).json({ message: error.message || "Failed to link subscription" });
    }
  });

  app.put('/api/admin/users/:id/ban', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { reason } = req.body;
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({ message: "Ban reason is required" });
      }

      const updatedUser = await storage.banUser(req.params.id, reason.trim());

      // Immediately destroy all active sessions for the banned user
      try {
        await db.execute(
          sql`DELETE FROM sessions WHERE sess::jsonb @> ${JSON.stringify({ passport: { user: { claims: { sub: req.params.id } } } })}::jsonb`
        );
      } catch (sessionErr) {
        console.error("Error destroying sessions for banned user:", sessionErr);
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.put('/api/admin/users/:id/unban', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updatedUser = await storage.unbanUser(req.params.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  app.put('/api/admin/users/:id/fitness-access', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { hasAccess } = req.body;
      if (typeof hasAccess !== 'boolean') {
        return res.status(400).json({ message: "hasAccess must be a boolean" });
      }
      const updatedUser = await storage.setUserFitnessAccess(req.params.id, hasAccess);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating fitness access:", error);
      res.status(500).json({ message: "Failed to update fitness access" });
    }
  });

  // Get study progress overview for a user (admin)
  app.get('/api/admin/users/:id/study-progress', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const targetUserId = req.params.id;

      // Fetch all series
      const allSeries = await db.select().from(schema.studySeries).orderBy(asc(schema.studySeries.createdAt));

      const result = await Promise.all(allSeries.map(async (series) => {
        const seriesStudies = await db.select().from(schema.studies)
          .where(and(eq(schema.studies.seriesId, series.id), eq(schema.studies.isPublished, true)))
          .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));

        const studiesWithProgress = await Promise.all(seriesStudies.map(async (study) => {
          const lessons = await db.select().from(schema.studyLessons)
            .where(eq(schema.studyLessons.studyId, study.id))
            .orderBy(asc(schema.studyLessons.displayOrder), asc(schema.studyLessons.dayNumber));

          let completedLessons = 0;
          let isStudyComplete = false;
          let lessonProgress: schema.UserLessonProgress[] = [];

          if (lessons.length === 0) {
            const [prog] = await db.select().from(schema.userProgress)
              .where(and(eq(schema.userProgress.userId, targetUserId), eq(schema.userProgress.studyId, study.id)));
            isStudyComplete = !!prog?.completedAt;
          } else {
            const lessonIds = lessons.map(l => l.id);
            lessonProgress = lessonIds.length > 0
              ? await db.select().from(schema.userLessonProgress)
                  .where(and(
                    eq(schema.userLessonProgress.userId, targetUserId),
                    inArray(schema.userLessonProgress.lessonId, lessonIds)
                  ))
              : [];
            completedLessons = lessonProgress.filter(lp => !!lp.completedAt).length;
            isStudyComplete = completedLessons >= lessons.length && lessons.length > 0;
          }

          // Build per-lesson detail for admin view (sorted so drip-lock can be computed)
          const sortedLessons = [...lessons].sort((a, b) =>
            ((a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0))
          );
          const adminTimezone = (req.query.timezone as string) || 'America/New_York';
          const progressMap = new Map(lessonProgress.map(lp => [lp.lessonId, lp]));
          const lessonDetails = sortedLessons.map((l, idx) => {
            const lp = progressMap.get(l.id);
            const isCompleted = !!lp?.completedAt;
            const dripBypassed = !!lp?.dripBypassed;
            let isLocked = false;
            let unlocksAt: string | null = null;
            if (idx > 0 && !isCompleted && !dripBypassed) {
              const prevLesson = sortedLessons[idx - 1];
              const prevProg = progressMap.get(prevLesson.id);
              if (!prevProg?.completedAt) {
                isLocked = true;
              } else {
                const unlockTime = getNextMidnightInTimezone(new Date(prevProg.completedAt), adminTimezone);
                if (new Date() < unlockTime) {
                  isLocked = true;
                  unlocksAt = unlockTime.toISOString();
                }
              }
            }
            return {
              id: l.id,
              title: l.title,
              dayNumber: l.dayNumber,
              displayOrder: l.displayOrder,
              isCompleted,
              completedAt: lp?.completedAt ?? null,
              dripBypassed,
              isLocked,
              unlocksAt,
            };
          });

          return {
            id: study.id,
            title: study.title,
            seriesOrder: study.seriesOrder,
            totalLessons: lessons.length,
            completedLessons,
            isComplete: isStudyComplete,
            lessons: lessonDetails,
          };
        }));

        return { id: series.id, title: series.title, studies: studiesWithProgress };
      }));

      // Also include standalone/topical studies (no series) under a synthetic group
      const topicalStudies = await db.select().from(schema.studies)
        .where(and(isNull(schema.studies.seriesId), eq(schema.studies.isPublished, true)))
        .orderBy(asc(schema.studies.createdAt));

      const topicalWithProgress = await Promise.all(topicalStudies.map(async (study) => {
        const lessons = await db.select().from(schema.studyLessons)
          .where(eq(schema.studyLessons.studyId, study.id))
          .orderBy(asc(schema.studyLessons.displayOrder), asc(schema.studyLessons.dayNumber));

        let completedLessons = 0;
        let isStudyComplete = false;
        let lessonProgress: schema.UserLessonProgress[] = [];

        if (lessons.length === 0) {
          const [prog] = await db.select().from(schema.userProgress)
            .where(and(eq(schema.userProgress.userId, targetUserId), eq(schema.userProgress.studyId, study.id)));
          isStudyComplete = !!prog?.completedAt;
        } else {
          const lessonIds = lessons.map(l => l.id);
          lessonProgress = lessonIds.length > 0
            ? await db.select().from(schema.userLessonProgress)
                .where(and(
                  eq(schema.userLessonProgress.userId, targetUserId),
                  inArray(schema.userLessonProgress.lessonId, lessonIds)
                ))
            : [];
          completedLessons = lessonProgress.filter(lp => !!lp.completedAt).length;
          isStudyComplete = completedLessons >= lessons.length && lessons.length > 0;
        }

        const sortedLessons = [...lessons].sort((a, b) =>
          ((a.displayOrder ?? a.dayNumber ?? 0) - (b.displayOrder ?? b.dayNumber ?? 0))
        );
        const adminTimezone = (req.query.timezone as string) || 'America/New_York';
        const progressMap = new Map(lessonProgress.map(lp => [lp.lessonId, lp]));
        const lessonDetails = sortedLessons.map((l, idx) => {
          const lp = progressMap.get(l.id);
          const isCompleted = !!lp?.completedAt;
          const dripBypassed = !!lp?.dripBypassed;
          let isLocked = false;
          let unlocksAt: string | null = null;
          if (idx > 0 && !isCompleted && !dripBypassed) {
            const prevLesson = sortedLessons[idx - 1];
            const prevProg = progressMap.get(prevLesson.id);
            if (!prevProg?.completedAt) {
              isLocked = true;
            } else {
              const unlockTime = getNextMidnightInTimezone(new Date(prevProg.completedAt), adminTimezone);
              if (new Date() < unlockTime) {
                isLocked = true;
                unlocksAt = unlockTime.toISOString();
              }
            }
          }
          return {
            id: l.id,
            title: l.title,
            dayNumber: l.dayNumber,
            displayOrder: l.displayOrder,
            isCompleted,
            completedAt: lp?.completedAt ?? null,
            dripBypassed,
            isLocked,
            unlocksAt,
          };
        });

        return {
          id: study.id,
          title: study.title,
          seriesOrder: null,
          totalLessons: lessons.length,
          completedLessons,
          isComplete: isStudyComplete,
          lessons: lessonDetails,
        };
      }));

      const seriesResult = result.filter(s => s.studies.length > 0);
      if (topicalWithProgress.length > 0) {
        seriesResult.push({ id: '__topical__', title: 'Topical Studies', studies: topicalWithProgress });
      }
      res.json(seriesResult);
    } catch (error) {
      console.error("Error fetching user study progress:", error);
      res.status(500).json({ message: "Failed to fetch study progress" });
    }
  });

  // ── Admin per-lesson controls ──────────────────────────────────────────────

  // Reset a single lesson: clear completed_at / is_completed and reset parent study progress
  app.post('/api/admin/users/:id/lessons/:lessonId/reset', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) return res.status(403).json({ message: "Admin access required" });
      const { id: targetUserId, lessonId } = req.params;

      // Clear this lesson's completion via direct UPDATE to ensure completedAt=NULL is applied
      await db.update(schema.userLessonProgress)
        .set({ isCompleted: false, completedAt: null, dripBypassed: false, updatedAt: new Date() })
        .where(and(
          eq(schema.userLessonProgress.userId, targetUserId),
          eq(schema.userLessonProgress.lessonId, lessonId)
        ));

      // Find which study owns this lesson and reset that study's user_progress
      const [lesson] = await db.select().from(schema.studyLessons).where(eq(schema.studyLessons.id, lessonId));
      if (lesson?.studyId) {
        await db.insert(schema.userProgress)
          .values({ userId: targetUserId, studyId: lesson.studyId, completedAt: null, status: 'in_progress' })
          .onConflictDoUpdate({
            target: [schema.userProgress.userId, schema.userProgress.studyId],
            set: { completedAt: null, status: 'in_progress' },
          });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting lesson:", error);
      res.status(500).json({ message: "Failed to reset lesson" });
    }
  });

  // Backfill `user_progress` for studies whose lessons are all marked
  // complete but whose study row never flipped to 'completed'. Used to
  // heal historical data from before the auto-flip logic was reliable.
  app.post('/api/admin/users/:id/fix-studies', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { id: targetUserId } = req.params;
      const result = await storage.fixUserStudyProgress(targetUserId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error fixing user study progress:", error);
      res.status(500).json({ message: "Failed to fix studies" });
    }
  });

  app.post('/api/admin/users/:id/lessons/:lessonId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) return res.status(403).json({ message: "Admin access required" });
      const { id: targetUserId, lessonId } = req.params;
      const now = new Date();

      // Mark complete AND bypass the drip gate so the lesson is accessible immediately.
      // Without dripBypassed the lesson could be isCompleted=true but still show a lock screen
      // if the previous lesson's drip window hasn't expired yet.
      await db.insert(schema.userLessonProgress)
        .values({ userId: targetUserId, lessonId, isCompleted: true, completedAt: now, dripBypassed: true })
        .onConflictDoUpdate({
          target: [schema.userLessonProgress.userId, schema.userLessonProgress.lessonId],
          set: { isCompleted: true, completedAt: now, dripBypassed: true, updatedAt: now },
        });

      // Check if all lessons in the parent study are now complete
      const [lesson] = await db.select().from(schema.studyLessons).where(eq(schema.studyLessons.id, lessonId));
      if (lesson?.studyId) {
        const allLessons = await db.select().from(schema.studyLessons).where(eq(schema.studyLessons.studyId, lesson.studyId));
        const allProgress = allLessons.length > 0
          ? await db.select().from(schema.userLessonProgress).where(
              and(eq(schema.userLessonProgress.userId, targetUserId),
                  inArray(schema.userLessonProgress.lessonId, allLessons.map(l => l.id))))
          : [];
        const allDone = allLessons.length > 0 && allProgress.filter(p => !!p.completedAt).length >= allLessons.length;
        await db.insert(schema.userProgress)
          .values({
            userId: targetUserId, studyId: lesson.studyId,
            completedAt: allDone ? now : null,
            status: allDone ? 'completed' : 'in_progress',
            isCompleted: allDone,
          })
          .onConflictDoUpdate({
            target: [schema.userProgress.userId, schema.userProgress.studyId],
            set: {
              completedAt: allDone ? now : null,
              status: allDone ? 'completed' : 'in_progress',
              isCompleted: allDone,
            },
          });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing lesson:", error);
      res.status(500).json({ message: "Failed to complete lesson" });
    }
  });

  // Unlock a single lesson by bypassing its drip gate (no other lesson is modified)
  app.post('/api/admin/users/:id/lessons/:lessonId/unlock', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) return res.status(403).json({ message: "Admin access required" });
      const { id: targetUserId, lessonId } = req.params;

      await db.insert(schema.userLessonProgress)
        .values({ userId: targetUserId, lessonId, dripBypassed: true })
        .onConflictDoUpdate({
          target: [schema.userLessonProgress.userId, schema.userLessonProgress.lessonId],
          set: { dripBypassed: true, updatedAt: new Date() },
        });
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlocking lesson:", error);
      res.status(500).json({ message: "Failed to unlock lesson" });
    }
  });

  // Re-lock a lesson that was previously bypass-unlocked (set dripBypassed back to false)
  app.post('/api/admin/users/:id/lessons/:lessonId/relock', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) return res.status(403).json({ message: "Admin access required" });
      const { id: targetUserId, lessonId } = req.params;

      await db.update(schema.userLessonProgress)
        .set({ dripBypassed: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.userLessonProgress.userId, targetUserId),
            eq(schema.userLessonProgress.lessonId, lessonId)
          )
        );
      res.json({ success: true });
    } catch (error) {
      console.error("Error relocking lesson:", error);
      res.status(500).json({ message: "Failed to relock lesson" });
    }
  });

  // Unlock Day 1 of a study by completing the previous study in the series (admin).
  // Only the previous study is marked complete — the target study is left untouched so
  // the user starts on Day 1 and continues on the normal drip schedule.
  app.post('/api/admin/users/:id/unlock-study/:studyId', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const targetUserId = req.params.id;
      const studyId = req.params.studyId; // the study to OPEN (e.g., Week 2)

      // Find the study and its series
      const [study] = await db.select().from(schema.studies).where(eq(schema.studies.id, studyId));
      if (!study || !study.seriesId) {
        return res.status(400).json({ message: "Study is not part of a series" });
      }

      // Get all published studies in the series ordered by position
      const seriesStudies = await db.select().from(schema.studies)
        .where(and(eq(schema.studies.seriesId, study.seriesId), eq(schema.studies.isPublished, true)))
        .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));

      const studyIndex = seriesStudies.findIndex(s => s.id === studyId);
      if (studyIndex <= 0) {
        return res.status(400).json({ message: "This is the first study — no previous study to complete" });
      }

      // Mark the PREVIOUS study as complete (48hrs ago so drip timers are already cleared)
      const previousStudy = seriesStudies[studyIndex - 1];
      const completedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const prevLessons = await db.select().from(schema.studyLessons)
        .where(eq(schema.studyLessons.studyId, previousStudy.id));

      if (prevLessons.length > 0) {
        for (const lesson of prevLessons) {
          await db.insert(schema.userLessonProgress)
            .values({ userId: targetUserId, lessonId: lesson.id, isCompleted: true, completedAt })
            .onConflictDoUpdate({
              target: [schema.userLessonProgress.userId, schema.userLessonProgress.lessonId],
              set: { isCompleted: true, completedAt, updatedAt: new Date() },
            });
        }
      }

      // Mark previous study-level progress as complete
      await db.insert(schema.userProgress)
        .values({ userId: targetUserId, studyId: previousStudy.id, status: 'completed', completedAt, lastAccessedAt: completedAt })
        .onConflictDoUpdate({
          target: [schema.userProgress.userId, schema.userProgress.studyId],
          set: { status: 'completed', completedAt, lastAccessedAt: completedAt },
        });

      // The target study (studyId) is intentionally left untouched —
      // Day 1 is now accessible and the drip schedule takes it from there.
      res.json({ success: true, unlockedStudyTitle: study.title, previousStudyTitle: previousStudy.title });
    } catch (error) {
      console.error("Error unlocking study:", error);
      res.status(500).json({ message: "Failed to unlock study" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await storage.getUser(req.user.claims.sub);
      if (!adminUser || !isAdmin(adminUser)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userIdToDelete = req.params.id;
      
      if (userIdToDelete === req.user.claims.sub) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const userToDelete = await storage.getUser(userIdToDelete);
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }

      if (userToDelete.role === 'owner') {
        return res.status(403).json({ message: "Cannot delete owner accounts" });
      }

      await storage.deleteUserPermanently(userIdToDelete);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/admin/52-week-leaders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const leaders = await storage.get52WeekLeaders();
      res.json(leaders);
    } catch (error) {
      console.error("Error fetching 52-week leaders:", error);
      res.status(500).json({ message: "Failed to fetch leaders" });
    }
  });

  // Public Community Stats Route
  app.get('/api/community/stats', async (req: any, res) => {
    try {
      const stats = await storage.getCommunityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching community stats:", error);
      res.status(500).json({ message: "Failed to fetch community stats" });
    }
  });

  // User profile endpoints
  app.get('/api/users/:userId/profile', async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.post('/api/users/report', isAuthenticated, async (req: any, res) => {
    try {
      const reportData = {
        ...req.body,
        reporterUserId: req.user.claims.sub,
      };

      const { reportedUserId, reason, location } = reportData;
      
      if (!reportedUserId || !reason || !location) {
        return res.status(400).json({ 
          message: "Missing required fields: reportedUserId, reason, and location" 
        });
      }

      const report = await storage.createUserReport(reportData);
      
      // Create direct message conversation with admins about the report
      try {
        const reporter = await storage.getUser(req.user.claims.sub);
        const reportedUser = await storage.getUser(reportedUserId);
        const allUsers = await storage.getAllUsers(500); // Get more users to find all admins
        const admins = allUsers.filter(user => user.role === 'admin');
        
        if (admins.length > 0) {
          const reporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Someone';
          const reportedName = reportedUser ? `${reportedUser.firstName} ${reportedUser.lastName}` : 'Unknown User';
          
          // Create group conversation with all admins for this report
          const conversationData = {
            type: "group",
            name: `Report: ${reportedName} (${location})`,
            description: `User report created by ${reporterName}`,
            createdBy: req.user.claims.sub,
          };
          
          const adminIds = admins.map(admin => admin.id);
          const allParticipantIds = Array.from(new Set([req.user.claims.sub, ...adminIds]));
          const conversation = await storage.createGroupConversation(conversationData, allParticipantIds);
          
          // Send initial message with report details (without triggering message notifications)
          const reportMessage = `🚨 **User Report Submitted**\n\n` +
            `**Reporter:** ${reporterName}\n` +
            `**Reported User:** ${reportedName}\n` +
            `**Location:** ${location}\n` +
            `**Reason:** ${reason}\n\n` +
            `Please review this report and take appropriate action.`;
            
          // Use direct database insertion to avoid triggering message notifications
          await storage.createMessageWithoutNotifications({
            conversationId: conversation.id,
            userId: req.user.claims.sub,
            content: reportMessage,
          });
          
          // Send notification to only the first admin to avoid duplicate notifications
          // Since all admins are already participants in the group conversation, 
          // they will be notified through the conversation system
          if (admins.length > 0) {
            try {
              await storage.createNotification({
                userId: admins[0].id, // Only send to first admin
                type: 'admin',
                title: '🚨 New User Report',
                message: `${reporterName} reported ${reportedName} for ${location}. Click to review the report details.`,
                relatedId: conversation.id, // This will link to the conversation
              });
              console.log(`Sent report notification to 1 admin (${admins[0].firstName || 'Unknown'})`);
            } catch (error) {
              console.error(`Failed to send notification to admin:`, error);
            }
          }
        }
      } catch (notificationError) {
        console.error('Error sending report notifications to admins:', notificationError);
        // Don't fail the report creation if notification fails
      }
      
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating user report:", error);
      res.status(500).json({ message: "Failed to create user report" });
    }
  });

  // Notification preferences endpoints
  app.get('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let preferences = await storage.getNotificationPreferences(userId);
      
      // Create default preferences if none exist
      if (!preferences) {
        await storage.createDefaultNotificationPreferences(userId);
        preferences = await storage.getNotificationPreferences(userId);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.patch('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      // Remove userId from updates to prevent modification
      delete updates.userId;
      
      const preferences = await storage.updateNotificationPreferences(userId, updates);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // User silence endpoints
  app.post('/api/users/:userId/silence', isAuthenticated, async (req: any, res) => {
    try {
      const silencerId = req.user.claims.sub;
      const silencedId = req.params.userId;
      
      if (silencerId === silencedId) {
        return res.status(400).json({ message: "Cannot silence yourself" });
      }
      
      const silence = await storage.silenceUser(silencerId, silencedId);
      res.status(201).json(silence);
    } catch (error) {
      console.error("Error silencing user:", error);
      res.status(500).json({ message: "Failed to silence user" });
    }
  });

  app.delete('/api/users/:userId/silence', isAuthenticated, async (req: any, res) => {
    try {
      const silencerId = req.user.claims.sub;
      const silencedId = req.params.userId;
      
      await storage.unsilenceUser(silencerId, silencedId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unsilencing user:", error);
      res.status(500).json({ message: "Failed to unsilence user" });
    }
  });

  app.get('/api/users/:userId/silence/status', isAuthenticated, async (req: any, res) => {
    try {
      const silencerId = req.user.claims.sub;
      const silencedId = req.params.userId;
      
      const isSilenced = await storage.isUserSilenced(silencerId, silencedId);
      res.json({ isSilenced });
    } catch (error) {
      console.error("Error checking silence status:", error);
      res.status(500).json({ message: "Failed to check silence status" });
    }
  });

  app.get('/api/users/silenced', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const silencedUserIds = await storage.getUserSilences(userId);
      res.json({ silencedUserIds });
    } catch (error) {
      console.error("Error fetching silenced users:", error);
      res.status(500).json({ message: "Failed to fetch silenced users" });
    }
  });

  // Subscription Settings API Routes
  app.get('/api/admin/subscription-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const settings = await storage.getSubscriptionSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching subscription settings:", error);
      res.status(500).json({ message: "Failed to fetch subscription settings" });
    }
  });

  app.put('/api/admin/subscription-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { monthlyPrice, yearlyPrice, trialDurationDays, features, trialContentAreas } = req.body;
      const updateData: any = {};
      if (monthlyPrice !== undefined) updateData.monthlyPrice = parseFloat(monthlyPrice).toFixed(2);
      if (yearlyPrice !== undefined) updateData.yearlyPrice = parseFloat(yearlyPrice).toFixed(2);
      if (trialDurationDays !== undefined) updateData.trialDurationDays = parseInt(trialDurationDays);
      if (features !== undefined) updateData.features = features;
      if (trialContentAreas !== undefined) updateData.trialContentAreas = trialContentAreas;
      
      const updated = await storage.updateSubscriptionSettings(updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating subscription settings:", error);
      res.status(500).json({ message: "Failed to update subscription settings" });
    }
  });

  // Get studies with trial access status (admin)
  app.get('/api/admin/studies/trial-access', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allStudies = await storage.getStudiesTrialAccess();
      res.json(allStudies);
    } catch (error) {
      console.error("Error fetching studies trial access:", error);
      res.status(500).json({ message: "Failed to fetch studies" });
    }
  });

  // Bulk update trial-accessible studies (admin)
  app.put('/api/admin/studies/trial-access', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { studyIds } = req.body;
      if (!Array.isArray(studyIds)) {
        return res.status(400).json({ message: "studyIds must be an array" });
      }
      await storage.updateStudyTrialAccess(studyIds);
      res.json({ success: true, updatedCount: studyIds.length });
    } catch (error) {
      console.error("Error updating studies trial access:", error);
      res.status(500).json({ message: "Failed to update studies trial access" });
    }
  });

  // Public subscription settings (for frontend pricing display)
  app.get('/api/subscription-settings', async (req: any, res) => {
    try {
      const settings = await storage.getSubscriptionSettings();
      if (settings) {
        res.json({
          monthlyPrice: settings.monthlyPrice,
          yearlyPrice: settings.yearlyPrice,
          trialDurationDays: settings.trialDurationDays,
          features: settings.features,
          trialContentAreas: settings.trialContentAreas || {},
        });
      } else {
        res.json({ monthlyPrice: "9.99", yearlyPrice: "99.99", trialDurationDays: 7, features: [], trialContentAreas: {} });
      }
    } catch (error) {
      console.error("Error fetching subscription settings:", error);
      res.status(500).json({ message: "Failed to fetch subscription settings" });
    }
  });

  // Legacy Tier Pricing Management API Routes (kept for backward compatibility)
  app.get('/api/admin/tier-pricing', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pricing = await storage.getTierPricing();
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching tier pricing:", error);
      res.status(500).json({ message: "Failed to fetch tier pricing" });
    }
  });

  app.put('/api/admin/tier-pricing/:tier', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { tier } = req.params;
      const { monthlyPrice, yearlyPrice, features } = req.body;

      if (!monthlyPrice || isNaN(parseFloat(monthlyPrice))) {
        return res.status(400).json({ message: "Valid monthly price is required" });
      }

      const pricingData = {
        monthlyPrice: parseFloat(monthlyPrice).toFixed(2),
        ...(yearlyPrice && { yearlyPrice: parseFloat(yearlyPrice).toFixed(2) }),
        ...(features && { features }),
      };

      const updated = await storage.updateTierPricing(tier, pricingData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tier pricing:", error);
      res.status(500).json({ message: "Failed to update tier pricing" });
    }
  });

  // Public tier pricing route for upgrade modal
  app.get('/api/tier-pricing', async (req: any, res) => {
    try {
      const pricing = await storage.getTierPricing();
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching tier pricing:", error);
      res.status(500).json({ message: "Failed to fetch tier pricing" });
    }
  });

  // Create subscription checkout session
  app.post('/api/create-subscription-checkout', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Prevent duplicate subscriptions — block if already active
      if (user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "You already have an active subscription." });
      }

      // Prevent double-subscription: a cancelled user whose Stripe sub is still
      // pending cancellation (within their paid-through window) should reactivate
      // the existing Stripe subscription instead of creating a brand new one.
      if (
        user.subscriptionStatus === 'cancelled' &&
        user.stripeSubscriptionId &&
        user.subscriptionExpiresAt &&
        new Date(user.subscriptionExpiresAt) > new Date()
      ) {
        return res.status(400).json({
          message: "Your subscription is scheduled to cancel. Please resume it instead of starting a new one.",
          code: "RESUME_REQUIRED",
        });
      }

      const { billingCycle, startTrial } = req.body;

      if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ message: "Invalid billing cycle" });
      }

      const subSettings = await storage.getSubscriptionSettings();

      // Fall back to sensible defaults when subscription settings haven't been
      // configured via the admin panel yet (mirrors the behaviour of the public
      // GET /api/subscription-settings endpoint).
      const defaults = { monthlyPrice: "9.99", yearlyPrice: "99.99", trialDurationDays: 7 };
      const effectiveSettings = subSettings ?? defaults;

      const trialDays = effectiveSettings.trialDurationDays || 7;
      const hasUsedTrial = !!(user as any).trialStartDate || (user as any).subscriptionStatus === 'active';
      const applyTrial = startTrial && !hasUsedTrial;

      const price = billingCycle === 'yearly'
        ? (effectiveSettings.yearlyPrice || effectiveSettings.monthlyPrice)
        : effectiveSettings.monthlyPrice;

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16',
      });

      const sessionParams: any = {
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: "Man Up God's Way Subscription",
                ...( ((effectiveSettings as any).features || []).length > 0
                  ? { description: ((effectiveSettings as any).features as string[]).join(', ') }
                  : {} ),
              },
              unit_amount: Math.round(parseFloat(price) * 100),
              recurring: {
                interval: billingCycle === 'yearly' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
          billingCycle: billingCycle,
          startTrial: applyTrial ? 'true' : 'false',
        },
        allow_promotion_codes: true,
        success_url: `${process.env.FRONTEND_URL || 'https://app.manupgodsway.org'}/profile?upgrade=success${applyTrial ? '&trial=true' : ''}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://app.manupgodsway.org'}/profile?upgrade=cancelled`,
      };

      sessionParams.subscription_data = {
        metadata: {
          userId: user.id,
          billingCycle: billingCycle,
        },
      };

      if (applyTrial) {
        sessionParams.subscription_data.trial_period_days = trialDays;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Verify a completed Stripe checkout session and activate the user's subscription.
  // Called from the success redirect page as a fallback in case the webhook missed the event.
  app.get('/api/subscription/verify-session', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(401).json({ message: "User not found" });

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "session_id required" });

      // Already active — nothing to do (webhook may have beaten us here)
      if (user.subscriptionStatus === 'active') {
        return res.json({ success: true, alreadyActive: true });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      // Security: make sure this session belongs to the requesting user
      if (session.metadata?.userId !== user.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return res.json({ success: false, status: session.status });
      }

      const sub = session.subscription as any;
      const billingCycle = session.metadata?.billingCycle;
      const isTrialSession = session.metadata?.startTrial === 'true' && sub?.trial_end;

      if (isTrialSession) {
        const trialEnd = new Date(sub.trial_end * 1000);
        await storage.updateUserSubscriptionDetails(user.id, {
          subscriptionTier: 'subscriber',
          subscriptionStatus: 'active',
          trialStartDate: new Date(),
          trialEndDate: trialEnd,
          subscriptionExpiresAt: trialEnd,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub?.id,
        });
      } else {
        const expirationDate = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : billingCycle === 'yearly'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await storage.updateUserSubscriptionDetails(user.id, {
          subscriptionTier: 'subscriber',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expirationDate,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub?.id,
        });
      }

      console.log(`[VerifySession] Activated subscription for user ${user.id} via session ${sessionId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[VerifySession] Error:", error.message);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });

  // Trial without Card
  app.post('/api/start-trial', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });

      const hasUsedTrial = !!(user as any).trialStartDate || 
                           (user as any).subscriptionStatus === 'active';
      if (hasUsedTrial) {
        return res.status(400).json({ message: "Trial already used" });
      }

      const subSettings = await storage.getSubscriptionSettings();
      const trialDays = subSettings?.trialDurationDays || 7;
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(now.getDate() + trialDays);

      await storage.updateUserSubscriptionDetails(user.id, {
        subscriptionStatus: 'trial',
        subscriptionTier: 'trial',
        trialStartDate: now,
        trialEndDate: trialEnd,
      });

      res.json({ success: true, trialEndDate: trialEnd.toISOString(), trialDays });
    } catch (error) {
      console.error("Error starting trial:", error);
      res.status(500).json({ message: "Failed to start trial" });
    }
  });
  
  // Check if user is eligible for a free trial
  app.get('/api/subscription/trial-eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const subSettings = await storage.getSubscriptionSettings();
      const trialDays = subSettings?.trialDurationDays || 7;
      const hasUsedTrial = !!(user as any).trialStartDate || (user as any).subscriptionStatus === 'active';
      res.json({
        eligible: !hasUsedTrial,
        trialDays,
        currentStatus: (user as any).subscriptionStatus || 'trial',
      });
    } catch (error) {
      console.error("Error checking trial eligibility:", error);
      res.status(500).json({ message: "Failed to check trial eligibility" });
    }
  });

  // Create Stripe billing portal session for subscription management
  app.post('/api/create-billing-portal', isAuthenticated, async (req: any, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ message: "Stripe not configured" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found. Please subscribe first." });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL || 'https://app.manupgodsway.org'}/profile`,
      });

      res.json({ portalUrl: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  // Get current subscription details from Stripe
  app.get('/api/subscription/details', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !user.stripeSubscriptionId) {
        return res.json({ hasSubscription: false });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ['items.data.price'],
      });

      const price = subscription.items.data[0]?.price as any;
      const interval = price?.recurring?.interval;

      res.json({
        hasSubscription: true,
        billingCycle: interval === 'year' ? 'yearly' : 'monthly',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        amount: price?.unit_amount ? price.unit_amount / 100 : null,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error('Error fetching subscription details:', error);
      res.status(500).json({ message: 'Failed to fetch subscription details' });
    }
  });

  // Reactivate a subscription that's scheduled to cancel at period end.
  // Single Stripe API call — no new subscription created, no new charge.
  app.post('/api/subscription/reactivate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ message: 'No subscription found' });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      if (!sub.cancel_at_period_end || sub.status !== 'active') {
        return res.status(400).json({
          message: 'Subscription is not eligible for reactivation. It must be active and pending cancellation.',
        });
      }

      const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      const periodEnd = new Date(updated.current_period_end * 1000);
      await storage.reactivateUserSubscription(user.id, periodEnd);

      res.json({
        message: 'Subscription reactivated',
        currentPeriodEnd: periodEnd.toISOString(),
      });
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      res.status(500).json({ message: error.message || 'Failed to reactivate subscription' });
    }
  });

  // Cancel main subscription (at period end)
  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ message: 'No active subscription found' });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await storage.cancelUserSubscription(user.id);

      res.json({
        message: 'Subscription will cancel at end of current billing period',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ message: error.message || 'Failed to cancel subscription' });
    }
  });

  // Switch subscription billing cycle (monthly ↔ yearly)
  app.post('/api/subscription/switch-billing', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ message: 'No active subscription found' });
      }

      const { newBillingCycle } = req.body;
      if (!newBillingCycle || !['monthly', 'yearly'].includes(newBillingCycle)) {
        return res.status(400).json({ message: 'newBillingCycle must be "monthly" or "yearly"' });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const [subSettings] = await db.select().from(schema.subscriptionSettings).limit(1);
      const price = newBillingCycle === 'yearly'
        ? (subSettings?.yearlyPrice || '99.99')
        : (subSettings?.monthlyPrice || '9.99');

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const currentItemId = subscription.items.data[0].id;

      const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        items: [{
          id: currentItemId,
          price_data: {
            currency: 'usd',
            product_data: { name: "Man Up God's Way Subscription" },
            unit_amount: Math.round(parseFloat(price) * 100),
            recurring: { interval: newBillingCycle === 'yearly' ? 'year' : 'month' },
          },
        }],
        proration_behavior: 'always_invoice',
      });

      const newPeriodEnd = new Date(updated.current_period_end * 1000);
      await storage.updateUserSubscriptionDetails(user.id, { subscriptionExpiresAt: newPeriodEnd });

      res.json({
        message: `Billing switched to ${newBillingCycle}`,
        billingCycle: newBillingCycle,
        currentPeriodEnd: newPeriodEnd.toISOString(),
        amount: parseFloat(price),
      });
    } catch (error: any) {
      console.error('Error switching billing cycle:', error);
      res.status(500).json({ message: error.message || 'Failed to switch billing cycle' });
    }
  });

  // NOTE: /api/stripe/webhook is registered in server/index.ts BEFORE express.json()
  // so it receives the raw body needed for Stripe signature verification.
  // See server/stripeWebhook.ts for the handler.


  // Video Management API Routes
  app.get('/api/admin/videos', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { limit } = req.query;
      const videos = await storage.getVideos(
        undefined, // category
        undefined, // requiredTier  
        undefined, // userTier
        undefined, // sortBy
        limit ? parseInt(limit as string) : undefined
      );
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get('/api/admin/videos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // Serve video files for streaming
  app.get('/api/videos/:id/stream', async (req: any, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (req.user) {
        const user = await storage.getUser(req.user.claims.sub);
        if (user) {
          const videoAccess = await canAccessContent(user, 'videos', video.isTrialAccessible ?? false);
          if (!videoAccess) {
            return res.status(403).json({ message: "Active subscription required" });
          }
        }
      }

      // GCS-stored video (new uploads)
      if (video.videoUrl && video.videoUrl.startsWith('gcs:')) {
        await streamVideoFromStorage(video.videoUrl, req.headers.range, res, video.mimeType || 'video/mp4');
        return;
      }

      // Serve the actual uploaded video file from disk (legacy)
      if (video.filename) {
        // Check for legacy disk path (old uploads before Object Storage migration)
        const videoPath = path.join(process.cwd(), 'uploads', 'videos', video.filename);
        
        if (fs.existsSync(videoPath)) {
          const stat = fs.statSync(videoPath);
          const fileSize = stat.size;
          const range = req.headers.range;

          if (range) {
            // Handle range requests for seeking/partial content
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            const head = {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': video.mimeType || 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
          } else {
            // Send entire file
            const head = {
              'Content-Length': fileSize,
              'Content-Type': video.mimeType || 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(videoPath).pipe(res);
          }
          return;
        }
      }

      // Fallback to sample video for legacy videos without files
      const streamUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
      res.redirect(streamUrl);
    } catch (error) {
      console.error("Error streaming video:", error);
      res.status(500).json({ message: "Failed to stream video" });
    }
  });

  // Create video from external URL (YouTube, Vimeo, or direct link)
  app.post('/api/admin/videos/from-url', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, videoUrl, category = 'general', requiredTier = 'free', thumbnailUrl, isTrialAccessible } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }
      if (!videoUrl || videoUrl.trim() === '') {
        return res.status(400).json({ message: "Video URL is required" });
      }

      const videoData = {
        title: title.trim(),
        description: description || '',
        videoUrl: videoUrl.trim(),
        filename: '',
        originalName: videoUrl.trim(),
        mimeType: 'video/external',
        fileSize: 0,
        thumbnailUrl: thumbnailUrl || null,
        uploadedBy: user.id,
        requiredTier,
        category,
        isTrialAccessible: isTrialAccessible === true || isTrialAccessible === 'true',
        isProcessed: true,
        processingStatus: 'completed',
      };

      const video = await storage.createVideo(videoData);
      console.log(`[Video] URL-based video created by ${user.id}: "${video.title}" (${videoUrl})`);
      res.json(video);
    } catch (error) {
      console.error("Error creating video from URL:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.post('/api/admin/videos/upload', isAuthenticated, upload.single('video'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, requiredTier = 'free', category = 'general', tags } = req.body;
      const file = req.file;
      
      // Parse tags if provided
      let parsedTags: string[] = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          // If tags is already an array or comma-separated string
          parsedTags = typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        }
      }
      
      console.log('Upload request body:', req.body);
      console.log('Upload file:', file ? { name: file.originalname, size: file.size, type: file.mimetype } : 'No file');
      
      if (!title || title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }

      if (!file) {
        return res.status(400).json({ message: "Video file is required" });
      }

      // Write buffer to temp file so ffmpeg can process it
      const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const tmpVideoFilename = `tmp_${Date.now()}_${safeOriginalName}`;
      const videoPath = path.join(tmpDir, tmpVideoFilename);
      fs.writeFileSync(videoPath, file.buffer);

      // Generate thumbnail from video using ffmpeg
      let thumbnailUrl = `https://via.placeholder.com/640x360/4A90B8/ffffff?text=${encodeURIComponent(title)}`;
      let videoDuration = Math.floor(Math.random() * 1800) + 300;
      const tmpThumbPath = path.join(tmpDir, `thumb_${Date.now()}_${safeOriginalName.replace(/\.[^.]+$/, '.jpg')}`);

      try {
        // Extract thumbnail at 1 second mark
        await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -y "${tmpThumbPath}"`);
        
        if (fs.existsSync(tmpThumbPath)) {
          const thumbBuffer = fs.readFileSync(tmpThumbPath);
          const thumbKey = `video-thumbnails/thumb_${Date.now()}_${safeOriginalName.replace(/\.[^.]+$/, '.jpg')}`;
          thumbnailUrl = await uploadPublicFile(thumbBuffer, thumbKey, 'image/jpeg');
          console.log('Generated and uploaded thumbnail:', thumbnailUrl);
        }
        
        // Try to get actual video duration using ffprobe
        try {
          const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
          const duration = parseFloat(stdout.trim());
          if (!isNaN(duration)) {
            videoDuration = Math.floor(duration);
          }
        } catch (probeError) {
          console.log('Could not get video duration, using estimate');
        }
      } catch (ffmpegError) {
        console.error('Failed to generate thumbnail:', ffmpegError);
        // Continue with placeholder thumbnail
      }

      // Upload video to Object Storage (private) and clean up temp files
      const videoKey = `videos/${tmpVideoFilename}`;
      const gcsVideoKey = await uploadPrivateFile(file.buffer, videoKey, file.mimetype);
      try {
        fs.unlinkSync(videoPath);
        if (fs.existsSync(tmpThumbPath)) fs.unlinkSync(tmpThumbPath);
      } catch {}
      
      const videoData = {
        title: title.trim(),
        description: description || '',
        filename: videoKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        duration: videoDuration,
        thumbnailUrl: thumbnailUrl,
        videoUrl: gcsVideoKey,
        uploadedBy: user.id,
        requiredTier: requiredTier,
        category: category,
        tags: parsedTags,
      };

      const video = await storage.createVideo(videoData);
      
      // Send real-time notifications to users based on tier access
      try {
        const allUsers = await storage.getAllUsers();
        let targetUsers: any[] = [];
        
        // Determine target users based on video's required tier
        switch (video.requiredTier) {
          case 'free':
            // Everyone can access free videos
            targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
            break;
          default:
            // Subscriber-only videos — notify active subscribers
            targetUsers = allUsers.filter(targetUser =>
              targetUser.id !== user.id &&
              targetUser.subscriptionStatus === 'active'
            );
            break;
        }
        
        // Send notifications to eligible users
        if (targetUsers.length > 0) {
          const notificationPromises = targetUsers.map(async (targetUser) => {
            return await storage.createNotificationWithPreferences({
              userId: targetUser.id,
              type: 'video',
              title: '🎥 New Video Available',
              message: `\"${video.title}\" has been published and is now available in the Videos section.`,
              relatedId: video.id,
            });
          });
          
          await Promise.all(notificationPromises.filter(Boolean));
          console.log(`Sent new video notifications to ${targetUsers.length} users`);
        }
      } catch (notificationError) {
        console.error('Error sending video notifications:', notificationError);
        // Don't fail the video creation if notification fails
      }
      
      // Simulate processing
      setTimeout(async () => {
        await storage.updateVideoProcessingStatus(video.id, 'completed', true);
      }, 2000);

      res.json(video);
    } catch (error) {
      console.error("Error uploading video:", error);
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum size is 100MB." });
        }
        return res.status(400).json({ message: error.message });
      }
      // Check for title conflict errors
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Generate thumbnail from video (ffmpeg for uploads, YouTube/Vimeo CDN for URL-based)
  app.post('/api/admin/videos/:id/generate-thumbnail', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const video = await storage.getVideo(req.params.id);
      if (!video) return res.status(404).json({ message: "Video not found" });

      let thumbnailUrl: string | null = null;

      // YouTube — use public YouTube CDN thumbnail (no API key needed)
      if (video.videoUrl) {
        const ytMatch = video.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch) {
          // Try maxresdefault first, fall back to hqdefault
          thumbnailUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
          await storage.updateVideo(video.id, { thumbnailUrl });
          return res.json({ thumbnailUrl });
        }

        // Vimeo — use public oEmbed API (no auth needed)
        // Match multiple Vimeo URL formats:
        // https://vimeo.com/123456789
        // https://player.vimeo.com/video/123456789
        // https://vimeo.com/channels/staff/123456789
        const vimeoMatch = video.videoUrl.match(/vimeo\.com(?:\/video)?\/(\d+)/);
        if (vimeoMatch) {
          const vimeoId = vimeoMatch[1];
          const ua = 'Mozilla/5.0 (compatible; ManUpGodsWay/1.0)';

          // Try oEmbed API first
          try {
            const oembedRes = await fetch(
              `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}&width=640`,
              { headers: { 'User-Agent': ua } }
            );
            if (oembedRes.ok) {
              const oembed = await oembedRes.json() as any;
              if (oembed.thumbnail_url) {
                thumbnailUrl = oembed.thumbnail_url;
                await storage.updateVideo(video.id, { thumbnailUrl });
                return res.json({ thumbnailUrl });
              }
            }
          } catch (oembedErr) {
            console.warn('[Vimeo] oEmbed failed, trying v2 API:', oembedErr);
          }

          // Fallback: Vimeo simple API v2
          try {
            const v2Res = await fetch(
              `https://vimeo.com/api/v2/video/${vimeoId}.json`,
              { headers: { 'User-Agent': ua } }
            );
            if (v2Res.ok) {
              const v2Data = await v2Res.json() as any[];
              const thumb = v2Data?.[0]?.thumbnail_large || v2Data?.[0]?.thumbnail_medium;
              if (thumb) {
                thumbnailUrl = thumb;
                await storage.updateVideo(video.id, { thumbnailUrl });
                return res.json({ thumbnailUrl });
              }
            }
            console.warn('[Vimeo] v2 API status:', v2Res.status);
          } catch (v2Err) {
            console.error('[Vimeo] v2 API failed:', v2Err);
          }

          return res.status(422).json({ message: "Could not fetch Vimeo thumbnail — the video may be private. Try pasting a thumbnail URL manually." });
        }

        return res.status(422).json({ message: "Auto-thumbnail is only supported for YouTube and Vimeo links. Paste a thumbnail URL manually for other video types." });
      }

      // Uploaded file — run ffmpeg to extract a frame (supports both GCS and legacy disk)
      if (!video.filename && !video.videoUrl?.startsWith('gcs:')) {
        return res.status(422).json({ message: "No video file or supported URL found to generate a thumbnail from." });
      }

      let videoPath: string;
      let usedTempFile = false;

      if (video.videoUrl && video.videoUrl.startsWith('gcs:')) {
        // Download from GCS to temp file for ffmpeg
        const { objectStorageClient } = await import('./replit_integrations/object_storage/objectStorage');
        const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || '').split(',').map((p: string) => p.trim()).filter(Boolean);
        const bucketName = paths[0]?.split('/').filter(Boolean)[0] || '';
        const objectName = video.videoUrl.slice(4);
        const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        videoPath = path.join(tmpDir, `dl_${Date.now()}_${path.basename(objectName)}`);
        await objectStorageClient.bucket(bucketName).file(objectName).download({ destination: videoPath });
        usedTempFile = true;
      } else {
        videoPath = path.join(process.cwd(), 'uploads', 'videos', video.filename!);
        if (!fs.existsSync(videoPath)) {
          return res.status(422).json({ message: "Video file not found on disk." });
        }
      }

      const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const safeBase = path.basename(videoPath).replace(/\.[^.]+$/, '.jpg');
      const tmpThumbPath = path.join(tmpDir, `thumb_${Date.now()}_${safeBase}`);

      await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -y "${tmpThumbPath}"`);

      if (!fs.existsSync(tmpThumbPath)) {
        if (usedTempFile) try { fs.unlinkSync(videoPath); } catch {}
        return res.status(500).json({ message: "ffmpeg ran but no thumbnail was produced." });
      }

      const thumbBuffer = fs.readFileSync(tmpThumbPath);
      const thumbKey = `video-thumbnails/thumb_${Date.now()}_${safeBase}`;
      thumbnailUrl = await uploadPublicFile(thumbBuffer, thumbKey, 'image/jpeg');

      // Clean up temp files
      try { fs.unlinkSync(tmpThumbPath); } catch {}
      if (usedTempFile) try { fs.unlinkSync(videoPath); } catch {}

      await storage.updateVideo(video.id, { thumbnailUrl });
      console.log(`[Video] Regenerated thumbnail for ${video.id}: ${thumbnailUrl}`);
      res.json({ thumbnailUrl });
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      res.status(500).json({ message: "Failed to generate thumbnail" });
    }
  });

  app.put('/api/admin/videos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get the current video to check if it's being processed
      const currentVideo = await storage.getVideo(req.params.id);
      const video = await storage.updateVideo(req.params.id, req.body);
      
      // Check if video is being processed/published (was unprocessed, now processed)
      const wasUnprocessed = !currentVideo?.isProcessed;
      const isBeingProcessed = req.body.isProcessed === true;
      
      if (wasUnprocessed && isBeingProcessed) {
        // Send real-time notifications to users based on tier access
        try {
          const allUsers = await storage.getAllUsers();
          let targetUsers: any[] = [];
          
          // Determine target users based on video's required tier
          switch (video.requiredTier || 'free') {
            case 'free':
              // Everyone can access free videos
              targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
              break;
            default:
              // Subscriber-only videos — notify active subscribers
              targetUsers = allUsers.filter(targetUser =>
                targetUser.id !== user.id &&
                targetUser.subscriptionStatus === 'active'
              );
              break;
          }
          
          // Send notifications to eligible users
          if (targetUsers.length > 0) {
            const notificationPromises = targetUsers.map(async (targetUser) => {
              return await storage.createNotificationWithPreferences({
                userId: targetUser.id,
                type: 'video',
                title: '🎥 New Video Available',
                message: `"${video.title}" has been published and is now available in the Videos section.`,
                relatedId: video.id,
              });
            });
            
            await Promise.all(notificationPromises.filter(Boolean));
            console.log(`Sent video processing notifications to ${targetUsers.length} users`);
          }
        } catch (notificationError) {
          console.error('Error sending video processing notifications:', notificationError);
          // Don't fail the video update if notification fails
        }
      }
      
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      // Check for title conflict errors
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete('/api/admin/videos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Clean up Object Storage files before deleting DB record
      const video = await storage.getVideo(req.params.id);
      if (video) {
        if (video.videoUrl) await deleteStorageFile(video.videoUrl);
        if (video.thumbnailUrl) await deleteStorageFile(video.thumbnailUrl);
        // Also try legacy disk files
        if (video.filename && !video.videoUrl?.startsWith('gcs:')) {
          const diskPath = path.join(process.cwd(), 'uploads', 'videos', video.filename);
          if (fs.existsSync(diskPath)) try { fs.unlinkSync(diskPath); } catch {}
        }
      }

      await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });


  // Return the current number of connected WebSocket sessions (tabs, not unique users)
  app.get('/api/admin/connected-count', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      let count = 0;
      connectedClients.forEach((sockets) => { count += sockets.size; });
      return res.json({ connectedCount: count });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Force-reload all currently connected users (all tabs)
  app.post('/api/admin/force-reload', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      let connectedCount = 0;
      connectedClients.forEach((sockets) => { connectedCount += sockets.size; });
      (app as any).broadcastToAll({ type: 'force_reload', triggeredBy: user.id });
      return res.json({ ok: true, connectedCount });
    } catch (error) {
      console.error('Error sending force-reload broadcast:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Force-reload a specific user (all their open tabs)
  app.post('/api/admin/users/:targetUserId/force-reload', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { targetUserId } = req.params;
      (app as any).sendToUser(targetUserId, { type: 'force_reload_user' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Error sending per-user force-reload:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Broadcast Notification API Route
  app.post('/api/admin/notifications/broadcast', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, message, type, targetAudience, selectedUserIds, landingPage } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      // Get all users
      const allUsers = await storage.getAllUsers();
      let targetUsers: any[] = [];

      // Filter users based on target audience
      switch (targetAudience) {
        case 'everyone':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
          break;
        case 'subscribers':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id && targetUser.subscriptionStatus === 'active');
          break;
        case 'trial':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id && targetUser.subscriptionStatus === 'trial');
          break;
        case 'expired':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id && ['expired', 'cancelled', 'past_due'].includes(targetUser.subscriptionStatus || ''));
          break;
        case 'individual':
          if (!selectedUserIds || selectedUserIds.length === 0) {
            return res.status(400).json({ message: "No users selected for individual notification" });
          }
          targetUsers = allUsers.filter(targetUser => selectedUserIds.includes(targetUser.id));
          break;
        default:
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
      }

      if (targetUsers.length === 0) {
        return res.status(400).json({ message: "No users match the selected criteria" });
      }
      
      // Create notifications for targeted users (Note: Admin notifications bypass preferences)
      const allowedLandingPages = new Set([
        '/', '/library', '/videos', '/podcasts', '/challenges', '/fitness',
        '/events', '/community', '/brothers', '/messages', '/profile', '/journal',
        '/live', '/blog', '/hurdle-wall', '/under-fire', '/war-groups', '/bible',
        '/rations', '/rations-store', '/notifications', '/subscribe', '/more-man-up',
      ]);
      const pushUrl = (landingPage && allowedLandingPages.has(landingPage)) ? landingPage : '/';
      const notificationPromises = targetUsers.map(async (targetUser) => {
        // Admin notifications are always sent (cannot be disabled)
        return await storage.createNotification({
          userId: targetUser.id,
          type: 'admin',
          title,
          message,
          relatedId: null,
        }, { pushUrl });
      });

      await Promise.all(notificationPromises.filter(Boolean));

      // Push notifications are fired automatically inside createNotification for each user
      console.log(`[Admin Broadcast] In-app + push sent to ${targetUsers.length} users`);

      let successMessage = "";
      switch (targetAudience) {
        case 'subscribers':
          successMessage = `Notification sent to ${targetUsers.length} subscriber(s) successfully`;
          break;
        case 'trial':
          successMessage = `Notification sent to ${targetUsers.length} trial user(s) successfully`;
          break;
        case 'expired':
          successMessage = `Notification sent to ${targetUsers.length} expired/cancelled user(s) successfully`;
          break;
        case 'individual':
          successMessage = `Notification sent to ${targetUsers.length} selected user(s) successfully`;
          break;
        default:
          successMessage = `Notification sent to ${targetUsers.length} user(s) successfully`;
      }

      res.json({ 
        message: successMessage,
        recipients: targetUsers.length,
        pushDelivered: targetUsers.length,
      });
    } catch (error) {
      console.error("Error broadcasting notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Clear all notifications for a user
  app.delete('/api/notifications/clear-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Delete all notifications for the user
      await storage.clearAllNotifications(userId);
      
      res.json({ message: "All notifications cleared successfully" });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ message: "Failed to clear notifications" });
    }
  });

  // Clear individual notification
  app.delete('/api/notifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = req.params.id;
      
      // Delete the specific notification for the user
      await storage.clearNotification(userId, notificationId);
      
      res.json({ message: "Notification cleared successfully" });
    } catch (error) {
      console.error("Error clearing notification:", error);
      res.status(500).json({ message: "Failed to clear notification" });
    }
  });

  // Get user notification preferences
  app.get('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getOrCreateNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  // Update user notification preferences
  app.put('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      // Validate the updates
      const validKeys = [
        'studyNotifications',
        'devotionalNotifications', 
        'discussionNotifications',
        'discussionReplyNotifications',
        'messageNotifications',
        'videoNotifications',
        'communityNotifications',
        'liveStreamNotifications',
        'warRoomNotifications',
        'underFireNotifications',
        'fitnessPlanReminderNotifications',
        'fitnessCommunityNotifications',
        'mealReminderNotifications',
        'mentionNotifications',
      ];
      
      const filteredUpdates: any = {};
      for (const key of validKeys) {
        if (key in updates && typeof updates[key] === 'boolean') {
          filteredUpdates[key] = updates[key];
        }
      }
      
      const preferences = await storage.updateNotificationPreferences(userId, filteredUpdates);
      if (!preferences) {
        // Create if doesn't exist
        await storage.createDefaultNotificationPreferences(userId);
        const newPreferences = await storage.updateNotificationPreferences(userId, filteredUpdates);
        res.json(newPreferences);
      } else {
        res.json(preferences);
      }
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Notification API Routes
  // Request direct message access
  app.post("/api/message-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { toUserId, message } = req.body;

      if (!toUserId || !message) {
        return res.status(400).json({ message: "toUserId and message are required" });
      }

      if (userId === toUserId) {
        return res.status(400).json({ message: "Cannot send message request to yourself" });
      }

      // Check if target user allows direct messages
      const targetUser = await storage.getUser(toUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!targetUser.allowDirectMessages) {
        return res.status(403).json({ message: "This user has disabled direct messages" });
      }

      // Check if conversation already exists
      const existingConversation = await storage.findDirectConversation(userId, toUserId);
      if (existingConversation) {
        return res.status(400).json({ message: "Conversation already exists" });
      }

      // Check if request already exists
      const existingRequests = await storage.getUserMessageRequests(toUserId);
      const pendingRequest = existingRequests.find(r => r.fromUserId === userId && r.status === 'pending');
      if (pendingRequest) {
        return res.status(400).json({ message: "Message request already sent" });
      }

      // Create message request
      const request = await storage.createMessageRequest({
        fromUserId: userId,
        toUserId,
        message,
      });

      // Create notification for the recipient
      const fromUser = await storage.getUser(userId);
      await storage.createNotification({
        userId: toUserId,
        type: 'message_request',
        title: 'New Message Request',
        message: `${fromUser?.firstName || 'Someone'} wants to send you a message`,
        relatedId: request.id,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating message request:", error);
      res.status(500).json({ message: "Failed to create message request" });
    }
  });

  // Get user's message requests
  app.get("/api/message-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getUserMessageRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error getting message requests:", error);
      res.status(500).json({ message: "Failed to get message requests" });
    }
  });

  // Accept or decline message request
  app.post("/api/message-requests/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requestId = req.params.id;
      const { action } = req.body; // 'accept' or 'decline'

      if (!action || !['accept', 'decline'].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const request = await storage.getMessageRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Message request not found" });
      }

      if (request.toUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to respond to this request" });
      }

      const status = action === 'accept' ? 'accepted' : 'declined';
      const updatedRequest = await storage.respondToMessageRequest(requestId, status);

      if (status === 'accepted') {
        // Create direct conversation
        const conversation = await storage.getOrCreateDirectConversation(request.fromUserId, request.toUserId);

        // Send the initial message
        await storage.sendMessage({
          conversationId: conversation.id,
          userId: request.fromUserId,
          content: request.message,
          messageType: 'text',
        });

        // Notify the sender that their request was accepted
        const toUser = await storage.getUser(request.toUserId);
        await storage.createNotificationWithPreferences({
          userId: request.fromUserId,
          type: 'new_message',
          title: 'Message Request Accepted',
          message: `${toUser?.firstName || 'Someone'} accepted your message request`,
          relatedId: conversation.id,
        });
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error responding to message request:", error);
      res.status(500).json({ message: "Failed to respond to message request" });
    }
  });

  // Get user notifications
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count: Number(count) });
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      res.status(500).json({ message: "Failed to get unread notification count" });
    }
  });

  // Feedback route
  app.post('/api/feedback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validatedData = feedbackSchema.parse(req.body);

      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
      const userEmail = user?.email ?? 'unknown@unknown.com';

      await sendFeedbackEmail(validatedData.feedback, validatedData.category, userEmail, userName);
      
      res.json({ message: "Feedback sent successfully" });
    } catch (error) {
      console.error("Error sending feedback:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid feedback data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to send feedback" });
    }
  });

  app.post('/api/help-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
      const userEmail = user?.email ?? 'unknown@unknown.com';

      await sendHelpRequestEmail(message.trim(), userEmail, userName);

      res.json({ message: "Help request sent successfully" });
    } catch (error) {
      console.error("Error sending help request:", error);
      res.status(500).json({ message: "Failed to send help request" });
    }
  });

  // Public video routes (for users)
  app.get('/api/videos', async (req: any, res) => {
    try {
      const { category, sortBy, limit } = req.query;
      
      const videos = await storage.getVideos(
        category as string,
        undefined,
        undefined,
        sortBy as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Get video reviews
  app.get('/api/videos/:id/reviews', async (req, res) => {
    try {
      const reviews = await storage.getVideoReviews(req.params.id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching video reviews:", error);
      res.status(500).json({ message: "Failed to fetch video reviews" });
    }
  });

  // Delete a video rating (moderator/admin only)
  app.delete('/api/videos/:id/ratings/:ratingId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!isModerator(user)) {
        return res.status(403).json({ message: "Moderator access required" });
      }
      const success = await storage.deleteVideoRating(req.params.ratingId);
      if (!success) return res.status(404).json({ message: "Rating not found" });
      res.json({ message: "Rating deleted" });
    } catch (error) {
      console.error("Error deleting video rating:", error);
      res.status(500).json({ message: "Failed to delete rating" });
    }
  });

  // Rate a video
  app.post('/api/videos/:id/rate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;
      const ratingData = insertVideoRatingSchema.parse({
        ...req.body,
        userId,
        videoId,
      });

      const rating = await storage.rateVideo(ratingData);
      res.json(rating);
    } catch (error) {
      console.error("Error rating video:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rating data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to rate video" });
    }
  });

  // Profile setup for new users
  app.post("/api/profile/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, allowDirectMessages, allowGroupInvites, isProfileComplete } = req.body;

      const updatedUser = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        allowDirectMessages,
        allowGroupInvites,
        isProfileComplete,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error setting up profile:", error);
      res.status(500).json({ message: "Failed to set up profile" });
    }
  });

  // Update user profile
  app.put("/api/profile/update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, allowDirectMessages, allowGroupInvites, isProfilePrivate } = req.body;

      const updatedUser = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        allowDirectMessages,
        allowGroupInvites,
        isProfilePrivate,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload profile picture
  app.post('/api/profile/upload-picture', isAuthenticated, imageUpload.single('profilePicture'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (!req.file) {
        return res.status(400).json({ message: 'Profile picture file is required' });
      }

      // Convert uploaded file to base64 data URL
      const base64Data = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

      // Update user's profileImageUrl
      const updatedUser = await storage.updateUserProfile(userId, {
        profileImageUrl: dataUrl,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // Delete profile picture
  app.delete('/api/profile/delete-picture', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Clear user's profileImageUrl
      const updatedUser = await storage.updateUserProfile(userId, {
        profileImageUrl: null,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      res.status(500).json({ message: "Failed to delete profile picture" });
    }
  });

  // Mark welcome intro as seen
  app.post('/api/user/welcome-seen', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updatedUser = await storage.updateUserProfile(userId, {
        hasSeenWelcome: true,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking welcome as seen:", error);
      res.status(500).json({ message: "Failed to update welcome status" });
    }
  });

  // Logo settings routes
  // Get current logo settings
  app.get('/api/logo', async (req, res) => {
    try {
      const logoSettings = await storage.getLogoSettings();
      res.json(logoSettings);
    } catch (error) {
      console.error("Error fetching logo settings:", error);
      res.status(500).json({ message: "Failed to fetch logo settings" });
    }
  });

  // Upload/update logo (admin only)
  app.post('/api/admin/logo', isAuthenticated, imageUpload.single('logo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Logo file is required' });
      }

      // Convert uploaded file to base64 data URL
      const base64Data = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

      const { splashDurationMs, backgroundColor } = req.body;
      
      const logoSettingsData = insertLogoSettingsSchema.parse({
        logoUrl: dataUrl,
        splashDurationMs: splashDurationMs ? parseInt(splashDurationMs) : 3000,
        backgroundColor: backgroundColor || 'white',
        isEnabled: true,
        uploadedBy: userId
      });

      const logoSettings = await storage.updateLogoSettings(logoSettingsData);
      res.json(logoSettings);
    } catch (error) {
      console.error("Error uploading logo:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid logo data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Get current header logo settings
  app.get('/api/header-logo', async (req, res) => {
    try {
      const headerLogoSettings = await storage.getHeaderLogoSettings();
      res.json(headerLogoSettings);
    } catch (error) {
      console.error("Error fetching header logo settings:", error);
      res.status(500).json({ message: "Failed to fetch header logo settings" });
    }
  });

  // Upload/update header logo (admin only)
  app.post('/api/admin/header-logo', isAuthenticated, imageUpload.single('logo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Header logo file is required' });
      }

      // Convert uploaded file to base64 data URL
      const base64Data = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;
      
      const headerLogoSettingsData = insertHeaderLogoSettingsSchema.parse({
        logoUrl: dataUrl,
        isEnabled: true,
        uploadedBy: userId
      });

      const headerLogoSettings = await storage.updateHeaderLogoSettings(headerLogoSettingsData);
      res.json(headerLogoSettings);
    } catch (error) {
      console.error("Error uploading header logo:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid header logo data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to upload header logo" });
    }
  });

  // Delete header logo (admin only)
  app.delete('/api/admin/header-logo', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      await storage.deleteHeaderLogoSettings();
      res.json({ message: "Header logo deleted successfully" });
    } catch (error) {
      console.error("Error deleting header logo:", error);
      res.status(500).json({ message: "Failed to delete header logo" });
    }
  });

  // Update logo settings without uploading new file (admin only)
  app.patch('/api/admin/logo', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { splashDurationMs, backgroundColor, isEnabled } = req.body;
      
      // Validate input
      if (splashDurationMs && (splashDurationMs < 1000 || splashDurationMs > 10000)) {
        return res.status(400).json({ message: "Duration must be between 1 and 10 seconds" });
      }

      const validColors = ['ministry-gold', 'black', 'white', 'steel', 'slate', 'charcoal', 'gold', 'light-gray'];
      if (backgroundColor && !validColors.includes(backgroundColor)) {
        return res.status(400).json({ message: "Invalid background color" });
      }

      // Get current settings
      const currentSettings = await storage.getLogoSettings();
      if (!currentSettings) {
        return res.status(404).json({ message: "No logo settings found to update" });
      }

      // Update only the provided fields
      const updateData: any = {};
      if (splashDurationMs !== undefined) updateData.splashDurationMs = parseInt(splashDurationMs);
      if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
      if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

      const updatedSettings = await storage.updateLogoSettingsPartial(updateData);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating logo settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update logo settings" });
    }
  });

  // Get system settings
  app.get('/api/system-settings', async (req, res) => {
    try {
      const systemSettings = await storage.getSystemSettings();
      res.json(systemSettings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // Update system settings (admin only)
  app.put('/api/system-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const systemSettingsData = insertSystemSettingsSchema.parse({
        ...req.body,
        updatedBy: user.id
      });
      
      const settings = await storage.updateSystemSettings(systemSettingsData);
      res.json(settings);
    } catch (error) {
      console.error("Error updating system settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid system settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  // Podcast Routes
  // Get all podcasts with filtering and sorting
  app.get('/api/podcasts', async (req, res) => {
    try {
      const { search, category, sort } = req.query;
      const podcasts = await storage.getPodcasts({
        search: search as string,
        category: category as string,
        sort: sort as string
      });
      res.json(podcasts);
    } catch (error) {
      console.error('Error fetching podcasts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get podcast by ID
  app.get('/api/podcasts/:id', async (req, res) => {
    try {
      const podcast = await storage.getPodcastById(req.params.id);
      if (!podcast) {
        return res.status(404).json({ message: 'Podcast not found' });
      }
      res.json(podcast);
    } catch (error) {
      console.error('Error fetching podcast:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create new podcast (admin only)
  app.post('/api/podcasts', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const podcastData = insertPodcastSchema.parse({
        ...req.body,
        uploadedBy: user.id
      });
      
      const podcast = await storage.createPodcast(podcastData);
      res.status(201).json(podcast);
    } catch (error) {
      console.error('Error creating podcast:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid podcast data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update podcast (admin only)
  app.put('/api/podcasts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const updates = req.body;
      const podcast = await storage.updatePodcast(req.params.id, updates);
      res.json(podcast);
    } catch (error) {
      console.error('Error updating podcast:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete podcast (admin only)
  app.delete('/api/podcasts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      await storage.deletePodcast(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting podcast:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Rate podcast
  app.post('/api/podcasts/:id/rate', isAuthenticated, async (req: any, res) => {
    try {
      const { rating, review } = req.body;
      
      const podcastRating = await storage.ratePodcast(
        req.user.claims.sub,
        req.params.id,
        { rating: parseInt(rating), review }
      );
      
      res.json(podcastRating);
    } catch (error) {
      console.error('Error rating podcast:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rating data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get podcast ratings
  app.get('/api/podcasts/:id/ratings', async (req, res) => {
    try {
      const ratings = await storage.getPodcastRatings(req.params.id);
      res.json(ratings);
    } catch (error) {
      console.error('Error fetching podcast ratings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete a podcast rating (moderator/admin only)
  app.delete('/api/podcasts/:id/ratings/:ratingId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!isModerator(user)) {
        return res.status(403).json({ message: "Moderator access required" });
      }
      const success = await storage.deletePodcastRating(req.params.ratingId);
      if (!success) return res.status(404).json({ message: "Rating not found" });
      res.json({ message: "Rating deleted" });
    } catch (error) {
      console.error("Error deleting podcast rating:", error);
      res.status(500).json({ message: "Failed to delete rating" });
    }
  });

  // Track podcast view
  app.post('/api/podcasts/:id/view', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      await storage.incrementPodcastViews(req.params.id, userId, ipAddress);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking podcast view:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin podcast routes
  app.get('/api/admin/podcasts', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Get all podcasts including unpublished ones
      const podcasts = await storage.getAllPodcasts();
      res.json(podcasts);
    } catch (error) {
      console.error('Error fetching admin podcasts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Import podcasts from RSS feed (admin only)
  app.post('/api/admin/podcasts/import-rss', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { feedUrl } = req.body;
      if (!feedUrl) {
        return res.status(400).json({ message: "RSS feed URL is required" });
      }

      const parser = new Parser({
        customFields: {
          item: [
            ['itunes:duration', 'duration'],
            ['itunes:image', 'image'],
            ['enclosure', 'enclosure']
          ]
        }
      });

      const feed = await parser.parseURL(feedUrl);
      const importedPodcasts = [];
      const skippedPodcasts = [];

      // Fetch existing podcasts once before the loop for efficiency
      const existingPodcasts = await storage.getAllPodcasts();
      const existingTitles = new Set(existingPodcasts.map((p: any) => p.title?.toLowerCase().trim()));

      // Helper function to extract episode number from title
      const extractEpisodeNumber = (title: string): number | null => {
        if (!title) return null;
        // Match patterns like "Episode 123", "Ep 123", "Ep. 123", "#123", "E123"
        const patterns = [
          /episode\s*#?\s*(\d+)/i,
          /ep\.?\s*#?\s*(\d+)/i,
          /e(\d+)/i,
          /#(\d+)/,
          /^(\d+)\s*[-:.]/,
          /[-:.\s](\d+)$/
        ];
        for (const pattern of patterns) {
          const match = title.match(pattern);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return null;
      };

      for (const item of feed.items) {
        try {
          const itemTitle = item.title?.toLowerCase().trim();
          
          // Check if podcast already exists by title to avoid duplicates
          if (existingTitles.has(itemTitle)) {
            skippedPodcasts.push({ title: item.title, reason: 'Already exists' });
            continue;
          }

          // Parse duration from iTunes format (HH:MM:SS or MM:SS or seconds)
          let durationInSeconds = 0;
          if (item.duration) {
            const parts = item.duration.split(':').map(Number);
            if (parts.length === 3) {
              durationInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
              durationInSeconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
              durationInSeconds = parts[0];
            }
          }

          // Get audio URL from enclosure
          const audioUrl = item.enclosure?.url || item.link || '';
          const thumbnailUrl = item.image?.href || item.itunes?.image || feed.image?.url || '';
          
          // Extract episode number from title
          const episodeNumber = extractEpisodeNumber(item.title || '');

          const podcastData = {
            title: item.title || 'Untitled Podcast',
            description: item.contentSnippet || item.content || '',
            type: 'audio' as const,
            fileUrl: audioUrl,
            thumbnailUrl: thumbnailUrl,
            duration: durationInSeconds,
            category: 'general',
            tags: item.categories || [],
            isPublished: true,
            uploadedBy: user.id,
            episodeNumber: episodeNumber
          };

          const podcast = await storage.createPodcast(podcastData);
          importedPodcasts.push(podcast);
          
          // Add to existing titles set to prevent duplicates within same import batch
          existingTitles.add(itemTitle);
        } catch (error) {
          console.error('Error importing podcast:', item.title, error);
          skippedPodcasts.push({ 
            title: item.title || 'Unknown', 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({
        success: true,
        imported: importedPodcasts.length,
        skipped: skippedPodcasts.length,
        details: {
          importedPodcasts: importedPodcasts.map(p => ({ id: p.id, title: p.title })),
          skippedPodcasts
        }
      });
    } catch (error) {
      console.error('Error importing RSS feed:', error);
      res.status(500).json({ 
        message: 'Failed to import RSS feed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create new live session (creates new podcast entry)
  app.post('/api/admin/live-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, category, type, liveUrl, scheduledDate } = req.body;
      
      if (!title || !liveUrl) {
        return res.status(400).json({ message: "Title and live stream URL are required" });
      }

      const liveSession = await storage.createLiveSession({
        title,
        description: description || '',
        category: category || 'general',
        type: type || 'video',
        liveUrl,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        uploadedBy: user.id
      });

      await storage.notifyLiveStreamStart(liveSession.id);
      res.json(liveSession);
    } catch (error) {
      console.error("Error creating live session:", error);
      res.status(500).json({ message: "Failed to create live session" });
    }
  });

  // Live streaming routes
  app.post('/api/admin/livestream/start/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { liveUrl } = req.body;
      if (!liveUrl) {
        return res.status(400).json({ message: "Live stream URL is required" });
      }

      const podcast = await storage.startLiveStream(req.params.id, liveUrl);
      await storage.notifyLiveStreamStart(req.params.id);
      res.json(podcast);
    } catch (error) {
      console.error("Error starting live stream:", error);
      res.status(500).json({ message: "Failed to start live stream" });
    }
  });

  app.post('/api/admin/livestream/end/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const podcast = await storage.endLiveStream(req.params.id);
      res.json(podcast);
    } catch (error) {
      console.error("Error ending live stream:", error);
      res.status(500).json({ message: "Failed to end live stream" });
    }
  });

  app.get('/api/livestreams', async (req, res) => {
    try {
      const liveStreams = await storage.getLiveStreams();
      res.json(liveStreams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  // Challenge routes
  app.get('/api/challenges', async (req: any, res) => {
    try {
      // Get userId if authenticated (optional)
      let userId: string | null = null;
      if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      }
      
      // Return challenges with unlock status for progressive drip
      const challenges = await storage.getChallengesWithUnlockStatus(userId);
      res.json(challenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/challenges/current', async (req, res) => {
    try {
      const challenge = await storage.getCurrentWeekChallenge();
      res.json(challenge);
    } catch (error) {
      console.error('Error fetching current challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin/challenges', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const challenges = await storage.getChallenges();
      res.json(challenges);
    } catch (error) {
      console.error('Error fetching admin challenges:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Bulk import challenges (admin only)
  app.post('/api/admin/challenges/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { challenges: challengeList } = req.body;
      if (!Array.isArray(challengeList) || challengeList.length === 0) {
        return res.status(400).json({ message: "No challenges provided" });
      }
      if (challengeList.length > 52) {
        return res.status(400).json({ message: "Maximum 52 challenges per bulk import" });
      }

      const validTopics = ['leadership', 'marriage', 'fatherhood', 'character', 'faith', 'discipline', 'service', 'growth'];
      const created = [];
      for (const ch of challengeList) {
        if (!ch.title?.trim()) continue;
        const challenge = await storage.createChallenge({
          title: ch.title.trim(),
          description: ch.description?.trim() || null,
          topic: validTopics.includes(ch.topic) ? ch.topic : 'faith',
          releaseDate: new Date(ch.releaseDate),
          durationDays: ch.durationDays || 7,
          rationReward: ch.rationReward || 25,
          completionReward: ch.completionReward || 75,
        });
        created.push(challenge);
      }

      res.json({ created: created.length, challenges: created });
    } catch (error) {
      console.error('Error bulk importing challenges:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/challenges', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const challenge = await storage.createChallenge(req.body);
      res.json(challenge);
    } catch (error) {
      console.error('Error creating challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/challenges/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const challenge = await storage.updateChallenge(req.params.id, req.body);
      res.json(challenge);
    } catch (error) {
      console.error('Error updating challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/challenges/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteChallenge(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/challenges/:id/push-to-current', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const challenge = await storage.pushChallengeToCurrentWeek(req.params.id);
      
      // Send notifications to all users about the new challenge
      try {
        const allUsers = await storage.getAllUsers();
        const notificationPromises = allUsers.map(async (targetUser) => {
          if (targetUser.id === user.id) return null; // Skip the admin who posted
          return await storage.createNotificationWithPreferences({
            userId: targetUser.id,
            type: 'challenge',
            title: 'New Weekly Challenge',
            message: `A new challenge is available: ${challenge.title}`,
            data: { challengeId: challenge.id },
          });
        });
        await Promise.allSettled(notificationPromises);
        console.log(`Sent challenge notifications to ${allUsers.length - 1} users`);
        
        // Broadcast real-time update to all connected users
        if ((app as any).broadcastToAll) {
          (app as any).broadcastToAll({
            type: 'new_challenge',
            challenge: challenge,
          });
        }
      } catch (notificationError) {
        console.error('Error sending challenge notifications:', notificationError);
        // Don't fail the challenge push if notifications fail
      }
      
      res.json(challenge);
    } catch (error) {
      console.error('Error pushing challenge to current week:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Challenge participation routes
  app.post('/api/challenges/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      // Check if already accepted
      const alreadyAccepted = await storage.hasUserAcceptedChallenge(userId, challengeId);
      if (alreadyAccepted) {
        return res.status(400).json({ message: 'Challenge already accepted' });
      }
      
      const participant = await storage.acceptChallenge(userId, challengeId);
      
      // Award rations for accepting the challenge (use DB configured reward)
      const { rationsService } = await import('./rations-service');
      const [challenge] = await db.select({ rationReward: schema.challenges.rationReward, title: schema.challenges.title })
        .from(schema.challenges).where(eq(schema.challenges.id, challengeId));
      const challengeReward = challenge?.rationReward || 25;
      
      const rationResult = await rationsService.awardCustomRations(
        userId, challengeReward, 'challenge', `Accepted challenge: ${challenge?.title || 'Weekly Challenge'}`, 
        'challenge_accept', challengeId, 'challenge'
      );
      
      res.json({ ...participant, rations: rationResult });
    } catch (error) {
      console.error('Error accepting challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Complete weekly challenge (awards rations) - honor system
  app.post('/api/challenges/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      // Verify user has accepted the challenge
      const hasAccepted = await storage.hasUserAcceptedChallenge(userId, challengeId);
      if (!hasAccepted) {
        return res.status(400).json({ message: 'Must accept challenge first' });
      }
      
      // Check if already completed
      const participation = await storage.getChallengeParticipation(userId, challengeId);
      if (participation?.completedAt) {
        return res.status(400).json({ message: 'Challenge already completed' });
      }
      
      // Mark as completed in database
      await storage.completeChallenge(userId, challengeId);
      
      const { rationsService } = await import('./rations-service');
      
      // Award completion reward from the challenge settings
      const [challenge] = await db.select({ 
        completionReward: schema.challenges.completionReward, 
        title: schema.challenges.title 
      }).from(schema.challenges).where(eq(schema.challenges.id, challengeId));
      const completionReward = challenge?.completionReward || 75;
      
      const rationResult = await rationsService.awardCustomRations(
        userId, completionReward, 'challenge', `Completed challenge: ${challenge?.title || 'Weekly Challenge'}`, 
        'challenge_complete', challengeId, 'challenge'
      );
      
      res.json({ success: true, rations: rationResult });
    } catch (error) {
      console.error('Error completing challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Regroup from challenge (user didn't complete but acknowledges and will try next time)
  app.post('/api/challenges/:id/regroup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      // Verify user has accepted the challenge
      const hasAccepted = await storage.hasUserAcceptedChallenge(userId, challengeId);
      if (!hasAccepted) {
        return res.status(400).json({ message: 'Must accept challenge first' });
      }
      
      // Check if already completed or regrouped
      const participation = await storage.getChallengeParticipation(userId, challengeId);
      if (participation?.completedAt) {
        return res.status(400).json({ message: 'Challenge already completed' });
      }
      if (participation?.regroupedAt) {
        return res.status(400).json({ message: 'Already regrouped from this challenge' });
      }
      
      // Mark as regrouped in database
      await db.update(schema.challengeParticipants)
        .set({ regroupedAt: new Date() })
        .where(
          and(
            eq(schema.challengeParticipants.userId, userId),
            eq(schema.challengeParticipants.challengeId, challengeId)
          )
        );
      
      res.json({ success: true, message: 'Keep your head up, soldier! The next challenge awaits.' });
    } catch (error) {
      console.error('Error regrouping from challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get user's daily check-ins for a challenge
  app.get('/api/challenges/:id/checkins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      const checkins = await storage.getDailyChallengeCheckins(userId, challengeId);
      res.json(checkins);
    } catch (error) {
      console.error('Error fetching challenge checkins:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Submit a daily check-in for a challenge
  app.post('/api/challenges/:id/checkin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      const { dayNumber } = req.body;

      if (!dayNumber || dayNumber < 1 || dayNumber > 7) {
        return res.status(400).json({ message: 'dayNumber must be between 1 and 7' });
      }

      const challenge = await storage.getChallenge(challengeId);
      if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

      // Auto-accept challenge if not yet accepted
      const hasAccepted = await storage.hasUserAcceptedChallenge(userId, challengeId);
      if (!hasAccepted) {
        await storage.acceptChallenge(userId, challengeId);
        const { rationsService } = await import('./rations-service');
        await rationsService.awardCustomRations(
          userId, challenge.rationReward || 25, 'challenge',
          `Joined challenge: ${challenge.title}`, 'challenge_join', challengeId, 'challenge'
        );
      }

      // Check if already checked in for this day
      const alreadyCheckedIn = await storage.hasDailyCheckin(userId, challengeId, dayNumber);
      if (alreadyCheckedIn) {
        return res.status(400).json({ message: 'Already checked in for this day' });
      }

      const checkin = await storage.addDailyChallengeCheckin(userId, challengeId, dayNumber);

      // Get total checkins to see if all 7 are done
      const allCheckins = await storage.getDailyChallengeCheckins(userId, challengeId);
      let completionResult = null;

      if (allCheckins.length >= 7) {
        // Check if not already completed
        const participation = await storage.getChallengeParticipation(userId, challengeId);
        if (!participation?.completedAt) {
          await storage.completeChallenge(userId, challengeId);
          const { rationsService } = await import('./rations-service');
          const completionReward = challenge.completionReward || 200;
          completionResult = await rationsService.awardCustomRations(
            userId, completionReward, 'challenge',
            `Completed 7-day challenge: ${challenge.title}`, 'challenge_complete', challengeId, 'challenge'
          );
        }
      } else {
        // Award daily check-in rations (30 per day, days 1-6)
        const { rationsService } = await import('./rations-service');
        await rationsService.awardCustomRations(
          userId, 30, 'challenge',
          `Day ${dayNumber} check-in: ${challenge.title}`, 'challenge_daily', challengeId, 'challenge'
        );
      }

      res.json({ checkin, totalCheckins: allCheckins.length, completed: allCheckins.length >= 7, completionResult });
    } catch (error) {
      console.error('Error submitting challenge checkin:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user's challenge status (accepted, completed, deadline)
  app.get('/api/challenges/:id/user-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      const participation = await storage.getChallengeParticipation(userId, challengeId);
      const challenge = await storage.getChallenge(challengeId);
      
      if (!participation) {
        return res.json({ hasAccepted: false, hasCompleted: false });
      }
      
      // Calculate deadline based on acceptedAt + durationDays
      const durationDays = challenge?.durationDays || 7;
      const acceptedAt = new Date(participation.acceptedAt!);
      const deadline = new Date(acceptedAt);
      deadline.setDate(deadline.getDate() + durationDays);
      
      res.json({
        hasAccepted: true,
        hasCompleted: !!participation.completedAt,
        acceptedAt: participation.acceptedAt,
        completedAt: participation.completedAt,
        deadline: deadline.toISOString(),
        isExpired: new Date() > deadline
      });
    } catch (error) {
      console.error('Error getting challenge status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/challenges/:id/participant-count', async (req, res) => {
    try {
      const challengeId = req.params.id;
      const count = await storage.getChallengeParticipantCount(challengeId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting participant count:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/challenges/:id/user-accepted', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const challengeId = req.params.id;
      
      const participation = await storage.getChallengeParticipation(userId, challengeId);
      res.json({ 
        hasAccepted: !!participation,
        hasCompleted: !!participation?.completedAt,
        hasRegrouped: !!participation?.regroupedAt
      });
    } catch (error) {
      console.error('Error checking if user accepted challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Content Flagging Routes
  
  // Flag content (discussion or reply)
  app.post('/api/content/flag', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertContentFlagSchema.parse({
        ...req.body,
        reporterId: userId
      });

      const flag = await storage.flagContent(validatedData);
      
      // Send notification to all admins
      await storage.notifyAdminsOfFlag(flag);
      
      res.json(flag);
    } catch (error) {
      console.error('Error flagging content:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all flags (admin only)
  app.get('/api/admin/flags', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const flags = await storage.getAllFlags();
      res.json(flags);
    } catch (error) {
      console.error('Error fetching flags:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update flag status (admin only)
  app.patch('/api/admin/flags/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { status, reviewNotes } = req.body;
      const VALID_STATUSES = ['pending', 'in_review', 'completed'];
      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      const updateData: { status: string; reviewNotes?: string; reviewedBy?: string; reviewedAt?: Date } = { status, reviewNotes };
      // Only stamp reviewer info when marking complete
      if (status === 'completed') {
        updateData.reviewedBy = user.id;
        updateData.reviewedAt = new Date();
      }
      const flag = await storage.updateFlagStatus(req.params.id, updateData);
      
      res.json(flag);
    } catch (error) {
      console.error('Error updating flag:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Testimony Routes
  
  // Get user's own testimony
  app.get('/api/testimony', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const testimony = await storage.getUserTestimony(userId);
      res.json(testimony);
    } catch (error) {
      console.error('Error fetching testimony:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get another user's testimony (only if public)
  app.get('/api/testimony/:userId', async (req, res) => {
    try {
      const testimony = await storage.getUserTestimony(req.params.userId);
      if (!testimony || !testimony.isPublic) {
        return res.status(404).json({ message: 'Testimony not found or private' });
      }
      res.json(testimony);
    } catch (error) {
      console.error('Error fetching public testimony:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create or update user's testimony
  app.post('/api/testimony', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertTestimonySchema.parse({
        ...req.body,
        userId
      });

      const testimony = await storage.upsertTestimony(validatedData);
      res.json(testimony);
    } catch (error) {
      console.error('Error creating/updating testimony:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete user's testimony
  app.delete('/api/testimony', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteTestimony(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting testimony:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Discipleship Routes - Tag-based user discovery
  
  // Get all unique testimony tags with counts
  app.get('/api/testimony-tags', async (req, res) => {
    try {
      const tags = await storage.getAllTestimonyTags();
      res.json(tags);
    } catch (error) {
      console.error('Error fetching testimony tags:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get users with public testimonies and their tags
  app.get('/api/users-with-testimonies', async (req, res) => {
    try {
      const users = await storage.getUsersWithPublicTestimonies();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users with testimonies:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Brotherhood endpoints
  app.get('/api/brothers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const brothers = await storage.getUserBrothers(userId);
      res.json(brothers);
    } catch (error) {
      console.error("Error fetching brothers:", error);
      res.status(500).json({ message: "Failed to fetch brothers" });
    }
  });

  app.post('/api/brotherhood-requests', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { recipientId, message } = req.body;

      if (!recipientId) {
        return res.status(400).json({ message: "Recipient ID is required" });
      }

      if (requesterId === recipientId) {
        return res.status(400).json({ message: "Cannot request to be your own brother" });
      }

      // Check if request can be sent (handles brothers, pending requests, denied history, cooldowns)
      const requestStatus = await storage.canSendBrotherhoodRequest(requesterId, recipientId);
      if (!requestStatus.canSend) {
        return res.status(400).json({ 
          message: requestStatus.reason,
          cooldownUntil: requestStatus.cooldownUntil
        });
      }

      // If requires confirmation, check if user confirmed
      if (requestStatus.requiresConfirmation && !req.body.confirmed) {
        return res.status(409).json({ 
          message: "User previously denied your request", 
          requiresConfirmation: true,
          lastDenied: requestStatus.lastDenied
        });
      }

      // Create the request
      let request;
      try {
        request = await storage.createBrotherhoodRequest({
          requesterId,
          recipientId,
          message: message || '',
        });
      } catch (error: any) {
        // Handle duplicate key constraint error
        if (error.code === '23505') {
          return res.status(400).json({ message: "Brotherhood request already exists" });
        }
        throw error;
      }

      // Create notification for the recipient
      const requester = await storage.getUser(requesterId);
      const notification = await storage.createNotificationWithPreferences({
        userId: recipientId,
        type: 'brotherhood',
        title: '🤝 Brotherhood Request',
        message: `${requester?.firstName} ${requester?.lastName} wants to be your brother in faith`,
        relatedId: request.id,
      });
      
      // Send real-time WebSocket notification if user is connected (all tabs)
      const brotherhoodPayload = JSON.stringify({
        type: 'brotherhood_request',
        requestId: request.id,
        requester: {
          id: requesterId,
          firstName: requester?.firstName,
          lastName: requester?.lastName,
        },
        message: `${requester?.firstName} ${requester?.lastName} wants to be your brother in faith`
      });
      const recipientSockets = connectedClients.get(recipientId);
      if (recipientSockets && recipientSockets.size > 0) {
        recipientSockets.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(brotherhoodPayload);
        });
        console.log(`Sent real-time brotherhood request notification to user ${recipientId}`);
      } else {
        console.log(`User ${recipientId} not connected to WebSocket - notification not sent`);
      }

      res.json({ message: "Brotherhood request sent successfully" });
    } catch (error) {
      console.error("Error creating brotherhood request:", error);
      res.status(500).json({ message: "Failed to send brotherhood request" });
    }
  });

  app.get('/api/brotherhood-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getBrotherhoodRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching brotherhood requests:", error);
      res.status(500).json({ message: "Failed to fetch brotherhood requests" });
    }
  });

  app.post('/api/brotherhood-requests/:requestId/respond', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      const { response } = req.body; // 'approved' or 'denied'

      if (!['approved', 'denied'].includes(response)) {
        return res.status(400).json({ message: "Response must be 'approved' or 'denied'" });
      }

      // Verify the request exists and belongs to this user
      const request = await storage.getBrotherhoodRequest(requestId);
      if (!request || request.recipientId !== userId) {
        return res.status(404).json({ message: "Brotherhood request not found" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "Request has already been responded to" });
      }

      // Update the request
      await storage.respondToBrotherhoodRequest(requestId, response);

      if (response === 'approved') {
        // Create the brotherhood relationship
        await storage.createBrotherhood(request.requesterId, request.recipientId);

        // Notify the requester
        const recipient = await storage.getUser(userId);
        await storage.createNotificationWithPreferences({
          userId: request.requesterId,
          type: 'brotherhood',
          title: '✅ Brotherhood Request Approved',
          message: `${recipient?.firstName} ${recipient?.lastName} accepted your brotherhood request! You are now brothers in faith.`,
          relatedId: recipient?.id ?? null,
        });

        // Send real-time WebSocket notification for brotherhood establishment
        const requester = await storage.getUser(request.requesterId);
        
        // Send to the requester (all their tabs)
        const requesterPayload = JSON.stringify({
          type: 'brotherhood_established',
          message: 'Brotherhood established',
          partnerName: recipient?.firstName + ' ' + recipient?.lastName
        });
        connectedClients.get(request.requesterId)?.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(requesterPayload);
        });
        
        // Send to the responder (all their tabs)
        const responderPayload = JSON.stringify({
          type: 'brotherhood_established',
          message: 'Brotherhood established',
          partnerName: requester?.firstName + ' ' + requester?.lastName
        });
        connectedClients.get(request.recipientId)?.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(responderPayload);
        });
      } else if (response === 'denied') {
        // Track the denial for cooldown management
        await storage.upsertBrotherhoodDenial({
          requesterId: request.requesterId,
          recipientId: userId,
          denialCount: 1, // Will be incremented by the upsert logic
          lastDenialAt: new Date()
        });

        // Send real-time WebSocket notification for denied request
        const recipient = await storage.getUser(userId);
        const wsMessage = {
          type: 'brotherhood_request_denied',
          message: 'Brotherhood request denied',
          partnerName: recipient?.firstName + ' ' + recipient?.lastName
        };
        
        // Send to the requester so their UI updates immediately (all tabs)
        const deniedPayload = JSON.stringify(wsMessage);
        connectedClients.get(request.requesterId)?.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(deniedPayload);
        });
      }

      res.json({ message: `Brotherhood request ${response} successfully` });
    } catch (error) {
      console.error("Error responding to brotherhood request:", error);
      res.status(500).json({ message: "Failed to respond to request" });
    }
  });

  app.put('/api/brothers/:brotherhoodId/tag', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { brotherhoodId } = req.params;
      const { tag } = req.body; // 'Paul', 'Timothy', 'Barnabas', or null

      // Validate tag value
      if (tag !== null && !['Paul', 'Timothy', 'Barnabas'].includes(tag)) {
        return res.status(400).json({ message: "Tag must be 'Paul', 'Timothy', 'Barnabas', or null" });
      }

      await storage.updateBrotherhoodTag(brotherhoodId, userId, tag);
      res.json({ message: "Brotherhood tag updated successfully" });
    } catch (error) {
      console.error("Error updating brotherhood tag:", error);
      res.status(500).json({ message: "Failed to update brotherhood tag" });
    }
  });

  // Remove brotherhood relationship
  app.delete('/api/brothers/:brotherhoodId', isAuthenticated, async (req: any, res) => {
    try {
      const brotherhoodId = req.params.brotherhoodId;
      const userId = req.user.claims.sub;

      // Get the brotherhood relationship to verify user is part of it
      const brotherhood = await storage.getBrotherhood(brotherhoodId);
      if (!brotherhood) {
        return res.status(404).json({ message: "Brotherhood relationship not found" });
      }

      // Verify user is part of this brotherhood
      if (brotherhood.userId1 !== userId && brotherhood.userId2 !== userId) {
        return res.status(403).json({ message: "You can only remove your own brotherhood relationships" });
      }

      // Get the other user's ID and info for notifications
      const otherId = brotherhood.userId1 === userId ? brotherhood.userId2 : brotherhood.userId1;
      const currentUser = await storage.getUser(userId);

      // Remove the brotherhood
      await storage.removeBrotherhood(brotherhoodId);

      // Send real-time WebSocket notifications to both users
      const wsMessage = {
        type: 'brotherhood_removed',
        message: `${currentUser?.firstName} ${currentUser?.lastName} has removed your brotherhood`,
        removedBy: currentUser?.firstName + ' ' + currentUser?.lastName
      };

      // Send to the other user (all tabs)
      const removedPayload = JSON.stringify(wsMessage);
      connectedClients.get(otherId)?.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(removedPayload);
      });

      // Get the other user's info for the initiator message
      const otherUser = await storage.getUser(otherId);
      
      // Send update to the initiating user as well for real-time UI update (all tabs)
      const initiatorMessage = {
        type: 'brotherhood_removed',
        message: `You removed your brotherhood with ${otherUser?.firstName} ${otherUser?.lastName}`,
        removedBy: currentUser?.firstName + ' ' + currentUser?.lastName
      };
      const initiatorPayload = JSON.stringify(initiatorMessage);
      connectedClients.get(userId)?.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(initiatorPayload);
      });

      res.json({
        success: true,
        message: "Brotherhood removed successfully"
      });
    } catch (error) {
      console.error('Error removing brotherhood:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const users = await storage.searchUsers(q, currentUserId);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Fitness Challenge Routes
  
  // Get all published fitness challenges
  app.get('/api/fitness-challenges', async (req, res) => {
    try {
      const challenges = await storage.getFitnessChallenges();
      res.json(challenges);
    } catch (error) {
      console.error('Error fetching fitness challenges:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all fitness challenges (admin only - includes unpublished)
  app.get('/api/admin/fitness-challenges', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const challenges = await storage.getAllFitnessChallenges();
      res.json(challenges);
    } catch (error) {
      console.error('Error fetching all fitness challenges:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get fitness challenge by ID
  app.get('/api/fitness-challenges/:id', async (req, res) => {
    try {
      const challenge = await storage.getFitnessChallengeById(req.params.id);
      if (!challenge) {
        return res.status(404).json({ message: 'Fitness challenge not found' });
      }
      res.json(challenge);
    } catch (error) {
      console.error('Error fetching fitness challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create new fitness challenge (admin only)
  app.post('/api/fitness-challenges', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const challengeData = insertFitnessChallengeSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const challenge = await storage.createFitnessChallenge(challengeData);
      res.status(201).json(challenge);
    } catch (error) {
      console.error('Error creating fitness challenge:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid challenge data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update fitness challenge (admin only)
  app.put('/api/fitness-challenges/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const updates = req.body;
      const challenge = await storage.updateFitnessChallenge(req.params.id, updates);
      res.json(challenge);
    } catch (error) {
      console.error('Error updating fitness challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete fitness challenge (admin only)
  app.delete('/api/fitness-challenges/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      await storage.deleteFitnessChallenge(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting fitness challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Publish fitness challenge (admin only)
  app.post('/api/fitness-challenges/:id/publish', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const challenge = await storage.publishFitnessChallenge(req.params.id);
      res.json(challenge);
    } catch (error) {
      console.error('Error publishing fitness challenge:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // PRE-BUILT FITNESS PLANS ROUTES
  // ============================================

  // Get all published pre-built fitness plans (public, filtered by user tier)
  app.get('/api/pre-built-fitness-plans', async (req: any, res) => {
    try {
      let user: any = null;
      if (req.user?.claims?.sub) {
        user = await storage.getUser(req.user.claims.sub);
      }
      
      const plans = await db.select()
        .from(schema.preBuiltFitnessPlans)
        .where(eq(schema.preBuiltFitnessPlans.isPublished, true))
        .orderBy(desc(schema.preBuiltFitnessPlans.createdAt));
      
      const accessiblePlansPromises = plans.map(async (plan) => {
        const planAccess = user ? await canAccessContent(user, 'fitness', plan.isTrialAccessible ?? false) : false;
        return {
          ...plan,
          hasAccess: planAccess,
          downloadUrl: planAccess ? plan.downloadUrl : null
        };
      });
      const accessiblePlans = await Promise.all(accessiblePlansPromises);
      
      res.json(accessiblePlans);
    } catch (error) {
      console.error('Error fetching pre-built fitness plans:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Get all pre-built fitness plans (including unpublished)
  app.get('/api/admin/pre-built-fitness-plans', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const plans = await db.select()
        .from(schema.preBuiltFitnessPlans)
        .orderBy(desc(schema.preBuiltFitnessPlans.createdAt));
      
      res.json(plans);
    } catch (error) {
      console.error('Error fetching admin pre-built fitness plans:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Create pre-built fitness plan
  app.post('/api/pre-built-fitness-plans', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const planData = insertPreBuiltFitnessPlanSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const [plan] = await db.insert(schema.preBuiltFitnessPlans)
        .values(planData)
        .returning();
      
      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating pre-built fitness plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid plan data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Update pre-built fitness plan
  app.put('/api/pre-built-fitness-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const [plan] = await db.update(schema.preBuiltFitnessPlans)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id))
        .returning();
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }
      
      res.json(plan);
    } catch (error) {
      console.error('Error updating pre-built fitness plan:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Delete pre-built fitness plan
  app.delete('/api/pre-built-fitness-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      await db.delete(schema.preBuiltFitnessPlans)
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id));
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting pre-built fitness plan:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Toggle publish status for pre-built fitness plan
  app.post('/api/pre-built-fitness-plans/:id/publish', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Get current plan
      const [existingPlan] = await db.select()
        .from(schema.preBuiltFitnessPlans)
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id));
      
      if (!existingPlan) {
        return res.status(404).json({ message: 'Plan not found' });
      }
      
      const [plan] = await db.update(schema.preBuiltFitnessPlans)
        .set({
          isPublished: !existingPlan.isPublished,
          publishedAt: !existingPlan.isPublished ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id))
        .returning();
      
      res.json(plan);
    } catch (error) {
      console.error('Error toggling pre-built fitness plan publish status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Upload fitness plan document
  app.post('/api/pre-built-fitness-plans/:id/upload', isAuthenticated, documentUpload.single('document'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Documents are served through the download endpoint — use Object Storage for durability
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const docKey = `fitness-plans/plan_${Date.now()}_${safeOriginal}`;
      const docBuffer = fs.readFileSync(req.file.path);
      const downloadUrl = await uploadPublicFile(docBuffer, docKey, req.file.mimetype);
      // Clean up temp file
      try { fs.unlinkSync(req.file.path); } catch {}
      
      const [plan] = await db.update(schema.preBuiltFitnessPlans)
        .set({
          downloadUrl,
          downloadFileName: req.file.originalname,
          updatedAt: new Date()
        })
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id))
        .returning();
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }
      
      res.json(plan);
    } catch (error) {
      console.error('Error uploading fitness plan document:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Download fitness plan document (with tier check)
  app.get('/api/pre-built-fitness-plans/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const [plan] = await db.select()
        .from(schema.preBuiltFitnessPlans)
        .where(eq(schema.preBuiltFitnessPlans.id, req.params.id));
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }
      
      const planAccess = await canAccessContent(user, 'fitness', plan.isTrialAccessible ?? false);
      if (!planAccess) {
        return res.status(403).json({ 
          message: 'Active subscription required to download this plan'
        });
      }
      
      if (!plan.downloadUrl) {
        return res.status(404).json({ message: 'No document available for download' });
      }
      
      // Redirect to the file
      res.redirect(plan.downloadUrl);
    } catch (error) {
      console.error('Error downloading fitness plan:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ==========================================
  // FITNESS MEMBERSHIP ROUTES ($4.99/month)
  // ==========================================

  // Get current user's fitness membership status
  app.get('/api/fitness/membership', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [membership] = await db.select().from(schema.fitnessMemberships).where(eq(schema.fitnessMemberships.userId, userId)).limit(1);
      if (!membership) return res.json({ hasMembership: false });
      const isActive = membership.status === 'active' && (!membership.currentPeriodEnd || membership.currentPeriodEnd > new Date());
      res.json({ hasMembership: isActive, membership });
    } catch (error) {
      console.error('Error checking fitness membership:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create Stripe checkout session for fitness membership
  app.post('/api/fitness/membership/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Check if already active member
      const [existing] = await db.select().from(schema.fitnessMemberships).where(eq(schema.fitnessMemberships.userId, userId)).limit(1);
      if (existing && existing.status === 'active' && existing.currentPeriodEnd && existing.currentPeriodEnd > new Date()) {
        return res.status(400).json({ message: 'Already an active fitness member' });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email || undefined,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: 499, // $4.99
            recurring: { interval: 'month' },
            product_data: {
              name: 'Fitness Community Membership',
              description: 'Full access to the Man Up God\'s Way Fitness Community — workouts, plans, exercise library, and progress tracking.',
            },
          },
          quantity: 1,
        }],
        metadata: { userId, type: 'fitness_membership' },
        success_url: `${baseUrl}/fitness?membership=success`,
        cancel_url: `${baseUrl}/fitness?membership=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating fitness membership checkout:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  // Cancel fitness membership
  app.post('/api/fitness/membership/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [membership] = await db.select().from(schema.fitnessMemberships).where(eq(schema.fitnessMemberships.userId, userId)).limit(1);
      if (!membership || !membership.stripeSubscriptionId) {
        return res.status(404).json({ message: 'No active fitness membership found' });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      await stripe.subscriptions.update(membership.stripeSubscriptionId, { cancel_at_period_end: true });
      await db.update(schema.fitnessMemberships).set({ cancelAtPeriodEnd: true, updatedAt: new Date() }).where(eq(schema.fitnessMemberships.userId, userId));

      res.json({ message: 'Membership will cancel at end of billing period' });
    } catch (error: any) {
      console.error('Error cancelling fitness membership:', error);
      res.status(500).json({ message: error.message || 'Failed to cancel membership' });
    }
  });

  // Create Stripe Checkout session for individual fitness plan purchase
  app.post('/api/fitness/plans/:id/purchase-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const { id } = req.params;

      const [plan] = await db.select().from(schema.preBuiltFitnessPlans).where(eq(schema.preBuiltFitnessPlans.id, id)).limit(1);
      if (!plan || !plan.isPurchasable || !plan.price) {
        return res.status(404).json({ message: 'Plan not available for purchase' });
      }

      // Check if already purchased
      const [existingPurchase] = await db.select().from(schema.fitnessPlanPurchases)
        .where(and(eq(schema.fitnessPlanPurchases.userId, userId), eq(schema.fitnessPlanPurchases.planId, id))).limit(1);
      if (existingPurchase) return res.status(400).json({ message: 'Already purchased this plan' });

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: user.email || undefined,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: plan.price,
            product_data: {
              name: `Fitness Plan: ${plan.title}`,
              description: plan.description || undefined,
            },
          },
          quantity: 1,
        }],
        metadata: { userId, planId: id, planTitle: plan.title, type: 'fitness_plan_purchase' },
        success_url: `${baseUrl}/fitness?plan_purchase=success&planId=${id}`,
        cancel_url: `${baseUrl}/fitness?plan_purchase=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating fitness plan purchase:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  // Get user's purchased fitness plans
  app.get('/api/fitness/purchases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const purchases = await db.select().from(schema.fitnessPlanPurchases).where(eq(schema.fitnessPlanPurchases.userId, userId));
      res.json(purchases.map(p => p.planId));
    } catch (error) {
      console.error('Error fetching fitness purchases:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: get all fitness memberships
  app.get('/api/admin/fitness/memberships', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const memberships = await db.select().from(schema.fitnessMemberships).orderBy(desc(schema.fitnessMemberships.createdAt));
      res.json(memberships);
    } catch (error) {
      console.error('Error fetching fitness memberships:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Favorite exercises routes
  // Get user's favorite exercises
  app.get('/api/favorite-exercises', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const favorites = await storage.getFavoriteExercises(user.id);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorite exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add exercise to favorites
  app.post('/api/favorite-exercises', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const exerciseData = insertFavoriteExerciseSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      const favorite = await storage.addFavoriteExercise(exerciseData);
      res.status(201).json(favorite);
    } catch (error) {
      console.error('Error adding favorite exercise:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      // Handle duplicate favorite error
      if (error instanceof Error && error.message.includes("duplicate")) {
        return res.status(409).json({ message: "Exercise already in favorites" });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Remove exercise from favorites
  app.delete('/api/favorite-exercises/:exerciseId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      await storage.removeFavoriteExercise(user.id, req.params.exerciseId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing favorite exercise:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Check if exercise is favorited
  app.get('/api/favorite-exercises/:exerciseId/check', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const isFavorite = await storage.isFavoriteExercise(user.id, req.params.exerciseId);
      res.json({ isFavorite });
    } catch (error) {
      console.error('Error checking favorite exercise:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Exercises routes (local database)
  // Import exercises from JSON (admin only)
  app.post('/api/exercises/import', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const exercises = req.body.exercises;
      if (!Array.isArray(exercises)) {
        return res.status(400).json({ message: 'Invalid exercises data' });
      }

      await db.delete(schema.exercises); // Clear existing exercises
      
      for (const exercise of exercises) {
        await db.insert(schema.exercises).values({
          id: exercise.id,
          name: exercise.name,
          bodyPart: exercise.body_part,
          equipment: exercise.equipment,
          level: exercise.level,
          instructions: exercise.instructions,
          mediaFile: pickMediaFileName(exercise),
          shortInstructions: exercise.short_instructions ?? null,
          hiit: exercise.hiit ?? "No",
          stretching: exercise.stretching ?? "No",
        });
      }

      res.json({ message: 'Exercises imported successfully', count: exercises.length });
    } catch (error) {
      console.error('Error importing exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Import exercises from an admin-uploaded JSON file (admin only)
  app.post(
    '/api/exercises/import-from-file',
    isAuthenticated,
    requireAdmin,
    exerciseJsonUpload.single('file'),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded. Please select a JSON file to import.' });
        }

        let exercises: any;
        try {
          exercises = JSON.parse(req.file.buffer.toString('utf-8'));
        } catch (parseErr) {
          return res.status(400).json({ message: 'Uploaded file is not valid JSON.' });
        }

        if (!Array.isArray(exercises)) {
          return res.status(400).json({ message: 'JSON file must contain an array of exercises.' });
        }

        // Validate required fields up front so we don't half-import.
        // `id` is optional — entries without one get auto-assigned below.
        // `media_file` is optional — accepts media_file / mediaFile / image /
        // video / media keys; missing media just means it can be added later
        // via Bulk Import Media or per-row upload.
        for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
          if (
            typeof ex?.name !== 'string' ||
            typeof ex?.body_part !== 'string' ||
            typeof ex?.equipment !== 'string' ||
            typeof ex?.level !== 'string' ||
            typeof ex?.instructions !== 'string'
          ) {
            return res.status(400).json({
              message: `Invalid exercise entry at index ${i} (missing or wrong-typed required field). Name: ${ex?.name ?? '(none)'}`,
            });
          }
          if (ex.id != null && typeof ex.id !== 'number') {
            return res.status(400).json({
              message: `Invalid exercise entry at index ${i}: \`id\` must be a number when provided.`,
            });
          }
        }

        // Auto-assign IDs to entries missing one, using the first available
        // positive integer not already taken by another entry in the file.
        const usedIds = new Set<number>();
        for (const ex of exercises) {
          if (typeof ex.id === 'number') usedIds.add(ex.id);
        }
        let nextId = 1;
        for (const ex of exercises) {
          if (typeof ex.id !== 'number') {
            while (usedIds.has(nextId)) nextId++;
            ex.id = nextId;
            usedIds.add(nextId);
            nextId++;
          }
        }

        await db.delete(schema.exercises); // Clear existing exercises

        let withMedia = 0;
        for (const exercise of exercises) {
          const mediaFile = pickMediaFileName(exercise);
          if (mediaFile) withMedia++;
          await db.insert(schema.exercises).values({
            id: exercise.id,
            name: exercise.name,
            bodyPart: exercise.body_part,
            equipment: exercise.equipment,
            level: exercise.level,
            instructions: exercise.instructions,
            mediaFile,
            shortInstructions: exercise.short_instructions ?? null,
            hiit: exercise.hiit ?? "No",
            stretching: exercise.stretching ?? "No",
          });
        }

        res.json({
          message: `Imported ${exercises.length} exercises from ${req.file.originalname} (${withMedia} with media filename, ${exercises.length - withMedia} without).`,
          count: exercises.length,
          withMedia,
          missingMedia: exercises.length - withMedia,
          fileName: req.file.originalname,
        });
      } catch (error) {
        console.error('Error importing exercises from file:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  );

  // Get all exercises with filtering and pagination
  app.get('/api/exercises', async (req: any, res) => {
    try {
      // Apply filters
      const { bodyPart, equipment, level, search, offset, limit, hiit, stretching, dedupePairs } = req.query;
      const conditions = [];
      
      if (bodyPart) conditions.push(eq(schema.exercises.bodyPart, bodyPart));
      if (equipment) conditions.push(eq(schema.exercises.equipment, equipment));
      
      // Support multiple levels (comma-separated)
      if (level) {
        const levels = level.split(',').map((l: string) => l.trim());
        if (levels.length === 1) {
          conditions.push(eq(schema.exercises.level, levels[0]));
        } else {
          conditions.push(sql`${schema.exercises.level} IN (${sql.join(levels.map((l: string) => sql`${l}`), sql`, `)})`);
        }
      }

      // Filter by HIIT / Stretching tags ("Yes" or "No")
      if (hiit) conditions.push(eq(schema.exercises.hiit, hiit as string));
      if (stretching) conditions.push(eq(schema.exercises.stretching, stretching as string));
      
      if (search) conditions.push(sql`${schema.exercises.name} ILIKE ${'%' + search + '%'}`);

      // dedupePairs: when 'true', collapse left/right pair rows to ONE entry
      // per pair (keeping the side='left' row as canonical) and substitute
      // pair_base_name for name. Used by user-facing flows where the pair
      // should appear as a single unilateral exercise. Admin tools omit
      // this param so they can see and manage both halves.
      const dedupe = dedupePairs === 'true' || dedupePairs === '1';
      if (dedupe) {
        conditions.push(
          sql`(${schema.exercises.pairedExerciseId} IS NULL OR ${schema.exercises.side} = 'left')`,
        );
      }

      let query = db.select().from(schema.exercises);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      // Apply pagination if provided
      if (offset !== undefined) {
        query = query.offset(parseInt(offset)) as any;
      }
      if (limit !== undefined) {
        query = query.limit(parseInt(limit)) as any;
      }
      
      const exercises = await query;

      // When deduping, surface the canonical pair name (e.g. "Diagonal Chop")
      // instead of the side-specific row name ("Diagonal Chop Left").
      const payload = dedupe
        ? exercises.map((ex: any) =>
            ex.pairedExerciseId && ex.pairBaseName
              ? { ...ex, name: ex.pairBaseName }
              : ex,
          )
        : exercises;

      if (payload.length === 0 && (equipment || level)) {
        console.warn('[/api/exercises] 0 results for query:', { equipment, level, bodyPart, hiit, stretching });
      }

      // Optional: when injuriesAware=1 and the caller is authenticated with
      // recorded injuries, annotate each exercise with { injuryStatus,
      // injuryReasons, injuryHints } so clients can render badges without
      // a separate evaluate-injuries call.
      const injuriesAware = req.query.injuriesAware === '1' || req.query.injuriesAware === 'true';
      if (injuriesAware && req.user?.claims?.sub) {
        const injuries = await storage.getUserInjuries(req.user.claims.sub);
        if (injuries && injuries.length > 0) {
          const enriched = payload.map((ex: any) => {
            const exForEval = {
              name: ex.name ?? '',
              bodyPart: ex.bodyPart ?? '',
              hiit: ex.hiit ?? 'No',
              stretching: ex.stretching ?? 'No',
              equipment: ex.equipment ?? '',
              level: ex.level ?? '',
            };
            const evaluation = evaluateExerciseAgainstInjuries(exForEval, injuries);
            return {
              ...ex,
              injuryStatus: evaluation.status,
              injuryReasons: evaluation.reasons,
              injuryHints: evaluation.modificationHints,
            };
          });
          return res.json(enriched);
        }
      }

      res.json(payload);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get unique equipment types
  // Fetch a single exercise by name (case-insensitive). Used by the
  // workout player's "Instructions" modal — plan rows store synthetic
  // "prebuilt-..." ids rather than the canonical exercises.id, so we
  // resolve by name to pull the rich instructions text.
  app.get('/api/exercises/by-name/:name', async (req: any, res) => {
    try {
      const name = decodeURIComponent(req.params.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Exercise name required' });
      const [row] = await db.select().from(schema.exercises)
        .where(sql`LOWER(${schema.exercises.name}) = LOWER(${name})`)
        .limit(1);
      if (!row) return res.status(404).json({ message: 'Exercise not found' });
      res.json(row);
    } catch (error) {
      console.error('Error fetching exercise by name:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/exercises/:name/tempo', isAuthenticated, async (req: any, res) => {
    try {
      const name = decodeURIComponent(req.params.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Exercise name required' });
      const { tempoSec } = req.body;
      if (typeof tempoSec !== 'number' || !isFinite(tempoSec) || tempoSec <= 0 || tempoSec > 60) {
        return res.status(400).json({ message: 'tempoSec must be a positive number no greater than 60' });
      }
      const updated = await storage.updateExerciseTempo(name, tempoSec);
      if (!updated) return res.status(404).json({ message: 'Exercise not found' });
      res.json({ ok: true });
    } catch (error) {
      console.error('Error updating exercise tempo:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/exercises/equipment-types', async (req: any, res) => {
    try {
      const result = await db.selectDistinct({ equipment: schema.exercises.equipment })
        .from(schema.exercises);
      res.json(result.map(r => r.equipment));
    } catch (error) {
      console.error('Error fetching equipment types:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get unique fitness levels
  app.get('/api/exercises/fitness-levels', async (req: any, res) => {
    try {
      const result = await db.selectDistinct({ level: schema.exercises.level })
        .from(schema.exercises);
      res.json(result.map(r => r.level));
    } catch (error) {
      console.error('Error fetching fitness levels:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get unique body parts
  app.get('/api/exercises/body-parts', async (req: any, res) => {
    try {
      const result = await db.selectDistinct({ bodyPart: schema.exercises.bodyPart })
        .from(schema.exercises);
      res.json(result.map(r => r.bodyPart));
    } catch (error) {
      console.error('Error fetching body parts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Batch-evaluate exercises against the authenticated user's recorded injuries.
  // Accepts a list of exercise identifiers (numeric id or name fallback) and
  // returns a map of id → { status, reasons, modificationHints }.
  app.post('/api/exercises/evaluate-injuries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items: Array<{ exerciseId?: string; exerciseName?: string; bodyPart?: string; equipment?: string }> =
        Array.isArray(req.body?.exercises) ? req.body.exercises : [];
      if (items.length === 0) return res.json({});

      const injuries = await storage.getUserInjuries(userId);
      if (!injuries || injuries.length === 0) return res.json({});

      const numericIds = items.map(e => parseInt(e.exerciseId ?? '', 10)).filter(n => !isNaN(n));
      const dbRows = numericIds.length > 0
        ? await db.select({
            id: schema.exercises.id,
            name: schema.exercises.name,
            bodyPart: schema.exercises.bodyPart,
            hiit: schema.exercises.hiit,
            stretching: schema.exercises.stretching,
            equipment: schema.exercises.equipment,
            level: schema.exercises.level,
          }).from(schema.exercises).where(inArray(schema.exercises.id, numericIds))
        : [];

      const dbMap = new Map(dbRows.map(r => [r.id, r]));
      const result: Record<string, any> = {};

      for (const item of items) {
        const key = item.exerciseId ?? item.exerciseName ?? '';
        if (!key) continue;
        const numId = parseInt(item.exerciseId ?? '', 10);
        const dbRow = !isNaN(numId) ? dbMap.get(numId) : undefined;
        const exerciseForEval = {
          name: dbRow?.name ?? item.exerciseName ?? '',
          bodyPart: dbRow?.bodyPart ?? item.bodyPart ?? '',
          hiit: dbRow?.hiit ?? 'No',
          stretching: dbRow?.stretching ?? 'No',
          equipment: dbRow?.equipment ?? item.equipment ?? '',
          level: dbRow?.level ?? '',
        };
        result[key] = evaluateExerciseAgainstInjuries(exerciseForEval, injuries);
      }
      res.json(result);
    } catch (error) {
      console.error('Error evaluating exercises against injuries:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── Admin exercise management ─────────────────────────────────────────

  // Clear entire exercise database + all dependent user data
  app.delete('/api/admin/exercises/clear-all', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const deleted = await db.transaction(async (tx) => {
        // Delete in FK-dependency order so constraints don't block.
        // fitnessPlanPurchases references preBuiltFitnessPlans (Stripe-paid records);
        // include them so the exercise DB is wiped alongside all related user data.
        const purchases = await tx.delete(schema.fitnessPlanPurchases).returning();
        const reminders = await tx.delete(schema.fitnessPlanReminders).returning();
        const planExercises = await tx.delete(schema.fitnessPlanExercises).returning();
        const plans = await tx.delete(schema.fitnessPlans).returning();
        const favorites = await tx.delete(schema.favoriteExercises).returning();
        const exercises = await tx.delete(schema.exercises).returning();
        return { purchases, reminders, planExercises, plans, favorites, exercises };
      });

      res.json({
        message: 'Exercise database cleared',
        deleted: {
          purchases: deleted.purchases.length,
          reminders: deleted.reminders.length,
          planExercises: deleted.planExercises.length,
          plans: deleted.plans.length,
          favorites: deleted.favorites.length,
          exercises: deleted.exercises.length,
        },
      });
    } catch (error) {
      console.error('Error clearing exercise database:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update a single exercise (partial — validated via insertExerciseSchema)
  app.patch('/api/admin/exercises/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid exercise id' });

      const partialSchema = insertExerciseSchema.omit({ id: true }).partial();
      const parsed = partialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid exercise data', errors: parsed.error.issues });
      }

      const { data } = parsed;
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'No fields provided to update' });
      }

      const [updated] = await db
        .update(schema.exercises)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.exercises.id, id))
        .returning();

      if (!updated) return res.status(404).json({ message: 'Exercise not found' });
      res.json(updated);
    } catch (error) {
      console.error('Error updating exercise:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete a single exercise + clean up favorites and plan exercises that reference it
  app.delete('/api/admin/exercises/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid exercise id' });

      const idStr = String(id);

      // Remove from favorites and plan exercises (stored as varchar)
      await db.delete(schema.favoriteExercises).where(eq(schema.favoriteExercises.exerciseId, idStr));
      await db.delete(schema.fitnessPlanExercises).where(eq(schema.fitnessPlanExercises.exerciseId, idStr));

      const [deleted] = await db
        .delete(schema.exercises)
        .where(eq(schema.exercises.id, id))
        .returning();

      if (!deleted) return res.status(404).json({ message: 'Exercise not found' });

      // Delete media file from object storage if it's a storage URL
      if (deleted.mediaFile && isStorageUrl(deleted.mediaFile)) {
        await deleteStorageFile(deleted.mediaFile);
      }

      res.json({ message: 'Exercise deleted', id });
    } catch (error) {
      console.error('Error deleting exercise:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Upload new media file for an exercise (replaces existing)
  app.post(
    '/api/admin/exercises/:id/media',
    isAuthenticated,
    requireAdmin,
    exerciseMediaUpload.single('media'),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid exercise id' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const [existing] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
        if (!existing) return res.status(404).json({ message: 'Exercise not found' });

        const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'gif';
        const key = `exercises/${id}-${Date.now()}.${ext}`;
        const newUrl = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);

        // Delete old file if it's in object storage
        if (existing.mediaFile && isStorageUrl(existing.mediaFile)) {
          await deleteStorageFile(existing.mediaFile);
        }

        const [updated] = await db
          .update(schema.exercises)
          .set({ mediaFile: newUrl, updatedAt: new Date() })
          .where(eq(schema.exercises.id, id))
          .returning();

        res.json(updated);
      } catch (error) {
        console.error('Error uploading exercise media:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  );

  // Remove media file from an exercise (sets mediaFile to empty string)
  app.delete('/api/admin/exercises/:id/media', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid exercise id' });

      const [existing] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
      if (!existing) return res.status(404).json({ message: 'Exercise not found' });

      if (existing.mediaFile && isStorageUrl(existing.mediaFile)) {
        await deleteStorageFile(existing.mediaFile);
      }

      const [updated] = await db
        .update(schema.exercises)
        .set({ mediaFile: '', updatedAt: new Date() })
        .where(eq(schema.exercises.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error removing exercise media:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Bulk import media files — match each uploaded file by its filename to
  // the exercise whose `mediaFile` column equals that name (e.g. "0001_push-up.gif").
  // Matched files are uploaded to public object storage and the exercise's
  // `mediaFile` column is updated to the new storage URL.
  app.post(
    '/api/admin/exercises/bulk-media',
    isAuthenticated,
    requireAdmin,
    (req: any, res: any, next: any) => {
      // Use disk-based multer — files land on disk one at a time rather than
      // all being held in RAM, so large batches (1,700+ files) can't OOM the server.
      exerciseBulkMediaUpload.array('files', 5000)(req, res, (err: any) => {
        if (!err) return next();
        // On any multer error, clean up whatever temp files were already written
        // before returning the error so we don't leave disk debris behind.
        const writtenFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
        for (const f of writtenFiles) {
          if (f.path) fs.promises.unlink(f.path).catch(() => {});
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            message:
              'Too many files in one upload (limit 5000). Split your media into smaller batches and import each batch separately.',
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: `One or more files exceed the 50 MB per-file limit (${err.field || 'unknown field'}).`,
          });
        }
        return res.status(400).json({ message: err.message || 'Upload rejected' });
      });
    },
    async (req: any, res) => {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      // Helper: delete a temp file without throwing. Called in finally blocks.
      const cleanupTmp = (filePath: string) =>
        fs.promises.unlink(filePath).catch(() => {});

      // If multer left files on disk but we fail before processing, clean them all.
      if (files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const matched: Array<{ filename: string; exerciseId: number; exerciseName: string; url: string }> = [];
      const unmatched: string[] = [];
      const failed: Array<{ filename: string; error: string }> = [];

      let totalBytes = 0;
      for (const file of files) {
        totalBytes += file.size ?? 0;
      }
      if (totalBytes > 10 * 1024 * 1024 * 1024) {
        console.warn(`[BulkMedia] Large batch: ${(totalBytes / 1e9).toFixed(2)} GB across ${files.length} files`);
      }

      for (const file of files) {
        const filename = file.originalname;
        const tmpPath = file.path; // disk-storage path
        try {
          // Match exercise where stored mediaFile equals the uploaded basename
          const [exercise] = await db
            .select()
            .from(schema.exercises)
            .where(eq(schema.exercises.mediaFile, filename));

          if (!exercise) {
            unmatched.push(filename);
            await cleanupTmp(tmpPath);
            continue;
          }

          // Stream from disk → GCS (never loads full bytes into RAM)
          const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
          const key = `exercises/${exercise.id}-${Date.now()}.${ext}`;
          const newUrl = await uploadPublicFileFromPath(tmpPath, key, file.mimetype);

          // Remove any previously stored file for this exercise
          if (exercise.mediaFile && isStorageUrl(exercise.mediaFile)) {
            await deleteStorageFile(exercise.mediaFile).catch(() => {});
          }

          await db
            .update(schema.exercises)
            .set({ mediaFile: newUrl, updatedAt: new Date() })
            .where(eq(schema.exercises.id, exercise.id));

          matched.push({ filename, exerciseId: exercise.id, exerciseName: exercise.name, url: newUrl });
        } catch (err: any) {
          console.error(`Bulk media upload failed for ${filename}:`, err);
          failed.push({ filename, error: err?.message || 'Upload failed' });
        } finally {
          await cleanupTmp(tmpPath);
        }
      }

      res.json({
        message: 'Bulk media import complete',
        totals: { uploaded: matched.length, unmatched: unmatched.length, failed: failed.length, received: files.length },
        matched,
        unmatched,
        failed,
      });
    }
  );

  // Delete every storage-backed media file referenced by exercises and
  // clear the mediaFile column. Leaves the exercise rows themselves intact.
  app.delete('/api/admin/exercise-media/clear-all', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.select().from(schema.exercises);
      let deleted = 0;
      let failed = 0;
      let cleared = 0;

      for (const row of rows) {
        if (row.mediaFile && isStorageUrl(row.mediaFile)) {
          try {
            await deleteStorageFile(row.mediaFile);
            deleted++;
          } catch (err) {
            console.warn(`Failed to delete media for exercise ${row.id}:`, err);
            failed++;
          }
        }
        if (row.mediaFile && row.mediaFile !== '') {
          cleared++;
        }
      }

      await db
        .update(schema.exercises)
        .set({ mediaFile: '', updatedAt: new Date() });

      res.json({
        message: `Deleted ${deleted} media file(s) from storage and cleared ${cleared} exercise media reference(s).`,
        deleted,
        cleared,
        failed,
        total: rows.length,
      });
    } catch (error) {
      console.error('Error deleting all exercise media:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Coverage stats: how many exercises have media attached vs missing, and how
  // many files actually live in object storage under the exercise media prefix.
  // Surfaces drift between the database and storage on the admin Fitness page.
  app.get('/api/admin/exercises/media-stats', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [totalRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(schema.exercises);
      const [withMediaRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(schema.exercises)
        .where(and(ne(schema.exercises.mediaFile, ''), sql`${schema.exercises.mediaFile} IS NOT NULL`));

      const totalExercises = Number(totalRow?.c ?? 0);
      const withMedia = Number(withMediaRow?.c ?? 0);
      const filesInStorage = await countStorageFiles('public/uploads/exercises/');

      res.json({
        totalExercises,
        withMedia,
        missingMedia: Math.max(0, totalExercises - withMedia),
        filesInStorage,
      });
    } catch (error) {
      console.error('Error computing exercise media stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── End admin exercise management ─────────────────────────────────────

  // Fitness plans routes
  // Get user's fitness plans
  app.get('/api/fitness-plans', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const plans = await storage.getFitnessPlans(user.id);
      res.json(plans);
    } catch (error) {
      console.error('Error fetching fitness plans:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get fitness plan by ID with exercises
  app.get('/api/fitness-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const plan = await storage.getFitnessPlanWithExercises(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      // Check if user owns this plan or if it's public
      if (plan.userId !== user.id && !plan.isPublic) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(plan);
    } catch (error) {
      console.error('Error fetching fitness plan:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create fitness plan
  app.post('/api/fitness-plans', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const planData = insertFitnessPlanSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      const plan = await storage.createFitnessPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      console.error('Error creating fitness plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid plan data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update fitness plan
  app.put('/api/fitness-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership
      const existingPlan = await storage.getFitnessPlan(req.params.id);
      if (!existingPlan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (existingPlan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updateData = insertFitnessPlanSchema.partial().parse(req.body);
      const plan = await storage.updateFitnessPlan(req.params.id, updateData);

      // If the user manually changed the plan's difficulty, wipe the
      // streak counter for ALL workout types per spec ("If the user
      // manually changes their level, reset all streaks and levers
      // to 0"). Also clear any active Lever-6 cooldowns since the level
      // landscape has changed.
      const oldLevel = (existingPlan.difficulty || '').toLowerCase();
      const newLevel = (plan?.difficulty || '').toLowerCase();
      if (newLevel && oldLevel !== newLevel) {
        await storage.resetWorkoutStreaks(user.id, 'manual_level_change');
        await dbForLever6
          .update(fitnessPlansForLever6)
          .set({ levelDecisionCooldownUntil: null, levelDecisionSkipSessions: 0 })
          .where(eqForLever6(fitnessPlansForLever6.id, plan.id));
        console.log(`[streakReset] user=${user.id} plan=${plan.id} reason=manual_level_change ${oldLevel}→${newLevel}`);
      }

      // Mid-plan equipment / duration changes — preserve every lever
      // adjustment (do NOT reset streak counter), then reshape the plan
      // to fit the new constraints.
      const sideEffects: { equipmentChange?: any; durationChange?: any } = {};

      // -- Equipment change --------------------------------------------------
      // Filter out exercises whose equipment is no longer in the new
      // selection. Per spec: re-run exercise selection with new equipment
      // filter. Full re-selection (pulling brand-new exercises) requires
      // the plan generator; here we surgically remove the now-invalid
      // ones and surface a count so the UI can prompt the user to add
      // replacements if the session got too short.
      const oldEquipment = (existingPlan.equipment || '').toString();
      const newEquipment = (plan?.equipment || '').toString();
      if (newEquipment && oldEquipment !== newEquipment) {
        const allowed = new Set(
          newEquipment.split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
        );
        if (allowed.size > 0) {
          const exercises = await storage.getFitnessPlanExercises(plan.id);
          const orphaned = exercises.filter(ex => {
            const eq = (ex.equipment || '').trim().toLowerCase();
            // body weight / no equipment is always allowed; otherwise
            // exercise must use one of the new equipment selections.
            if (!eq || eq === 'body weight' || eq === 'bodyweight' || eq === 'none') return false;
            return !allowed.has(eq);
          });
          for (const ex of orphaned) {
            await storage.removePlanExercise(ex.id);
          }
          sideEffects.equipmentChange = {
            removedCount: orphaned.length,
            removedNames: orphaned.slice(0, 5).map(e => e.exerciseName),
            remainingCount: exercises.length - orphaned.length,
          };
          console.log(`[planUpdate] user=${user.id} plan=${plan.id} equipment ${oldEquipment}→${newEquipment} removed=${orphaned.length}`);
        }
      }

      // -- Duration change ---------------------------------------------------
      // Scale every exercise's set count proportionally to the new time
      // budget so existing lever adjustments to reps/rest are preserved
      // and the session naturally fits the new duration. Min 1 set per
      // exercise so nothing disappears entirely.
      const oldDuration = existingPlan.estimatedDuration ?? 60;
      const newDuration = plan?.estimatedDuration ?? oldDuration;
      if (newDuration && oldDuration && newDuration !== oldDuration) {
        const ratio = newDuration / oldDuration;
        const exercises = await storage.getFitnessPlanExercises(plan.id);
        let scaled = 0;
        for (const ex of exercises) {
          const oldSets = ex.sets ?? 3;
          // Proportional scaling: newSets = oldSets * ratio.
          // This is equally correct for unilateral exercises: each unilateral
          // set already takes 2× the work time (right-side countdown +
          // reposition rest + left-side countdown), so the duration ratio
          // applies uniformly regardless of sidedness.
          const newSets = Math.max(1, Math.round(oldSets * ratio));
          if (newSets !== oldSets) {
            await storage.updatePlanExercise(ex.id, { sets: newSets });
            scaled += 1;
          }
        }
        sideEffects.durationChange = {
          oldDuration,
          newDuration,
          ratio: Math.round(ratio * 100) / 100,
          exercisesAdjusted: scaled,
        };
        console.log(`[planUpdate] user=${user.id} plan=${plan.id} duration ${oldDuration}→${newDuration}min ratio=${ratio.toFixed(2)} scaled=${scaled}`);
      }

      res.json({ ...plan, sideEffects: Object.keys(sideEffects).length ? sideEffects : undefined });
    } catch (error) {
      console.error('Error updating fitness plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid plan data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete fitness plan
  app.delete('/api/fitness-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership
      const existingPlan = await storage.getFitnessPlan(req.params.id);
      if (!existingPlan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (existingPlan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.deleteFitnessPlan(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting fitness plan:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Fitness plan exercises routes
  // Get exercises for a fitness plan
  app.get('/api/fitness-plans/:planId/exercises', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check access to plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id && !plan.isPublic) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const exercises = await storage.getFitnessPlanExercises(req.params.planId);
      res.json(exercises);
    } catch (error) {
      console.error('Error fetching plan exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add exercise to fitness plan
  // Bulk-insert variant. Accepts { exercises: [...] } and inserts them in
  // a single DB write. This avoids hitting the per-IP rate limiter when a
  // user creates a 100+ exercise pre-built plan, which would otherwise fire
  // 100+ separate POSTs.
  app.post('/api/fitness-plans/:planId/exercises/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const incoming = Array.isArray(req.body?.exercises) ? req.body.exercises : null;
      if (!incoming) {
        return res.status(400).json({ message: 'Expected { exercises: [...] }' });
      }
      if (incoming.length === 0) {
        return res.status(201).json([]);
      }
      if (incoming.length > 500) {
        return res.status(400).json({ message: 'Too many exercises in one request (max 500)' });
      }

      const parsedList = incoming.map((row: any) =>
        insertFitnessPlanExerciseSchema.parse({ ...row, planId: req.params.planId })
      );

      // ── Injury risk guard ────────────────────────────────────────────────
      // If the user has recorded injuries and has NOT explicitly acknowledged
      // the risk, check every incoming exercise and return 409 for any that
      // are blocked.  The client can retry with { acknowledgeInjuryRisk: true }
      // after showing a confirmation dialog.
      if (!req.body?.acknowledgeInjuryRisk) {
        const injuries = await storage.getUserInjuries(user.id);
        if (injuries && injuries.length > 0) {
          const evalNumericIds = parsedList
            .map(p => parseInt(p.exerciseId, 10))
            .filter(n => !Number.isNaN(n));
          const evalRows = evalNumericIds.length > 0
            ? await db.select({
                id: schema.exercises.id,
                name: schema.exercises.name,
                bodyPart: schema.exercises.bodyPart,
                hiit: schema.exercises.hiit,
                stretching: schema.exercises.stretching,
                equipment: schema.exercises.equipment,
                level: schema.exercises.level,
              }).from(schema.exercises).where(inArray(schema.exercises.id, evalNumericIds))
            : [];
          const evalById = new Map(evalRows.map(r => [r.id, r]));

          const blockedExercises: Array<{ exerciseId: string; exerciseName: string; reasons: string[] }> = [];
          for (const p of parsedList) {
            const numId = parseInt(p.exerciseId, 10);
            const row = !Number.isNaN(numId) ? evalById.get(numId) : undefined;
            const exForEval = {
              name: row?.name ?? p.exerciseName ?? '',
              bodyPart: row?.bodyPart ?? p.bodyPart ?? '',
              hiit: row?.hiit ?? 'No',
              stretching: row?.stretching ?? 'No',
              equipment: row?.equipment ?? p.equipment ?? '',
              level: row?.level ?? '',
            };
            const evaluation = evaluateExerciseAgainstInjuries(exForEval, injuries);
            if (evaluation.status === 'blocked') {
              blockedExercises.push({
                exerciseId: p.exerciseId,
                exerciseName: p.exerciseName ?? '',
                reasons: evaluation.reasons,
              });
            }
          }
          if (blockedExercises.length > 0) {
            return res.status(409).json({
              code: 'INJURY_RISK',
              message: 'Some exercises conflict with your recorded injuries.',
              blockedExercises,
            });
          }
        }
      }
      // ── End injury guard ─────────────────────────────────────────────────

      // Resolve sidedness for all exercises in one query, keyed by numeric id
      // when the exerciseId parses as an int, otherwise by lowercased name.
      const numericIds: number[] = [];
      const namesToLookup: string[] = [];
      for (const p of parsedList) {
        const n = parseInt(p.exerciseId, 10);
        if (!Number.isNaN(n)) numericIds.push(n);
        else if (p.exerciseName) namesToLookup.push(p.exerciseName.toLowerCase());
      }

      const sidednessById = new Map<number, 'bilateral' | 'unilateral' | 'alternating'>();
      const sidednessByName = new Map<string, 'bilateral' | 'unilateral' | 'alternating'>();

      if (numericIds.length > 0) {
        const rows = await db
          .select({ id: schema.exercises.id, sidedness: schema.exercises.sidedness })
          .from(schema.exercises)
          .where(inArray(schema.exercises.id, numericIds));
        rows.forEach(r => sidednessById.set(r.id, r.sidedness));
      }
      if (namesToLookup.length > 0) {
        const rows = await db
          .select({ name: schema.exercises.name, sidedness: schema.exercises.sidedness })
          .from(schema.exercises)
          .where(sql`LOWER(${schema.exercises.name}) IN ${namesToLookup}`);
        rows.forEach(r => sidednessByName.set(r.name.toLowerCase(), r.sidedness));
      }

      const toInsert = parsedList.map(p => {
        const n = parseInt(p.exerciseId, 10);
        let sidedness: 'bilateral' | 'unilateral' | 'alternating' =
          (p.sidedness as 'bilateral' | 'unilateral' | 'alternating') ?? 'bilateral';
        if (!Number.isNaN(n) && sidednessById.has(n)) {
          sidedness = sidednessById.get(n)!;
        } else if (p.exerciseName && sidednessByName.has(p.exerciseName.toLowerCase())) {
          sidedness = sidednessByName.get(p.exerciseName.toLowerCase())!;
        }
        const currentReps = p.reps ?? '';
        const needsPerSide =
          (sidedness === 'unilateral' || sidedness === 'alternating') &&
          (currentReps === '10' || currentReps === '');
        return {
          ...p,
          sidedness,
          reps: needsPerSide ? '10 per side' : p.reps,
        };
      });

      const inserted = await storage.addExercisesToPlan(toInsert);
      res.status(201).json(inserted);
    } catch (error) {
      console.error('Error bulk-adding exercises to plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/fitness-plans/:planId/exercises', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // ── Injury risk guard (single-add) ──────────────────────────────────
      if (!req.body?.acknowledgeInjuryRisk) {
        const injuries = await storage.getUserInjuries(user.id);
        if (injuries && injuries.length > 0) {
          const numId = parseInt(req.body?.exerciseId, 10);
          const exRow = !Number.isNaN(numId)
            ? (await db.select({
                id: schema.exercises.id,
                name: schema.exercises.name,
                bodyPart: schema.exercises.bodyPart,
                hiit: schema.exercises.hiit,
                stretching: schema.exercises.stretching,
                equipment: schema.exercises.equipment,
                level: schema.exercises.level,
              }).from(schema.exercises).where(eq(schema.exercises.id, numId)).limit(1))[0]
            : undefined;
          const exForEval = {
            name: exRow?.name ?? req.body?.exerciseName ?? '',
            bodyPart: exRow?.bodyPart ?? req.body?.bodyPart ?? '',
            hiit: exRow?.hiit ?? 'No',
            stretching: exRow?.stretching ?? 'No',
            equipment: exRow?.equipment ?? req.body?.equipment ?? '',
            level: exRow?.level ?? '',
          };
          const evaluation = evaluateExerciseAgainstInjuries(exForEval, injuries);
          if (evaluation.status === 'blocked') {
            return res.status(409).json({
              code: 'INJURY_RISK',
              message: 'This exercise conflicts with your recorded injuries.',
              blockedExercises: [{ exerciseId: req.body?.exerciseId, exerciseName: req.body?.exerciseName, reasons: evaluation.reasons }],
            });
          }
        }
      }
      // ── End injury guard ─────────────────────────────────────────────────

      const parsed = insertFitnessPlanExerciseSchema.parse({
        ...req.body,
        planId: req.params.planId
      });

      // Resolve sidedness from the exercises table so the workout runner
      // gets it directly from plan-exercise rows (no secondary async lookup).
      // Also normalise the reps default to "10 per side" for one-sided moves.
      let resolvedSidedness: 'bilateral' | 'unilateral' | 'alternating' =
        (parsed.sidedness as 'bilateral' | 'unilateral' | 'alternating') ?? 'bilateral';

      const exIdNum = parseInt(parsed.exerciseId, 10);
      if (!isNaN(exIdNum)) {
        const [dbEx] = await db
          .select({ sidedness: schema.exercises.sidedness })
          .from(schema.exercises)
          .where(eq(schema.exercises.id, exIdNum))
          .limit(1);
        if (dbEx) resolvedSidedness = dbEx.sidedness;
      } else if (parsed.exerciseName) {
        // Fall back to name-based lookup for non-numeric exercise IDs.
        const [dbEx] = await db
          .select({ sidedness: schema.exercises.sidedness })
          .from(schema.exercises)
          .where(sql`LOWER(${schema.exercises.name}) = LOWER(${parsed.exerciseName})`)
          .limit(1);
        if (dbEx) resolvedSidedness = dbEx.sidedness;
      }

      // Upgrade the bare "10" default to "10 per side" for one-sided exercises.
      const currentReps = parsed.reps ?? '';
      const needsPerSide =
        (resolvedSidedness === 'unilateral' || resolvedSidedness === 'alternating') &&
        (currentReps === '10' || currentReps === '');

      const exerciseData = {
        ...parsed,
        sidedness: resolvedSidedness,
        reps: needsPerSide ? '10 per side' : parsed.reps,
      };

      const exercise = await storage.addExerciseToPlan(exerciseData);
      res.status(201).json(exercise);
    } catch (error) {
      console.error('Error adding exercise to plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update exercise in fitness plan
  app.put('/api/fitness-plan-exercises/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get the exercise to check plan ownership
      const exercises = await storage.getFitnessPlanExercises(''); // This is a bit inefficient but works with current interface
      const exercise = exercises.find(ex => ex.id === req.params.id);
      
      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found' });
      }
      
      const plan = await storage.getFitnessPlan(exercise.planId);
      if (!plan || plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updateData = insertFitnessPlanExerciseSchema.partial().parse(req.body);
      const updatedExercise = await storage.updatePlanExercise(req.params.id, updateData);
      res.json(updatedExercise);
    } catch (error) {
      console.error('Error updating plan exercise:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Remove exercise from fitness plan
  app.delete('/api/fitness-plan-exercises/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Similar ownership check as update
      const exercises = await storage.getFitnessPlanExercises('');
      const exercise = exercises.find(ex => ex.id === req.params.id);
      
      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found' });
      }
      
      const plan = await storage.getFitnessPlan(exercise.planId);
      if (!plan || plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.removePlanExercise(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing plan exercise:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Reorder exercises in fitness plan
  app.put('/api/fitness-plans/:planId/exercises/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const { exerciseOrders } = req.body;
      if (!Array.isArray(exerciseOrders)) {
        return res.status(400).json({ message: 'exerciseOrders must be an array' });
      }
      
      await storage.reorderPlanExercises(req.params.planId, exerciseOrders);
      res.json({ success: true });
    } catch (error) {
      console.error('Error reordering plan exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Fitness plan reminders routes
  // Get reminders for a fitness plan
  app.get('/api/fitness-plans/:planId/reminders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const reminders = await storage.getFitnessPlanReminders(req.params.planId);
      res.json(reminders);
    } catch (error) {
      console.error('Error fetching plan reminders:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add reminder to fitness plan
  app.post('/api/fitness-plans/:planId/reminders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const reminderData = insertFitnessPlanReminderSchema.parse({
        ...req.body,
        planId: req.params.planId
      });
      
      const reminder = await storage.addReminderToPlan(reminderData);
      res.status(201).json(reminder);
    } catch (error) {
      console.error('Error adding reminder to plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reminder data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update reminder in fitness plan
  app.put('/api/fitness-plan-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get the reminder to check ownership
      const reminders = await storage.getFitnessPlanReminders('');
      const reminder = reminders.find(r => r.id === req.params.id);
      
      if (!reminder) {
        return res.status(404).json({ message: 'Reminder not found' });
      }
      
      const plan = await storage.getFitnessPlan(reminder.planId);
      if (!plan || plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updateData = insertFitnessPlanReminderSchema.partial().parse(req.body);
      const updatedReminder = await storage.updatePlanReminder(req.params.id, updateData);
      res.json(updatedReminder);
    } catch (error) {
      console.error('Error updating plan reminder:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reminder data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Remove reminder from fitness plan
  app.delete('/api/fitness-plan-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get the reminder to check ownership
      const reminders = await storage.getFitnessPlanReminders('');
      const reminder = reminders.find(r => r.id === req.params.id);
      
      if (!reminder) {
        return res.status(404).json({ message: 'Reminder not found' });
      }
      
      const plan = await storage.getFitnessPlan(reminder.planId);
      if (!plan || plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.removePlanReminder(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing plan reminder:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Exercise completion routes for weekly progression
  
  // Mark exercise as complete
  app.post('/api/fitness-plans/:planId/exercises/:exerciseId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Mark exercise as complete
      const completion = await storage.markExerciseComplete(user.id, req.params.planId, req.params.exerciseId);
      res.json(completion);
    } catch (error) {
      console.error('Error marking exercise complete:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Record post-workout feedback ("How did that feel?")
  // Implements the Confirmation Rule — counts consecutive same-feeling
  // sessions of the same workoutType for this user and returns the
  // computed adjustment level. Permanent plan changes are NEVER applied
  // here; the level is informational so the next plan-generation pass
  // can act on it.
  //   1 in a row → level: 'none'    (flagged only)
  //   2 in a row → level: 'minor'
  //   3 in a row → level: 'full'
  //   4+         → level: 'escalate'
  // 'just_right' streaks always return 'none' — they are logged but
  // never trigger an adjustment per spec.
  app.post('/api/fitness-plans/:planId/feedback', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const feeling = req.body?.feeling;
      const workoutType = req.body?.workoutType ?? 'standard';
      // completionPct (0..1) — fraction of the session the user actually
      // finished. Defaults to 1.0 when the client doesn't send it (treats
      // legacy callers as fully-completed sessions).
      let completionPct = typeof req.body?.completionPct === 'number'
        ? req.body.completionPct
        : 1;
      if (!Number.isFinite(completionPct)) completionPct = 1;
      completionPct = Math.max(0, Math.min(1, completionPct));
      const isPartial = completionPct < 1;

      if (!['too_hard', 'just_right', 'too_easy'].includes(feeling)) {
        return res.status(400).json({ message: 'Invalid feeling value' });
      }
      if (!['standard', 'standard-cardio', 'hiit', 'stretching'].includes(workoutType)) {
        return res.status(400).json({ message: 'Invalid workoutType' });
      }

      // Edge case: "too easy" + incomplete session is rejected outright.
      // Spec: don't insert the feedback; surface the friendly message.
      if (feeling === 'too_easy' && isPartial) {
        return res.status(400).json({
          code: 'incomplete_too_easy',
          message: 'Finish the full session before we adjust — you might surprise yourself!',
        });
      }

      const row = await storage.recordWorkoutFeedback(
        user.id,
        req.params.planId,
        workoutType,
        feeling,
        completionPct,
      );

      // Walk the most recent feedback rows for this (user, workoutType) and
      // accumulate a *weighted* streak. Same-feeling rows weight 1.0 normally
      // and 0.5 when the session was partially completed (too_hard only —
      // too_easy partials never reach this code per the rejection above).
      // The freshest row is the one we just inserted, so the streak is at
      // least the just-inserted row's weight.
      const recent = await storage.getRecentWorkoutFeedback(user.id, workoutType, 10);
      const weightOf = (r: { feeling: string; completionPct: number | null }) => {
        const pct = r.completionPct ?? 1;
        if (r.feeling === 'too_hard' && pct < 1) return 0.5;
        return 1;
      };
      let weightedStreak = 0;
      for (const r of recent) {
        if (r.feeling === feeling) weightedStreak += weightOf(r);
        else break;
      }
      // Streak as exposed to lever selection / UI is the floored weighted
      // total — so a 0.5 + 0.5 + 1.0 sequence is treated like a streak of 2.
      const streak = Math.floor(weightedStreak);

      // Edge case: alternating too_hard / too_easy feedback. After 4
      // strictly-alternating sessions (no just_right interleaved), suppress
      // every lever and ask the user whether they're happy with the
      // current difficulty. Detection runs on the freshest 4 rows after
      // the most recent reset marker.
      let mixedFeedback = false;
      if (feeling !== 'just_right' && recent.length >= 4) {
        const last4 = recent.slice(0, 4);
        const allHardOrEasy = last4.every(r => r.feeling === 'too_hard' || r.feeling === 'too_easy');
        const strictlyAlternating =
          allHardOrEasy &&
          last4[0].feeling !== last4[1].feeling &&
          last4[1].feeling !== last4[2].feeling &&
          last4[2].feeling !== last4[3].feeling;
        if (strictlyAlternating) mixedFeedback = true;
      }

      let level: 'none' | 'minor' | 'full' | 'escalate' = 'none';
      if (feeling !== 'just_right' && !mixedFeedback) {
        if (streak >= 4) level = 'escalate';
        else if (streak === 3) level = 'full';
        else if (streak === 2) level = 'minor';
      }

      // Pick which adjustment lever should fire for this streak. Levers
      // run from least disruptive (1: rest) to most disruptive (6: level
      // change). 'just_right' never triggers a lever per spec, and an
      // alternating pattern suppresses lever changes entirely until the
      // user resolves the prompt.
      const lever = feeling === 'just_right' || mixedFeedback
        ? null
        : selectLeverForStreak(streak);
      const direction = feeling === 'too_hard' ? 'easier' : feeling === 'too_easy' ? 'harder' : null;

      // Auto-apply the lever for "too hard" / "too easy" feedback
      // (Levers 1–5). Lever 6 normally returns a confirmation prompt
      // instead — the client posts the user's choice to
      // /api/fitness-plans/:planId/level-decision. Lever 6 may also be
      // suppressed by an active cooldown (see below), in which case it
      // is downgraded to Lever 5.
      let adjustment: Awaited<ReturnType<typeof applyTooHardLever>> | null = null;
      let leverIdToFire: TooHardLeverId | null = (lever?.id as TooHardLeverId) ?? null;
      let suppressedLever6 = false;

      // Lever-6 cooldown logic (only relevant for too_easy per spec —
      // too_hard does not yet define a date cooldown). If a cooldown is
      // active OR remaining skip-sessions > 0, downgrade Lever 6 → 5.
      if (feeling === 'too_easy' && leverIdToFire === 6) {
        const now = new Date();
        const cooldownActive = plan.levelDecisionCooldownUntil && new Date(plan.levelDecisionCooldownUntil) > now;
        const skipsLeft = plan.levelDecisionSkipSessions ?? 0;
        if (cooldownActive || skipsLeft > 0) {
          leverIdToFire = 5;
          suppressedLever6 = true;
        }
      }

      // Decrement remaining skip-sessions on every too_easy feedback so
      // the prompt eventually returns. Don't go below 0.
      if (feeling === 'too_easy' && (plan.levelDecisionSkipSessions ?? 0) > 0) {
        await dbForLever6
          .update(fitnessPlansForLever6)
          .set({ levelDecisionSkipSessions: Math.max(0, (plan.levelDecisionSkipSessions ?? 0) - 1) })
          .where(eqForLever6(fitnessPlansForLever6.id, plan.id));
      }

      if (leverIdToFire) {
        const planLevel = ((plan.difficulty || 'beginner').toLowerCase()) as TooHardLevel;
        if (planLevel === 'beginner' || planLevel === 'intermediate' || planLevel === 'advanced') {
          if (feeling === 'too_hard') {
            adjustment = await applyTooHardLever({
              planId: plan.id,
              leverId: leverIdToFire,
              level: planLevel,
              workoutType: workoutType as TooHardWorkoutType,
              sessionMinutes: plan.estimatedDuration ?? 60,
            });
          } else if (feeling === 'too_easy') {
            adjustment = await applyTooEasyLever({
              planId: plan.id,
              leverId: leverIdToFire,
              level: planLevel,
              workoutType: workoutType as TooHardWorkoutType,
              sessionMinutes: plan.estimatedDuration ?? 60,
            }) as any;
          }
        }
      }

      // Persist every change the lever made into the per-change audit
      // log so rollbacks (below + manual) can reverse them precisely.
      if (adjustment && adjustment.applied && adjustment.changes.length > 0 && lever) {
        await logAdjustmentBatch(
          {
            planId: plan.id,
            userId: user.id,
            workoutType,
            leverId: lever.id,
            direction: feeling === 'too_hard' ? 'easier' : 'harder',
          },
          adjustment.changes,
        );
      }

      // Rollback Rules — if the user reports "just right" after a series
      // of "too hard" adjustments, partially unwind:
      //   2 in a row → undo only the most recent lever batch.
      //   3 in a row → restore each touched field to its original
      //                baseline; keep swaps so the user keeps any new
      //                exercises they liked.
      // Cap at 3 — anything beyond just preserves the current state.
      let rollback: any = null;
      if (feeling === 'just_right' && (streak === 2 || streak === 3)) {
        if (streak === 2) {
          rollback = await partialUndoLastBatch({
            planId: plan.id,
            workoutType,
            direction: 'easier',
            reason: 'just_right_streak_2',
          });
        } else {
          rollback = await restoreFieldBaselines({
            planId: plan.id,
            workoutType,
            direction: 'easier',
            reason: 'just_right_streak_3',
          });
        }
      }

      console.log(
        `[workoutFeedback] user=${user.id} type=${workoutType} feeling=${feeling} streak=${streak} level=${level} lever=${lever?.id ?? 'none'} direction=${direction ?? 'none'} applied=${adjustment?.applied ?? false} changes=${adjustment?.changes.length ?? 0} rollback=${rollback ? 'yes' : 'no'}`,
      );

      res.json({
        ...row,
        streak,
        weightedStreak,
        completionPct,
        partial: isPartial,
        level,
        direction,
        lever: lever
          ? {
              id: lever.id,
              name: lever.name,
              description: lever.description,
              requiresConfirmation: lever.requiresConfirmation,
            }
          : null,
        adjustment,
        suppressedLever6,
        rollback,
        // When set, the client should suppress any adjustment summary and
        // instead show the alternating-feedback resolution prompt below.
        mixedFeedback: mixedFeedback
          ? {
              question: 'Your feedback has been mixed — are you happy with the current difficulty?',
              confirmText: "Yes, I'm happy",
              declineText: 'No, let me adjust',
            }
          : null,
      });
    } catch (error) {
      console.error('Error recording workout feedback:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Lever 6 decision — user accepts/declines/postpones a level change
  // after the feedback endpoint surfaced the prompt.
  app.post('/api/fitness-plans/:planId/level-decision', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const decision = req.body?.decision;
      const workoutType = req.body?.workoutType ?? 'standard';
      // Direction tells us whether the prompt was the "too hard" Lever 6
      // (lower the level) or the "too easy" Lever 6 (raise the level).
      // Defaults to 'easier' for backwards-compat with the original UI.
      const direction = req.body?.direction === 'harder' ? 'harder' : 'easier';
      if (!['yes', 'no', 'later'].includes(decision)) {
        return res.status(400).json({ message: 'Invalid decision' });
      }
      if (!['standard', 'standard-cardio', 'hiit', 'stretching'].includes(workoutType)) {
        return res.status(400).json({ message: 'Invalid workoutType' });
      }

      const planLevel = ((plan.difficulty || 'beginner').toLowerCase()) as TooHardLevel;
      if (planLevel !== 'beginner' && planLevel !== 'intermediate' && planLevel !== 'advanced') {
        return res.status(400).json({ message: 'Plan level is invalid' });
      }

      let result: any;
      if (direction === 'harder') {
        result = await applyTooEasyLever6Decision({
          planId: plan.id,
          decision,
          currentLevel: planLevel,
          workoutType: workoutType as TooHardWorkoutType,
          sessionMinutes: plan.estimatedDuration ?? 60,
        });
        // "Not yet" → ask again in 3 sessions. Persist the counter so the
        // feedback route can suppress + decrement it.
        if (decision === 'later') {
          await dbForLever6
            .update(fitnessPlansForLever6)
            .set({ levelDecisionSkipSessions: 3 })
            .where(eqForLever6(fitnessPlansForLever6.id, plan.id));
        }
        // "Yes" → reset cooldowns / counters and wipe the streak counter
        // for every workout type since the level just changed.
        if (decision === 'yes') {
          await dbForLever6
            .update(fitnessPlansForLever6)
            .set({ levelDecisionCooldownUntil: null, levelDecisionSkipSessions: 0 })
            .where(eqForLever6(fitnessPlansForLever6.id, plan.id));
          await storage.resetWorkoutStreaks(user.id, 'lever6_level_up');
        }
      } else {
        result = await applyLever6Decision({
          planId: plan.id,
          decision,
          currentLevel: planLevel,
          workoutType: workoutType as TooHardWorkoutType,
          sessionMinutes: plan.estimatedDuration ?? 60,
        });
        // Mirror the streak reset for the too-hard Lever 6 yes path.
        if (decision === 'yes') {
          await storage.resetWorkoutStreaks(user.id, 'lever6_level_down');
        }
      }

      console.log(
        `[lever6] user=${user.id} plan=${plan.id} direction=${direction} decision=${decision} applied=${result.applied} changes=${result.changes.length}`,
      );

      res.json(result);
    } catch (error) {
      console.error('Error applying level decision:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Full rollback — user-initiated only. Reverses every un-rolled-back
  // adjustment for the plan: restores removed exercises, undoes swaps,
  // resets rest/reps/sets to their original baselines. Logged.
  app.post('/api/fitness-plans/:planId/rollback', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const reason = (req.body?.reason || 'user_requested').toString().slice(0, 32);
      const result = await fullRollback({ planId: plan.id, reason });

      console.log(
        `[fullRollback] user=${user.id} plan=${plan.id} reason=${reason} entries=${result.entries} batches=${result.batches}`,
      );

      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Error performing full rollback:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Resolution for the alternating-feedback prompt. The client posts the
  // user's answer to "are you happy with the current difficulty?". A
  // "yes" inserts a streak-reset marker for this workoutType so the
  // alternation is forgotten and current settings are preserved. A
  // "no" returns ok and the client opens the manual difficulty UI; we
  // do nothing server-side because the level change itself happens via
  // PUT /api/fitness-plans/:id and that already wipes streaks.
  app.post('/api/fitness-plans/:planId/feedback/mixed-resolved', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const happy = req.body?.happy === true;
      const workoutType = (req.body?.workoutType ?? 'standard').toString();
      if (!['standard', 'standard-cardio', 'hiit', 'stretching'].includes(workoutType)) {
        return res.status(400).json({ message: 'Invalid workoutType' });
      }

      if (happy) {
        await storage.resetWorkoutStreaks(user.id, 'mixed_feedback_accepted', [workoutType]);
        console.log(`[mixedFeedback] user=${user.id} type=${workoutType} resolved=happy streakReset=yes`);
      } else {
        console.log(`[mixedFeedback] user=${user.id} type=${workoutType} resolved=adjust`);
      }

      res.json({ ok: true, happy });
    } catch (error) {
      console.error('Error resolving mixed feedback:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // -----------------------------------------------------------------
  // Manual difficulty overrides
  // -----------------------------------------------------------------
  // The user pulls the "Fine-tune your workout difficulty" sliders
  // (rest ±5s, intensity ±2 reps, volume ±1 set). We apply the deltas
  // to every exercise in the plan immediately, log each change with
  // direction='manual' so the audit trail can distinguish manual vs
  // automatic adjustments, and explicitly do NOT touch the streak
  // counter — manual tweaks coexist with the automatic engine.
  app.post('/api/fitness-plans/:planId/manual-override', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const restDeltaRaw = Number(req.body?.restDelta ?? 0);
      const repsDeltaRaw = Number(req.body?.repsDelta ?? 0);
      const setsDeltaRaw = Number(req.body?.setsDelta ?? 0);
      const workoutType = (req.body?.workoutType ?? 'standard').toString();

      // Clamp + snap inputs. UI uses 5-sec steps for rest, 2-rep steps
      // for intensity, 1-set steps for volume.
      const restDelta = Math.max(-60, Math.min(60, Math.round(restDeltaRaw / 5) * 5));
      const repsDelta = Math.max(-6, Math.min(6, Math.round(repsDeltaRaw / 2) * 2));
      const setsDelta = Math.max(-3, Math.min(3, Math.round(setsDeltaRaw)));

      if (restDelta === 0 && repsDelta === 0 && setsDelta === 0) {
        return res.status(400).json({ message: 'No changes — pick a slider value' });
      }

      const exercises = await storage.getFitnessPlanExercises(plan.id);
      const changes: Array<{
        planExerciseId: string;
        exerciseName: string;
        field: 'restTime' | 'reps' | 'sets';
        before: string;
        after: string;
      }> = [];

      // Helper: add a delta to a reps string. "10"→"12", "10-12"→"12-14".
      // Time-based reps ("30 seconds", "30s", "1 minute") are left alone
      // because intensity-by-reps is meaningless for them.
      const adjustReps = (current: string, delta: number): string | null => {
        const trimmed = (current || '').trim();
        if (!trimmed) return null;
        if (/[a-zA-Z]/.test(trimmed)) return null; // time-based
        const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
          const lo = Math.max(1, parseInt(range[1], 10) + delta);
          const hi = Math.max(lo, parseInt(range[2], 10) + delta);
          return `${lo}-${hi}`;
        }
        const num = trimmed.match(/^\d+$/);
        if (num) {
          const v = Math.max(1, parseInt(trimmed, 10) + delta);
          return String(v);
        }
        return null;
      };

      for (const ex of exercises) {
        const updates: Partial<{ restTime: number; reps: string; sets: number }> = {};

        if (restDelta !== 0 && typeof ex.restTime === 'number') {
          const next = Math.max(10, Math.min(300, ex.restTime + restDelta));
          if (next !== ex.restTime) {
            updates.restTime = next;
            changes.push({
              planExerciseId: ex.id,
              exerciseName: ex.exerciseName,
              field: 'restTime',
              before: String(ex.restTime),
              after: String(next),
            });
          }
        }

        if (repsDelta !== 0 && ex.reps != null) {
          const nextReps = adjustReps(String(ex.reps), repsDelta);
          if (nextReps && nextReps !== String(ex.reps)) {
            updates.reps = nextReps;
            changes.push({
              planExerciseId: ex.id,
              exerciseName: ex.exerciseName,
              field: 'reps',
              before: String(ex.reps),
              after: nextReps,
            });
          }
        }

        if (setsDelta !== 0 && typeof ex.sets === 'number') {
          const next = Math.max(1, Math.min(10, ex.sets + setsDelta));
          if (next !== ex.sets) {
            updates.sets = next;
            changes.push({
              planExerciseId: ex.id,
              exerciseName: ex.exerciseName,
              field: 'sets',
              before: String(ex.sets),
              after: String(next),
            });
          }
        }

        if (Object.keys(updates).length > 0) {
          await storage.updatePlanExercise(ex.id, updates);
        }
      }

      // Persist to the audit log with direction='manual'. leverId 0
      // is reserved for manual entries so they can be filtered easily
      // and never collide with automatic levers (1–6).
      let batchId: string | null = null;
      if (changes.length > 0) {
        batchId = await logAdjustmentBatch(
          {
            planId: plan.id,
            userId: user.id,
            workoutType,
            leverId: 0,
            // Cast — schema column is constrained to easier|harder in
            // TS but the underlying varchar accepts 'manual' and we
            // distinguish it via leverId=0 elsewhere.
            direction: 'manual' as any,
          },
          changes.map(c => ({
            planExerciseId: c.planExerciseId,
            exerciseName: c.exerciseName,
            field: c.field,
            before: c.before,
            after: c.after,
          })) as any,
        );
      }

      console.log(
        `[manualOverride] user=${user.id} plan=${plan.id} restDelta=${restDelta} repsDelta=${repsDelta} setsDelta=${setsDelta} changes=${changes.length} batch=${batchId ?? 'none'}`,
      );

      res.json({
        ok: true,
        applied: changes.length > 0,
        batchId,
        restDelta,
        repsDelta,
        setsDelta,
        changes,
      });
    } catch (error) {
      console.error('Error applying manual override:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // "Reset to default for my level" — rewinds every un-rolled-back
  // adjustment (manual or automatic) back to the original baselines.
  // Re-uses the full-rollback engine with a distinct reason so it shows
  // up clearly in the audit history.
  app.post('/api/fitness-plans/:planId/reset-defaults', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const result = await fullRollback({ planId: plan.id, reason: 'reset_to_default' });
      console.log(`[resetDefaults] user=${user.id} plan=${plan.id} entries=${result.entries} batches=${result.batches}`);
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Error resetting to defaults:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Adjustment history — read-only audit feed for the "See my
  // adjustment history" link. Returns newest first, capped at 50, with
  // a `source` discriminator (manual vs automatic) so the UI can render
  // them differently.
  app.get('/api/fitness-plans/:planId/adjustment-history', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) return res.status(404).json({ message: 'Fitness plan not found' });
      if (plan.userId !== user.id) return res.status(403).json({ message: 'Access denied' });

      const rows = await dbForLever6
        .select()
        .from(workoutAdjustmentLog)
        .where(eqForLever6(workoutAdjustmentLog.planId, plan.id))
        .orderBy(desc(workoutAdjustmentLog.appliedAt))
        .limit(50);

      const history = rows.map(r => ({
        id: r.id,
        appliedAt: r.appliedAt,
        source: r.leverId === 0 ? 'manual' : 'automatic',
        leverId: r.leverId,
        direction: r.direction,
        field: r.field,
        exerciseName: r.exerciseName,
        before: r.beforeVal,
        after: r.afterVal,
        batchId: r.batchId,
        rolledBackAt: r.rolledBackAt,
        rollbackReason: r.rollbackReason,
      }));

      res.json({ history });
    } catch (error) {
      console.error('Error loading adjustment history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all workout sessions (feedback rows) for the current user, joined with plan name
  app.get('/api/workout-history', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const sessions = await db
        .select({
          id: schema.workoutFeedback.id,
          planId: schema.workoutFeedback.planId,
          planName: schema.fitnessPlans.name,
          workoutType: schema.workoutFeedback.workoutType,
          feeling: schema.workoutFeedback.feeling,
          completionPct: schema.workoutFeedback.completionPct,
          createdAt: schema.workoutFeedback.createdAt,
        })
        .from(schema.workoutFeedback)
        .innerJoin(schema.fitnessPlans, eq(schema.fitnessPlans.id, schema.workoutFeedback.planId))
        .where(eq(schema.workoutFeedback.userId, user.id))
        .orderBy(desc(schema.workoutFeedback.createdAt))
        .limit(50);

      res.json({ sessions });
    } catch (error) {
      console.error('Error loading workout history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Unmark exercise as complete
  app.delete('/api/fitness-plans/:planId/exercises/:exerciseId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Remove exercise completion
      await storage.unmarkExerciseComplete(user.id, req.params.exerciseId);
      res.status(204).send();
    } catch (error) {
      console.error('Error unmarking exercise complete:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get completion status for a plan
  app.get('/api/fitness-plans/:planId/completions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check ownership of plan
      const plan = await storage.getFitnessPlan(req.params.planId);
      if (!plan) {
        return res.status(404).json({ message: 'Fitness plan not found' });
      }
      
      if (plan.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get all completions for this plan
      const completions = await storage.getExerciseCompletions(user.id, req.params.planId);
      res.json(completions);
    } catch (error) {
      console.error('Error fetching exercise completions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Fitness Community ─────────────────────────────────────────────────────

  // Fitness access is now free for all authenticated users.
  // Middleware kept (rather than removed at every call site) so the
  // route signatures stay stable; it just loads the user and passes through.
  const requireFitnessAccess = async (req: any, res: any, next: any) => {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    req.fitnessUser = user;
    next();
  };

  // Upload media for fitness community post
  app.post('/api/fitness/community/upload-media', isAuthenticated, requireFitnessAccess, communityMediaUpload.array('media', 5), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }
      const results = await Promise.all((req.files as Express.Multer.File[]).map(async file => {
        let mediaType = 'image';
        if (file.mimetype.startsWith('video/')) mediaType = 'video';
        else if (file.mimetype === 'image/gif') mediaType = 'gif';
        const ext = file.originalname.split('.').pop() || 'bin';
        const key = `community/community-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const url = await uploadPublicFile(file.buffer, key, file.mimetype);
        return { url, type: mediaType };
      }));
      res.json({ files: results });
    } catch (error) {
      console.error('Error uploading fitness community media:', error);
      res.status(500).json({ message: 'Upload failed' });
    }
  });

  // Get all fitness community posts
  app.get('/api/fitness/community/posts', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const posts = await db
        .select({
          id: schema.fitnessPosts.id,
          content: schema.fitnessPosts.content,
          mediaUrls: schema.fitnessPosts.mediaUrls,
          mediaTypes: schema.fitnessPosts.mediaTypes,
          category: schema.fitnessPosts.category,
          likes: schema.fitnessPosts.likes,
          createdAt: schema.fitnessPosts.createdAt,
          userId: schema.fitnessPosts.userId,
          authorName: schema.users.firstName,
          authorLastName: schema.users.lastName,
          authorProfilePicture: schema.users.profileImageUrl,
        })
        .from(schema.fitnessPosts)
        .leftJoin(schema.users, eq(schema.fitnessPosts.userId, schema.users.id))
        .orderBy(desc(schema.fitnessPosts.createdAt))
        .limit(100);

      // Get user's liked posts
      const likedRows = await db
        .select({ postId: schema.fitnessPostLikes.postId })
        .from(schema.fitnessPostLikes)
        .where(eq(schema.fitnessPostLikes.userId, userId));
      const likedSet = new Set(likedRows.map(r => r.postId));

      // Get user's Oh Me reactions
      const ohMeRows = await db
        .select({ postId: schema.fitnessPostOhMes.postId })
        .from(schema.fitnessPostOhMes)
        .where(eq(schema.fitnessPostOhMes.userId, userId));
      const ohMeSet = new Set(ohMeRows.map(r => r.postId));

      // Get oh-me counts per post
      const ohMeCounts = await db
        .select({ postId: schema.fitnessPostOhMes.postId, cnt: count(schema.fitnessPostOhMes.id) })
        .from(schema.fitnessPostOhMes)
        .groupBy(schema.fitnessPostOhMes.postId);
      const ohMeCountMap = new Map(ohMeCounts.map(r => [r.postId, Number(r.cnt)]));

      // Get comment counts per post
      const commentCounts = await db
        .select({ postId: schema.fitnessPostComments.postId, cnt: count(schema.fitnessPostComments.id) })
        .from(schema.fitnessPostComments)
        .groupBy(schema.fitnessPostComments.postId);
      const commentCountMap = new Map(commentCounts.map(r => [r.postId, Number(r.cnt)]));

      const result = posts.map(p => ({
        ...p,
        content: maskMentionIds(p.content),
        authorName: `${p.authorName || ''} ${p.authorLastName || ''}`.trim() || 'Member',
        likedByMe: likedSet.has(p.id),
        ohMeByMe: ohMeSet.has(p.id),
        ohMeCount: ohMeCountMap.get(p.id) || 0,
        commentCount: commentCountMap.get(p.id) || 0,
      }));
      res.json(result);
    } catch (error) {
      console.error('Error fetching fitness community posts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create a fitness community post
  app.post('/api/fitness/community/posts', isAuthenticated, requireFitnessAccess, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const { content, mediaUrls, mediaTypes, category } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Content is required' });
      }
      const [post] = await db.insert(schema.fitnessPosts).values({
        userId,
        content: content.trim(),
        mediaUrls: mediaUrls || null,
        mediaTypes: mediaTypes || null,
        category: category || 'encouragement',
      }).returning();
      res.json({ ...post, content: maskMentionIds(post.content) });

      // Fan-out: notify ALL users who have not explicitly opted out of fitnessCommunityNotifications
      setImmediate(async () => {
        try {
          const poster = await storage.getUser(userId);
          // Get all users (default pref is ON), then exclude those who explicitly opted out
          const allUsers = await storage.getAllUsers();
          const optedOut = new Set(
            (await db
              .select({ userId: schema.notificationPreferences.userId })
              .from(schema.notificationPreferences)
              .where(eq(schema.notificationPreferences.fitnessCommunityNotifications, false))
            ).map(r => r.userId)
          );
          for (const u of allUsers) {
            if (u.id === userId) continue; // don't notify the poster
            if (optedOut.has(u.id)) continue;
            try {
              await storage.createNotificationWithPreferences({
                userId: u.id,
                type: 'fitness_community',
                title: 'New Fitness Post',
                message: `${poster?.firstName || 'A brother'} shared something in the Fitness Community.`,
                relatedId: post.id,
                linkUrl: `/fitness?tab=community&post=${post.id}`,
              });
            } catch (notifErr) {
              console.error(`[FitnessCommunity] Failed to notify user ${u.id} on new post:`, notifErr);
            }
          }
        } catch (err) {
          console.error('[FitnessCommunity] Fan-out error on new post:', err);
        }
      });
    } catch (error) {
      console.error('Error creating fitness community post:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Toggle like on a fitness community post
  app.post('/api/fitness/community/posts/:id/like', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const postId = req.params.id;

      const existing = await db
        .select()
        .from(schema.fitnessPostLikes)
        .where(and(eq(schema.fitnessPostLikes.postId, postId), eq(schema.fitnessPostLikes.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(schema.fitnessPostLikes).where(
          and(eq(schema.fitnessPostLikes.postId, postId), eq(schema.fitnessPostLikes.userId, userId))
        );
        await db.update(schema.fitnessPosts)
          .set({ likes: sql`GREATEST(0, ${schema.fitnessPosts.likes} - 1)` })
          .where(eq(schema.fitnessPosts.id, postId));
        return res.json({ liked: false });
      } else {
        await db.insert(schema.fitnessPostLikes).values({ postId, userId });
        await db.update(schema.fitnessPosts)
          .set({ likes: sql`${schema.fitnessPosts.likes} + 1` })
          .where(eq(schema.fitnessPosts.id, postId));
        // Send notification to post author (if not self)
        const [post] = await db.select().from(schema.fitnessPosts).where(eq(schema.fitnessPosts.id, postId)).limit(1);
        if (post && post.userId !== userId) {
          try {
            await storage.createNotificationWithPreferences({
              userId: post.userId,
              type: 'fitness_community',
              title: 'Amen! 🙏',
              message: 'Someone Amened your fitness post.',
              relatedId: postId,
              linkUrl: `/fitness?tab=community&post=${postId}`,
            });
          } catch (e) {
            console.error('[FitnessCommunity] Failed to notify post author on like:', e);
          }
        }
        return res.json({ liked: true });
      }
    } catch (error) {
      console.error('Error toggling fitness post like:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete a fitness community post (owner or admin)
  app.delete('/api/fitness/community/posts/:id', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const user = req.fitnessUser;
      const [post] = await db
        .select()
        .from(schema.fitnessPosts)
        .where(eq(schema.fitnessPosts.id, req.params.id))
        .limit(1);
      if (!post) return res.status(404).json({ message: 'Post not found' });
      if (post.userId !== user.id && !isAdmin(user)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      await db.delete(schema.fitnessPosts).where(eq(schema.fitnessPosts.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting fitness community post:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Fitness Community — Oh Me reactions ────────────────────────────────────

  app.post('/api/fitness/community/posts/:id/ohme', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const postId = req.params.id;

      const existing = await db
        .select()
        .from(schema.fitnessPostOhMes)
        .where(and(eq(schema.fitnessPostOhMes.postId, postId), eq(schema.fitnessPostOhMes.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(schema.fitnessPostOhMes).where(
          and(eq(schema.fitnessPostOhMes.postId, postId), eq(schema.fitnessPostOhMes.userId, userId))
        );
        return res.json({ ohMe: false });
      } else {
        await db.insert(schema.fitnessPostOhMes).values({ postId, userId });
        // Send notification to post author (if not self)
        const [post] = await db.select().from(schema.fitnessPosts).where(eq(schema.fitnessPosts.id, postId)).limit(1);
        if (post && post.userId !== userId) {
          try {
            await storage.createNotificationWithPreferences({
              userId: post.userId,
              type: 'fitness_community',
              title: 'Oh Me! 😩',
              message: 'Someone reacted "Oh Me" to your fitness post.',
              relatedId: postId,
              linkUrl: `/fitness?tab=community&post=${postId}`,
            });
          } catch (e) {
            console.error('[FitnessCommunity] Failed to notify post author on Oh Me:', e);
          }
        }
        return res.json({ ohMe: true });
      }
    } catch (error) {
      console.error('Error toggling fitness post Oh Me:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Who Amened / Oh Me'd a fitness community post
  app.get('/api/fitness/community/posts/:id/likers', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const postId = req.params.id;
      const rows = await db
        .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, profileImageUrl: schema.users.profileImageUrl })
        .from(schema.fitnessPostLikes)
        .innerJoin(schema.users, eq(schema.fitnessPostLikes.userId, schema.users.id))
        .where(eq(schema.fitnessPostLikes.postId, postId))
        .orderBy(desc(schema.fitnessPostLikes.createdAt));
      res.json(rows);
    } catch (error) {
      console.error('Error fetching fitness post likers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/fitness/community/posts/:id/oh-mes', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const postId = req.params.id;
      const rows = await db
        .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, profileImageUrl: schema.users.profileImageUrl })
        .from(schema.fitnessPostOhMes)
        .innerJoin(schema.users, eq(schema.fitnessPostOhMes.userId, schema.users.id))
        .where(eq(schema.fitnessPostOhMes.postId, postId))
        .orderBy(desc(schema.fitnessPostOhMes.createdAt));
      res.json(rows);
    } catch (error) {
      console.error('Error fetching fitness post Oh Me\'s:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


  // ─── Fitness Community — Comments ────────────────────────────────────────────

  app.get('/api/fitness/community/posts/:id/comments', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const comments = await db
        .select({
          id: schema.fitnessPostComments.id,
          postId: schema.fitnessPostComments.postId,
          userId: schema.fitnessPostComments.userId,
          content: schema.fitnessPostComments.content,
          parentCommentId: schema.fitnessPostComments.parentCommentId,
          createdAt: schema.fitnessPostComments.createdAt,
          authorName: schema.users.firstName,
          authorLastName: schema.users.lastName,
          authorProfilePicture: schema.users.profileImageUrl,
        })
        .from(schema.fitnessPostComments)
        .leftJoin(schema.users, eq(schema.fitnessPostComments.userId, schema.users.id))
        .where(eq(schema.fitnessPostComments.postId, req.params.id))
        .orderBy(asc(schema.fitnessPostComments.createdAt));

      res.json(comments.map(c => ({
        ...c,
        content: maskMentionIds(c.content),
        authorName: `${c.authorName || ''} ${c.authorLastName || ''}`.trim() || 'Member',
      })));
    } catch (error) {
      console.error('Error fetching fitness post comments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/fitness/community/posts/:id/comments', isAuthenticated, requireFitnessAccess, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const postId = req.params.id;
      const { content, parentCommentId } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Content is required' });
      }

      const [comment] = await db
        .insert(schema.fitnessPostComments)
        .values({ postId, userId, content: content.trim(), parentCommentId: parentCommentId || null })
        .returning();

      // Notify post author (if not commenter)
      const [post] = await db.select().from(schema.fitnessPosts).where(eq(schema.fitnessPosts.id, postId)).limit(1);
      if (post && post.userId !== userId) {
        const prefs = await storage.getNotificationPreferences(post.userId);
        if (!prefs || prefs.fitnessCommunityNotifications !== false) {
          try {
            await storage.createNotificationWithPreferences({
              userId: post.userId,
              type: 'fitness_community',
              title: '💬 New Comment',
              message: 'Someone commented on your fitness post.',
              relatedId: postId,
              linkUrl: `/fitness?tab=community&post=${postId}`,
            });
          } catch (e) {
            console.error('[FitnessCommunity] Failed to notify post author on comment:', e);
          }
        }
      }

      // Notify other commenters on this post (excluding author + commenter)
      const priorCommenters = await db
        .selectDistinct({ userId: schema.fitnessPostComments.userId })
        .from(schema.fitnessPostComments)
        .where(and(eq(schema.fitnessPostComments.postId, postId)));
      const notified = new Set<string>([userId, post?.userId ?? '']);
      for (const { userId: commenterId } of priorCommenters) {
        if (!notified.has(commenterId)) {
          notified.add(commenterId);
          const prefs = await storage.getNotificationPreferences(commenterId);
          if (!prefs || prefs.fitnessCommunityNotifications !== false) {
            try {
              await storage.createNotificationWithPreferences({
                userId: commenterId,
                type: 'fitness_community',
                title: '💬 New Reply',
                message: 'Someone replied on a fitness post you commented on.',
                relatedId: postId,
                linkUrl: `/fitness?tab=community&post=${postId}`,
              });
            } catch (e) {
              console.error('[FitnessCommunity] Failed to notify prior commenter:', e);
            }
          }
        }
      }

      res.json({ ...comment, content: maskMentionIds(comment.content) });
    } catch (error) {
      console.error('Error creating fitness post comment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/fitness/community/comments/:id', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const user = req.fitnessUser;
      const [comment] = await db
        .select()
        .from(schema.fitnessPostComments)
        .where(eq(schema.fitnessPostComments.id, req.params.id))
        .limit(1);
      if (!comment) return res.status(404).json({ message: 'Comment not found' });
      if (comment.userId !== user.id && !isAdmin(user)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      await db.delete(schema.fitnessPostComments).where(eq(schema.fitnessPostComments.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting fitness post comment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Edit a fitness post comment (owner only)
  app.patch('/api/fitness/community/comments/:id', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const user = req.fitnessUser;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Content is required' });
      }
      const [comment] = await db
        .select()
        .from(schema.fitnessPostComments)
        .where(eq(schema.fitnessPostComments.id, req.params.id))
        .limit(1);
      if (!comment) return res.status(404).json({ message: 'Comment not found' });
      if (comment.userId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const [updated] = await db
        .update(schema.fitnessPostComments)
        .set({ content: content.trim() })
        .where(eq(schema.fitnessPostComments.id, req.params.id))
        .returning();
      res.json({ ...updated, content: maskMentionIds(updated.content) });
    } catch (error) {
      console.error('Error editing fitness post comment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Health Metrics ─────────────────────────────────────────────────────────

  const VALID_METRIC_TYPES: readonly HealthMetricType[] = ['steps', 'heart_rate', 'sleep', 'weight'] as const;

  app.get('/api/health-metrics', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const type = req.query.type as string;
      if (!VALID_METRIC_TYPES.includes(type as HealthMetricType)) {
        return res.status(400).json({ message: 'Invalid metric type' });
      }
      const rawLimit = parseInt(req.query.limit as string) || 30;
      const limit = Math.min(Math.max(rawLimit, 1), 90);
      const entries = await storage.getHealthMetrics(userId, type, limit);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching health metrics:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/health-metrics', isAuthenticated, requireFitnessAccess, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const parsed = insertHealthMetricSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      if (!VALID_METRIC_TYPES.includes(parsed.data.metricType as HealthMetricType)) {
        return res.status(400).json({ message: 'Invalid metric type' });
      }
      if (
        parsed.data.metricType === 'sleep' &&
        parsed.data.secondaryValue !== undefined &&
        parsed.data.secondaryValue !== null &&
        (parsed.data.secondaryValue < 1 || parsed.data.secondaryValue > 5)
      ) {
        return res.status(400).json({ message: 'Sleep quality must be between 1 and 5' });
      }
      const entry = await storage.createHealthMetric(parsed.data);
      res.json(entry);
    } catch (error) {
      console.error('Error creating health metric:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/health-metrics/:id', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const deleted = await storage.deleteHealthMetric(req.params.id, userId);
      if (!deleted) return res.status(404).json({ message: 'Health metric not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting health metric:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Health Goals ────────────────────────────────────────────────────────────

  app.get('/api/health-goals', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const goals = await storage.getHealthGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error('Error fetching health goals:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/health-goals/:type', isAuthenticated, requireFitnessAccess, async (req: any, res) => {
    try {
      const userId = req.fitnessUser.id;
      const rawType = req.params.type;
      if (!VALID_METRIC_TYPES.includes(rawType as HealthMetricType)) {
        return res.status(400).json({ message: 'Invalid metric type' });
      }
      const metricType = rawType as HealthMetricType;
      const targetValue = parseFloat(req.body.targetValue);
      if (!Number.isFinite(targetValue) || targetValue < 0 || targetValue > 1_000_000) {
        return res.status(400).json({ message: 'targetValue must be a finite non-negative number within range' });
      }
      const goal = await storage.upsertHealthGoal(userId, metricType, targetValue);
      res.json(goal);
    } catch (error) {
      console.error('Error upserting health goal:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── User Injuries ───────────────────────────────────────────────────────────

  app.get('/api/user/injuries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const injuries = await storage.getUserInjuries(userId);
      res.json(injuries);
    } catch (error) {
      console.error('Error fetching user injuries:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/user/injuries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertUserInjurySchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid injury data', errors: parsed.error.errors });
      }
      const injury = await storage.createUserInjury(parsed.data);
      res.status(201).json(injury);
    } catch (error) {
      console.error('Error creating user injury:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/user/injuries/clear', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearUserInjuries(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing user injuries:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/user/injuries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteUserInjury(req.params.id, userId);
      if (!deleted) return res.status(404).json({ message: 'Injury not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user injury:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Audit log: user clicked "Accept" on the pre-workout warning that some of
  // today's planned exercises may aggravate a recorded injury. Stores the
  // exact list of flagged exercises and a server-stamped acknowledgedAt time.
  app.post('/api/workout-injury-acknowledgements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertWorkoutInjuryAcknowledgementSchema.safeParse({
        ...req.body,
        userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid acknowledgement payload', issues: parsed.error.issues });
      }
      const row = await storage.createWorkoutInjuryAcknowledgement(parsed.data);
      res.status(201).json(row);
    } catch (error) {
      console.error('Error creating workout injury acknowledgement:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ALWAYS-INCLUDE recommendations for the user's injuries (e.g., McGill Big
  // Three for lower back, rotator-cuff maintenance for shoulders). Returned
  // in the form expected by InjuriesPanel — see shared/injuryFilter.ts for
  // the per-body-part rule packs.
  app.get('/api/user/injuries/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const injuries = await storage.getUserInjuries(userId);
      const { getInjuryRecommendations } = await import('@shared/injuryFilter');
      const recs = getInjuryRecommendations(injuries.map(i => ({
        bodyArea: i.bodyArea,
        injuryType: i.injuryType,
        startedAt: i.startedAt,
        weekNumber: i.weekNumber,
      })));
      res.json(recs);
    } catch (error) {
      console.error('Error fetching injury recommendations:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Meal Reminders ─────────────────────────────────────────────────────────

  app.get('/api/meal-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reminders = await storage.getMealReminders(userId);
      res.json(reminders);
    } catch (error) {
      console.error('Error fetching meal reminders:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', ''];

  app.post('/api/meal-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { time, label, mealType } = req.body;
      if (!time) return res.status(400).json({ message: 'time is required' });
      const sanitizedMealType = mealType && VALID_MEAL_TYPES.includes(mealType) ? mealType : '';
      const reminder = await storage.addMealReminder({ userId, time, label: label || '', mealType: sanitizedMealType, isActive: true });
      res.json(reminder);
    } catch (error) {
      console.error('Error adding meal reminder:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/meal-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { time, label, mealType } = req.body;
      if (!time) return res.status(400).json({ message: 'time is required' });
      const sanitizedMealType = mealType !== undefined
        ? (VALID_MEAL_TYPES.includes(mealType) ? mealType : '')
        : undefined;
      const reminder = await storage.updateMealReminder(req.params.id, userId, { time, label, mealType: sanitizedMealType });
      if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
      res.json(reminder);
    } catch (error) {
      console.error('Error updating meal reminder:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/meal-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteMealReminder(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting meal reminder:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─── Events routes ──────────────────────────────────────────────────────────

  // Events routes
  app.get('/api/events', async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create event (admin only)
  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Log what we're receiving
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Manually prepare the data with proper types
      const dataToValidate = {
        ...req.body,
        createdBy: user.id,
        eventDate: req.body.eventDate, // Keep as string for schema transform
        requiresPurchase: req.body.requiresPurchase === 'true' || req.body.requiresPurchase === true,
        isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
        maxAttendees: req.body.maxAttendees ? parseInt(req.body.maxAttendees) : undefined
      };
      
      console.log('Data to validate:', JSON.stringify(dataToValidate, null, 2));
      
      const eventData = insertEventSchema.parse(dataToValidate);

      const event = await storage.createEvent(eventData);

      // Send notifications to all users about the new event
      try {
        const allUsers = await storage.getAllUsers(10000);
        const targetUsers = allUsers.filter(u => u.id !== user.id);
        
        if (targetUsers.length > 0) {
          const dateStr = new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const locationStr = event.location ? ` at ${event.location}` : '';
          const notificationPromises = targetUsers.map(async (targetUser) => {
            return await storage.createNotificationWithPreferences({
              userId: targetUser.id,
              type: 'event',
              title: '📅 New Event Announced',
              message: `"${event.title}" on ${dateStr}${locationStr}. Check it out!`,
              relatedId: event.id,
            }, { url: '/events' });
          });
          
          await Promise.all(notificationPromises.filter(Boolean));
          console.log(`Sent new event notifications to ${targetUsers.length} users`);
        }
      } catch (notificationError) {
        console.error('Error sending event notifications:', notificationError);
      }

      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating event:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update event (admin only)
  app.put('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const eventData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, eventData);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      res.json(event);
    } catch (error) {
      console.error('Error updating event:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete event (admin only)
  app.delete('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get tiers for an event
  app.get('/api/events/:id/tiers', async (req, res) => {
    try {
      const tiers = await storage.getEventTiers(req.params.id);
      res.json(tiers);
    } catch (error) {
      console.error('Error fetching event tiers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Replace tiers for an event (admin only)
  app.post('/api/admin/events/:id/tiers', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { tiers } = req.body;
      if (!Array.isArray(tiers)) {
        return res.status(400).json({ message: "tiers must be an array" });
      }
      const saved = await storage.replaceEventTiers(req.params.id, tiers);
      res.json(saved);
    } catch (error) {
      console.error('Error saving event tiers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all registrants for an event (admin only)
  app.get('/api/admin/events/:id/registrations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const registrants = await storage.getEventRegistrations(req.params.id);
      res.json(registrants);
    } catch (error) {
      console.error('Error fetching event registrations:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create payment intent for event ticket purchase
  app.post('/api/events/:id/payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      const { amount, tierName } = req.body;

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Valid amount is required' });
      }

      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        metadata: {
          eventId,
          eventTitle: event.title,
          tierName: tierName || '',
          userId,
        },
        description: tierName
          ? `${event.title} — ${tierName}`
          : event.title,
      });

      res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error: any) {
      console.error('Error creating event payment intent:', error);
      res.status(500).json({ message: error.message || 'Failed to create payment intent' });
    }
  });

  // Confirm paid event registration after successful Stripe payment
  app.post('/api/events/:id/confirm-purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      const { paymentIntentId, amountPaid, tierName } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: 'paymentIntentId is required' });
      }

      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const existing = await storage.getEventRegistration(eventId, userId);
      if (existing) {
        return res.status(409).json({ message: 'Already registered for this event' });
      }

      const registration = await storage.registerForEvent({
        eventId,
        userId,
        registrationType: 'paid',
        paymentStatus: 'completed',
        paymentIntentId,
        amountPaid: amountPaid?.toString() ?? '0',
        tierName: tierName ?? null,
      });

      res.status(201).json(registration);
    } catch (error: any) {
      console.error('Error confirming event purchase:', error);
      res.status(500).json({ message: error.message || 'Failed to confirm purchase' });
    }
  });

  // Register for event after completing payment via an external (hosted) Stripe URL
  app.post('/api/events/:id/register-external-purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      const { tierName } = req.body;

      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const existing = await storage.getEventRegistration(eventId, userId);
      if (existing) {
        return res.status(409).json({ message: 'Already registered for this event' });
      }

      const registration = await storage.registerForEvent({
        eventId,
        userId,
        registrationType: 'paid',
        paymentStatus: 'completed',
        tierName: tierName ?? null,
      });

      res.status(201).json(registration);
    } catch (error: any) {
      console.error('Error registering external purchase:', error);
      res.status(500).json({ message: error.message || 'Failed to register purchase' });
    }
  });

  // Register for event (free events)
  app.post('/api/events/:id/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      if (event.requiresPurchase) {
        return res.status(400).json({ message: 'This event requires payment. Use the purchase endpoint instead.' });
      }
      
      // Check if user is already registered
      const existingRegistration = await storage.getEventRegistration(eventId, userId);
      if (existingRegistration) {
        return res.status(400).json({ message: 'You are already registered for this event' });
      }
      
      const registration = await storage.registerForEvent({
        eventId,
        userId,
        registrationType: 'free',
        paymentStatus: 'completed'
      });
      
      res.status(201).json(registration);
    } catch (error) {
      console.error('Error registering for event:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user's event registrations
  app.get('/api/events/registrations/my', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const registrations = await storage.getUserEventRegistrations(userId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching user registrations:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create payment intent for event purchase
  app.post('/api/events/:id/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      if (!event.requiresPurchase || !event.price) {
        return res.status(400).json({ message: 'This event does not require payment' });
      }
      
      // Check if already registered
      const existingRegistration = await storage.getEventRegistration(eventId, userId);
      if (existingRegistration && existingRegistration.paymentStatus === 'completed') {
        return res.status(400).json({ message: 'Already registered for this event' });
      }
      
      // Here we would create Stripe payment intent
      // For now, return a placeholder
      res.json({ 
        clientSecret: 'placeholder_client_secret',
        eventId,
        amount: parseFloat(event.price) * 100 // Convert to cents
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Promo Ads — public
  app.get('/api/promo-ads/active', async (req, res) => {
    try {
      const ads = await storage.getActivePromoAds();
      res.json(ads);
    } catch (e) {
      console.error('[PromoAds] getActivePromoAds error:', e);
      res.status(500).json({ error: 'Failed to fetch promo ads' });
    }
  });

  // Promo Ads — admin image upload
  app.post('/api/admin/promo-ads/upload-image', isAuthenticated, imageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'No image file uploaded' });
      const key = `promo-ads/promo_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const imageUrl = await uploadPublicFile(file.buffer, key, file.mimetype);
      res.json({ imageUrl });
    } catch (e) {
      console.error('[PromoAds] uploadImage error:', e);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Promo Ads — admin CRUD
  app.get('/api/admin/promo-ads', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const ads = await storage.getAllPromoAds();
      res.json(ads);
    } catch (e) {
      console.error('[PromoAds] getAllPromoAds error:', e);
      res.status(500).json({ error: 'Failed to fetch promo ads' });
    }
  });

  app.post('/api/admin/promo-ads', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const parsed = schema.insertPromoAdSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      const ad = await storage.createPromoAd(parsed.data);
      res.status(201).json(ad);
    } catch (e) {
      console.error('[PromoAds] createPromoAd error:', e);
      res.status(500).json({ error: 'Failed to create promo ad' });
    }
  });

  app.put('/api/admin/promo-ads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const ad = await storage.updatePromoAd(id, req.body);
      res.json(ad);
    } catch (e) {
      console.error('[PromoAds] updatePromoAd error:', e);
      res.status(500).json({ error: 'Failed to update promo ad' });
    }
  });

  app.post('/api/admin/promo-ads/:id/activate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const ad = await storage.setPromoAdActive(id);
      res.json(ad);
    } catch (e) {
      console.error('[PromoAds] setPromoAdActive error:', e);
      res.status(500).json({ error: 'Failed to activate promo ad' });
    }
  });

  app.post('/api/admin/promo-ads/:id/deactivate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const ad = await storage.updatePromoAd(id, { isActive: false });
      res.json(ad);
    } catch (e) {
      console.error('[PromoAds] deactivatePromoAd error:', e);
      res.status(500).json({ error: 'Failed to deactivate promo ad' });
    }
  });

  app.delete('/api/admin/promo-ads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) return res.status(403).json({ message: 'Admin access required' });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await storage.deletePromoAd(id);
      res.status(204).end();
    } catch (e) {
      console.error('[PromoAds] deletePromoAd error:', e);
      res.status(500).json({ error: 'Failed to delete promo ad' });
    }
  });

  // Blog routes
  app.get('/api/blogs', async (req, res) => {
    try {
      const blogs = await db.select().from(schema.blogPosts)
        .where(eq(schema.blogPosts.isPublished, true))
        .orderBy(schema.blogPosts.displayOrder, desc(schema.blogPosts.publishedAt));
      res.json(blogs);
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/blogs/featured', async (req, res) => {
    try {
      const featured = await db.select().from(schema.blogPosts)
        .where(and(eq(schema.blogPosts.isPublished, true), eq(schema.blogPosts.isFeatured, true)))
        .orderBy(desc(schema.blogPosts.publishedAt))
        .limit(5);
      res.json(featured);
    } catch (error) {
      console.error('Error fetching featured blogs:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/blogs/:slug', async (req, res) => {
    try {
      const blog = await db.select().from(schema.blogPosts)
        .where(eq(schema.blogPosts.slug, req.params.slug))
        .limit(1);
      
      if (!blog.length) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      res.json(blog[0]);
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin blog routes
  app.get('/api/admin/blogs', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const blogs = await db.select().from(schema.blogPosts)
        .orderBy(schema.blogPosts.displayOrder, desc(schema.blogPosts.createdAt));
      res.json(blogs);
    } catch (error) {
      console.error('Error fetching admin blogs:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/blogs', isAuthenticated, blogThumbnailUpload.single('thumbnail'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, slug, excerpt, content, coverImageUrl, category, isPublished, isFeatured } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      // Generate slug if not provided
      const finalSlug = slug || title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Handle thumbnail upload or URL
      let finalCoverImageUrl = coverImageUrl || null;
      if (req.file) {
        const key = `blog-thumbnails/blog_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        finalCoverImageUrl = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);
      }

      const newBlog = await db.insert(schema.blogPosts).values({
        title,
        slug: finalSlug,
        excerpt: excerpt || null,
        content,
        coverImageUrl: finalCoverImageUrl,
        category: category || 'general',
        authorId: user.id,
        authorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin',
        isPublished: isPublished === 'true' || isPublished === true,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        publishedAt: (isPublished === 'true' || isPublished === true) ? new Date() : null,
      }).returning();

      res.json(newBlog[0]);
    } catch (error) {
      console.error('Error creating blog:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/admin/blogs/:id', isAuthenticated, blogThumbnailUpload.single('thumbnail'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, slug, excerpt, content, coverImageUrl, category, isPublished, isFeatured } = req.body;
      
      console.log('Blog update request:', { id: req.params.id, hasFile: !!req.file, coverImageUrl });
      
      const existingBlog = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.id, req.params.id)).limit(1);
      if (!existingBlog.length) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Handle thumbnail upload or URL
      let finalCoverImageUrl = existingBlog[0].coverImageUrl;
      if (req.file) {
        const key = `blog-thumbnails/blog_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        finalCoverImageUrl = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);
        console.log('Blog thumbnail uploaded:', finalCoverImageUrl);
      } else if (coverImageUrl !== undefined) {
        finalCoverImageUrl = coverImageUrl || null;
      }

      const wasPublished = existingBlog[0].isPublished;
      const isNowPublished = isPublished === 'true' || isPublished === true;
      const publishedAt = isNowPublished && !wasPublished ? new Date() : existingBlog[0].publishedAt;

      const updated = await db.update(schema.blogPosts)
        .set({
          title,
          slug,
          excerpt,
          content,
          coverImageUrl: finalCoverImageUrl,
          category,
          isPublished: isNowPublished,
          isFeatured: isFeatured === 'true' || isFeatured === true,
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.blogPosts.id, req.params.id))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating blog:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/admin/blogs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Import blogs from RSS feed (admin only)
  // Import from WordPress REST API — fetches all posts with proper featured images
  app.post('/api/admin/blogs/import-wordpress', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { siteUrl } = req.body;
      if (!siteUrl) {
        return res.status(400).json({ message: "WordPress site URL is required" });
      }

      const base = siteUrl.replace(/\/$/, '');
      const apiBase = `${base}/wp-json/wp/v2/posts`;

      // Probe total pages
      const probeRes = await fetch(`${apiBase}?per_page=1`, { method: 'HEAD' });
      if (!probeRes.ok) {
        return res.status(422).json({ message: `Cannot reach WordPress REST API at ${apiBase}. Make sure the site has REST API enabled.` });
      }
      const totalPages = parseInt(probeRes.headers.get('x-wp-totalpages') || '1', 10);
      const totalPosts = parseInt(probeRes.headers.get('x-wp-total') || '0', 10);

      // Load existing posts for duplicate detection
      const existingBlogs = await db.select().from(schema.blogPosts);
      const existingGuids = new Set(existingBlogs.filter(b => b.rssGuid).map(b => b.rssGuid));
      const existingSlugs = new Set(existingBlogs.map(b => b.slug));

      const imported: any[] = [];
      const skipped: any[] = [];

      for (let page = 1; page <= totalPages; page++) {
        const pageRes = await fetch(`${apiBase}?per_page=100&page=${page}&_embed=1`);
        if (!pageRes.ok) break;
        const posts: any[] = await pageRes.json();

        for (const post of posts) {
          try {
            const guid = post.guid?.rendered || post.link || post.id?.toString();

            if (existingGuids.has(guid)) {
              skipped.push({ title: post.title?.rendered || '', reason: 'Already imported' });
              continue;
            }

            // Slug
            let baseSlug = (post.slug || post.title?.rendered || 'untitled')
              .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            let slug = baseSlug;
            let counter = 1;
            while (existingSlugs.has(slug)) { slug = `${baseSlug}-${counter++}`; }

            // Featured image — prefer WordPress media, fall back to content extraction
            let coverImageUrl: string | null = null;
            const featuredMedia = post._embedded?.['wp:featuredmedia'];
            if (Array.isArray(featuredMedia) && featuredMedia[0]?.source_url) {
              coverImageUrl = featuredMedia[0].source_url;
            }
            if (!coverImageUrl) {
              const content = post.content?.rendered || '';
              const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (imgMatch) coverImageUrl = imgMatch[1];
            }

            // Strip HTML from excerpt
            const rawExcerpt = (post.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
            const content = post.content?.rendered || '';

            const blogData = {
              title: post.title?.rendered?.replace(/&#(\d+);/g, (_: any, n: string) => String.fromCharCode(parseInt(n))) || 'Untitled',
              slug,
              excerpt: rawExcerpt.length > 300 ? rawExcerpt.substring(0, 297) + '...' : rawExcerpt,
              content,
              coverImageUrl,
              authorName: post._embedded?.['author']?.[0]?.name || 'Man Up God\'s Way',
              isPublished: true,
              isFeatured: false,
              publishedAt: post.date ? new Date(post.date) : new Date(),
              externalSource: base,
              rssGuid: guid,
              externalUrl: post.link || null,
              category: 'general',
            };

            const newBlog = await db.insert(schema.blogPosts).values(blogData).returning();
            imported.push(newBlog[0]);
            existingGuids.add(guid);
            existingSlugs.add(slug);
          } catch (err) {
            console.error('WP import error for post', post.id, err);
            skipped.push({ title: post.title?.rendered || String(post.id), reason: err instanceof Error ? err.message : 'Unknown error' });
          }
        }
      }

      res.json({ success: true, total: totalPosts, imported: imported.length, skipped: skipped.length, details: { importedBlogs: imported.map(b => ({ id: b.id, title: b.title })), skippedBlogs: skipped } });
    } catch (error) {
      console.error('WordPress import error:', error);
      res.status(500).json({ message: 'Failed to import from WordPress', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/admin/blogs/import-rss', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { feedUrl } = req.body;
      if (!feedUrl) {
        return res.status(400).json({ message: "RSS feed URL is required" });
      }

      const parser = new Parser();
      const feed = await parser.parseURL(feedUrl);
      const importedBlogs: any[] = [];
      const skippedBlogs: any[] = [];

      // Fetch existing blogs to check for duplicates
      const existingBlogs = await db.select().from(schema.blogPosts);
      const existingGuids = new Set(existingBlogs.filter(b => b.rssGuid).map(b => b.rssGuid));
      const existingSlugs = new Set(existingBlogs.map(b => b.slug));

      for (const item of feed.items) {
        try {
          const guid = item.guid || item.link || item.title;
          
          // Check if already imported
          if (existingGuids.has(guid)) {
            skippedBlogs.push({ title: item.title, reason: 'Already imported (matching GUID)' });
            continue;
          }

          // Generate slug
          let baseSlug = (item.title || 'untitled').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          let slug = baseSlug;
          let counter = 1;
          while (existingSlugs.has(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          // Get content - try multiple RSS content fields
          const content = (item as any)['content:encoded'] || item.content || item.contentSnippet || item.summary || '';
          const excerpt = item.contentSnippet || item.summary || content.substring(0, 300);

          // Extract image from various RSS sources
          let coverImageUrl = null;
          // Try enclosure (common for media)
          if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
            coverImageUrl = item.enclosure.url;
          }
          // Try iTunes image
          if (!coverImageUrl && (item as any)['itunes:image']) {
            coverImageUrl = (item as any)['itunes:image'].$ ?.href || (item as any)['itunes:image'];
          }
          // Try media:content or media:thumbnail
          if (!coverImageUrl && (item as any)['media:content']?.$?.url) {
            coverImageUrl = (item as any)['media:content'].$.url;
          }
          if (!coverImageUrl && (item as any)['media:thumbnail']?.$?.url) {
            coverImageUrl = (item as any)['media:thumbnail'].$.url;
          }
          // Try to extract first image from content
          if (!coverImageUrl && content) {
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
              coverImageUrl = imgMatch[1];
            }
          }
          // Fall back to feed-level image
          if (!coverImageUrl && feed.image?.url) {
            coverImageUrl = feed.image.url;
          }

          const blogData = {
            title: item.title || 'Untitled',
            slug,
            excerpt: excerpt.length > 300 ? excerpt.substring(0, 297) + '...' : excerpt,
            content,
            coverImageUrl,
            authorName: item.creator || (item as any).author || 'External',
            isPublished: true,
            isFeatured: false,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            externalSource: feedUrl,
            rssGuid: guid,
            externalUrl: item.link || null,
            category: 'general',
          };

          const newBlog = await db.insert(schema.blogPosts).values(blogData).returning();
          importedBlogs.push(newBlog[0]);
          
          existingGuids.add(guid);
          existingSlugs.add(slug);
        } catch (error) {
          console.error('Error importing blog:', item.title, error);
          skippedBlogs.push({ 
            title: item.title || 'Unknown', 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({
        success: true,
        imported: importedBlogs.length,
        skipped: skippedBlogs.length,
        details: {
          importedBlogs: importedBlogs.map(b => ({ id: b.id, title: b.title })),
          skippedBlogs
        }
      });
    } catch (error) {
      console.error('Error importing RSS feed:', error);
      res.status(500).json({ 
        message: 'Failed to import RSS feed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync thumbnails by fetching images from blog pages (admin only)
  app.post('/api/admin/blogs/sync-thumbnails', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get blogs without thumbnails that have external URLs
      const blogsWithoutThumbnails = await db.select().from(schema.blogPosts)
        .where(sql`${schema.blogPosts.coverImageUrl} IS NULL AND ${schema.blogPosts.externalUrl} IS NOT NULL`);
      
      const updatedBlogs: any[] = [];
      const skippedItems: any[] = [];

      for (const blog of blogsWithoutThumbnails) {
        try {
          if (!blog.externalUrl) {
            skippedItems.push({ title: blog.title, reason: 'No external URL' });
            continue;
          }

          console.log(`Fetching page for: ${blog.title} from ${blog.externalUrl}`);
          
          // Fetch the actual blog page
          const response = await fetch(blog.externalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BlogThumbnailFetcher/1.0)'
            }
          });
          
          if (!response.ok) {
            skippedItems.push({ title: blog.title, reason: `Failed to fetch page: ${response.status}` });
            continue;
          }

          const html = await response.text();
          let coverImageUrl = null;

          // Try og:image meta tag first (most reliable for thumbnails)
          const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                               html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            coverImageUrl = ogImageMatch[1];
          }

          // Try twitter:image
          if (!coverImageUrl) {
            const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
            if (twitterImageMatch && twitterImageMatch[1]) {
              coverImageUrl = twitterImageMatch[1];
            }
          }

          // Try first image in article/main content
          if (!coverImageUrl) {
            const articleImgMatch = html.match(/<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
                                    html.match(/<main[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
            if (articleImgMatch && articleImgMatch[1]) {
              coverImageUrl = articleImgMatch[1];
            }
          }

          // Try any image with common blog image classes
          if (!coverImageUrl) {
            const featuredImgMatch = html.match(/<img[^>]+class=["'][^"']*(?:featured|hero|banner|post-image|entry-image)[^"']*["'][^>]+src=["']([^"']+)["']/i);
            if (featuredImgMatch && featuredImgMatch[1]) {
              coverImageUrl = featuredImgMatch[1];
            }
          }

          if (!coverImageUrl) {
            skippedItems.push({ title: blog.title, reason: 'No image found on page' });
            continue;
          }

          // Make relative URLs absolute
          if (coverImageUrl.startsWith('/')) {
            const baseUrl = new URL(blog.externalUrl);
            coverImageUrl = `${baseUrl.protocol}//${baseUrl.host}${coverImageUrl}`;
          }

          // Update the blog with the thumbnail
          await db.update(schema.blogPosts)
            .set({ coverImageUrl })
            .where(eq(schema.blogPosts.id, blog.id));
          
          updatedBlogs.push({ id: blog.id, title: blog.title, coverImageUrl });
          console.log(`Updated thumbnail for blog: ${blog.title} -> ${coverImageUrl}`);
        } catch (error) {
          console.error('Error syncing thumbnail:', blog.title, error);
          skippedItems.push({ 
            title: blog.title, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({
        success: true,
        updated: updatedBlogs.length,
        skipped: skippedItems.length,
        details: {
          updatedBlogs,
          skippedItems
        }
      });
    } catch (error) {
      console.error('Error syncing thumbnails:', error);
      res.status(500).json({ 
        message: 'Failed to sync thumbnails',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Reorder blogs (admin only)
  app.post('/api/admin/blogs/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { blogId, direction } = req.body;
      if (!blogId || !['up', 'down'].includes(direction)) {
        return res.status(400).json({ message: "Blog ID and direction (up/down) are required" });
      }

      // Get all blogs ordered by displayOrder
      const allBlogs = await db.select().from(schema.blogPosts)
        .orderBy(schema.blogPosts.displayOrder, schema.blogPosts.createdAt);

      const currentIndex = allBlogs.findIndex(b => b.id === blogId);
      if (currentIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
      }

      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= allBlogs.length) {
        return res.status(400).json({ message: "Cannot move blog further in that direction" });
      }

      // Swap display orders
      const currentBlog = allBlogs[currentIndex];
      const swapBlog = allBlogs[swapIndex];

      await db.update(schema.blogPosts)
        .set({ displayOrder: swapBlog.displayOrder })
        .where(eq(schema.blogPosts.id, currentBlog.id));

      await db.update(schema.blogPosts)
        .set({ displayOrder: currentBlog.displayOrder })
        .where(eq(schema.blogPosts.id, swapBlog.id));

      res.json({ success: true });
    } catch (error) {
      console.error('Error reordering blogs:', error);
      res.status(500).json({ message: 'Failed to reorder blogs' });
    }
  });

  // Drag-drop reorder: move blog to target position (admin only)
  app.post('/api/admin/blogs/reorder-to', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { blogId, targetBlogId } = req.body;
      if (!blogId || !targetBlogId) {
        return res.status(400).json({ message: "Blog ID and target blog ID are required" });
      }

      // Get all blogs ordered by displayOrder
      const allBlogs = await db.select().from(schema.blogPosts)
        .orderBy(schema.blogPosts.displayOrder, schema.blogPosts.createdAt);

      const sourceIndex = allBlogs.findIndex(b => b.id === blogId);
      const targetIndex = allBlogs.findIndex(b => b.id === targetBlogId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
      }

      if (sourceIndex === targetIndex) {
        return res.json({ success: true });
      }

      // Remove source from array and insert at target position
      const [movedBlog] = allBlogs.splice(sourceIndex, 1);
      allBlogs.splice(targetIndex, 0, movedBlog);

      // Update all display orders based on new positions
      for (let i = 0; i < allBlogs.length; i++) {
        await db.update(schema.blogPosts)
          .set({ displayOrder: i })
          .where(eq(schema.blogPosts.id, allBlogs[i].id));
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error reordering blogs:', error);
      res.status(500).json({ message: 'Failed to reorder blogs' });
    }
  });

  // Update all blog display orders (admin only) - for bulk reordering
  app.post('/api/admin/blogs/update-order', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { blogIds } = req.body;
      if (!Array.isArray(blogIds)) {
        return res.status(400).json({ message: "Blog IDs array is required" });
      }

      // Update display order for each blog based on array position
      for (let i = 0; i < blogIds.length; i++) {
        await db.update(schema.blogPosts)
          .set({ displayOrder: i })
          .where(eq(schema.blogPosts.id, blogIds[i]));
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating blog order:', error);
      res.status(500).json({ message: 'Failed to update blog order' });
    }
  });

  const httpServer = createServer(app);
  
  // Hurdle Wall routes
  app.get('/api/hurdle-wall', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const posts = await storage.getHurdleWallPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching hurdle wall posts:", error);
      res.status(500).json({ message: "Failed to fetch hurdle wall posts" });
    }
  });

  app.post('/api/hurdle-wall', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, isAnonymous, postType } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }

      if (!['discussion', 'prayer_request'].includes(postType)) {
        return res.status(400).json({ message: "Post type must be 'discussion' or 'prayer_request'" });
      }

      const post = await storage.createHurdleWallPost({
        userId,
        content: content.trim(),
        isAnonymous: isAnonymous !== false, // Default to true (anonymous)
        postType
      });

      // Broadcast to all connected clients about new post
      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: post });

      // @-mention fan-out — fires even for anonymous posts so tagged brothers
      // still get notified, but the notification hides the author's real name.
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: post.content,
          authorId: userId,
          sourceType: 'hurdle_wall_post',
          sourceId: post.id,
          linkUrl: `/hurdle-wall?post=${post.id}`,
          surfaceLabel: 'a Hurdle Wall post',
          isAuthorOwner: author?.role === 'owner',
          anonymizeAuthor: post.isAnonymous !== false,
        });
      }

      // Fan-out in-app notifications to all users with War Room notifications enabled
      try {
        const usersToNotify = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .leftJoin(schema.notificationPreferences, eq(schema.users.id, schema.notificationPreferences.userId))
          .where(
            and(
              ne(schema.users.id, userId),
              or(
                eq(schema.notificationPreferences.warRoomNotifications, true),
                isNull(schema.notificationPreferences.userId)
              )
            )
          );

        if (usersToNotify.length > 0) {
          await Promise.all(usersToNotify.map(u =>
            storage.createNotificationWithPreferences({
              userId: u.id,
              type: 'war_room_post',
              title: 'New War Room Post',
              message: 'A brother posted in the War Room. Stand with him.',
              relatedId: post.id,
            })
          ));
        }
      } catch (notifError) {
        console.error('Error sending War Room notifications:', notifError);
      }

      res.json(post);
    } catch (error) {
      console.error("Error creating hurdle wall post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get('/api/hurdle-wall/:postId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { postId } = req.params;
      const post = await storage.getHurdleWallPost(postId, userId);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching hurdle wall post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post('/api/hurdle-wall/:postId/replies', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      const { content, isAnonymous } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }

      // Check if post exists
      const post = await storage.getHurdleWallPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const reply = await storage.createHurdleWallReply({
        postId,
        userId,
        content: content.trim(),
        isAnonymous: isAnonymous !== false // Default to true (anonymous)
      });

      // Broadcast to all connected clients about new reply
      (app as any).broadcastToAll({ type: 'hurdle_wall_reply_created', data: { reply, postId } });

      // @-mention fan-out — fires even for anonymous replies; the notification
      // hides the author's real name when anonymous.
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: reply.content,
          authorId: userId,
          sourceType: 'hurdle_wall_reply',
          sourceId: reply.id,
          linkUrl: `/hurdle-wall?post=${postId}`,
          surfaceLabel: 'a Hurdle Wall reply',
          isAuthorOwner: author?.role === 'owner',
          anonymizeAuthor: reply.isAnonymous !== false,
        });
      }

      res.json(reply);
    } catch (error) {
      console.error("Error creating hurdle wall reply:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  app.post('/api/hurdle-wall/:postId/pray', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;

      // Check if post exists and is a prayer request
      const post = await storage.getHurdleWallPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.postType !== 'prayer_request') {
        return res.status(400).json({ message: "Can only pray for prayer request posts" });
      }

      const result = await storage.prayForPost(userId, postId);
      
      if (!result.success) {
        return res.status(400).json({ message: "Already prayed for this post" });
      }

      res.json({ message: "Prayer added successfully", prayerCount: result.prayerCount });
    } catch (error) {
      console.error("Error praying for post:", error);
      res.status(500).json({ message: "Failed to add prayer" });
    }
  });

  app.delete('/api/hurdle-wall/:postId/pray', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;

      const result = await storage.removePrayerFromPost(userId, postId);
      
      if (!result.success) {
        return res.status(400).json({ message: "Haven't prayed for this post" });
      }

      res.json({ message: "Prayer removed successfully", prayerCount: result.prayerCount });
    } catch (error) {
      console.error("Error removing prayer from post:", error);
      res.status(500).json({ message: "Failed to remove prayer" });
    }
  });

  // Praise routes — post author only
  app.post('/api/hurdle-wall/:postId/praise', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Praise content is required" });
      }

      const post = await storage.getHurdleWallPost(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.userId !== userId) return res.status(403).json({ message: "Only the post author can add a praise" });

      const result = await storage.createHurdleWallPraise(postId, userId, content.trim());
      if (!result.success) return res.status(409).json({ message: "This post already has a praise" });

      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: { postId } });
      res.json(result.praise);
    } catch (error) {
      console.error("Error creating praise:", error);
      res.status(500).json({ message: "Failed to create praise" });
    }
  });

  app.patch('/api/hurdle-wall/:postId/praise', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Praise content is required" });
      }

      const updated = await storage.updateHurdleWallPraise(postId, userId, content.trim());
      if (!updated) return res.status(403).json({ message: "Praise not found or not yours" });

      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: { postId } });
      res.json(updated);
    } catch (error) {
      console.error("Error updating praise:", error);
      res.status(500).json({ message: "Failed to update praise" });
    }
  });

  app.delete('/api/hurdle-wall/:postId/praise', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;

      const success = await storage.deleteHurdleWallPraise(postId, userId);
      if (!success) return res.status(403).json({ message: "Praise not found or not yours" });

      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: { postId } });
      res.json({ message: "Praise removed" });
    } catch (error) {
      console.error("Error deleting praise:", error);
      res.status(500).json({ message: "Failed to delete praise" });
    }
  });

  // Amen routes — any authenticated user (post must have a praise first)
  app.post('/api/hurdle-wall/:postId/amen', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;

      const post = await storage.getHurdleWallPost(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (!post.praise) return res.status(400).json({ message: "Can only say Amen to a praised post" });

      const result = await storage.addAmenToPost(postId, userId);
      if (!result.success) return res.status(400).json({ message: "Already said Amen" });

      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: { postId } });
      res.json({ amenCount: result.amenCount });
    } catch (error) {
      console.error("Error adding amen:", error);
      res.status(500).json({ message: "Failed to add Amen" });
    }
  });

  app.delete('/api/hurdle-wall/:postId/amen', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;

      const result = await storage.removeAmenFromPost(postId, userId);
      if (!result.success) return res.status(400).json({ message: "Haven't said Amen" });

      (app as any).broadcastToAll({ type: 'hurdle_wall_post_created', data: { postId } });
      res.json({ amenCount: result.amenCount });
    } catch (error) {
      console.error("Error removing amen:", error);
      res.status(500).json({ message: "Failed to remove Amen" });
    }
  });

  app.get('/api/hurdle-wall/:postId/ameners', isAuthenticated, async (req: any, res) => {
    try {
      const ameners = await storage.getHurdleWallAmeners(req.params.postId);
      res.json(ameners);
    } catch (error) {
      console.error("Error fetching ameners:", error);
      res.status(500).json({ message: "Failed to fetch ameners" });
    }
  });

  app.get('/api/prayer-stats/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const stats = await storage.getUserPrayerStats(userId);
      
      if (!stats) {
        const newStats = await storage.ensurePrayerStatsExist(userId);
        return res.json(newStats);
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching prayer stats:", error);
      res.status(500).json({ message: "Failed to fetch prayer stats" });
    }
  });

  app.delete('/api/hurdle-wall/posts/:postId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      const user = await storage.getUser(userId);
      const canModerate = isModerator(user);

      const success = await storage.deleteHurdleWallPost(postId, userId, canModerate);
      
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }

      // Broadcast to all connected clients about deleted post
      (app as any).broadcastToAll({ type: 'hurdle_wall_post_deleted', data: { postId } });

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting hurdle wall post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  app.delete('/api/hurdle-wall/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { replyId } = req.params;
      const user = await storage.getUser(userId);
      const canModerate = isModerator(user);

      const success = await storage.deleteHurdleWallReply(replyId, userId, canModerate);
      
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own replies" });
      }

      // Broadcast to all connected clients about deleted reply
      (app as any).broadcastToAll({ type: 'hurdle_wall_reply_deleted', data: { replyId } });

      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Error deleting hurdle wall reply:", error);
      res.status(500).json({ message: "Failed to delete reply" });
    }
  });

  app.patch('/api/hurdle-wall/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content is required" });
      const updated = await storage.updateHurdleWallReply(req.params.replyId, userId, content.trim());
      if (!updated) return res.status(403).json({ message: "You can only edit your own replies" });

      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: updated.content,
          authorId: userId,
          sourceType: 'hurdle_wall_reply',
          sourceId: updated.id,
          linkUrl: `/hurdle-wall?post=${updated.postId}`,
          surfaceLabel: 'a Hurdle Wall reply',
          isAuthorOwner: author?.role === 'owner',
          anonymizeAuthor: updated.isAnonymous !== false,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating hurdle wall reply:", error);
      res.status(500).json({ message: "Failed to update reply" });
    }
  });

  app.get('/api/hurdle-wall/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const posts = await storage.getUserHurdleWallPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching user hurdle wall posts:", error);
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });
  
  // ========================================
  // UNDER FIRE - ACCOUNTABILITY REQUESTS
  // ========================================
  
  // Get all accountability requests
  app.get('/api/accountability-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getAccountabilityRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching accountability requests:", error);
      res.status(500).json({ message: "Failed to fetch accountability requests" });
    }
  });
  
  // Create a new accountability request
  app.post('/api/accountability-requests', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, isAnonymous } = req.body;
      console.log('[DEBUG accountability] req.body:', JSON.stringify(req.body));
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      const request = await storage.createAccountabilityRequest({
        userId,
        content: content.trim(),
        isAnonymous: isAnonymous === true,
      });

      // @-mention fan-out
      {
        const author = await storage.getUser(userId);
        await extractMentionsAndFanOut({
          text: request.content,
          authorId: userId,
          sourceType: 'accountability_request',
          sourceId: request.id,
          linkUrl: `/under-fire?request=${request.id}`,
          surfaceLabel: 'an Under Fire request',
          isAuthorOwner: author?.role === 'owner',
        });
      }

      // Fan-out in-app notifications to all users with Under Fire notifications enabled
      try {
        const usersToNotify = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .leftJoin(schema.notificationPreferences, eq(schema.users.id, schema.notificationPreferences.userId))
          .where(
            and(
              ne(schema.users.id, userId),
              or(
                eq(schema.notificationPreferences.underFireNotifications, true),
                isNull(schema.notificationPreferences.userId)
              )
            )
          );

        if (usersToNotify.length > 0) {
          await Promise.all(usersToNotify.map(u =>
            storage.createNotificationWithPreferences({
              userId: u.id,
              type: 'under_fire_post',
              title: 'Brother Under Fire',
              message: 'A brother needs accountability. Will you step up?',
              relatedId: request.id,
            })
          ));
        }
      } catch (notifError) {
        console.error('Error sending Under Fire notifications:', notifError);
      }

      // Broadcast to all connected clients so Under Fire page updates in real-time
      if ((req.app as any).broadcastToAll) {
        (req.app as any).broadcastToAll({ type: 'accountability_request_created', data: request });
      }

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating accountability request:", error);
      res.status(500).json({ message: "Failed to create accountability request" });
    }
  });
  
  // Assist with an accountability request (creates DM)
  app.post('/api/accountability-requests/:requestId/assist', isAuthenticated, async (req: any, res) => {
    try {
      const assisterId = req.user.claims.sub;
      const { requestId } = req.params;
      
      // Get the request
      const request = await storage.getAccountabilityRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Cannot assist your own request
      if (request.userId === assisterId) {
        return res.status(400).json({ message: "You cannot assist your own request" });
      }
      
      // Check if already assisted
      if (request.assistedById) {
        return res.status(400).json({ message: "This request has already been assisted" });
      }
      
      // Mark as assisted
      await storage.markAccountabilityRequestAssisted(requestId, assisterId);
      
      // Create or get existing DM conversation between the two users
      const conversation = await storage.getOrCreateDirectConversation(request.userId, assisterId);
      
      // Send initial message from the assister
      const assister = await storage.getUser(assisterId);
      const initialMessage = `I saw your accountability request and I'm here to help you! Let's work together to keep you on track.`;
      
      await storage.sendMessage({
        conversationId: conversation.id,
        userId: assisterId,
        content: initialMessage,
      });
      
      // Notify the request owner that someone has stepped up to assist
      try {
        await storage.createNotificationWithPreferences({
          userId: request.userId,
          type: 'new_message',
          title: 'Someone Stepped Up For You',
          message: `${assister?.firstName || 'A brother'} ${assister?.lastName || ''} saw your accountability request and is ready to assist. Check your messages!`.trim(),
          relatedId: conversation.id,
        });
      } catch (notifError) {
        console.error("Error sending accountability assist notification:", notifError);
      }

      // Broadcast real-time update to all clients
      if ((req.app as any).broadcastToAll) {
        (req.app as any).broadcastToAll({
          type: 'accountability_request_assist',
          data: { requestId, assisterId }
        });
      }
      
      res.json({ 
        message: "Accountability accepted! A direct message has been created.",
        conversationId: conversation.id 
      });
    } catch (error) {
      console.error("Error assisting accountability request:", error);
      res.status(500).json({ message: "Failed to assist with request" });
    }
  });

  // Unassist an accountability request (only the person who assisted can unassist)
  app.post('/api/accountability-requests/:requestId/unassist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      
      const request = await storage.getAccountabilityRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Only the person who assisted can unassist
      if (request.assistedById !== userId) {
        return res.status(403).json({ message: "You can only unassist requests you are assisting" });
      }
      
      await storage.unassistAccountabilityRequest(requestId);
      
      // Broadcast real-time update to all clients
      if ((req.app as any).broadcastToAll) {
        (req.app as any).broadcastToAll({
          type: 'accountability_request_unassist',
          data: { requestId }
        });
      }
      
      res.json({ message: "You are no longer assisting this request" });
    } catch (error) {
      console.error("Error unassisting accountability request:", error);
      res.status(500).json({ message: "Failed to unassist request" });
    }
  });
  
  // Toggle "Got Your 6" support on an assisted accountability request
  app.post('/api/accountability-requests/:requestId/support', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      const request = await storage.getAccountabilityRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.userId === userId) {
        return res.status(403).json({ message: "You cannot support your own request" });
      }
      if (!request.assistedById) {
        return res.status(400).json({ message: "Request must be assisted before it can be supported" });
      }
      const result = await storage.toggleAccountabilitySupport(requestId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling accountability support:", error);
      res.status(500).json({ message: "Failed to toggle support" });
    }
  });

  // Delete accountability request (own, or any if moderator/admin)
  // Accountability request comments
  app.get('/api/accountability-requests/:requestId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getAccountabilityRequestComments(req.params.requestId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching accountability request comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post('/api/accountability-requests/:requestId/comments', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      const { content, parentCommentId } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content is required" });
      const comment = await storage.createAccountabilityRequestComment({ requestId, userId, content: content.trim(), parentCommentId });
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating accountability request comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.patch('/api/accountability-requests/comments/:commentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content is required" });
      const updated = await storage.updateAccountabilityRequestComment(req.params.commentId, userId, content.trim());
      if (!updated) return res.status(403).json({ message: "You can only edit your own comments" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating accountability request comment:", error);
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  app.delete('/api/accountability-requests/comments/:commentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const canModerate = isModerator(user);
      const success = await storage.deleteAccountabilityRequestComment(req.params.commentId, userId, canModerate);
      if (!success) return res.status(403).json({ message: "You can only delete your own comments" });
      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.error("Error deleting accountability request comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Accountability request amens
  app.post('/api/accountability-requests/:requestId/amen', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.toggleAccountabilityRequestAmen(req.params.requestId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling accountability request amen:", error);
      res.status(500).json({ message: "Failed to toggle amen" });
    }
  });

  app.get('/api/accountability-requests/:requestId/ameners', isAuthenticated, async (req: any, res) => {
    try {
      const ameners = await storage.getAccountabilityRequestAmeners(req.params.requestId);
      res.json(ameners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ameners" });
    }
  });

  // Accountability request oh-mes
  app.post('/api/accountability-requests/:requestId/oh-me', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.toggleAccountabilityRequestOhMe(req.params.requestId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling oh-me:", error);
      res.status(500).json({ message: "Failed to toggle oh-me" });
    }
  });

  app.get('/api/accountability-requests/:requestId/oh-mers', isAuthenticated, async (req: any, res) => {
    try {
      const ohMers = await storage.getAccountabilityRequestOhMers(req.params.requestId);
      res.json(ohMers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch oh-mers" });
    }
  });

  app.delete('/api/accountability-requests/:requestId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      const user = await storage.getUser(userId);
      
      const request = await storage.getAccountabilityRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      if (request.userId !== userId && !isModerator(user)) {
        return res.status(403).json({ message: "You can only delete your own requests" });
      }
      
      await storage.deleteAccountabilityRequest(requestId);
      res.json({ message: "Request deleted" });
    } catch (error) {
      console.error("Error deleting accountability request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  // ========================================
  // STRIPE PAYMENT ROUTES
  // ========================================
  
  // Create payment intent for one-time purchases
  app.post('/api/payments/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      // Check if Stripe keys are configured
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ 
          message: "Payment system not configured. Please contact administrator." 
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      const { amount, currency = 'usd', metadata = {} } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          userId: userId,
          userEmail: user?.email || '',
          ...metadata
        },
        receipt_email: user?.email
      });

      console.log(`Payment intent created: ${paymentIntent.id} for user ${userId} amount: $${amount}`);

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        message: "Error creating payment intent: " + (error.message || "Unknown error")
      });
    }
  });

  // Get payment status
  app.get('/api/payments/:paymentIntentId/status', isAuthenticated, async (req: any, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ 
          message: "Payment system not configured" 
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      const { paymentIntentId } = req.params;
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      res.json({
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
        created: paymentIntent.created
      });
    } catch (error: any) {
      console.error("Error retrieving payment status:", error);
      res.status(500).json({ 
        message: "Error retrieving payment status: " + (error.message || "Unknown error")
      });
    }
  });

  // Complete study purchase after successful payment
  app.post('/api/purchases/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ 
          message: "Payment system not configured" 
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      const { paymentIntentId } = req.body;
      const userId = req.user.claims.sub;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID required" });
      }

      // Verify payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      const metadata = paymentIntent.metadata;
      
      // Check if this is a study purchase
      if (metadata.type === 'study_purchase' && metadata.studyId && metadata.userId === userId) {
        // Create the purchase record
        const purchase = await storage.createPurchase({
          userId,
          studyId: metadata.studyId,
          amount: (paymentIntent.amount / 100).toString(),
          status: 'completed',
          stripePaymentIntentId: paymentIntentId,
          currency: 'usd'
        });

        res.json({ 
          success: true,
          purchase,
          message: "Study purchase completed successfully" 
        });
      } else {
        res.json({ 
          success: true,
          message: "Payment completed successfully" 
        });
      }
    } catch (error: any) {
      console.error("Error completing purchase:", error);
      res.status(500).json({ 
        message: "Error completing purchase: " + (error.message || "Unknown error")
      });
    }
  });

  // Owner-only: Get Stripe account info
  app.get('/api/admin/stripe/account-info', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.json({ 
          configured: false,
          message: "Stripe API keys not configured"
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      const account = await stripe.accounts.retrieve();
      
      res.json({
        configured: true,
        accountId: account.id,
        email: account.email,
        displayName: account.display_name || account.business_profile?.name,
        country: account.country,
        currency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled
      });
    } catch (error: any) {
      console.error("Error fetching Stripe account info:", error);
      res.status(500).json({ 
        message: "Error fetching Stripe account info: " + (error.message || "Unknown error")
      });
    }
  });

  // Owner-only: Test Stripe connection
  app.post('/api/admin/stripe/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(400).json({ 
          success: false,
          message: "Stripe secret key not configured"
        });
      }

      if (!process.env.VITE_STRIPE_PUBLIC_KEY) {
        return res.status(400).json({ 
          success: false,
          message: "Stripe public key not configured"
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      // Test the connection by fetching account info
      await stripe.accounts.retrieve();
      
      res.json({
        success: true,
        message: "Stripe connection successful",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Stripe connection test failed:", error);
      res.status(400).json({ 
        success: false,
        message: "Stripe connection failed: " + (error.message || "Unknown error")
      });
    }
  });

  // New Stripe configuration routes
  app.get('/api/stripe/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      const configured = !!(process.env.STRIPE_SECRET_KEY && process.env.VITE_STRIPE_PUBLIC_KEY);
      
      if (!configured) {
        return res.json({
          configured: false,
          connected: false
        });
      }

      // Test connection
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2023-10-16",
        });
        
        const account = await stripe.accounts.retrieve();
        
        res.json({
          configured: true,
          connected: true,
          accountId: account.id,
          country: account.country,
          testMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false
        });
      } catch (connectionError) {
        res.json({
          configured: true,
          connected: false,
          error: 'Connection failed'
        });
      }
    } catch (error: any) {
      console.error("Error checking Stripe status:", error);
      res.status(500).json({ message: "Failed to check Stripe status" });
    }
  });

  app.post('/api/stripe/configure', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      const { publishableKey, secretKey } = req.body;

      if (!publishableKey || !secretKey) {
        return res.status(400).json({ message: "Both publishable and secret keys are required" });
      }

      if (!publishableKey.startsWith('pk_')) {
        return res.status(400).json({ message: "Invalid publishable key format" });
      }

      if (!secretKey.startsWith('sk_')) {
        return res.status(400).json({ message: "Invalid secret key format" });
      }

      // Validate keys by testing connection
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(secretKey, {
          apiVersion: "2023-10-16",
        });
        
        const account = await stripe.accounts.retrieve();
        
        // Keys are valid, set them as environment variables
        process.env.STRIPE_SECRET_KEY = secretKey;
        process.env.VITE_STRIPE_PUBLIC_KEY = publishableKey;
        
        res.json({
          success: true,
          message: "Stripe configuration saved successfully",
          accountId: account.id
        });
      } catch (validationError: any) {
        return res.status(400).json({ 
          message: "Invalid Stripe keys: " + (validationError.message || "Authentication failed")
        });
      }
    } catch (error: any) {
      console.error("Error configuring Stripe:", error);
      res.status(500).json({ message: "Failed to configure Stripe" });
    }
  });

  // Carousel routes
  app.get('/api/carousel', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (userId) {
        const items = await storage.getActiveCarouselItemsForUser(userId);
        res.json(items);
      } else {
        const items = await storage.getActiveCarouselItems();
        res.json(items);
      }
    } catch (error: any) {
      console.error("Error fetching carousel items:", error);
      res.status(500).json({ message: "Failed to fetch carousel items" });
    }
  });

  app.post('/api/carousel/:id/dismiss', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const item = await storage.getCarouselItem(id);
      if (!item) {
        return res.status(404).json({ message: "Carousel item not found" });
      }
      if (!item.isOneTime) {
        return res.status(400).json({ message: "Only one-time items can be dismissed" });
      }
      await storage.dismissCarouselItem(userId, id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error dismissing carousel item:", error);
      res.status(500).json({ message: "Failed to dismiss carousel item" });
    }
  });

  app.get('/api/admin/carousel', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const items = await storage.getAllCarouselItems();
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching all carousel items:", error);
      res.status(500).json({ message: "Failed to fetch carousel items" });
    }
  });

  app.post('/api/admin/carousel', isAuthenticated, imageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, linkType, linkId, externalUrl, position, displayOrder, isOneTime } = req.body;
      
      if (!title || !linkType || !position) {
        return res.status(400).json({ message: "Title, linkType, and position are required" });
      }

      let imageUrl = '';
      if (req.file) {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const item = await storage.createCarouselItem({
        title,
        description,
        imageUrl,
        linkType,
        linkId: linkId || null,
        externalUrl: externalUrl || null,
        position: parseInt(position),
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
        isActive: true,
        isOneTime: isOneTime === 'true' || isOneTime === true,
      });

      res.json(item);
    } catch (error: any) {
      console.error("Error creating carousel item:", error);
      res.status(500).json({ message: "Failed to create carousel item" });
    }
  });

  app.put('/api/admin/carousel/:id', isAuthenticated, imageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { title, description, linkType, linkId, externalUrl, position, displayOrder, isActive, isOneTime } = req.body;

      const existingItem = await storage.getCarouselItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Carousel item not found" });
      }

      let imageUrl = existingItem.imageUrl;
      if (req.file) {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const updated = await storage.updateCarouselItem(id, {
        title: title || existingItem.title,
        description: description !== undefined ? description : existingItem.description,
        imageUrl,
        linkType: linkType || existingItem.linkType,
        linkId: linkId !== undefined ? linkId : existingItem.linkId,
        externalUrl: externalUrl !== undefined ? externalUrl : existingItem.externalUrl,
        position: position ? parseInt(position) : existingItem.position,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : existingItem.displayOrder,
        isActive: isActive !== undefined ? isActive === 'true' || isActive === true : existingItem.isActive,
        isOneTime: isOneTime !== undefined ? isOneTime === 'true' || isOneTime === true : existingItem.isOneTime,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating carousel item:", error);
      res.status(500).json({ message: "Failed to update carousel item" });
    }
  });

  app.delete('/api/admin/carousel/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteCarouselItem(id);
      res.json({ message: "Carousel item deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting carousel item:", error);
      res.status(500).json({ message: "Failed to delete carousel item" });
    }
  });

  // Man Up Links routes
  app.get('/api/man-up-links', async (req: any, res) => {
    try {
      const links = await storage.getActiveManUpLinks();
      res.json(links);
    } catch (error: any) {
      console.error("Error fetching man up links:", error);
      res.status(500).json({ message: "Failed to fetch man up links" });
    }
  });

  app.get('/api/admin/man-up-links', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const links = await storage.getAllManUpLinks();
      res.json(links);
    } catch (error: any) {
      console.error("Error fetching admin man up links:", error);
      res.status(500).json({ message: "Failed to fetch man up links" });
    }
  });

  app.post('/api/admin/man-up-links', isAuthenticated, imageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, url, icon, iconColor, displayOrder } = req.body;

      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const link = await storage.createManUpLink({
        name,
        url,
        icon: icon || 'globe',
        iconColor: iconColor || 'text-black',
        imageUrl,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      });

      res.json(link);
    } catch (error: any) {
      console.error("Error creating man up link:", error);
      res.status(500).json({ message: "Failed to create man up link" });
    }
  });

  app.put('/api/admin/man-up-links/:id', isAuthenticated, imageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { name, url, icon, iconColor, displayOrder, isActive } = req.body;

      const existingLink = await storage.getManUpLink(id);
      if (!existingLink) {
        return res.status(404).json({ message: "Man up link not found" });
      }

      let imageUrl = existingLink.imageUrl;
      if (req.file) {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      } else if (req.body.removeImage === 'true') {
        imageUrl = null;
      }

      const updated = await storage.updateManUpLink(id, {
        name: name || existingLink.name,
        url: url || existingLink.url,
        icon: icon || existingLink.icon,
        iconColor: iconColor || existingLink.iconColor,
        imageUrl,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : existingLink.displayOrder,
        isActive: isActive !== undefined ? isActive === 'true' || isActive === true : existingLink.isActive,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating man up link:", error);
      res.status(500).json({ message: "Failed to update man up link" });
    }
  });

  app.delete('/api/admin/man-up-links/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteManUpLink(id);
      res.json({ message: "Man up link deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting man up link:", error);
      res.status(500).json({ message: "Failed to delete man up link" });
    }
  });

  app.post('/api/stripe/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) {
        return res.status(403).json({ message: "Owner access required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(400).json({ 
          success: false,
          message: "Stripe secret key not configured"
        });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      const account = await stripe.accounts.retrieve();
      
      res.json({
        success: true,
        message: "Stripe connection successful",
        accountId: account.id,
        country: account.country,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Stripe connection test failed:", error);
      res.status(400).json({ 
        success: false,
        message: "Stripe connection failed: " + (error.message || "Unknown error")
      });
    }
  });

  // ─── Owner Stripe Test Subscription ─────────────────────────────────────────

  app.get('/api/owner/stripe/test-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      const rows = await db.select().from(schema.stripeTestSubscriptions).orderBy(desc(schema.stripeTestSubscriptions.createdAt)).limit(1);
      if (!rows.length) return res.json(null);

      const row = rows[0];

      // Refresh status from Stripe (use test key since this is the test subscription)
      if (row.stripeSubscriptionId && row.status !== 'canceled' && row.status !== 'inactive') {
        const testKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
        if (testKey) {
          try {
            const { default: Stripe } = await import('stripe');
            const stripe = new Stripe(testKey, { apiVersion: "2023-10-16" });
            const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, { expand: ['latest_invoice.payment_intent'] });

            const invoice = sub.latest_invoice as any;
            const paymentStatus = invoice?.payment_intent?.status ?? invoice?.status ?? null;
            const paidAt = invoice?.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : row.lastPaymentAt;

            await db.update(schema.stripeTestSubscriptions)
              .set({ status: sub.status, lastPaymentStatus: paymentStatus, lastPaymentAt: paidAt, updatedAt: new Date() })
              .where(eq(schema.stripeTestSubscriptions.id, row.id));

            return res.json({ ...row, status: sub.status, lastPaymentStatus: paymentStatus, lastPaymentAt: paidAt });
          } catch (stripeErr: any) {
            console.error("Error refreshing Stripe test sub status:", stripeErr.message);
          }
        }
      }

      res.json(row);
    } catch (error) {
      console.error("Error fetching test subscription:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a payment intent for the test subscription (uses test-mode Stripe key)
  // Returns clientSecret so the frontend can show a real card form via Stripe Elements
  app.post('/api/owner/stripe/test-subscription/create-intent', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      const testKey = process.env.TESTING_STRIPE_SECRET_KEY;
      if (!testKey) return res.status(400).json({ message: "TESTING_STRIPE_SECRET_KEY not configured. Add it to your Replit Secrets." });
      const keyPrefix = testKey.substring(0, 12);
      if (testKey.startsWith('pk_')) return res.status(400).json({ message: `TESTING_STRIPE_SECRET_KEY contains a publishable key. It must be a secret key (sk_test_...). Currently reads: ${keyPrefix}...` });
      if (!testKey.startsWith('sk_')) return res.status(400).json({ message: `TESTING_STRIPE_SECRET_KEY looks invalid — it must start with sk_test_. Currently reads: ${keyPrefix}...` });

      const { amount, interval, intervalCount } = req.body;
      if (!amount || amount < 50) return res.status(400).json({ message: "Amount must be at least $0.50" });
      if (!['day', 'week', 'month', 'year'].includes(interval)) return res.status(400).json({ message: "Invalid interval" });

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(testKey, { apiVersion: "2023-10-16" });

      // Cancel any existing test subscription
      const existing = await db.select().from(schema.stripeTestSubscriptions).orderBy(desc(schema.stripeTestSubscriptions.createdAt)).limit(1);
      if (existing.length && existing[0].stripeSubscriptionId && !['canceled', 'inactive'].includes(existing[0].status)) {
        try { await stripe.subscriptions.cancel(existing[0].stripeSubscriptionId); } catch {}
      }

      // Create a customer
      const customer = await stripe.customers.create({ description: "Owner test subscription" });

      // Create a price
      const price = await stripe.prices.create({
        unit_amount: amount,
        currency: 'usd',
        recurring: { interval, interval_count: intervalCount || 1 },
        product_data: { name: 'Man Up Test Subscription' },
      });

      // Create subscription in default_incomplete mode so we get a PaymentIntent client_secret
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      const invoice = sub.latest_invoice as any;
      const clientSecret = invoice?.payment_intent?.client_secret;
      if (!clientSecret) return res.status(500).json({ message: "Could not get payment intent client secret from Stripe" });

      res.json({
        clientSecret,
        subscriptionId: sub.id,
        customerId: customer.id,
        amount,
        interval,
        intervalCount: intervalCount || 1,
        testPublicKey: process.env.TESTING_VITE_STRIPE_PUBLIC_KEY || '',
      });
    } catch (error: any) {
      console.error("Error creating test subscription intent:", error);
      res.status(500).json({ message: error.message || "Failed to create test subscription intent" });
    }
  });

  // Save the confirmed test subscription to DB (called after Stripe Elements confirms payment)
  app.post('/api/owner/stripe/test-subscription/save', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      const { subscriptionId, customerId, amount, interval, intervalCount } = req.body;
      if (!subscriptionId) return res.status(400).json({ message: "subscriptionId required" });

      // Verify subscription status from Stripe
      const testKey = process.env.TESTING_STRIPE_SECRET_KEY;
      let subStatus = 'active';
      let paymentStatus = 'succeeded';
      let paidAt: Date | null = new Date();

      if (testKey) {
        try {
          const { default: Stripe } = await import('stripe');
          const stripe = new Stripe(testKey, { apiVersion: "2023-10-16" });
          const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice.payment_intent'] });
          subStatus = sub.status;
          const invoice = sub.latest_invoice as any;
          paymentStatus = invoice?.payment_intent?.status ?? invoice?.status ?? 'succeeded';
          paidAt = invoice?.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date();
        } catch (e: any) {
          console.error("Error verifying subscription after confirm:", e.message);
        }
      }

      const existing = await db.select().from(schema.stripeTestSubscriptions).orderBy(desc(schema.stripeTestSubscriptions.createdAt)).limit(1);
      if (existing.length) {
        await db.update(schema.stripeTestSubscriptions)
          .set({ stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, amount, interval, intervalCount: intervalCount || 1, status: subStatus, lastPaymentStatus: paymentStatus, lastPaymentAt: paidAt, updatedAt: new Date() })
          .where(eq(schema.stripeTestSubscriptions.id, existing[0].id));
      } else {
        await db.insert(schema.stripeTestSubscriptions).values({ stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, amount, interval, intervalCount: intervalCount || 1, status: subStatus, lastPaymentStatus: paymentStatus, lastPaymentAt: paidAt });
      }

      const [saved] = await db.select().from(schema.stripeTestSubscriptions).orderBy(desc(schema.stripeTestSubscriptions.createdAt)).limit(1);
      res.json(saved);
    } catch (error: any) {
      console.error("Error saving test subscription:", error);
      res.status(500).json({ message: error.message || "Failed to save test subscription" });
    }
  });

  app.delete('/api/owner/stripe/test-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      const rows = await db.select().from(schema.stripeTestSubscriptions).orderBy(desc(schema.stripeTestSubscriptions.createdAt)).limit(1);
      if (!rows.length) return res.status(404).json({ message: "No test subscription found" });

      const row = rows[0];

      if (row.stripeSubscriptionId && row.status !== 'canceled') {
        const testKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
        if (testKey) {
          try {
            const { default: Stripe } = await import('stripe');
            const stripe = new Stripe(testKey, { apiVersion: "2023-10-16" });
            await stripe.subscriptions.cancel(row.stripeSubscriptionId);
          } catch (e: any) {
            console.error("Error canceling Stripe test subscription:", e.message);
          }
        }
      }

      await db.update(schema.stripeTestSubscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(schema.stripeTestSubscriptions.id, row.id));

      res.json({ success: true, message: "Test subscription canceled" });
    } catch (error: any) {
      console.error("Error canceling test subscription:", error);
      res.status(500).json({ message: error.message || "Failed to cancel test subscription" });
    }
  });

  // War Groups routes
  app.get('/api/war-groups', async (req, res) => {
    try {
      const { search, city, state, distance } = req.query;
      const groups = await warGroupsService.getAllGroups(
        search as string | undefined,
        city as string | undefined,
        state as string | undefined,
        distance ? parseInt(distance as string, 10) : undefined
      );
      res.json(groups);
    } catch (error) {
      console.error('Error fetching war groups:', error);
      res.status(500).json({ message: 'Failed to fetch war groups' });
    }
  });

  app.get('/api/war-groups/:id', async (req, res) => {
    try {
      const group = await warGroupsService.getGroupById(req.params.id);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      res.json(group);
    } catch (error) {
      console.error('Error fetching war group:', error);
      res.status(500).json({ message: 'Failed to fetch war group' });
    }
  });

  app.get('/api/war-groups/:id/membership', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      const membership = await warGroupsService.getUserGroupMembership(userId, groupId);
      res.json(membership);
    } catch (error) {
      console.error('Error fetching membership:', error);
      res.status(500).json({ message: 'Failed to fetch membership' });
    }
  });

  app.get('/api/user/war-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groups = await warGroupsService.getUserGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching user war groups:', error);
      res.status(500).json({ message: 'Failed to fetch user war groups' });
    }
  });

  app.post('/api/war-groups/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const membership = await warGroupsService.requestToJoinGroup(userId, groupId);
      res.json(membership);
    } catch (error: any) {
      console.error('Error requesting to join group:', error);
      res.status(400).json({ message: error.message || 'Failed to request to join group' });
    }
  });

  app.post('/api/war-groups/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const group = await warGroupsService.getGroupById(groupId);
      if (group && group.leaderId === userId) {
        return res.status(400).json({ message: 'Group leaders cannot leave their own group. Transfer leadership first or delete the group.' });
      }
      
      await warGroupsService.removeMemberFromGroup(groupId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error leaving group:', error);
      res.status(400).json({ message: error.message || 'Failed to leave group' });
    }
  });

  app.get('/api/war-groups/:id/members', isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.id;
      const status = req.query.status as string | undefined;
      const members = await warGroupsService.getGroupMembers(groupId, status);
      res.json(members);
    } catch (error) {
      console.error('Error fetching group members:', error);
      res.status(500).json({ message: 'Failed to fetch group members' });
    }
  });

  app.post('/api/war-groups/:id/members/:memberId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id: groupId, memberId } = req.params;
      
      const membership = await warGroupsService.approveMemberRequest(memberId, userId);
      
      // Award rations to the new member for joining
      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardRations(membership.userId, 'war_group_join', groupId, 'war_group');
      
      res.json({ ...membership, rations: rationResult });
    } catch (error: any) {
      console.error('Error approving member:', error);
      res.status(403).json({ message: error.message || 'Failed to approve member' });
    }
  });

  app.post('/api/war-groups/:id/members/:memberId/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      await warGroupsService.rejectMemberRequest(memberId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error rejecting member:', error);
      res.status(403).json({ message: error.message || 'Failed to reject member' });
    }
  });

  app.get('/api/war-groups/:id/pending-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const pendingRequests = await warGroupsService.getPendingMemberRequests(groupId, userId);
      res.json(pendingRequests);
    } catch (error: any) {
      console.error('Error fetching pending requests:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch pending requests' });
    }
  });

  // Check if user can manage members (for UI visibility)
  app.get('/api/war-groups/:id/can-manage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const canManage = await warGroupsService.canUserManageMembers(userId, groupId);
      res.json({ canManage });
    } catch (error: any) {
      console.error('Error checking manage permission:', error);
      res.status(500).json({ message: error.message || 'Failed to check permission' });
    }
  });

  // Get member names (for any group member)
  app.get('/api/war-groups/:id/member-names', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const members = await warGroupsService.getMemberNames(groupId, userId);
      res.json(members);
    } catch (error: any) {
      console.error('Error fetching member names:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch members' });
    }
  });

  // Get approved members list (for leaders and managers)
  app.get('/api/war-groups/:id/approved-members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const members = await warGroupsService.getApprovedMembers(groupId, userId);
      res.json(members);
    } catch (error: any) {
      console.error('Error fetching approved members:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch members' });
    }
  });

  // Toggle member management permission (leader only)
  app.post('/api/war-groups/:id/members/:memberId/toggle-manage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      const updated = await warGroupsService.toggleMemberManagePermission(memberId, userId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error toggling manage permission:', error);
      res.status(403).json({ message: error.message || 'Failed to toggle permission' });
    }
  });

  // War Group Discussion Posts (Private Group Board)
  app.get('/api/war-groups/:id/posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const posts = await warGroupsService.getGroupPosts(groupId, userId, limit, offset);
      res.json(posts.map((p: any) => ({ ...p, content: maskMentionIds(p.content) })));
    } catch (error: any) {
      console.error('Error fetching group posts:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch group posts' });
    }
  });

  app.post('/api/war-groups/:id/posts', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      const { content, postType, mediaUrls, mediaTypes } = req.body;
      
      const hasContent = content && content.trim().length > 0;
      const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
      
      if (!hasContent && !hasMedia) {
        return res.status(400).json({ message: 'Post content or media is required' });
      }
      
      const validatedMediaUrls = hasMedia ? mediaUrls.filter((url: any) => typeof url === 'string') : undefined;
      const validatedMediaTypes = hasMedia && Array.isArray(mediaTypes) 
        ? mediaTypes.filter((type: any) => ['image', 'video', 'gif'].includes(type)) 
        : undefined;
      
      const post = await warGroupsService.createGroupPost(
        groupId, 
        userId, 
        content || '', 
        postType, 
        validatedMediaUrls, 
        validatedMediaTypes
      );
      
      // Award rations for posting
      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardRations(userId, 'war_group_post', post.id, 'war_group_post');

      res.status(201).json({ ...post, content: maskMentionIds(post.content), rations: rationResult });

      // @-mention fan-out for war groups (alwaysNotify because mentioned users may not be members)
      (async () => {
        try {
          const author = await storage.getUser(userId);
          await extractMentionsAndFanOut({
            text: content || '',
            authorId: userId,
            sourceType: 'war_group_post',
            sourceId: post.id,
            linkUrl: `/war-groups/${groupId}?postId=${post.id}`,
            surfaceLabel: 'a War Group post',
            isAuthorOwner: author?.role === 'owner',
            alwaysNotify: true,
          });
        } catch (e) {
          console.error('War group post mention fan-out error:', e);
        }
      })();

      // Fire-and-forget: notify all approved members of the new post (except the poster)
      (async () => {
        try {
          const [group, poster, members] = await Promise.all([
            warGroupsService.getGroupById(groupId),
            storage.getUser(userId),
            warGroupsService.getGroupMembers(groupId, 'approved'),
          ]);
          const posterName = poster?.firstName ? `${poster.firstName}${poster.lastName ? ' ' + poster.lastName : ''}` : 'A member';
          const groupName = group?.name || 'your War Group';
          const preview = (content || '').trim().slice(0, 80) + ((content || '').length > 80 ? '…' : '');
          const targets = members.filter(m => m.userId !== userId).map(m => m.userId);

          // Send targeted real-time cache invalidation signal to each approved member
          // (minimal payload — no post content — scoped to members only)
          const sendToUser = (req.app as any).sendToUser;
          if (sendToUser) {
            members.map(m => m.userId).forEach(memberId => {
              sendToUser(memberId, { type: 'war_group_post_created', data: { groupId } });
            });
          }

          await Promise.allSettled(targets.map(memberId =>
            sendPushNotification(memberId, {
              title: `New post in ${groupName}`,
              body: preview ? `${posterName}: ${preview}` : `${posterName} posted something new`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `war-group-post-${post.id}`,
              url: `/war-groups/${groupId}?postId=${post.id}`,
            })
          ));
        } catch (e) {
          console.error('War group post push notification error:', e);
        }
      })();
    } catch (error: any) {
      console.error('Error creating group post:', error);
      res.status(403).json({ message: error.message || 'Failed to create group post' });
    }
  });

  // War Group media upload endpoint
  app.post('/api/war-groups/:id/upload-media', isAuthenticated, communityMediaUpload.array('media', 10), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      
      const membership = await warGroupsService.getUserGroupMembership(userId, groupId);
      if (!membership || membership.status !== 'approved') {
        return res.status(403).json({ message: 'Only approved members can upload media' });
      }
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      for (const file of files) {
        const ext = file.originalname.split('.').pop() || 'bin';
        const key = `community/community-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const url = await uploadPublicFile(file.buffer, key, file.mimetype);
        mediaUrls.push(url);
        
        if (file.mimetype.startsWith('image/')) {
          if (file.mimetype === 'image/gif') {
            mediaTypes.push('gif');
          } else {
            mediaTypes.push('image');
          }
        } else if (file.mimetype.startsWith('video/')) {
          mediaTypes.push('video');
        }
      }

      res.json({ mediaUrls, mediaTypes });
    } catch (error) {
      console.error("Error uploading war group media:", error);
      res.status(500).json({ message: "Failed to upload media" });
    }
  });

  app.post('/api/war-groups/:id/posts/:postId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      
      await warGroupsService.likeGroupPost(postId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error liking group post:', error);
      res.status(403).json({ message: error.message || 'Failed to like post' });
    }
  });

  app.delete('/api/war-groups/:id/posts/:postId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      
      await warGroupsService.deleteGroupPost(postId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting group post:', error);
      res.status(403).json({ message: error.message || 'Failed to delete post' });
    }
  });

  app.delete('/api/war-groups/:id/posts/:postId/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId, replyId } = req.params;
      await warGroupsService.deleteGroupPostReply(replyId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting group post reply:', error);
      res.status(403).json({ message: error.message || 'Failed to delete reply' });
    }
  });

  app.patch('/api/war-groups/:id/posts/:postId/replies/:replyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { replyId } = req.params;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content is required" });
      const updated = await warGroupsService.updateGroupPostReply(replyId, userId, content.trim(), req.params.postId);
      res.json(updated ? { ...updated, content: maskMentionIds(updated.content) } : updated);

      if (updated) {
        (async () => {
          try {
            const author = await storage.getUser(userId);
            await extractMentionsAndFanOut({
              text: content.trim(),
              authorId: userId,
              sourceType: 'war_group_reply',
              sourceId: replyId,
              linkUrl: `/war-groups/${req.params.id}?postId=${req.params.postId}&openReplies=true`,
              surfaceLabel: 'a War Group reply',
              isAuthorOwner: author?.role === 'owner',
              alwaysNotify: true,
            });
          } catch (e) {
            console.error('War group reply edit mention fan-out error:', e);
          }
        })();
      }
    } catch (error: any) {
      console.error('Error updating group post reply:', error);
      res.status(403).json({ message: error.message || 'Failed to update reply' });
    }
  });

  app.post('/api/war-groups/:id/posts/:postId/pin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      
      const result = await warGroupsService.togglePinPost(postId, userId);
      res.json(result);
    } catch (error: any) {
      console.error('Error toggling pin on post:', error);
      res.status(403).json({ message: error.message || 'Failed to toggle pin' });
    }
  });

  // War Group Post Replies
  app.get('/api/war-groups/:id/posts/:postId/replies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      
      const replies = await warGroupsService.getPostReplies(postId, userId);
      res.json(replies.map((r: any) => ({ ...r, content: maskMentionIds(r.content) })));
    } catch (error: any) {
      console.error('Error fetching post replies:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch replies' });
    }
  });

  app.post('/api/war-groups/:id/posts/:postId/replies', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { postId } = req.params;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: 'Reply content is required' });
      }
      
      const reply = await warGroupsService.createPostReply(postId, userId, content);
      
      // Award rations for commenting
      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardRations(userId, 'war_group_comment', reply.id, 'war_group_reply');

      const groupId = req.params.id;
      res.status(201).json({ ...reply, content: maskMentionIds(reply.content), rations: rationResult });

      // @-mention fan-out (alwaysNotify because mentioned users may not be members)
      (async () => {
        try {
          const author = await storage.getUser(userId);
          await extractMentionsAndFanOut({
            text: content,
            authorId: userId,
            sourceType: 'war_group_reply',
            sourceId: reply.id,
            linkUrl: `/war-groups/${groupId}?postId=${postId}&openReplies=true`,
            surfaceLabel: 'a War Group reply',
            isAuthorOwner: author?.role === 'owner',
            alwaysNotify: true,
          });
        } catch (e) {
          console.error('War group reply mention fan-out error:', e);
        }
      })();

      // Fire-and-forget: send real-time signals + push notification for reply
      (async () => {
        try {
          const [post, replier, members] = await Promise.all([
            (async () => {
              const [p] = await db.select().from(schema.warGroupPosts).where(eq(schema.warGroupPosts.id, postId)).limit(1);
              return p;
            })(),
            storage.getUser(userId),
            warGroupsService.getGroupMembers(groupId, 'approved'),
          ]);

          // Send targeted real-time cache invalidation signal to each approved member
          // (minimal payload — no reply content — scoped to members only)
          const sendToUser = (req.app as any).sendToUser;
          if (sendToUser) {
            members.map(m => m.userId).forEach(memberId => {
              sendToUser(memberId, { type: 'war_group_reply_created', data: { groupId, postId } });
            });
          }

          if (!post || post.userId === userId) return; // Don't push-notify yourself
          const group = await warGroupsService.getGroupById(post.groupId);
          const replierName = replier?.firstName ? `${replier.firstName}${replier.lastName ? ' ' + replier.lastName : ''}` : 'Someone';
          const groupName = group?.name || 'your War Group';
          const preview = content.trim().slice(0, 80) + (content.length > 80 ? '…' : '');
          await sendPushNotification(post.userId, {
            title: `${replierName} replied to your post`,
            body: preview ? `${preview} — in ${groupName}` : `New reply in ${groupName}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `war-group-reply-${reply.id}`,
            url: `/war-groups/${post.groupId}?postId=${postId}&openReplies=true`,
          });
        } catch (e) {
          console.error('War group reply push notification error:', e);
        }
      })();
    } catch (error: any) {
      console.error('Error creating post reply:', error);
      res.status(403).json({ message: error.message || 'Failed to create reply' });
    }
  });

  app.delete('/api/war-groups/:id/members/:memberId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memberId } = req.params;
      
      await warGroupsService.removeMember(memberId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error removing member:', error);
      res.status(403).json({ message: error.message || 'Failed to remove member' });
    }
  });

  app.put('/api/war-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = req.params.id;
      const groupData = req.body;
      
      const updated = await warGroupsService.updateGroup(groupId, groupData, userId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating group:', error);
      res.status(403).json({ message: error.message || 'Failed to update group' });
    }
  });

  app.post('/api/admin/war-groups', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const groupData = insertWarGroupSchema.parse(req.body);
      const newGroup = await warGroupsService.createGroup(groupData);
      res.json(newGroup);
    } catch (error: any) {
      console.error('Error creating war group:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid group data', errors: error.errors });
      }
      res.status(500).json({ message: error.message || 'Failed to create war group' });
    }
  });

  app.get('/api/admin/war-groups', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const groups = await warGroupsService.getAllGroupsForAdmin();
      res.json(groups);
    } catch (error: any) {
      console.error('Error fetching war groups for admin:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch war groups' });
    }
  });

  app.patch('/api/admin/war-groups/:id/leader', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newLeaderId } = req.body;
      
      if (!newLeaderId) {
        return res.status(400).json({ message: 'New leader ID is required' });
      }
      
      const updated = await warGroupsService.changeGroupLeader(id, newLeaderId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error changing group leader:', error);
      res.status(500).json({ message: error.message || 'Failed to change group leader' });
    }
  });

  app.delete('/api/admin/war-groups/:groupId/members/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { groupId, userId } = req.params;
      
      await warGroupsService.removeMemberFromGroup(groupId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error removing member from group:', error);
      res.status(500).json({ message: error.message || 'Failed to remove member' });
    }
  });

  app.patch('/api/admin/war-groups/:id/license', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isLicensed } = req.body;
      
      if (typeof isLicensed !== 'boolean') {
        return res.status(400).json({ message: 'isLicensed must be a boolean' });
      }
      
      const updated = await db.update(schema.warGroups)
        .set({ 
          isLicensed,
          updatedAt: new Date()
        })
        .where(eq(schema.warGroups.id, id))
        .returning();
      
      if (!updated.length) {
        return res.status(404).json({ message: 'Group not found' });
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      console.error('Error updating license status:', error);
      res.status(500).json({ message: error.message || 'Failed to update license status' });
    }
  });

  app.patch('/api/admin/war-groups/:id/headquarters', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isHeadquarters } = req.body;
      
      if (typeof isHeadquarters !== 'boolean') {
        return res.status(400).json({ message: 'isHeadquarters must be a boolean' });
      }
      
      // If setting as HQ, first remove HQ status from any existing HQ group
      if (isHeadquarters) {
        await db.update(schema.warGroups)
          .set({ isHeadquarters: false, updatedAt: new Date() })
          .where(eq(schema.warGroups.isHeadquarters, true));
      }
      
      const updated = await db.update(schema.warGroups)
        .set({ 
          isHeadquarters,
          updatedAt: new Date()
        })
        .where(eq(schema.warGroups.id, id))
        .returning();
      
      if (!updated.length) {
        return res.status(404).json({ message: 'Group not found' });
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      console.error('Error updating headquarters status:', error);
      res.status(500).json({ message: error.message || 'Failed to update headquarters status' });
    }
  });

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { search } = req.query;
      const users = await warGroupsService.getAllUsers(search as string);
      res.json(users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/war-groups/:id/members', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const members = await warGroupsService.getGroupMembers(id);
      res.json(members);
    } catch (error: any) {
      console.error('Error fetching group members:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch group members' });
    }
  });

  app.delete('/api/admin/war-groups/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await warGroupsService.deleteGroup(id);
      res.json({ success: true, message: 'War group deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting war group:', error);
      res.status(500).json({ message: error.message || 'Failed to delete war group' });
    }
  });

  // War Group Registration Routes
  app.post('/api/war-groups/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Parse the form data (requestedBy is omitted from schema, so add it separately)
      const parsedData = schema.insertWarGroupRegistrationSchema.parse(req.body);
      const registrationData = {
        ...parsedData,
        requestedBy: userId
      };

      const registration = await warGroupsService.createRegistration(registrationData);

      // Create notifications for all admin users
      const adminUsers = await db.select().from(schema.users).where(eq(schema.users.role, 'admin'));
      const notificationPromises = adminUsers.map(admin => 
        db.insert(schema.notifications).values({
          userId: admin.id,
          type: 'war_group_registration',
          title: 'New War Group Registration',
          message: `${req.user.email} has submitted a registration request for "${registration.name}" in ${registration.city}, ${registration.state}`,
          relatedId: registration.id,
        })
      );
      await Promise.all(notificationPromises);

      // Send email notification to info@manupgodsway.org
      const { sendWarGroupRegistrationEmail } = await import('./emailService');
      sendWarGroupRegistrationEmail(registration, req.user.email).catch(err => 
        console.error('Failed to send registration email:', err)
      );

      res.status(201).json(registration);
    } catch (error: any) {
      console.error('Error creating war group registration:', error);
      res.status(500).json({ message: error.message || 'Failed to create registration' });
    }
  });

  app.get('/api/admin/war-groups/registrations', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { status } = req.query;
      const registrations = await warGroupsService.getAllRegistrations(status as string);
      res.json(registrations);
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch registrations' });
    }
  });

  app.post('/api/admin/war-groups/registrations/:id/approve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const reviewerId = req.user?.claims?.sub;

      if (!reviewerId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const newGroup = await warGroupsService.approveRegistration(id, reviewerId);
      res.json(newGroup);
    } catch (error: any) {
      console.error('Error approving registration:', error);
      res.status(500).json({ message: error.message || 'Failed to approve registration' });
    }
  });

  app.post('/api/admin/war-groups/registrations/:id/reject', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const reviewerId = req.user?.claims?.sub;

      if (!reviewerId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!reason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      await warGroupsService.rejectRegistration(id, reviewerId, reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error rejecting registration:', error);
      res.status(500).json({ message: error.message || 'Failed to reject registration' });
    }
  });

  // ============================================
  // RATIONS SYSTEM ROUTES
  // ============================================

  // Get user's ration balance and rank
  app.get('/api/rations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rationsService } = await import('./rations-service');
      const rationInfo = await rationsService.getUserRations(userId);
      res.json(rationInfo);
    } catch (error) {
      console.error("Error fetching rations:", error);
      res.status(500).json({ message: "Failed to fetch rations" });
    }
  });

  // Get ration transaction history
  app.get('/api/rations/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const { rationsService } = await import('./rations-service');
      const history = await rationsService.getTransactionHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching ration history:", error);
      res.status(500).json({ message: "Failed to fetch ration history" });
    }
  });

  // Award rations for completing a mission
  app.post('/api/rations/award', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { missionType, referenceId, referenceType } = req.body;
      
      if (!missionType) {
        return res.status(400).json({ message: "Mission type is required" });
      }

      const { rationsService } = await import('./rations-service');
      const result = await rationsService.awardRations(userId, missionType, referenceId, referenceType);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      console.error("Error awarding rations:", error);
      res.status(500).json({ message: "Failed to award rations" });
    }
  });

  // Spend rations
  app.post('/api/rations/spend', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, category, description, referenceId, referenceType } = req.body;
      
      if (!amount || !category || !description) {
        return res.status(400).json({ message: "Amount, category, and description are required" });
      }

      const { rationsService } = await import('./rations-service');
      const result = await rationsService.spendRations(userId, amount, category, description, referenceId, referenceType);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      console.error("Error spending rations:", error);
      res.status(500).json({ message: "Failed to spend rations" });
    }
  });

  // Get leaderboard
  app.get('/api/rations/leaderboard', isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const { rationsService } = await import('./rations-service');
      const leaderboard = await rationsService.getLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Check and award grace bonus for returning user
  app.post('/api/rations/grace-bonus', isAuthenticated, strictWriteLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rationsService } = await import('./rations-service');
      const result = await rationsService.awardGraceBonus(userId);
      // Update lastActiveDate so the 14-day clock resets from now
      if (result.success) {
        await storage.upsertUser({ id: userId, lastActiveDate: new Date() });
      }
      res.json(result);
    } catch (error) {
      console.error("Error checking grace bonus:", error);
      res.status(500).json({ message: "Failed to check grace bonus" });
    }
  });

  // Get mission reward definitions (for frontend display)
  app.get('/api/rations/missions', async (req, res) => {
    try {
      const { MISSION_REWARDS, RATION_RANKS } = await import('@shared/schema');
      res.json({ missions: MISSION_REWARDS, ranks: RATION_RANKS });
    } catch (error) {
      console.error("Error fetching mission definitions:", error);
      res.status(500).json({ message: "Failed to fetch mission definitions" });
    }
  });

  // Share app and earn rations (10 per share, once per day)
  app.post('/api/share/app', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check if already shared in the last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [recentShare] = await db
        .select({ id: schema.rationTransactions.id })
        .from(schema.rationTransactions)
        .where(and(
          eq(schema.rationTransactions.userId, userId),
          eq(schema.rationTransactions.missionType, 'app_share'),
          gte(schema.rationTransactions.createdAt, yesterday)
        ))
        .limit(1);

      if (recentShare) {
        return res.json({ success: true, alreadyAwarded: true, message: 'You already earned rations for sharing today. Come back tomorrow!', rations: { success: false, amount: 0 } });
      }

      const { rationsService } = await import('./rations-service');
      const rationResult = await rationsService.awardCustomRations(
        userId, 10, 'profile', 'Shared the app with others', 'app_share', undefined, undefined
      );

      res.json({ success: true, rations: rationResult });
    } catch (error) {
      console.error('Error awarding share rations:', error);
      res.status(500).json({ message: 'Failed to award rations' });
    }
  });

  // ============ ADMIN RATION MANAGEMENT ROUTES ============

  // Admin: Get all content with ration rewards
  app.get('/api/admin/rations/content', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const contentType = req.query.type as string || 'all';
      const result: any = {};

      if (contentType === 'all' || contentType === 'studies') {
        result.studies = await db.select({
          id: schema.studies.id,
          title: schema.studies.title,
          category: schema.studies.category,
          rationReward: schema.studies.rationReward,
        }).from(schema.studies).orderBy(schema.studies.title);
      }

      if (contentType === 'all' || contentType === 'lessons') {
        result.lessons = await db.select({
          id: schema.studyLessons.id,
          studyId: schema.studyLessons.studyId,
          dayNumber: schema.studyLessons.dayNumber,
          title: schema.studyLessons.title,
          rationReward: schema.studyLessons.rationReward,
        }).from(schema.studyLessons).orderBy(schema.studyLessons.studyId, schema.studyLessons.dayNumber);
      }

      if (contentType === 'all' || contentType === 'videos') {
        result.videos = await db.select({
          id: schema.videos.id,
          title: schema.videos.title,
          category: schema.videos.category,
          rationReward: schema.videos.rationReward,
        }).from(schema.videos).orderBy(schema.videos.title);
      }

      if (contentType === 'all' || contentType === 'podcasts') {
        result.podcasts = await db.select({
          id: schema.podcasts.id,
          title: schema.podcasts.title,
          category: schema.podcasts.category,
          rationReward: schema.podcasts.rationReward,
        }).from(schema.podcasts).orderBy(schema.podcasts.title);
      }

      if (contentType === 'all' || contentType === 'devotionals') {
        result.devotionals = await db.select({
          id: schema.devotionals.id,
          title: schema.devotionals.title,
          date: schema.devotionals.date,
          rationReward: schema.devotionals.rationReward,
        }).from(schema.devotionals).orderBy(desc(schema.devotionals.date)).limit(100);
      }

      if (contentType === 'all' || contentType === 'challenges') {
        result.challenges = await db.select({
          id: schema.challenges.id,
          title: schema.challenges.title,
          topic: schema.challenges.topic,
          rationReward: schema.challenges.rationReward,
        }).from(schema.challenges).orderBy(desc(schema.challenges.releaseDate));
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching ration content:", error);
      res.status(500).json({ message: "Failed to fetch ration content" });
    }
  });

  // Admin: Update ration reward for a specific content item
  app.patch('/api/admin/rations/content/:type/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { type, id } = req.params;
      const { rationReward } = req.body;

      if (rationReward === undefined || rationReward < 0) {
        return res.status(400).json({ message: "Valid ration reward is required (0 or positive number)" });
      }

      let updated = false;

      switch (type) {
        case 'study':
          await db.update(schema.studies).set({ rationReward }).where(eq(schema.studies.id, id));
          updated = true;
          break;
        case 'lesson':
          await db.update(schema.studyLessons).set({ rationReward }).where(eq(schema.studyLessons.id, id));
          updated = true;
          break;
        case 'video':
          await db.update(schema.videos).set({ rationReward }).where(eq(schema.videos.id, id));
          updated = true;
          break;
        case 'podcast':
          await db.update(schema.podcasts).set({ rationReward }).where(eq(schema.podcasts.id, id));
          updated = true;
          break;
        case 'devotional':
          await db.update(schema.devotionals).set({ rationReward }).where(eq(schema.devotionals.id, id));
          updated = true;
          break;
        case 'challenge':
          await db.update(schema.challenges).set({ rationReward }).where(eq(schema.challenges.id, id));
          updated = true;
          break;
        default:
          return res.status(400).json({ message: "Invalid content type" });
      }

      if (updated) {
        res.json({ success: true, message: "Ration reward updated" });
      } else {
        res.status(404).json({ message: "Content not found" });
      }
    } catch (error) {
      console.error("Error updating ration reward:", error);
      res.status(500).json({ message: "Failed to update ration reward" });
    }
  });

  // Admin: Bulk update ration rewards for a content type
  app.patch('/api/admin/rations/bulk/:type', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { type } = req.params;
      const { rationReward } = req.body;

      if (rationReward === undefined || rationReward < 0) {
        return res.status(400).json({ message: "Valid ration reward is required" });
      }

      let count = 0;

      switch (type) {
        case 'studies':
          const studyResult = await db.update(schema.studies).set({ rationReward });
          count = studyResult.rowCount || 0;
          break;
        case 'lessons':
          const lessonResult = await db.update(schema.studyLessons).set({ rationReward });
          count = lessonResult.rowCount || 0;
          break;
        case 'videos':
          const videoResult = await db.update(schema.videos).set({ rationReward });
          count = videoResult.rowCount || 0;
          break;
        case 'podcasts':
          const podcastResult = await db.update(schema.podcasts).set({ rationReward });
          count = podcastResult.rowCount || 0;
          break;
        case 'devotionals':
          const devotionalResult = await db.update(schema.devotionals).set({ rationReward });
          count = devotionalResult.rowCount || 0;
          break;
        case 'challenges':
          const challengeResult = await db.update(schema.challenges).set({ rationReward });
          count = challengeResult.rowCount || 0;
          break;
        default:
          return res.status(400).json({ message: "Invalid content type" });
      }

      res.json({ success: true, message: `Updated ${count} items`, count });
    } catch (error) {
      console.error("Error bulk updating ration rewards:", error);
      res.status(500).json({ message: "Failed to bulk update ration rewards" });
    }
  });

  // Admin: Manually adjust user rations
  app.post('/api/admin/rations/adjust', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const adminUserId = req.user.claims.sub;
      const { userId, amount, reason } = req.body;

      if (!userId || amount === undefined || !reason) {
        return res.status(400).json({ message: "User ID, amount, and reason are required" });
      }

      const { rationsService } = await import('./rations-service');
      const result = await rationsService.adminAdjustRations(adminUserId, userId, amount, reason);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      console.error("Error adjusting user rations:", error);
      res.status(500).json({ message: "Failed to adjust user rations" });
    }
  });

  // Admin: Get users with their ration info (paginated)
  app.get('/api/admin/rations/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;

      let query = db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        profileImageUrl: schema.users.profileImageUrl,
        rations: schema.users.rations,
        rationRank: schema.users.rationRank,
      }).from(schema.users);

      if (search) {
        query = query.where(
          sql`LOWER(${schema.users.firstName} || ' ' || ${schema.users.lastName}) LIKE ${`%${search.toLowerCase()}%`} OR LOWER(${schema.users.email}) LIKE ${`%${search.toLowerCase()}%`}`
        );
      }

      const allUsers = await query.orderBy(desc(schema.users.rations)).limit(limit).offset(offset);
      
      // Get total count
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
      const total = Number(countResult?.count) || 0;

      res.json({
        users: allUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      });
    } catch (error) {
      console.error("Error fetching users for rations:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all missions for admin management
  app.get('/api/admin/missions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allMissions = await db.select().from(schema.missions).orderBy(schema.missions.functionalArea, schema.missions.name);
      res.json(allMissions);
    } catch (error) {
      console.error("Error fetching missions:", error);
      res.status(500).json({ message: "Failed to fetch missions" });
    }
  });

  // Update a mission's configuration
  app.patch('/api/admin/missions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { rations, pointCap, capDuration, activity, isActive } = req.body;

      const updates: any = { updatedAt: new Date() };
      if (rations !== undefined) updates.rations = rations;
      if (pointCap !== undefined) updates.pointCap = pointCap;
      if (capDuration !== undefined) updates.capDuration = capDuration;
      if (activity !== undefined) updates.activity = activity;
      if (isActive !== undefined) updates.isActive = isActive;

      const [updated] = await db.update(schema.missions)
        .set(updates)
        .where(eq(schema.missions.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Mission not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating mission:", error);
      res.status(500).json({ message: "Failed to update mission" });
    }
  });

  // Bulk update missions by functional area
  app.patch('/api/admin/missions/bulk/:functionalArea', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { functionalArea } = req.params;
      const { rations, pointCap, capDuration } = req.body;

      const updates: any = { updatedAt: new Date() };
      if (rations !== undefined) updates.rations = rations;
      if (pointCap !== undefined) updates.pointCap = pointCap;
      if (capDuration !== undefined) updates.capDuration = capDuration;

      await db.update(schema.missions)
        .set(updates)
        .where(eq(schema.missions.functionalArea, functionalArea));

      res.json({ message: `Updated all missions in ${functionalArea}` });
    } catch (error) {
      console.error("Error bulk updating missions:", error);
      res.status(500).json({ message: "Failed to bulk update missions" });
    }
  });

  // ============ RATIONS STORE ROUTES ============

  // Get all store products (optionally filtered by tier)
  app.get('/api/store/products', isAuthenticated, async (req: any, res) => {
    try {
      const tier = req.query.tier as string | undefined;
      const products = await storage.getStoreProducts(tier);
      res.json(products);
    } catch (error) {
      console.error("Error fetching store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  // Get single store product
  app.get('/api/store/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const product = await storage.getStoreProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching store product:", error);
      res.status(500).json({ message: "Failed to fetch store product" });
    }
  });

  // Redeem a product with rations
  app.post('/api/store/redeem', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId, shippingInfo, selectedSize } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const redemption = await storage.redeemProduct(userId, productId, shippingInfo, selectedSize);
      
      // Send email notifications for order
      try {
        const user = await storage.getUser(userId);
        const product = await storage.getStoreProduct(productId);
        
        if (user && product) {
          const orderEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #FCD000; background: #000; padding: 20px; margin: 0;">New Rations Store Order</h1>
              <div style="padding: 20px; background: #f5f5f5;">
                <h2 style="margin-top: 0;">Order Details</h2>
                <p><strong>Order ID:</strong> ${redemption.id}</p>
                <p><strong>Product:</strong> ${product.name}</p>
                <p><strong>Rations Cost:</strong> ${product.rationCost.toLocaleString()}</p>
                ${selectedSize ? `<p><strong>Size:</strong> ${selectedSize}</p>` : ''}
                
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                
                ${shippingInfo ? `
                <h3>Shipping Information</h3>
                <p><strong>Ship To:</strong> ${shippingInfo.shippingName}</p>
                <p><strong>Address:</strong> ${shippingInfo.shippingAddress}</p>
                <p><strong>City, State ZIP:</strong> ${shippingInfo.shippingCity}, ${shippingInfo.shippingState} ${shippingInfo.shippingZip}</p>
                <p><strong>Phone:</strong> ${shippingInfo.shippingPhone}</p>
                <p><strong>Email:</strong> ${shippingInfo.shippingEmail}</p>
                ` : ''}
                
                <p style="margin-top: 20px; color: #666;">
                  <a href="https://manupgodsway.com/admin" style="color: #FCD000;">View in Admin Panel</a>
                </p>
              </div>
            </div>
          `;
          
          // Send to both email addresses using Nodemailer SMTP (Nixihost)
          const nodemailer = await import('nodemailer');
          
          const transporter = nodemailer.createTransport({
            host: 'mail.manupgodsway.org',
            port: 465,
            secure: true,
            auth: {
              user: 'info@manupgodsway.org',
              pass: process.env.SMTP_PASSWORD,
            },
          });
          
          await transporter.sendMail({
            from: 'Man Up God\'s Way <info@manupgodsway.org>',
            to: 'swhite@gojsdirect.com, info@manupgodsway.org',
            subject: `New Rations Store Order: ${product.name}`,
            html: orderEmailHtml,
          });
          console.log('Order notification email sent successfully via SMTP');
        }
      } catch (emailError) {
        console.error("Error sending order notification email:", emailError);
        // Don't fail the redemption if email fails
      }
      
      res.status(201).json(redemption);
    } catch (error) {
      console.error("Error redeeming product:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to redeem product" });
    }
  });

  // Get user's redemption history
  app.get('/api/store/redemptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const redemptions = await storage.getUserRedemptions(userId);
      res.json(redemptions);
    } catch (error) {
      console.error("Error fetching redemptions:", error);
      res.status(500).json({ message: "Failed to fetch redemptions" });
    }
  });

  // ============ ADMIN STORE MANAGEMENT ROUTES ============

  // Admin: Get all store products (including inactive)
  app.get('/api/admin/store/products', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const tier = req.query.tier as string | undefined;
      // Get all products including inactive ones
      const products = await db.select()
        .from(schema.storeProducts)
        .where(tier ? eq(schema.storeProducts.tier, tier) : undefined)
        .orderBy(asc(schema.storeProducts.tier), asc(schema.storeProducts.displayOrder));
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching admin store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  // Admin: Create a new store product
  app.post('/api/admin/store/products', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const product = await storage.createStoreProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating store product:", error);
      res.status(500).json({ message: "Failed to create store product" });
    }
  });

  // Admin: Update a store product
  app.put('/api/admin/store/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const product = await storage.updateStoreProduct(req.params.id, req.body);
      res.json(product);
    } catch (error) {
      console.error("Error updating store product:", error);
      res.status(500).json({ message: "Failed to update store product" });
    }
  });

  // Admin: Delete a store product
  app.delete('/api/admin/store/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteStoreProduct(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting store product:", error);
      res.status(500).json({ message: "Failed to delete store product" });
    }
  });

  // Admin: Upload product image
  app.post('/api/admin/store/products/:id/upload-image', isAuthenticated, storeProductImageUpload.single('image'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const key = `store-products/store_product_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const imageUrl = await uploadPublicFile(file.buffer, key, file.mimetype);
      const product = await storage.updateStoreProduct(req.params.id, { imageUrl });
      res.json(product);
    } catch (error) {
      console.error("Error uploading store product image:", error);
      res.status(500).json({ message: "Failed to upload product image" });
    }
  });

  // Admin: Delete product image
  app.delete('/api/admin/store/products/:id/delete-image', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get current product to find image file
      const products = await db.select().from(schema.storeProducts).where(eq(schema.storeProducts.id, req.params.id));
      if (products.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      const product = products[0];
      if (product.imageUrl) {
        if (isStorageUrl(product.imageUrl)) {
          await deleteStorageFile(product.imageUrl);
        } else if (product.imageUrl.startsWith('/uploads/store-products/')) {
          const filename = product.imageUrl.replace('/uploads/store-products/', '');
          const filePath = path.join(process.cwd(), 'uploads', 'store-products', filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }

      const updatedProduct = await storage.updateStoreProduct(req.params.id, { imageUrl: "" });
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error deleting store product image:", error);
      res.status(500).json({ message: "Failed to delete product image" });
    }
  });

  // Admin: Get all redemptions for fulfillment
  app.get('/api/admin/store/redemptions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const status = req.query.status as string | undefined;
      const redemptions = await storage.getAllRedemptions(status);
      res.json(redemptions);
    } catch (error) {
      console.error("Error fetching all redemptions:", error);
      res.status(500).json({ message: "Failed to fetch redemptions" });
    }
  });

  // Admin: Update redemption status (fulfill, ship, cancel)
  app.put('/api/admin/store/redemptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { status, trackingNumber } = req.body;
      if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required (pending, processing, shipped, delivered, cancelled)" });
      }

      const redemption = await storage.updateRedemptionStatus(
        req.params.id, 
        status, 
        user.id,
        trackingNumber
      );
      res.json(redemption);
    } catch (error) {
      console.error("Error updating redemption status:", error);
      res.status(500).json({ message: "Failed to update redemption status" });
    }
  });

  // ============================================
  // Owner Panel — Content Stats
  // ============================================

  app.get('/api/owner/content-stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      // Billing period starts on the 24th of each month
      const now = new Date();
      const periodStart = now.getDate() >= 24
        ? new Date(now.getFullYear(), now.getMonth(), 24, 0, 0, 0, 0)
        : new Date(now.getFullYear(), now.getMonth() - 1, 24, 0, 0, 0, 0);

      const [
        publishedStudiesResult,
        videosResult,
        blogPostsResult,
        challengesResult,
        eventsResult,
        warRoomResult,
        podcastsResult,
        bibleCallsResult,
        fitnessSubscribersResult,
      ] = await Promise.all([
        db.select({ c: count(schema.studies.id) }).from(schema.studies).where(eq(schema.studies.isPublished, true)),
        db.select({ c: count(schema.videos.id) }).from(schema.videos),
        db.select({ c: count(schema.blogPosts.id) }).from(schema.blogPosts).where(eq(schema.blogPosts.isPublished, true)),
        db.select({ c: count(schema.challenges.id) }).from(schema.challenges),
        db.select({ c: count(schema.events.id) }).from(schema.events),
        db.select({ c: count(schema.hurdleWallPosts.id) }).from(schema.hurdleWallPosts),
        db.select({ c: count(schema.podcasts.id) }).from(schema.podcasts),
        db.select({ c: count(schema.bibleApiCalls.id) }).from(schema.bibleApiCalls)
          .where(sql`${schema.bibleApiCalls.calledAt} >= ${periodStart}`),
        db.select({ c: count(schema.users.id) }).from(schema.users).where(eq(schema.users.hasFitnessAccess, true)),
      ]);

      res.json({
        publishedStudies: publishedStudiesResult[0]?.c ?? 0,
        videos: videosResult[0]?.c ?? 0,
        blogPosts: blogPostsResult[0]?.c ?? 0,
        challenges: challengesResult[0]?.c ?? 0,
        events: eventsResult[0]?.c ?? 0,
        warRoomPosts: warRoomResult[0]?.c ?? 0,
        podcasts: podcastsResult[0]?.c ?? 0,
        bibleApiCallsThisPeriod: bibleCallsResult[0]?.c ?? 0,
        fitnessSubscribers: fitnessSubscribersResult[0]?.c ?? 0,
        periodStart: periodStart.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching owner content stats:", error);
      res.status(500).json({ message: "Failed to fetch content stats" });
    }
  });

  // ============================================
  // Owner Panel — System Health
  // ============================================

  app.get('/api/owner/system-health', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isOwner(user)) return res.status(403).json({ message: "Owner access required" });

      const services: Record<string, { name: string; status: 'ok' | 'degraded' | 'error'; detail?: string }> = {};

      // ── 1. Database ───────────────────────────────────────────────────────────
      try {
        await db.execute(sql`SELECT 1`);
        services.database = { name: "PostgreSQL (Neon)", status: "ok", detail: "Connected" };
      } catch (e: any) {
        services.database = { name: "PostgreSQL (Neon)", status: "error", detail: e.message };
      }

      // ── 2. Object Storage ─────────────────────────────────────────────────────
      const hasObjStorage = !!(process.env.PUBLIC_OBJECT_SEARCH_PATHS && process.env.PRIVATE_OBJECT_DIR);
      services.objectStorage = {
        name: "Object Storage (GCS)",
        status: hasObjStorage ? "ok" : "error",
        detail: hasObjStorage ? "Configured" : "PUBLIC_OBJECT_SEARCH_PATHS not set",
      };

      // ── 3. Stripe ────────────────────────────────────────────────────────────
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) {
        try {
          const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
            headers: { 'Authorization': `Bearer ${stripeKey}` },
          });
          services.stripe = {
            name: "Stripe Payments",
            status: stripeRes.ok ? "ok" : "degraded",
            detail: stripeRes.ok ? "Connected" : `HTTP ${stripeRes.status}`,
          };
        } catch (e: any) {
          services.stripe = { name: "Stripe Payments", status: "error", detail: e.message };
        }
      } else {
        services.stripe = { name: "Stripe Payments", status: "error", detail: "No API key configured" };
      }

      // ── 4. Mux Live Streaming ────────────────────────────────────────────────
      const muxId = process.env.MUX_TOKEN_ID;
      const muxSecret = process.env.MUX_TOKEN_SECRET;
      if (muxId && muxSecret) {
        try {
          const muxRes = await fetch('https://api.mux.com/video/v1/live-streams?limit=1', {
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${muxId}:${muxSecret}`).toString('base64'),
              'Content-Type': 'application/json',
            },
          });
          services.mux = {
            name: "Mux Live Streaming",
            status: muxRes.ok ? "ok" : "degraded",
            detail: muxRes.ok ? "Connected" : `HTTP ${muxRes.status}`,
          };
        } catch (e: any) {
          services.mux = { name: "Mux Live Streaming", status: "error", detail: e.message };
        }
      } else {
        services.mux = { name: "Mux Live Streaming", status: "error", detail: "Tokens not configured" };
      }

      // ── 5. Bible API ─────────────────────────────────────────────────────────
      const bibleKey = process.env.BIBLE_API_KEY;
      if (bibleKey) {
        try {
          const bibleRes = await fetch('https://rest.api.bible/v1/bibles?language=eng', {
            headers: { 'api-key': bibleKey },
          });
          // Count this health-check call toward the billing tracker
          try {
            await db.insert(schema.bibleApiCalls).values({ endpoint: '/health-check/bibles' });
          } catch (_) { /* non-blocking */ }
          services.bibleApi = {
            name: "API.Bible",
            status: bibleRes.ok ? "ok" : "degraded",
            detail: bibleRes.ok ? "Connected" : `HTTP ${bibleRes.status}`,
          };
        } catch (e: any) {
          services.bibleApi = { name: "API.Bible", status: "error", detail: e.message };
        }
      } else {
        services.bibleApi = { name: "API.Bible", status: "error", detail: "API key not configured" };
      }

      // ── 6. Push Notifications (VAPID) ────────────────────────────────────────
      const vapid = process.env.VAPID_PRIVATE_KEY;
      services.pushNotifications = {
        name: "Push Notifications",
        status: vapid ? "ok" : "error",
        detail: vapid ? "VAPID keys configured" : "VAPID_PRIVATE_KEY not set",
      };

      // ── 7. Email (Resend via Replit integration) ──────────────────────────────
      const replitConnectors = process.env.REPLIT_CONNECTORS_HOSTNAME;
      services.email = {
        name: "Email (Resend)",
        status: replitConnectors ? "ok" : "degraded",
        detail: replitConnectors ? "Integration configured" : "REPLIT_CONNECTORS_HOSTNAME not set",
      };

      // ── 8. Mailchimp ─────────────────────────────────────────────────────────
      const mailchimpKey = process.env.MAILCHIMP_API_KEY;
      if (mailchimpKey) {
        try {
          const dc = mailchimpKey.split('-')[1];
          const mcRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, {
            headers: { 'Authorization': `apikey ${mailchimpKey}` },
          });
          services.mailchimp = {
            name: "Mailchimp",
            status: mcRes.ok ? "ok" : "degraded",
            detail: mcRes.ok ? "Connected" : `HTTP ${mcRes.status}`,
          };
        } catch (e: any) {
          services.mailchimp = { name: "Mailchimp", status: "error", detail: e.message };
        }
      } else {
        services.mailchimp = { name: "Mailchimp", status: "degraded", detail: "Not configured" };
      }

      res.json({ services, checkedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Error checking system health:", error);
      res.status(500).json({ message: "Failed to check system health" });
    }
  });

  // ============================================
  // Bible API Routes (using API.Bible)
  // ============================================
  
  const BIBLE_API_KEY = process.env.BIBLE_API_KEY;
  const BIBLE_API_BASE = 'https://rest.api.bible/v1';

  // Track every call to API.Bible for the owner dashboard
  app.use('/api/bible', async (req, _res, next) => {
    try {
      await db.insert(schema.bibleApiCalls).values({ endpoint: req.path });
    } catch (_) { /* non-blocking — never break the request */ }
    next();
  });

  // Get available Bible versions
  app.get('/api/bible/versions', async (req, res) => {
    try {
      if (!BIBLE_API_KEY) {
        return res.status(500).json({ message: 'Bible API key not configured' });
      }

      const response = await fetch(`${BIBLE_API_BASE}/bibles`, {
        headers: { 'api-key': BIBLE_API_KEY }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API.Bible error response: ${response.status} - ${errorText}`);
        throw new Error(`API.Bible returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      // Filter to English versions and return simplified list
      const englishBibles = data.data
        .filter((bible: any) => bible.language?.id === 'eng')
        .map((bible: any) => ({
          id: bible.id,
          name: bible.name,
          nameLocal: bible.nameLocal,
          abbreviation: bible.abbreviation,
          abbreviationLocal: bible.abbreviationLocal,
          description: bible.description
        }));
      
      res.json(englishBibles);
    } catch (error) {
      console.error('Error fetching Bible versions:', error);
      res.status(500).json({ message: 'Failed to fetch Bible versions' });
    }
  });

  // Get books for a specific Bible version
  app.get('/api/bible/:bibleId/books', async (req, res) => {
    try {
      if (!BIBLE_API_KEY) {
        return res.status(500).json({ message: 'Bible API key not configured' });
      }

      const { bibleId } = req.params;
      const response = await fetch(`${BIBLE_API_BASE}/bibles/${bibleId}/books`, {
        headers: { 'api-key': BIBLE_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`API.Bible returned ${response.status}`);
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
      res.status(500).json({ message: 'Failed to fetch Bible books' });
    }
  });

  // Get chapters for a specific book
  app.get('/api/bible/:bibleId/books/:bookId/chapters', async (req, res) => {
    try {
      if (!BIBLE_API_KEY) {
        return res.status(500).json({ message: 'Bible API key not configured' });
      }

      const { bibleId, bookId } = req.params;
      const response = await fetch(`${BIBLE_API_BASE}/bibles/${bibleId}/books/${bookId}/chapters`, {
        headers: { 'api-key': BIBLE_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`API.Bible returned ${response.status}`);
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error) {
      console.error('Error fetching Bible chapters:', error);
      res.status(500).json({ message: 'Failed to fetch Bible chapters' });
    }
  });

  // Get chapter content (the main endpoint for reading Bible text)
  app.get('/api/bible/:bibleId/chapters/:chapterId', async (req, res) => {
    try {
      if (!BIBLE_API_KEY) {
        return res.status(500).json({ message: 'Bible API key not configured' });
      }

      const { bibleId, chapterId } = req.params;
      // Request content with verse numbers and without footnotes for cleaner reading
      const response = await fetch(
        `${BIBLE_API_BASE}/bibles/${bibleId}/chapters/${chapterId}?content-type=text&include-verse-numbers=true&include-notes=false&include-titles=true`,
        { headers: { 'api-key': BIBLE_API_KEY } }
      );

      if (!response.ok) {
        throw new Error(`API.Bible returned ${response.status}`);
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error) {
      console.error('Error fetching Bible chapter:', error);
      res.status(500).json({ message: 'Failed to fetch Bible chapter' });
    }
  });

  // Search the Bible
  app.get('/api/bible/:bibleId/search', async (req, res) => {
    try {
      if (!BIBLE_API_KEY) {
        return res.status(500).json({ message: 'Bible API key not configured' });
      }

      const { bibleId } = req.params;
      const query = req.query.query as string;
      
      if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      const response = await fetch(
        `${BIBLE_API_BASE}/bibles/${bibleId}/search?query=${encodeURIComponent(query)}`,
        { headers: { 'api-key': BIBLE_API_KEY } }
      );

      if (!response.ok) {
        throw new Error(`API.Bible returned ${response.status}`);
      }

      const data = await response.json();
      res.json(data.data);
    } catch (error) {
      console.error('Error searching Bible:', error);
      res.status(500).json({ message: 'Failed to search Bible' });
    }
  });

  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients: userId → Set of sockets (one per tab/window)
  const connectedClients = new Map<string, Set<WebSocket>>();
  
  const PING_INTERVAL = 30000;

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  wss.on('connection', (ws: any, req) => {
    console.log('WebSocket connection established');
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (data.type === 'auth' && data.userId) {
          ws.userId = data.userId; // Attach for O(1) close cleanup
          // Add this socket to the user's Set (supports multiple tabs)
          if (!connectedClients.has(data.userId)) {
            connectedClients.set(data.userId, new Set());
          }
          connectedClients.get(data.userId)!.add(ws);
          console.log(`User ${data.userId} connected to WebSocket (${connectedClients.get(data.userId)!.size} tab(s))`);
          
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Successfully authenticated'
          }));
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      if (ws.userId) {
        const sockets = connectedClients.get(ws.userId);
        if (sockets) {
          sockets.delete(ws); // Remove only this tab's socket
          if (sockets.size === 0) {
            connectedClients.delete(ws.userId); // Last tab closed
            console.log(`User ${ws.userId} fully disconnected from WebSocket`);
          } else {
            console.log(`User ${ws.userId} closed a tab (${sockets.size} tab(s) remaining)`);
          }
        }
      }
    });
  });
  
  // Add function to send real-time notifications (wrapped format)
  // Delivers to ALL open tabs for that user
  (app as any).sendRealtimeNotification = (userId: string, notification: any) => {
    const sockets = connectedClients.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify({ type: 'notification', data: notification });
    sockets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  // Add function to send an arbitrary typed message to a single user (all their tabs)
  // Use for private/scoped events where broadcastToAll would leak content to non-members
  (app as any).sendToUser = (userId: string, message: { type: string; data?: any }) => {
    const sockets = connectedClients.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(message);
    sockets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };
  
  // Add function to broadcast to all connected clients (all users, all tabs)
  (app as any).broadcastToAll = (message: { type: string; data?: any }) => {
    const payload = JSON.stringify(message); // Serialize once, not once per client/tab
    connectedClients.forEach((sockets) => {
      sockets.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    });
  };
  
  // Social share page for devotionals — returns HTML with Open Graph meta tags
  // Facebook/X crawlers scrape this page to show the meme image in link previews
  app.get('/share/devotional/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const devotional = await storage.getDevotional(id);
      if (!devotional) {
        return res.redirect('/');
      }
      const title = `${devotional.title} — Man Up God's Way Daily Devotional`;
      const description = devotional.verse
        ? `"${devotional.verse}" — ${devotional.verseReference}`
        : 'Start your day with God\'s Word at manupgodsway.org';
      const imageUrl = `https://www.manupgodsway.org/api/devotionals/${id}/share-image`;
      const pageUrl = `https://www.manupgodsway.org/share/devotional/${id}`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!-- Open Graph (Facebook, Instagram, etc.) -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="800" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="Man Up God's Way" />
  <!-- Twitter / X card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:site" content="@ManUpGodsWay" />
  <!-- Redirect to app after crawlers have what they need -->
  <meta http-equiv="refresh" content="0; url=/" />
  <style>
    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
    .box { text-align: center; color: #fff; padding: 40px; }
    img { max-width: 400px; width: 100%; border-radius: 8px; margin-bottom: 24px; }
    h1 { color: #FCD000; font-size: 1.4rem; margin: 0 0 12px; }
    p { color: #ccc; margin: 0 0 20px; }
    a { color: #FCD000; }
  </style>
</head>
<body>
  <div class="box">
    <img src="${imageUrl}" alt="${devotional.title}" />
    <h1>${devotional.title}</h1>
    <p>${description}</p>
    <p><a href="/">Open Man Up God's Way</a></p>
  </div>
</body>
</html>`);
    } catch (error) {
      console.error("Error serving share page:", error);
      res.redirect('/');
    }
  });

  // ─── Bible Reading Plans ─────────────────────────────────────────────────────

  app.get("/api/bible-plans", async (req, res) => {
    try {
      const plans = await storage.getBibleReadingPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching bible plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.get("/api/bible-plans/:id/days", async (req, res) => {
    try {
      const days = await storage.getBibleReadingPlanDays(req.params.id);
      res.json(days);
    } catch (error) {
      console.error("Error fetching plan days:", error);
      res.status(500).json({ error: "Failed to fetch plan days" });
    }
  });

  app.get("/api/bible-plans/:id/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getBibleReadingProgress(userId, req.params.id);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching bible reading progress:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/bible-plans/:id/days/:dayNum/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    try {
      const userId = req.user.claims.sub;
      const planId = req.params.id;
      const dayNumber = parseInt(req.params.dayNum, 10);
      if (isNaN(dayNumber)) return res.status(400).json({ error: "Invalid day number" });

      const progress = await storage.markBibleReadingDayComplete(userId, planId, dayNumber);

      let rationMessage = "";
      try {
        const { rationsService } = await import('./rations-service');
        const rationResult = await rationsService.awardRations(userId, 'bible_reading_day', `${planId}-${dayNumber}`, 'bible_reading');
        if (rationResult?.awarded) rationMessage = `+${rationResult.amount} rations`;

        const streak = await storage.getBibleReadingConsecutiveDays(userId, planId);
        if (streak === 7) {
          await rationsService.awardRations(userId, 'bible_reading_streak_7', `${planId}-streak7`, 'bible_reading');
        } else if (streak === 30) {
          await rationsService.awardRations(userId, 'bible_reading_streak_30', `${planId}-streak30`, 'bible_reading');
        }
      } catch (_e) {}

      res.json({ progress, rationMessage });
    } catch (error) {
      console.error("Error marking bible reading day complete:", error);
      res.status(500).json({ error: "Failed to mark day complete" });
    }
  });

  app.delete("/api/bible-plans/:id/days/:dayNum/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    try {
      const userId = req.user.claims.sub;
      const planId = req.params.id;
      const dayNumber = parseInt(req.params.dayNum, 10);
      if (isNaN(dayNumber)) return res.status(400).json({ error: "Invalid day number" });
      await storage.unmarkBibleReadingDayComplete(userId, planId, dayNumber);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unmarking bible reading day:", error);
      res.status(500).json({ error: "Failed to unmark day" });
    }
  });

  app.post("/api/admin/seed-bible-plans", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const role = (req.user as any)?.role;
    if (!['admin', 'owner'].includes(role)) return res.status(403).json({ error: "Forbidden" });
    try {
      const { generateSequential365, generateChronological365 } = await import('./bible-plan-data');

      const existingPlans = await storage.getBibleReadingPlans();
      if (existingPlans.length >= 2) {
        return res.json({ message: "Plans already seeded", plans: existingPlans });
      }

      const seqPlan = await storage.seedBiblePlan(
        {
          name: "Read Through the Bible in 365 Days",
          description: "A complete journey through all 66 books of the Bible in canonical order — from Genesis through Revelation — at a steady pace of about 3 chapters per day.",
          planType: "sequential",
        },
        generateSequential365()
      );

      const chronoPlan = await storage.seedBiblePlan(
        {
          name: "Chronological Bible Reading Plan",
          description: "Experience Scripture in the order events actually occurred — beginning with creation and the patriarchs, through the rise and fall of Israel, and into the New Testament church.",
          planType: "chronological",
        },
        generateChronological365()
      );

      res.json({ message: "Bible reading plans seeded successfully", plans: [seqPlan, chronoPlan] });
    } catch (error) {
      console.error("Error seeding bible plans:", error);
      res.status(500).json({ error: "Failed to seed plans" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Nutrition routes (USDA FoodData Central)
  // ─────────────────────────────────────────────────────────────────────────────

  // Lazy-loaded nspell instance — initialised once on first nutrition request
  let _spellChecker: any = null;
  let _spellCheckerInitPromise: Promise<void> | null = null;

  async function getNutritionSpellChecker(): Promise<any | null> {
    if (_spellChecker) return _spellChecker;
    if (_spellCheckerInitPromise) {
      await _spellCheckerInitPromise;
      return _spellChecker;
    }
    _spellCheckerInitPromise = (async () => {
      try {
        // Both nspell and dictionary-en are ESM modules — use dynamic import()
        const [{ default: nspell }, { default: dict }] = await Promise.all([
          import('nspell'),
          import('dictionary-en'),
        ]);
        // dictionary-en v4 exports { aff: Uint8Array, dic: Uint8Array } directly
        _spellChecker = nspell(dict);
        console.log('[Nutrition] Spell checker initialized');
      } catch (err: any) {
        console.warn('[Nutrition] Spell checker unavailable:', err?.message ?? err);
      }
    })();
    await _spellCheckerInitPromise;
    return _spellChecker;
  }

  async function spellCorrectQuery(raw: string): Promise<{ correctedQuery: string; wasChanged: boolean }> {
    try {
      const spell = await getNutritionSpellChecker();
      if (!spell) return { correctedQuery: raw, wasChanged: false };
      const words = raw.trim().split(/\s+/);
      const corrected = words.map((w) => {
        if (spell.correct(w)) return w;
        const suggestions: string[] = spell.suggest(w);
        return suggestions.length > 0 ? suggestions[0] : w;
      });
      const correctedQuery = corrected.join(' ');
      return {
        correctedQuery,
        wasChanged: correctedQuery.toLowerCase() !== raw.toLowerCase(),
      };
    } catch {
      return { correctedQuery: raw, wasChanged: false };
    }
  }

  // Key FDC nutrient IDs to surface on the detail panel
  const LABEL_NUTRIENT_IDS = new Set([
    1008, // Energy (kcal)
    1004, // Total Fat
    1258, // Saturated Fat
    1257, // Trans Fat
    1253, // Cholesterol
    1093, // Sodium
    1005, // Total Carbohydrates
    1079, // Dietary Fiber
    2000, // Total Sugars
    1003, // Protein
    1114, // Vitamin D
    1087, // Calcium
    1089, // Iron
    1092, // Potassium
  ]);

  // GET /api/nutrition/search?q=<query>
  app.get('/api/nutrition/search', isAuthenticated, async (req: any, res) => {
    try {
      const raw = (req.query.q as string || '').trim();
      if (!raw) return res.status(400).json({ message: 'Query is required' });

      const apiKey = process.env.FDC_API_KEY;
      if (!apiKey) return res.status(503).json({ message: 'Nutrition service is not configured' });

      const { correctedQuery, wasChanged } = await spellCorrectQuery(raw);

      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(correctedQuery)}&pageSize=25&api_key=${apiKey}`;
      const fdcRes = await fetch(url);
      if (!fdcRes.ok) {
        console.error('[FDC] search error', fdcRes.status, await fdcRes.text());
        return res.status(502).json({ message: 'Failed to reach nutrition database' });
      }

      const data: any = await fdcRes.json();
      const foods = (data.foods || []).map((f: any) => ({
        fdcId: f.fdcId,
        description: f.description,
        brandOwner: f.brandOwner || null,
        brandName: f.brandName || null,
        dataType: f.dataType,
        servingSize: f.servingSize || null,
        servingSizeUnit: f.servingSizeUnit || null,
        calories: (f.foodNutrients || []).find((n: any) => n.nutrientId === 1008)?.value ?? null,
      }));

      res.json({ correctedQuery, wasChanged, originalQuery: raw, foods, totalHits: data.totalHits || 0 });
    } catch (error) {
      console.error('[FDC] search exception', error);
      res.status(500).json({ message: 'Failed to search nutrition database' });
    }
  });

  // GET /api/nutrition/food/:fdcId
  app.get('/api/nutrition/food/:fdcId', isAuthenticated, async (req: any, res) => {
    try {
      const { fdcId } = req.params;
      const apiKey = process.env.FDC_API_KEY;
      if (!apiKey) return res.status(503).json({ message: 'Nutrition service is not configured' });

      const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`;
      const fdcRes = await fetch(url);
      if (!fdcRes.ok) {
        console.error('[FDC] food detail error', fdcRes.status);
        return res.status(502).json({ message: 'Failed to fetch food details' });
      }

      const data: any = await fdcRes.json();

      const nutrients = (data.foodNutrients || [])
        .filter((n: any) => {
          const id = n.nutrient?.id ?? n.nutrientId;
          return LABEL_NUTRIENT_IDS.has(id);
        })
        .map((n: any) => ({
          id: n.nutrient?.id ?? n.nutrientId,
          name: n.nutrient?.name ?? n.nutrientName,
          amount: n.amount ?? n.value ?? null,
          unitName: n.nutrient?.unitName ?? n.unitName ?? '',
        }))
        .sort((a: any, b: any) => {
          const order = [1008, 1004, 1258, 1257, 1253, 1093, 1005, 1079, 2000, 1003, 1114, 1087, 1089, 1092];
          return order.indexOf(a.id) - order.indexOf(b.id);
        });

      res.json({
        fdcId: data.fdcId,
        description: data.description,
        brandOwner: data.brandOwner || null,
        brandName: data.brandName || null,
        dataType: data.dataType,
        servingSize: data.servingSize || null,
        servingSizeUnit: data.servingSizeUnit || null,
        householdServingFullText: data.householdServingFullText || null,
        nutrients,
      });
    } catch (error) {
      console.error('[FDC] food detail exception', error);
      res.status(500).json({ message: 'Failed to fetch food details' });
    }
  });

  // ─── Food Intake Routes ───────────────────────────────────────────────────────

  const intakeEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    foodName: z.string().min(1).max(300),
    caloriesPerServing: z.number().int().min(0).max(100000),
    servings: z.number().min(0.1).max(100),
  });

  // POST /api/intake — add an entry
  app.post('/api/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = intakeEntrySchema.parse(req.body);
      const totalCalories = Math.round(parsed.caloriesPerServing * parsed.servings);
      const entry = await storage.addFoodIntakeEntry({ userId, ...parsed, totalCalories });
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      console.error('[Intake] POST error', error);
      res.status(500).json({ message: 'Failed to save food intake entry' });
    }
  });

  // GET /api/intake?start=YYYY-MM-DD&end=YYYY-MM-DD — fetch entries for a date range
  app.get('/api/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { start, end } = req.query as { start?: string; end?: string };
      if (!start || !end) return res.status(400).json({ message: 'start and end query params are required' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ message: 'start and end must be YYYY-MM-DD' });
      }
      if (start > end) {
        return res.status(400).json({ message: 'start must be on or before end' });
      }
      const entries = await storage.getFoodIntakeEntries(userId, start, end);
      res.json(entries);
    } catch (error) {
      console.error('[Intake] GET error', error);
      res.status(500).json({ message: 'Failed to fetch food intake entries' });
    }
  });

  // DELETE /api/intake/:id — delete entry owned by the requesting user
  app.delete('/api/intake/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteFoodIntakeEntry(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('[Intake] DELETE error', error);
      res.status(500).json({ message: 'Failed to delete food intake entry' });
    }
  });

  // ─── Nutrition Profile (calorie target) ──────────────────────────────────────

  app.get('/api/nutrition-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getNutritionProfile(userId);
      res.json(profile ?? null);
    } catch (error) {
      console.error('[NutritionProfile] GET error', error);
      res.status(500).json({ message: 'Failed to fetch nutrition profile' });
    }
  });

  const nutritionProfileInputSchema = z.object({
    sex: z.enum(['male', 'female']),
    ageYears: z.number().int().min(13).max(99),
    heightCm: z.number().min(50).max(280),
    weightKg: z.number().min(25).max(400),
    goalWeightKg: z.number().min(25).max(400).optional(),
    goalType: z.enum(['lose', 'maintain', 'gain']),
    timelineWeeks: z.number().int().min(1).max(260).optional(),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'very', 'extra']),
    weightUnit: z.enum(['lb', 'kg']).default('lb'),
    heightUnit: z.enum(['in', 'cm']).default('in'),
    acknowledgement: z.literal(true),
  });

  app.put('/api/nutrition-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = nutritionProfileInputSchema.parse(req.body);
      const { computeTarget } = await import('@shared/calorie-math');
      const result = computeTarget({
        sex: parsed.sex,
        ageYears: parsed.ageYears,
        heightCm: parsed.heightCm,
        weightKg: parsed.weightKg,
        goalType: parsed.goalType,
        activity: parsed.activityLevel,
      });
      // The new simplified flow no longer asks for goal weight or timeline.
      // The DB columns are still NOT NULL for back-compat, so default them.
      const goalWeightKg = parsed.goalWeightKg ?? parsed.weightKg;
      const timelineWeeks = parsed.timelineWeeks ?? 12;
      const saved = await storage.upsertNutritionProfile({
        userId,
        sex: parsed.sex,
        ageYears: parsed.ageYears,
        heightCm: parsed.heightCm,
        weightKg: parsed.weightKg,
        goalWeightKg,
        goalType: parsed.goalType,
        timelineWeeks,
        activityLevel: parsed.activityLevel,
        weightUnit: parsed.weightUnit,
        heightUnit: parsed.heightUnit,
        bmr: result.bmr,
        maintenanceKcal: Math.round(result.maintenanceKcal),
        targetKcal: result.targetKcal,
        floorApplied: result.floorApplied,
        effectiveTimelineWeeks: timelineWeeks,
      });
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      console.error('[NutritionProfile] PUT error', error);
      res.status(500).json({ message: 'Failed to save nutrition profile' });
    }
  });

  // ─── VATMEBOP Accountability Chart ───────────────────────────────────────────

  // GET /api/vatmebop?year=YYYY — all rows for the authenticated user for that year
  app.get('/api/vatmebop', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const yearSchema = z.coerce.number().int().min(2020).max(2100);
      const yearResult = yearSchema.safeParse(req.query.year);
      const year = yearResult.success ? yearResult.data : new Date().getFullYear();
      const rows = await storage.getVatmebopChart(userId, year);
      res.json(rows);
    } catch (error) {
      console.error('[VATMEBOP] GET error', error);
      res.status(500).json({ message: 'Failed to fetch VATMEBOP data' });
    }
  });

  // POST /api/vatmebop — upsert a single week row; body: { year, week, disciplines: { v?, a?, t?, m?, e?, b?, o?, p? } }
  app.post('/api/vatmebop', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const disciplineValueSchema = z.number().int().min(0).max(2);
      const disciplinesSchema = z.object({
        v: disciplineValueSchema.optional(),
        a: disciplineValueSchema.optional(),
        t: disciplineValueSchema.optional(),
        m: disciplineValueSchema.optional(),
        e: disciplineValueSchema.optional(),
        b: disciplineValueSchema.optional(),
        o: disciplineValueSchema.optional(),
        p: disciplineValueSchema.optional(),
      }).refine(
        (d) => Object.values(d).some((v) => v !== undefined),
        { message: 'At least one discipline value must be provided' }
      );
      const bodySchema = z.object({
        year: z.number().int().min(2020).max(2100),
        week: z.number().int().min(1).max(52),
        disciplines: disciplinesSchema,
      });
      const parsed = bodySchema.parse(req.body);
      const row = await storage.upsertVatmebopCheck(userId, parsed.year, parsed.week, parsed.disciplines);
      res.json(row);
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      console.error('[VATMEBOP] POST error', error);
      res.status(500).json({ message: 'Failed to save VATMEBOP check' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Exercise instruction audit (admin only)
  // ─────────────────────────────────────────────────────────────────────────────

  app.post('/api/admin/exercise-audit/start', isAuthenticated, requireAdmin, async (_req: any, res: any) => {
    try {
      if (isAuditJobRunning()) {
        return res.status(409).json({ message: 'Audit job is already running' });
      }
      await startAuditJob(false);
      res.json({ message: 'Audit job started', status: getAuditJobStatus() });
    } catch (err: any) {
      console.error('[exercise-audit] start error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/admin/exercise-audit/status', isAuthenticated, requireAdmin, async (_req: any, res: any) => {
    res.json(getAuditJobStatus());
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Exercise instruction reviews (admin only)
  // ─────────────────────────────────────────────────────────────────────────────

  app.get('/api/admin/exercise-instruction-reviews', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 25), 100);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      // Support explicit params (status, needsReview) OR the convenience `view` shorthand
      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
      const needsReviewParam = req.query.needsReview !== undefined
        ? req.query.needsReview === 'true' || req.query.needsReview === '1'
        : undefined;
      const view = typeof req.query.view === 'string' ? req.query.view : 'corrections';

      const conditions: any[] = [];
      if (search) {
        conditions.push(ilike(schema.exerciseInstructionReviews.exerciseName, `%${search}%`));
      }

      if (statusParam !== undefined || needsReviewParam !== undefined) {
        // Explicit param mode — caller specifies exactly what they want
        if (statusParam !== undefined) {
          conditions.push(eq(schema.exerciseInstructionReviews.status, statusParam));
        }
        if (needsReviewParam !== undefined) {
          conditions.push(eq(schema.exerciseInstructionReviews.needsReview, needsReviewParam));
          if (needsReviewParam) {
            // Only include rows that actually have a new instruction (real corrections)
            conditions.push(isNotNull(schema.exerciseInstructionReviews.newInstructions));
          }
        }
      } else {
        // Convenience view shorthand (used by the admin UI)
        if (view === 'corrections') {
          conditions.push(
            and(
              eq(schema.exerciseInstructionReviews.needsReview, true),
              isNotNull(schema.exerciseInstructionReviews.newInstructions),
              eq(schema.exerciseInstructionReviews.status, 'approved')
            )
          );
        } else if (view === 'matched') {
          conditions.push(eq(schema.exerciseInstructionReviews.needsReview, false));
        } else if (view === 'rejected') {
          conditions.push(eq(schema.exerciseInstructionReviews.status, 'rejected'));
        }
      }

      const confidenceQuery = typeof req.query.confidence === 'string' ? req.query.confidence : undefined;
      if (confidenceQuery === 'medium-low') {
        conditions.push(inArray(schema.exerciseInstructionReviews.confidence, ['medium', 'low']));
      } else if (confidenceQuery === 'low' || confidenceQuery === 'medium' || confidenceQuery === 'high') {
        conditions.push(eq(schema.exerciseInstructionReviews.confidence, confidenceQuery));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: schema.exerciseInstructionReviews.id,
          exerciseId: schema.exerciseInstructionReviews.exerciseId,
          exerciseName: schema.exerciseInstructionReviews.exerciseName,
          oldInstructions: schema.exerciseInstructionReviews.oldInstructions,
          newInstructions: schema.exerciseInstructionReviews.newInstructions,
          needsReview: schema.exerciseInstructionReviews.needsReview,
          status: schema.exerciseInstructionReviews.status,
          confidence: schema.exerciseInstructionReviews.confidence,
          processedAt: schema.exerciseInstructionReviews.processedAt,
          rawModelResponse: schema.exerciseInstructionReviews.rawModelResponse,
          mediaFile: schema.exercises.mediaFile,
          currentInstructions: schema.exercises.instructions,
        })
        .from(schema.exerciseInstructionReviews)
        .leftJoin(schema.exercises, eq(schema.exerciseInstructionReviews.exerciseId, schema.exercises.id))
        .where(whereClause)
        .orderBy(asc(schema.exerciseInstructionReviews.exerciseId))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(schema.exerciseInstructionReviews)
        .where(whereClause);

      res.json({ rows, total: Number(total), limit, offset });
    } catch (err: any) {
      console.error('[exercise-instruction-reviews] list error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-instruction-reviews/:id/revert', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const [review] = await db
        .select()
        .from(schema.exerciseInstructionReviews)
        .where(eq(schema.exerciseInstructionReviews.id, id));
      if (!review) return res.status(404).json({ message: 'Review not found' });

      await db
        .update(schema.exercises)
        .set({ instructions: review.oldInstructions })
        .where(eq(schema.exercises.id, review.exerciseId));
      await db
        .update(schema.exerciseInstructionReviews)
        .set({ status: 'rejected' })
        .where(eq(schema.exerciseInstructionReviews.id, id));

      res.json({ message: 'Instructions reverted to original', exerciseId: review.exerciseId });
    } catch (err: any) {
      console.error('[exercise-instruction-reviews] revert error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-instruction-reviews/:id/edit', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
      if (!instructions) {
        return res.status(400).json({ message: 'Instructions cannot be empty' });
      }

      const [review] = await db
        .select()
        .from(schema.exerciseInstructionReviews)
        .where(eq(schema.exerciseInstructionReviews.id, id));
      if (!review) return res.status(404).json({ message: 'Review not found' });

      await db
        .update(schema.exercises)
        .set({ instructions })
        .where(eq(schema.exercises.id, review.exerciseId));

      await db
        .update(schema.exerciseInstructionReviews)
        .set({ newInstructions: instructions, status: 'approved', needsReview: true })
        .where(eq(schema.exerciseInstructionReviews.id, id));

      res.json({ message: 'Instructions updated', exerciseId: review.exerciseId, instructions });
    } catch (err: any) {
      console.error('[exercise-instruction-reviews] edit error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // Bulk-approve a list of reviews — marks them as permanently reviewed (needsReview=false)
  // so they no longer appear in the corrections queue. The AI corrections were already
  // applied to exercises.instructions when the review row was created; this just records
  // the admin sign-off.
  app.post('/api/admin/exercise-instruction-reviews/bulk-approve', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(new Set(
        rawIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
      )) as number[];

      if (ids.length === 0) {
        return res.status(400).json({ message: 'No valid review IDs provided' });
      }
      if (ids.length > 500) {
        return res.status(400).json({ message: 'Cannot approve more than 500 reviews at once' });
      }

      const result = await db
        .update(schema.exerciseInstructionReviews)
        .set({ needsReview: false, status: 'approved' })
        .where(inArray(schema.exerciseInstructionReviews.id, ids))
        .returning({ id: schema.exerciseInstructionReviews.id });

      res.json({
        message: `Approved ${result.length} review${result.length === 1 ? '' : 's'}`,
        approvedCount: result.length,
      });
    } catch (err: any) {
      console.error('[exercise-instruction-reviews] bulk-approve error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-instruction-reviews/:id/requeue', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const [review] = await db
        .select()
        .from(schema.exerciseInstructionReviews)
        .where(eq(schema.exerciseInstructionReviews.id, id));
      if (!review) return res.status(404).json({ message: 'Review not found' });

      // Delete the existing review row so the audit won't skip it
      await db
        .delete(schema.exerciseInstructionReviews)
        .where(eq(schema.exerciseInstructionReviews.id, id));

      // Immediately re-audit this single exercise (runs in background, non-blocking)
      auditSingleExercise(review.exerciseId)
        .then(({ result, exerciseName }) => {
          console.log(`[exercise-audit] Re-queue complete for #${review.exerciseId} "${exerciseName}": ${result}`);
        })
        .catch((err: any) => {
          console.error(`[exercise-audit] Re-queue error for #${review.exerciseId}:`, err.message);
        });

      res.json({
        message: 'Exercise re-queued — AI audit is running for this exercise in the background',
        exerciseId: review.exerciseId,
      });
    } catch (err: any) {
      console.error('[exercise-instruction-reviews] requeue error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Exercise Sidedness Reviews — admin queue for AI-proposed sidedness classifications
  // ─────────────────────────────────────────────────────────────────────────────

  const SIDEDNESS_VALUES = ['bilateral', 'unilateral', 'alternating'] as const;
  type SidednessValue = typeof SIDEDNESS_VALUES[number];

  function parseSidedness(raw: unknown): SidednessValue | null {
    if (typeof raw !== 'string') return null;
    const v = raw as SidednessValue;
    return SIDEDNESS_VALUES.includes(v) ? v : null;
  }

  app.get('/api/admin/exercise-sidedness-reviews', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 30), 200);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const confidenceFilter = typeof req.query.confidence === 'string' ? req.query.confidence : undefined;
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'exerciseId';
      const sortDir = req.query.sortDir === 'desc' ? desc : asc;

      const conditions = [eq(schema.exerciseSidednessReviews.status, statusFilter)];
      if (search) conditions.push(ilike(schema.exerciseSidednessReviews.exerciseName, `%${search}%`));
      if (confidenceFilter === 'medium-low') {
        conditions.push(inArray(schema.exerciseSidednessReviews.confidence, ['medium', 'low']));
      } else if (confidenceFilter === 'low') {
        conditions.push(eq(schema.exerciseSidednessReviews.confidence, 'low'));
      }
      const whereClause = and(...conditions);

      const orderColumn =
        sortBy === 'exerciseName' ? schema.exerciseSidednessReviews.exerciseName
        : sortBy === 'confidence' ? schema.exerciseSidednessReviews.confidence
        : sortBy === 'proposedSidedness' ? schema.exerciseSidednessReviews.proposedSidedness
        : schema.exerciseSidednessReviews.exerciseId;

      const rows = await db
        .select({
          id: schema.exerciseSidednessReviews.id,
          exerciseId: schema.exerciseSidednessReviews.exerciseId,
          exerciseName: schema.exerciseSidednessReviews.exerciseName,
          proposedSidedness: schema.exerciseSidednessReviews.proposedSidedness,
          reasoning: schema.exerciseSidednessReviews.reasoning,
          confidence: schema.exerciseSidednessReviews.confidence,
          status: schema.exerciseSidednessReviews.status,
          approvedSidedness: schema.exerciseSidednessReviews.approvedSidedness,
          reviewedAt: schema.exerciseSidednessReviews.reviewedAt,
          processedAt: schema.exerciseSidednessReviews.processedAt,
          currentSidedness: schema.exercises.sidedness,
          // Included so the admin can verify the AI verdict against the actual instructions
          instructions: schema.exercises.instructions,
        })
        .from(schema.exerciseSidednessReviews)
        .leftJoin(schema.exercises, eq(schema.exerciseSidednessReviews.exerciseId, schema.exercises.id))
        .where(whereClause)
        .orderBy(sortDir(orderColumn))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(schema.exerciseSidednessReviews)
        .where(whereClause);

      // Counts per status for tab badges
      const statusCounts = await db
        .select({ status: schema.exerciseSidednessReviews.status, cnt: count() })
        .from(schema.exerciseSidednessReviews)
        .groupBy(schema.exerciseSidednessReviews.status);

      const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const row of statusCounts) counts[row.status] = Number(row.cnt);

      res.json({ rows, total: Number(total), limit, offset, counts });
    } catch (err: any) {
      console.error('[sidedness-reviews] list error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-sidedness-reviews/:id/approve', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id, 10);
      const chosenSidedness = parseSidedness(req.body.sidedness);
      if (!chosenSidedness) return res.status(400).json({ message: 'Invalid sidedness value' });

      const [review] = await db
        .select()
        .from(schema.exerciseSidednessReviews)
        .where(eq(schema.exerciseSidednessReviews.id, id))
        .limit(1);
      if (!review) return res.status(404).json({ message: 'Review not found' });

      await db.transaction(async (tx) => {
        await tx
          .update(schema.exercises)
          .set({ sidedness: chosenSidedness, updatedAt: new Date() })
          .where(eq(schema.exercises.id, review.exerciseId));

        await tx
          .update(schema.fitnessPlanExercises)
          .set({ sidedness: chosenSidedness })
          .where(eq(schema.fitnessPlanExercises.exerciseId, review.exerciseId.toString()));

        await tx
          .update(schema.exerciseSidednessReviews)
          .set({ status: 'approved', approvedSidedness: chosenSidedness, reviewedAt: new Date() })
          .where(eq(schema.exerciseSidednessReviews.id, id));
      });

      res.json({ ok: true });
    } catch (err: any) {
      console.error('[sidedness-reviews] approve error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-sidedness-reviews/:id/reject', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db
        .update(schema.exerciseSidednessReviews)
        .set({ status: 'rejected', reviewedAt: new Date() })
        .where(eq(schema.exerciseSidednessReviews.id, id));
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[sidedness-reviews] reject error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-sidedness-reviews/:id/requeue', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid review id' });

      // Pre-check existence so callers get a 404 rather than a generic 500
      const [existing] = await db
        .select({ id: schema.exerciseSidednessReviews.id })
        .from(schema.exerciseSidednessReviews)
        .where(eq(schema.exerciseSidednessReviews.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ message: `Sidedness review #${id} not found` });

      const useOpus = req.body?.useOpus === true;
      const { exerciseName, verdict } = await reclassifyExerciseSidedness(id, { useOpus });

      console.log(`[sidedness-reviews] requeue #${id} "${exerciseName}": ${verdict.sidedness} (${verdict.confidence})`);
      res.json({ ok: true, exerciseName, verdict });
    } catch (err: any) {
      console.error('[sidedness-reviews] requeue error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/exercise-sidedness-reviews/bulk-approve', isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      // confidenceFilter defaults to "high" so the safe workflow is: bulk-approve
      // only high-confidence rows automatically; low-confidence rows require individual
      // review. Pass "all" to override and approve every pending row.
      const { confidenceFilter = 'high', search } = req.body as {
        confidenceFilter?: 'high' | 'high-medium' | 'all';
        search?: string;
      };

      const conditions = [eq(schema.exerciseSidednessReviews.status, 'pending')];
      if (confidenceFilter === 'high') {
        conditions.push(eq(schema.exerciseSidednessReviews.confidence, 'high'));
      } else if (confidenceFilter === 'high-medium') {
        conditions.push(inArray(schema.exerciseSidednessReviews.confidence, ['high', 'medium']));
      }
      // 'all' adds no confidence condition
      if (search) conditions.push(ilike(schema.exerciseSidednessReviews.exerciseName, `%${search}%`));
      const whereClause = and(...conditions);

      const pending = await db
        .select({
          id: schema.exerciseSidednessReviews.id,
          exerciseId: schema.exerciseSidednessReviews.exerciseId,
          proposedSidedness: schema.exerciseSidednessReviews.proposedSidedness,
        })
        .from(schema.exerciseSidednessReviews)
        .where(whereClause);

      let approved = 0;
      for (const r of pending) {
        const sidedness = parseSidedness(r.proposedSidedness);
        if (!sidedness) continue;
        await db.transaction(async (tx) => {
          await tx
            .update(schema.exercises)
            .set({ sidedness, updatedAt: new Date() })
            .where(eq(schema.exercises.id, r.exerciseId));
          await tx
            .update(schema.fitnessPlanExercises)
            .set({ sidedness })
            .where(eq(schema.fitnessPlanExercises.exerciseId, r.exerciseId.toString()));
          await tx
            .update(schema.exerciseSidednessReviews)
            .set({ status: 'approved', approvedSidedness: sidedness, reviewedAt: new Date() })
            .where(eq(schema.exerciseSidednessReviews.id, r.id));
        });
        approved++;
      }

      res.json({ ok: true, approved });
    } catch (err: any) {
      console.error('[sidedness-reviews] bulk-approve error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Terms Acknowledgement ────────────────────────────────────────────────
  // GET /api/terms/current — return the current terms version and effective date (no auth required)
  app.get('/api/terms/current', (_req, res) => {
    res.json({ version: CURRENT_TERMS_VERSION, effectiveDate: TERMS_EFFECTIVE_DATE });
  });

  // GET /api/terms/me — return the version and timestamp this user has accepted (null if never)
  app.get('/api/terms/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const result = await storage.getUserTermsInfo(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: 'Failed to fetch terms version' });
    }
  });

  // POST /api/terms/accept — record a user's acceptance of a terms version
  app.post('/api/terms/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const { version, source } = req.body;
      if (!version || typeof version !== 'string') {
        return res.status(400).json({ message: 'Missing version' });
      }
      const validSources = ['signup', 'forced_reagreement', 'settings_reaccept'];
      const safeSource = validSources.includes(source) ? source : 'forced_reagreement';
      const row = await storage.recordTermsAcceptance(userId, version, safeSource);
      res.json({ ok: true, row });
    } catch (err: any) {
      console.error('[terms/accept] error:', err.message);
      res.status(500).json({ message: 'Failed to record terms acceptance' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  return httpServer;
}
