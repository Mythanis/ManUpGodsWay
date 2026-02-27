import type { Express } from "express";
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
import { warGroupsService } from "./warGroupsService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
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
  insertWarGroupMemberSchema
} from "@shared/schema";
import { z, ZodError } from "zod";
import { devotionalNotificationService } from "./devotionalNotificationService";
import { 
  savePushSubscription, 
  removePushSubscription, 
  getUserSubscriptionCount,
  sendPushNotification,
  sendPushToMultipleUsers,
  sendPushToAllUsers
} from "./pushNotificationService";
import Parser from 'rss-parser';

// Role checking helper functions
function isAdmin(user: any): boolean {
  return user && (user.role === 'admin' || user.role === 'owner');
}

function isOwner(user: any): boolean {
  return user && user.role === 'owner';
}

function hasAdminPrivileges(user: any): boolean {
  return isAdmin(user);
}

function hasOwnerPrivileges(user: any): boolean {
  return isOwner(user);
}

// Subscription access checking helpers
function hasActiveSubscription(user: any): boolean {
  return user && (user.subscriptionStatus === 'active' || user.role === 'admin' || user.role === 'owner');
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

// Configure multer for video uploads with disk storage
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = `video_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: videoStorage,
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

// Configure multer for thumbnail uploads with disk storage
const thumbnailStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = `study_thumbnail_${Date.now()}_${file.originalname}`;
    cb(null, filename);
  }
});

const thumbnailUpload = multer({
  storage: thumbnailStorage,
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

// Configure multer for blog thumbnail uploads with disk storage
const blogThumbnailStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'blog-thumbnails');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = `blog_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, filename);
  }
});

const blogThumbnailUpload = multer({
  storage: blogThumbnailStorage,
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

// Configure multer for store product images with disk storage
const storeProductImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'store-products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = `store_product_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, filename);
  }
});

const storeProductImageUpload = multer({
  storage: storeProductImageStorage,
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

// Configure multer for community media uploads (images, videos, gifs)
const communityMediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'community');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    if (file.originalname.includes('\0')) {
      return cb(new Error('Invalid filename: contains null byte'));
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `community-${uniqueSuffix}${ext}`);
  }
});

const communityMediaUpload = multer({
  storage: communityMediaStorage,
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

  app.get('/api/push/vapid-public-key', (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
    if (vapidPublicKey) {
      res.json({ vapidPublicKey });
    } else {
      res.status(404).json({ message: 'VAPID public key not configured' });
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
      // Filter to trial-accessible only for trial users
      let filtered = studies;
      if (userId) {
        try {
          const user = await storage.getUser(userId);
          if (user?.subscriptionStatus === 'trial' && !hasAdminPrivileges(user)) {
            filtered = studies.filter((s: any) => s.isTrialAccessible);
          }
        } catch {}
      }
      res.json(filtered);
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

      // File is already saved to disk by multer
      const thumbnailUrl = `/uploads/thumbnails/${file.filename}`;
      const updateData = {
        thumbnailFilename: file.filename,
        thumbnailUrl: thumbnailUrl,
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

      // Delete file from disk if it exists
      if (study.thumbnailFilename) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'thumbnails');
        const filePath = path.resolve(uploadsDir, study.thumbnailFilename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
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
      
      // Extract user's local date if provided
      const userLocalDate = progressData.userLocalDate ? new Date(progressData.userLocalDate) : undefined;
      // Remove userLocalDate from progressData before passing to storage
      const { userLocalDate: _, ...cleanProgressData } = progressData;
      
      const progress = await storage.updateProgress(userId, studyId, cleanProgressData, userLocalDate);
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
      res.json(discussions);
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
      res.json(discussion);
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
        const url = `/uploads/community/${file.filename}`;
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

  app.post('/api/discussions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const discussionData = insertDiscussionSchema.parse({
        ...req.body,
        userId,
      });
      
      const discussion = await storage.createDiscussion(discussionData);
      
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
            });
          });
          
          await Promise.allSettled(notificationPromises);
        }
      } catch (notificationError) {
        console.error("Error sending discussion notifications:", notificationError);
        // Don't fail the discussion creation if notifications fail
      }
      
      res.status(201).json(discussion);
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
      res.json(updatedDiscussion);
    } catch (error) {
      console.error("Error updating discussion:", error);
      res.status(500).json({ message: "Failed to update discussion" });
    }
  });

  app.get('/api/discussions/:id/replies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replies = await storage.getDiscussionReplies(req.params.id, userId);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      res.status(500).json({ message: "Failed to fetch replies" });
    }
  });

  app.post('/api/discussions/:id/replies', isAuthenticated, async (req: any, res) => {
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
              relatedId: discussion.id,
            });
          });
          
          await Promise.allSettled(notificationPromises);
        }
      } catch (notificationError) {
        console.error("Error sending reply notifications:", notificationError);
        // Don't fail the reply creation if notifications fail
      }
      
      res.status(201).json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reply data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create reply" });
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

      const streamData = {
        ...req.body,
        createdBy: user.id,
        status: 'scheduled',
      };
      
      const stream = await storage.createLiveStream(streamData);
      res.status(201).json(stream);
    } catch (error) {
      console.error("Error creating live stream:", error);
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

      await storage.deleteLiveStream(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting live stream:", error);
      res.status(500).json({ message: "Failed to delete live stream" });
    }
  });

  // Study lesson routes
  app.get('/api/studies/:studyId/lessons', async (req, res) => {
    try {
      const lessons = await storage.getStudyLessons(req.params.studyId);
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

  // Track "Start a Study" activity - awards rations on first study view
  app.post('/api/studies/:studyId/track-start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;

      // Check if study exists
      const study = await storage.getStudy(studyId);
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }

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

      // Check if lesson was already completed
      const existingProgress = await storage.getUserLessonProgress(userId);
      const wasAlreadyComplete = existingProgress.some(p => p.lessonId === lessonId && p.isCompleted);

      const progress = await storage.markLessonComplete(userId, lessonId, answers);
      
      // Award rations for lesson completion (only if first time completing)
      let rationResult = null;
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
          // Get the study's configured reward from DB
          const [study] = await db.select({ 
            rationReward: schema.studies.rationReward, 
            title: schema.studies.title,
            seriesId: schema.studies.seriesId,
            seriesOrder: schema.studies.seriesOrder
          }).from(schema.studies).where(eq(schema.studies.id, studyId));
          const studyReward = study?.rationReward || 100;
          
          await rationsService.awardCustomRations(
            userId, studyReward, 'study', `Completed study: ${study?.title || 'Unknown'}`, 'complete_study', studyId, 'study'
          );
          
          // Check if there's a next study in a consecutive series and notify user
          if (study?.seriesId) {
            const [series] = await db.select()
              .from(schema.studySeries)
              .where(eq(schema.studySeries.id, study.seriesId));
            
            if (series?.requiresConsecutiveCompletion) {
              // Get all studies in the series ordered properly to find the next one
              const allSeriesStudies = await db.select()
                .from(schema.studies)
                .where(and(
                  eq(schema.studies.seriesId, study.seriesId),
                  eq(schema.studies.isPublished, true)
                ))
                .orderBy(asc(schema.studies.seriesOrder), asc(schema.studies.createdAt));
              
              // Find current study index and get the next one
              const currentIndex = allSeriesStudies.findIndex(s => s.id === studyId);
              const nextStudy = currentIndex >= 0 && currentIndex < allSeriesStudies.length - 1
                ? allSeriesStudies[currentIndex + 1]
                : null;
              
              if (nextStudy) {
                // Check user's notification preferences
                const [userPrefs] = await db.select()
                  .from(schema.notificationPreferences)
                  .where(eq(schema.notificationPreferences.userId, userId));
                
                // Send notification if user has nextStudyNotifications enabled (default true)
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
        }
      }

      res.json({ ...progress, rations: rationResult });
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

  // Generate shareable devotional image
  app.get('/api/devotionals/:id/share-image', async (req, res) => {
    try {
      const { id } = req.params;
      const devotional = await storage.getDevotional(id);
      
      if (!devotional) {
        return res.status(404).json({ message: "Devotional not found" });
      }

      const { createCanvas, loadImage } = await import('canvas');
      
      // Square format for social sharing
      const width = 1080;
      const height = 1080;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const margin = 50;

      // Black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Gold border
      ctx.strokeStyle = '#FCD000';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Fixed layout zones - maximize content area
      const headerEnd = 150;
      const footerStart = height - 80;
      const contentStart = headerEnd + 15;
      const contentEnd = footerStart - 10;

      // === HEADER ZONE (0 to headerEnd) ===
      // Try to load and draw logo
      let hasLogo = false;
      try {
        const logoSettings = await storage.getLogoSettings();
        if (logoSettings?.logoUrl) {
          const logoImg = await loadImage(logoSettings.logoUrl);
          const logoHeight = 100;
          const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
          ctx.drawImage(logoImg, (width - logoWidth) / 2, 30, logoWidth, logoHeight);
          hasLogo = true;
        }
      } catch (logoErr) {
        console.log("Logo load failed, using text");
      }
      
      if (!hasLogo) {
        ctx.fillStyle = '#FCD000';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAN UP GOD\'S WAY', width / 2, 90);
      }

      // Gold line under header
      ctx.fillStyle = '#FCD000';
      ctx.fillRect(margin + 50, headerEnd - 10, width - margin * 2 - 100, 3);

      // === CONTENT ZONE (contentStart to contentEnd) ===
      const contentWidth = width - margin * 2;
      let y = contentStart;

      // Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px sans-serif';
      ctx.textAlign = 'center';
      const title = devotional.title.toUpperCase();
      const titleLines = wrapTextSimple(ctx, title, contentWidth - 40);
      titleLines.slice(0, 2).forEach(line => {
        ctx.fillText(line, width / 2, y);
        y += 48;
      });

      // Gold divider
      y += 15;
      ctx.fillStyle = '#FCD000';
      ctx.fillRect(width / 2 - 50, y, 100, 4);
      y += 35;

      // Verse in gold italic
      ctx.fillStyle = '#FCD000';
      ctx.font = 'italic 28px sans-serif';
      const verseText = `"${devotional.verse || ''}"`;
      const verseLines = wrapTextSimple(ctx, verseText, contentWidth - 60);
      verseLines.slice(0, 4).forEach(line => {
        ctx.fillText(line, width / 2, y);
        y += 36;
      });

      // Verse reference
      y += 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`— ${devotional.verseReference || ''}`, width / 2, y);
      y += 40;

      // Small gold divider
      ctx.fillStyle = '#FCD000';
      ctx.fillRect(width / 2 - 30, y, 60, 3);
      y += 35;

      // Content text - fill remaining space
      const remainingHeight = contentEnd - y;
      const lineHeight = 32;
      const maxLines = Math.floor(remainingHeight / lineHeight);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'left';
      const content = (devotional.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      const contentLines = wrapTextSimple(ctx, content, contentWidth - 20);
      
      const linesToShow = Math.min(maxLines - 1, contentLines.length);
      for (let i = 0; i < linesToShow; i++) {
        ctx.fillText(contentLines[i], margin + 10, y);
        y += lineHeight;
      }
      if (contentLines.length > linesToShow) {
        ctx.fillStyle = '#888888';
        ctx.font = 'italic 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('...continue reading in the app', width / 2, y);
      }

      // === FOOTER ZONE (footerStart to height) ===
      ctx.fillStyle = '#FCD000';
      ctx.fillRect(0, footerStart, width, height - footerStart);
      
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('DOWNLOAD THE APP', width / 2, footerStart + 28);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('www.manupgodsway.org', width / 2, footerStart + 58);

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

      // File is already saved to disk by multer
      const thumbnailUrl = `/uploads/thumbnails/${file.filename}`;
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

      // Extract filename from URL if it's a local upload
      if (devotional.imageUrl && devotional.imageUrl.startsWith('/uploads/thumbnails/')) {
        const filename = devotional.imageUrl.split('/').pop();
        if (filename) {
          const uploadsDir = path.resolve(process.cwd(), 'uploads', 'thumbnails');
          const filePath = path.resolve(uploadsDir, filename);
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
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

  // Mark devotional as complete (awards rations)
  app.post('/api/devotionals/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id: devotionalId } = req.params;
      
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

  // Submit devotional reflection (awards rations)
  app.post('/api/devotionals/:id/reflection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id: devotionalId } = req.params;
      const { reflection } = req.body;
      
      if (!reflection || reflection.trim().length < 50) {
        return res.status(400).json({ message: "Reflection must be at least 50 characters" });
      }
      
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

  app.post('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
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

  // Admin routes
  // Users endpoint for messaging (accessible to all authenticated users)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const users = await storage.getAllUsers(
        limit ? parseInt(limit as string) : undefined
      );
      
      // Return only necessary fields for messaging (excluding sensitive info)
      const publicUsers = users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
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

      const { limit } = req.query;
      const users = await storage.getAllUsers(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:id/role', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { role } = req.body;
      if (!role || !['user', 'admin', 'owner'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
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

      let { subscriptionStatus, subscriptionTier } = req.body;

      // Accept subscriptionTier from the frontend and translate to subscriptionStatus
      if (!subscriptionStatus && subscriptionTier) {
        if (subscriptionTier === 'free') subscriptionStatus = 'expired';
        else if (subscriptionTier === 'premium' || subscriptionTier === 'subscriber') subscriptionStatus = 'active';
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
      } else if (subscriptionStatus === 'expired') {
        updateData.subscriptionTier = 'free';
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
        updateData.subscriptionTier = 'free';
      }

      const updatedUser = await storage.updateUserSubscriptionDetails(req.params.id, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user subscription:", error);
      res.status(500).json({ message: "Failed to update user subscription" });
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

      const { billingCycle, startTrial } = req.body;

      if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ message: "Invalid billing cycle" });
      }

      const subSettings = await storage.getSubscriptionSettings();
      if (!subSettings) {
        return res.status(404).json({ message: "Subscription pricing not configured" });
      }

      const trialDays = subSettings.trialDurationDays || 7;
      const hasUsedTrial = !!(user as any).trialStartDate || (user as any).subscriptionStatus === 'active';
      const applyTrial = startTrial && !hasUsedTrial;

      const price = billingCycle === 'yearly' 
        ? (subSettings.yearlyPrice || subSettings.monthlyPrice)
        : subSettings.monthlyPrice;

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
                description: (subSettings.features || []).join(', '),
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
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile?upgrade=success${applyTrial ? '&trial=true' : ''}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile?upgrade=cancelled`,
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
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile`,
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

  // Stripe webhook to handle subscription events
  app.post('/api/stripe/webhook', async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ message: "Stripe not configured" });
      }

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      const event = req.body;

      // Handle the subscription checkout completion event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Handle fitness membership subscription
        if (session.mode === 'subscription' && session.metadata?.type === 'fitness_membership') {
          const { userId } = session.metadata;
          if (userId) {
            const subscriptions = await stripe.subscriptions.list({ customer: session.customer as string, limit: 1 });
            const sub = subscriptions.data[0];
            const periodEnd = sub ? new Date(sub.current_period_end * 1000) : null;

            await db.insert(schema.fitnessMemberships).values({
              userId,
              stripeSubscriptionId: sub?.id,
              stripeCustomerId: session.customer as string,
              status: 'active',
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            }).onConflictDoUpdate({
              target: schema.fitnessMemberships.userId,
              set: {
                stripeSubscriptionId: sub?.id,
                stripeCustomerId: session.customer as string,
                status: 'active',
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                updatedAt: new Date(),
              }
            });

            await storage.setUserFitnessAccess(userId, true);

            await storage.createNotification({
              userId,
              type: 'admin',
              title: 'Fitness Community Access Unlocked!',
              message: 'Welcome to the Man Up God\'s Way Fitness Community! You now have full access to workouts, plans, and the exercise library.',
              relatedId: null,
            });
            console.log(`[Fitness] Membership activated for user ${userId}`);
          }
        }

        // Handle individual fitness plan purchase
        if (session.mode === 'payment' && session.metadata?.type === 'fitness_plan_purchase') {
          const { userId, planId } = session.metadata;
          if (userId && planId) {
            await db.insert(schema.fitnessPlanPurchases).values({
              userId,
              planId,
              stripePaymentIntentId: session.payment_intent as string,
              amountPaid: session.amount_total || 0,
            }).onConflictDoNothing();

            await storage.createNotification({
              userId,
              type: 'admin',
              title: 'Fitness Plan Purchased!',
              message: `Your fitness plan "${session.metadata.planTitle}" is now available to download in the Fitness section.`,
              relatedId: null,
            });
            console.log(`[Fitness] Plan ${planId} purchased by user ${userId}`);
          }
        }

        if (session.mode === 'subscription' && session.metadata?.type !== 'fitness_membership') {
          const { userId, billingCycle, startTrial } = session.metadata;

          if (userId) {
            const subscription = await stripe.subscriptions.list({
              customer: session.customer,
              limit: 1,
            });

            const stripeSubscription = subscription.data[0];
            const isTrialSubscription = startTrial === 'true' && stripeSubscription?.trial_end;

            if (isTrialSubscription) {
              const trialEnd = new Date(stripeSubscription.trial_end! * 1000);
              await storage.updateUserSubscriptionDetails(userId, {
                subscriptionTier: 'subscriber',
                subscriptionStatus: 'active',
                trialStartDate: new Date(),
                trialEndDate: trialEnd,
                subscriptionExpiresAt: trialEnd,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: stripeSubscription.id,
              });

              console.log(`User ${userId} started free trial via Stripe (trial ends: ${trialEnd.toISOString()})`);

              const user = await storage.getUser(userId);
              if (user) {
                const notification = await storage.createNotification({
                  userId: user.id,
                  type: 'admin',
                  title: 'Free Trial Started!',
                  message: `Welcome! Your free trial is now active. You have full access to all content and features until ${trialEnd.toLocaleDateString()}.`,
                  relatedId: null,
                });
                if ((req.app as any).sendRealtimeNotification) {
                  (req.app as any).sendRealtimeNotification(user.id, notification);
                }
              }
            } else {
              const now = new Date();
              const expirationDate = new Date(now);
              if (billingCycle === 'yearly') {
                expirationDate.setFullYear(now.getFullYear() + 1);
              } else {
                expirationDate.setMonth(now.getMonth() + 1);
              }

              await storage.updateUserSubscriptionDetails(userId, {
                subscriptionTier: 'subscriber',
                subscriptionStatus: 'active',
                subscriptionExpiresAt: expirationDate,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: stripeSubscription?.id,
              });

              console.log(`User ${userId} subscribed via Stripe (expires: ${expirationDate.toISOString()})`);

              const user = await storage.getUser(userId);
              if (user) {
                const notification = await storage.createNotification({
                  userId: user.id,
                  type: 'admin',
                  title: 'Subscription Activated!',
                  message: `Welcome! Your subscription is now active. You have full access to all content and features.`,
                  relatedId: null,
                });
                if ((req.app as any).sendRealtimeNotification) {
                  (req.app as any).sendRealtimeNotification(user.id, notification);
                }
              }
            }
          }
        }
      }

      // Handle subscription updates (trial conversion + cancellations)
      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const previousAttributes = event.data.previous_attributes;

        // Trial converted to paid subscription
        if (previousAttributes?.trial_end && !subscription.trial_end && subscription.status === 'active') {
          const userId = subscription.metadata?.userId;
          if (userId) {
            const expirationDate = new Date(subscription.current_period_end * 1000);

            await storage.updateUserSubscriptionDetails(userId, {
              subscriptionTier: 'subscriber',
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expirationDate,
            });

            console.log(`User ${userId} trial converted to paid subscription (expires: ${expirationDate.toISOString()})`);

            const user = await storage.getUser(userId);
            if (user) {
              const notification = await storage.createNotification({
                userId: user.id,
                type: 'admin',
                title: 'Trial Converted to Subscription!',
                message: `Your free trial has ended and your subscription is now active. Thank you for subscribing!`,
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(user.id, notification);
              }
            }
          }
        }

        // User cancelled but subscription continues until period end
        if (subscription.cancel_at_period_end) {
          const user = await storage.getUser(subscription.metadata?.userId);
          if (user && user.stripeSubscriptionId === subscription.id) {
            await storage.cancelUserSubscription(user.id);
            
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'admin',
              title: 'Subscription Cancelled',
              message: `Your subscription has been cancelled and will continue until ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}. You can reactivate it anytime before then.`,
              relatedId: null,
            });

            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(user.id, notification);
            }
          }
        }

        // Fitness membership: revoke access when subscription is fully cancelled
        if (subscription.status === 'canceled') {
          try {
            const [fitnessMembership] = await db
              .select()
              .from(schema.fitnessMemberships)
              .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscription.id))
              .limit(1);
            if (fitnessMembership) {
              await db.update(schema.fitnessMemberships)
                .set({ status: 'cancelled', updatedAt: new Date() })
                .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
              await storage.setUserFitnessAccess(fitnessMembership.userId, false);
              console.log(`[Fitness] Membership cancelled and access revoked for user ${fitnessMembership.userId}`);
            }
          } catch (err) {
            console.error('[Fitness] Error revoking fitness access on subscription cancel:', err);
          }
        }
      }

      // T001: invoice.payment_failed — suspend access immediately
      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          // Main subscription
          try {
            const [affectedUser] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.stripeSubscriptionId, subscriptionId))
              .limit(1);
            if (affectedUser) {
              await storage.updateUserSubscriptionDetails(affectedUser.id, {
                subscriptionStatus: 'past_due',
              });
              const notification = await storage.createNotification({
                userId: affectedUser.id,
                type: 'admin',
                title: 'Payment Failed',
                message: 'Your last payment was declined. Please update your payment method to restore your access.',
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
              }
              console.log(`[Billing] Main subscription payment failed for user ${affectedUser.id} — status set to past_due`);
            }
          } catch (err) {
            console.error('[Billing] Error handling payment_failed for main subscription:', err);
          }

          // Fitness membership
          try {
            const [fitnessMembership] = await db
              .select()
              .from(schema.fitnessMemberships)
              .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscriptionId))
              .limit(1);
            if (fitnessMembership) {
              await db.update(schema.fitnessMemberships)
                .set({ status: 'past_due', updatedAt: new Date() })
                .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
              await storage.setUserFitnessAccess(fitnessMembership.userId, false);
              const notification = await storage.createNotification({
                userId: fitnessMembership.userId,
                type: 'admin',
                title: 'Fitness Payment Failed',
                message: 'Your fitness membership payment failed. Please update your payment method to restore fitness access.',
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
              }
              console.log(`[Billing] Fitness membership payment failed for user ${fitnessMembership.userId} — access revoked`);
            }
          } catch (err) {
            console.error('[Billing] Error handling payment_failed for fitness membership:', err);
          }
        }
      }

      // T002: invoice.paid — renew access on successful charge (renewals + payment recovery)
      if (event.type === 'invoice.paid') {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        const billingReason = invoice.billing_reason;
        // Skip first-time checkout — already handled by checkout.session.completed
        if (subscriptionId && billingReason !== 'subscription_create') {
          // Main subscription renewal / recovery
          try {
            const [affectedUser] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.stripeSubscriptionId, subscriptionId))
              .limit(1);
            if (affectedUser) {
              const { default: Stripe } = await import('stripe');
              const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
              const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
              const newPeriodEnd = new Date(subscription.current_period_end * 1000);
              await storage.updateUserSubscriptionDetails(affectedUser.id, {
                subscriptionStatus: 'active',
                subscriptionExpiresAt: newPeriodEnd,
              });
              // If this was a recovery from past_due, notify the user
              if (affectedUser.subscriptionStatus === 'past_due') {
                const notification = await storage.createNotification({
                  userId: affectedUser.id,
                  type: 'admin',
                  title: 'Payment Successful — Access Restored',
                  message: 'Your payment went through and your subscription is active again. Welcome back!',
                  relatedId: null,
                });
                if ((req.app as any).sendRealtimeNotification) {
                  (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
                }
              }
              console.log(`[Billing] Main subscription renewed for user ${affectedUser.id} — expires ${newPeriodEnd.toISOString()}`);
            }
          } catch (err) {
            console.error('[Billing] Error handling invoice.paid for main subscription:', err);
          }

          // Fitness membership renewal / recovery
          try {
            const [fitnessMembership] = await db
              .select()
              .from(schema.fitnessMemberships)
              .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscriptionId))
              .limit(1);
            if (fitnessMembership) {
              const { default: Stripe } = await import('stripe');
              const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
              const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
              const newPeriodEnd = new Date(subscription.current_period_end * 1000);
              await db.update(schema.fitnessMemberships)
                .set({ status: 'active', currentPeriodEnd: newPeriodEnd, cancelAtPeriodEnd: false, updatedAt: new Date() })
                .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
              await storage.setUserFitnessAccess(fitnessMembership.userId, true);
              if (fitnessMembership.status === 'past_due') {
                const notification = await storage.createNotification({
                  userId: fitnessMembership.userId,
                  type: 'admin',
                  title: 'Fitness Access Restored',
                  message: 'Your fitness membership payment went through. You have full fitness access again!',
                  relatedId: null,
                });
                if ((req.app as any).sendRealtimeNotification) {
                  (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
                }
              }
              console.log(`[Billing] Fitness membership renewed for user ${fitnessMembership.userId} — expires ${newPeriodEnd.toISOString()}`);
            }
          } catch (err) {
            console.error('[Billing] Error handling invoice.paid for fitness membership:', err);
          }
        }
      }

      // T003: customer.subscription.deleted — fully revoke access after all retries exhausted or period ends
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;

        // Main subscription
        try {
          const [affectedUser] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.stripeSubscriptionId, subscription.id))
            .limit(1);
          if (affectedUser) {
            await storage.updateUserSubscriptionDetails(affectedUser.id, {
              subscriptionStatus: 'expired',
              subscriptionTier: 'free',
              stripeSubscriptionId: undefined,
            });
            const notification = await storage.createNotification({
              userId: affectedUser.id,
              type: 'admin',
              title: 'Subscription Ended',
              message: 'Your subscription has ended. Subscribe again anytime to restore full access.',
              relatedId: null,
            });
            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
            }
            console.log(`[Billing] Main subscription deleted for user ${affectedUser.id} — status set to expired`);
          }
        } catch (err) {
          console.error('[Billing] Error handling subscription.deleted for main subscription:', err);
        }

        // Fitness membership
        try {
          const [fitnessMembership] = await db
            .select()
            .from(schema.fitnessMemberships)
            .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscription.id))
            .limit(1);
          if (fitnessMembership) {
            await db.update(schema.fitnessMemberships)
              .set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
            await storage.setUserFitnessAccess(fitnessMembership.userId, false);
            const notification = await storage.createNotification({
              userId: fitnessMembership.userId,
              type: 'admin',
              title: 'Fitness Membership Ended',
              message: 'Your fitness membership has ended. Rejoin anytime to restore access to fitness content.',
              relatedId: null,
            });
            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
            }
            console.log(`[Billing] Fitness membership deleted for user ${fitnessMembership.userId} — access revoked`);
          }
        } catch (err) {
          console.error('[Billing] Error handling subscription.deleted for fitness membership:', err);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ message: "Webhook error" });
    }
  });

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

      // Serve the actual uploaded video file from disk
      if (video.filename) {
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

      // File is now saved to disk by multer - use the filename from disk storage
      const videoPath = path.join(process.cwd(), 'uploads', 'videos', file.filename);
      
      // Generate thumbnail from video using ffmpeg
      let thumbnailUrl = `https://via.placeholder.com/640x360/4A90B8/ffffff?text=${encodeURIComponent(title)}`;
      let videoDuration = Math.floor(Math.random() * 1800) + 300;
      
      try {
        // Ensure thumbnail directory exists
        const thumbnailDir = path.join(process.cwd(), 'uploads', 'video-thumbnails');
        if (!fs.existsSync(thumbnailDir)) {
          fs.mkdirSync(thumbnailDir, { recursive: true });
        }
        
        const thumbnailFilename = `thumb_${Date.now()}_${file.filename.replace(/\.[^.]+$/, '.jpg')}`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
        
        // Extract thumbnail at 1 second mark (or beginning if video is shorter)
        await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -y "${thumbnailPath}"`);
        
        if (fs.existsSync(thumbnailPath)) {
          thumbnailUrl = `/uploads/video-thumbnails/${thumbnailFilename}`;
          console.log('Generated thumbnail:', thumbnailUrl);
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
      
      const videoData = {
        title: title.trim(),
        description: description || '',
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        duration: videoDuration,
        thumbnailUrl: thumbnailUrl,
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
          case 'premium':
            // Premium and VIP users can access premium videos
            targetUsers = allUsers.filter(targetUser => 
              targetUser.id !== user.id && 
              ['premium', 'vip'].includes(targetUser.subscriptionTier || 'free')
            );
            break;
          case 'vip':
            // Only VIP users can access VIP videos
            targetUsers = allUsers.filter(targetUser => 
              targetUser.id !== user.id && 
              (targetUser.subscriptionTier || 'free') === 'vip'
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
            case 'premium':
              // Premium and VIP users can access premium videos
              targetUsers = allUsers.filter(targetUser => 
                targetUser.id !== user.id && 
                ['premium', 'vip'].includes(targetUser.subscriptionTier || 'free')
              );
              break;
            case 'vip':
              // Only VIP users can access VIP videos
              targetUsers = allUsers.filter(targetUser => 
                targetUser.id !== user.id && 
                (targetUser.subscriptionTier || 'free') === 'vip'
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

      await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });


  // Broadcast Notification API Route
  app.post('/api/admin/notifications/broadcast', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, message, type, targetAudience, selectedUserIds } = req.body;
      
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
        case 'vip':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id && targetUser.subscriptionTier === 'vip');
          break;
        case 'premium':
          targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id && targetUser.subscriptionTier === 'premium');
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
      const notificationPromises = targetUsers.map(async (targetUser) => {
        // Admin notifications are always sent (cannot be disabled)
        return await storage.createNotification({
          userId: targetUser.id,
          type: 'admin',
          title,
          message,
          relatedId: null,
        });
      });

      await Promise.all(notificationPromises.filter(Boolean));

      // Also send native device push notifications
      const pushPayload = {
        title,
        body: message,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `admin-broadcast-${Date.now()}`,
        url: '/',
      };

      let pushResult = { success: 0, failed: 0 };
      if (targetAudience === 'everyone') {
        // Use targeted send (excluding admin) rather than sendPushToAllUsers
        const targetUserIds = targetUsers.map((u: any) => u.id);
        pushResult = await sendPushToMultipleUsers(targetUserIds, pushPayload);
      } else {
        const targetUserIds = targetUsers.map((u: any) => u.id);
        pushResult = await sendPushToMultipleUsers(targetUserIds, pushPayload);
      }

      console.log(`[Admin Broadcast] In-app: ${targetUsers.length} users, Push: ${pushResult.success} sent, ${pushResult.failed} failed`);

      let successMessage = "";
      switch (targetAudience) {
        case 'vip':
          successMessage = `Notification sent to ${targetUsers.length} VIP user(s) successfully`;
          break;
        case 'premium':
          successMessage = `Notification sent to ${targetUsers.length} Premium user(s) successfully`;
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
        pushDelivered: pushResult.success,
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
        'communityNotifications'
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
      
      // Send feedback to admins
      await storage.sendFeedbackToAdmins(userId, validatedData.feedback, validatedData.category);
      
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
        const allUsers = await storage.getUsers();
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
      const flag = await storage.updateFlagStatus(req.params.id, {
        status,
        reviewNotes,
        reviewedBy: user.id,
        reviewedAt: new Date()
      });
      
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
      
      // Send real-time WebSocket notification if user is connected  
      const client = connectedClients.get(recipientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'brotherhood_request',
          requestId: request.id,
          requester: {
            id: requesterId,
            firstName: requester?.firstName,
            lastName: requester?.lastName,
          },
          message: `${requester?.firstName} ${requester?.lastName} wants to be your brother in faith`
        }));
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
          relatedId: null,
        });

        // Send real-time WebSocket notification for brotherhood establishment
        const requester = await storage.getUser(request.requesterId);
        
        // Send to the requester (Josh who sent the request)
        const requesterWs = connectedClients.get(request.requesterId);
        if (requesterWs && requesterWs.readyState === WebSocket.OPEN) {
          requesterWs.send(JSON.stringify({
            type: 'brotherhood_established',
            message: 'Brotherhood established',
            partnerName: recipient?.firstName + ' ' + recipient?.lastName
          }));
        }
        
        // Send to the responder (Jody who accepted the request)  
        const responderWs = connectedClients.get(request.recipientId);
        if (responderWs && responderWs.readyState === WebSocket.OPEN) {
          responderWs.send(JSON.stringify({
            type: 'brotherhood_established', 
            message: 'Brotherhood established',
            partnerName: requester?.firstName + ' ' + requester?.lastName
          }));
        }
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
        
        // Send to the requester so their UI updates immediately
        const targetWs = connectedClients.get(request.requesterId);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify(wsMessage));
        }
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

      // Send to the other user
      const targetWs = connectedClients.get(otherId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify(wsMessage));
      }

      // Get the other user's info for the initiator message
      const otherUser = await storage.getUser(otherId);
      
      // Send update to the initiating user as well for real-time UI update
      const initiatorMessage = {
        type: 'brotherhood_removed',
        message: `You removed your brotherhood with ${otherUser?.firstName} ${otherUser?.lastName}`,
        removedBy: currentUser?.firstName + ' ' + currentUser?.lastName
      };

      const initiatorWs = connectedClients.get(userId);
      if (initiatorWs && initiatorWs.readyState === WebSocket.OPEN) {
        initiatorWs.send(JSON.stringify(initiatorMessage));
      }

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
  app.post('/api/pre-built-fitness-plans/:id/upload', isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdmin(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const downloadUrl = `/uploads/fitness-plans/${req.file.filename}`;
      
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
          mediaFile: exercise.media_file,
          shortInstructions: exercise.short_instructions
        });
      }

      res.json({ message: 'Exercises imported successfully', count: exercises.length });
    } catch (error) {
      console.error('Error importing exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Import exercises from local JSON file (admin only)
  app.post('/api/exercises/import-from-file', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = path.join(process.cwd(), 'attached_assets', 'exercises_db_330_short_1759200371273.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const exercises = JSON.parse(fileContent);

      await db.delete(schema.exercises); // Clear existing exercises
      
      for (const exercise of exercises) {
        await db.insert(schema.exercises).values({
          id: exercise.id,
          name: exercise.name,
          bodyPart: exercise.body_part,
          equipment: exercise.equipment,
          level: exercise.level,
          instructions: exercise.instructions,
          mediaFile: exercise.media_file,
          shortInstructions: exercise.short_instructions
        });
      }

      res.json({ message: 'Exercises imported successfully from file', count: exercises.length });
    } catch (error) {
      console.error('Error importing exercises from file:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all exercises with filtering and pagination
  app.get('/api/exercises', async (req: any, res) => {
    try {
      // Apply filters
      const { bodyPart, equipment, level, search, offset, limit } = req.query;
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
      
      if (search) conditions.push(sql`${schema.exercises.name} ILIKE ${'%' + search + '%'}`);
      
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
      res.json(exercises);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get unique equipment types
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
      res.json(plan);
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
      
      const exerciseData = insertFitnessPlanExerciseSchema.parse({
        ...req.body,
        planId: req.params.planId
      });
      
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
        finalCoverImageUrl = `/uploads/blog-thumbnails/${req.file.filename}`;
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
        finalCoverImageUrl = `/uploads/blog-thumbnails/${req.file.filename}`;
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
      const posts = await storage.getHurdleWallPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching hurdle wall posts:", error);
      res.status(500).json({ message: "Failed to fetch hurdle wall posts" });
    }
  });

  app.post('/api/hurdle-wall', isAuthenticated, async (req: any, res) => {
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
      Array.from(connectedClients.entries()).forEach(([connectedUserId, ws]) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'hurdle_wall_post_created',
            data: post
          }));
        }
      });

      res.json(post);
    } catch (error) {
      console.error("Error creating hurdle wall post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get('/api/hurdle-wall/:postId', isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const post = await storage.getHurdleWallPost(postId);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching hurdle wall post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post('/api/hurdle-wall/:postId/replies', isAuthenticated, async (req: any, res) => {
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
      Array.from(connectedClients.entries()).forEach(([connectedUserId, ws]) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'hurdle_wall_reply_created',
            data: { reply, postId }
          }));
        }
      });

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

      const success = await storage.deleteHurdleWallPost(postId, userId);
      
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }

      // Broadcast to all connected clients about deleted post
      Array.from(connectedClients.entries()).forEach(([connectedUserId, ws]) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'hurdle_wall_post_deleted',
            data: { postId }
          }));
        }
      });

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

      const success = await storage.deleteHurdleWallReply(replyId, userId);
      
      if (!success) {
        return res.status(403).json({ message: "You can only delete your own replies" });
      }

      // Broadcast to all connected clients about deleted reply
      Array.from(connectedClients.entries()).forEach(([connectedUserId, ws]) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'hurdle_wall_reply_deleted',
            data: { replyId }
          }));
        }
      });

      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Error deleting hurdle wall reply:", error);
      res.status(500).json({ message: "Failed to delete reply" });
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
      const requests = await storage.getAccountabilityRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching accountability requests:", error);
      res.status(500).json({ message: "Failed to fetch accountability requests" });
    }
  });
  
  // Create a new accountability request
  app.post('/api/accountability-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      const request = await storage.createAccountabilityRequest({
        userId,
        content: content.trim(),
      });
      
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
  
  // Delete own accountability request
  app.delete('/api/accountability-requests/:requestId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;
      
      const request = await storage.getAccountabilityRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      if (request.userId !== userId) {
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
      const items = await storage.getActiveCarouselItems();
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching carousel items:", error);
      res.status(500).json({ message: "Failed to fetch carousel items" });
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

      const { title, description, linkType, linkId, externalUrl, position, displayOrder } = req.body;
      
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
      const { title, description, linkType, linkId, externalUrl, position, displayOrder, isActive } = req.body;

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
      res.json(posts);
    } catch (error: any) {
      console.error('Error fetching group posts:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch group posts' });
    }
  });

  app.post('/api/war-groups/:id/posts', isAuthenticated, async (req: any, res) => {
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
      
      res.status(201).json({ ...post, rations: rationResult });
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
        const url = `/uploads/community/${file.filename}`;
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
      res.json(replies);
    } catch (error: any) {
      console.error('Error fetching post replies:', error);
      res.status(403).json({ message: error.message || 'Failed to fetch replies' });
    }
  });

  app.post('/api/war-groups/:id/posts/:postId/replies', isAuthenticated, async (req: any, res) => {
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
      
      res.status(201).json({ ...reply, rations: rationResult });
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
  app.post('/api/rations/award', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/rations/grace-bonus', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rationsService } = await import('./rations-service');
      const result = await rationsService.awardGraceBonus(userId);
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
          
          const transporter = nodemailer.default.createTransport({
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

      const imageUrl = `/uploads/store-products/${file.filename}`;
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
      if (product.imageUrl && product.imageUrl.startsWith('/uploads/store-products/')) {
        const filename = product.imageUrl.replace('/uploads/store-products/', '');
        const filePath = path.join(process.cwd(), 'uploads', 'store-products', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
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
  // Bible API Routes (using API.Bible)
  // ============================================
  
  const BIBLE_API_KEY = process.env.BIBLE_API_KEY;
  const BIBLE_API_BASE = 'https://rest.api.bible/v1';

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
  
  // Store connected clients with their user IDs
  const connectedClients = new Map<string, WebSocket>();
  
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
          connectedClients.set(data.userId, ws);
          console.log(`User ${data.userId} connected to WebSocket`);
          
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
      Array.from(connectedClients.entries()).forEach(([userId, client]) => {
        if (client === ws) {
          connectedClients.delete(userId);
          console.log(`User ${userId} disconnected from WebSocket`);
        }
      });
    });
  });
  
  // Add function to send real-time notifications (wrapped format)
  (app as any).sendRealtimeNotification = (userId: string, notification: any) => {
    const client = connectedClients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }
  };
  
  // Add function to broadcast to all connected clients
  (app as any).broadcastToAll = (message: { type: string; data?: any }) => {
    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };
  
  return httpServer;
}
