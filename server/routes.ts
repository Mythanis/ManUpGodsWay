import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { pdfToPng } from 'pdf-to-png-converter';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { storage } from "./storage";
import { warGroupsService } from "./warGroupsService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { 
  insertStudySchema, 
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

// Configure multer for video uploads
const upload = multer({ 
  storage: multer.memoryStorage(), // Store in memory for now
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

  // Study routes
  app.get('/api/studies', async (req: any, res) => {
    try {
      const { category, tier } = req.query;
      
      // Check if user is admin
      let isAdmin = false;
      if (req.user) {
        try {
          const user = await storage.getUser(req.user.claims.sub);
          isAdmin = hasAdminPrivileges(user);
        } catch (error) {
          // If there's an error getting user info, continue as non-admin
          console.log("Could not verify admin status:", error);
        }
      }
      
      const studies = await storage.getStudies(
        category as string, 
        tier as string,
        isAdmin
      );
      res.json(studies);
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
      
      // Check tier access
      const userTier = user.subscriptionTier || 'free';
      const hasAccess = study.requiredTier === 'free' ||
                       (study.requiredTier === 'premium' && ['premium', 'vip'].includes(userTier)) ||
                       (study.requiredTier === 'vip' && userTier === 'vip');
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Insufficient subscription tier to access this study discussion" });
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
        switch (study.requiredTier) {
          case 'free':
            // Everyone can access free studies
            targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
            break;
          case 'premium':
            // Premium and VIP users can access premium studies
            targetUsers = allUsers.filter(targetUser => 
              targetUser.id !== user.id && 
              ['premium', 'vip'].includes(targetUser.subscriptionTier || 'free')
            );
            break;
          case 'vip':
            // Only VIP users can access VIP studies
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
        // Send real-time notifications to users based on tier access
        try {
          const allUsers = await storage.getAllUsers();
          let targetUsers: any[] = [];
          
          // Determine target users based on study's required tier
          switch (study.requiredTier || 'free') {
            case 'free':
              // Everyone can access free studies
              targetUsers = allUsers.filter(targetUser => targetUser.id !== user.id);
              break;
            case 'premium':
              // Premium and VIP users can access premium studies
              targetUsers = allUsers.filter(targetUser => 
                targetUser.id !== user.id && 
                ['premium', 'vip'].includes(targetUser.subscriptionTier || 'free')
              );
              break;
            case 'vip':
              // Only VIP users can access VIP studies
              targetUsers = allUsers.filter(targetUser => 
                targetUser.id !== user.id && 
                (targetUser.subscriptionTier || 'free') === 'vip'
              );
              break;
          }
          
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
        
        const userTier = user.subscriptionTier || 'free';
        const hasAccess = study.requiredTier === 'free' ||
                         (study.requiredTier === 'premium' && ['premium', 'vip'].includes(userTier)) ||
                         (study.requiredTier === 'vip' && userTier === 'vip');
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Insufficient subscription tier to participate in this study discussion" });
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
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lesson:", error);
      res.status(500).json({ message: "Failed to delete lesson" });
    }
  });

  // Mark lesson as complete
  app.post('/api/studies/:studyId/lessons/:lessonId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { lessonId } = req.params;
      const { answers } = req.body;

      const progress = await storage.markLessonComplete(userId, lessonId, answers);
      res.json(progress);
    } catch (error) {
      console.error("Error marking lesson complete:", error);
      res.status(500).json({ message: "Failed to mark lesson complete" });
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

      const { subscriptionTier } = req.body;
      if (!subscriptionTier || !['free', 'premium', 'vip'].includes(subscriptionTier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }

      const updatedUser = await storage.updateUserSubscription(req.params.id, subscriptionTier);
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

  // Tier Pricing Management API Routes
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

      const { tier, billingCycle } = req.body;

      if (!tier || !['premium', 'vip'].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }

      if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ message: "Invalid billing cycle" });
      }

      // Get tier pricing
      const tierPricing = await storage.getTierPricingByTier(tier);
      if (!tierPricing) {
        return res.status(404).json({ message: "Tier pricing not found" });
      }

      // Calculate yearly pricing with new discount structure
      let price = tierPricing.monthlyPrice;
      if (billingCycle === 'yearly') {
        const monthlyPrice = parseFloat(tierPricing.monthlyPrice);
        const discountPercent = tier === 'premium' ? 5 : tier === 'vip' ? 10 : 0;
        const yearlyPrice = (monthlyPrice * 12 * (1 - discountPercent / 100)).toFixed(2);
        price = yearlyPrice;
      }

      // Create Stripe checkout session
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16',
      });
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
                description: tierPricing.features.join(', '),
              },
              unit_amount: Math.round(parseFloat(price) * 100), // Convert to cents
              recurring: {
                interval: billingCycle === 'yearly' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
          tier: tier,
          billingCycle: billingCycle,
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile?upgrade=success&tier=${tier}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile?upgrade=cancelled`,
      });

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
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

        // Only handle subscription checkouts (not one-time payments)
        if (session.mode === 'subscription') {
          const { userId, tier, billingCycle } = session.metadata;

          if (userId && tier) {
            // Calculate subscription expiration date
            const now = new Date();
            const expirationDate = new Date(now);
            if (billingCycle === 'yearly') {
              expirationDate.setFullYear(now.getFullYear() + 1);
            } else {
              expirationDate.setMonth(now.getMonth() + 1);
            }

            // Get subscription from Stripe to store subscription ID
            const subscription = await stripe.subscriptions.list({
              customer: session.customer,
              limit: 1,
            });

            // Update user subscription with full details
            await storage.updateUserSubscriptionDetails(userId, {
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expirationDate,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: subscription.data[0]?.id,
            });

            console.log(`Updated user ${userId} to ${tier} tier via Stripe webhook (expires: ${expirationDate.toISOString()})`);

            // Send real-time notification to user about upgrade success
            const user = await storage.getUser(userId);
            if (user) {
              const notification = await storage.createNotification({
                userId: user.id,
                type: 'admin',
                title: 'Subscription Upgraded!',
                message: `Your subscription has been upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}. You now have access to exclusive content and features.`,
                relatedId: null,
              });

              // Send real-time notification if WebSocket is connected
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(user.id, notification);
              }
            }
          }
        }
      }

      // Handle subscription cancellations
      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        
        if (subscription.cancel_at_period_end) {
          // User has cancelled but subscription continues until period end
          const user = await storage.getUser(subscription.metadata?.userId);
          if (user && user.stripeSubscriptionId === subscription.id) {
            await storage.cancelUserSubscription(user.id);
            
            // Send notification about cancellation
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
        // Check tier access for authenticated users
        const user = await storage.getUser(req.user.claims.sub);
        if (user) {
          const userTier = user.subscriptionTier || 'free';
          const hasAccess = video.requiredTier === 'free' ||
                           (video.requiredTier === 'premium' && ['premium', 'vip'].includes(userTier)) ||
                           (video.requiredTier === 'vip' && userTier === 'vip');

          if (!hasAccess) {
            return res.status(403).json({ message: "Insufficient subscription tier" });
          }
        }
      }

      // Redirect to a working sample video URL for demo purposes
      // In production, you'd stream the actual uploaded file
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

      const { title, description, requiredTier = 'free', category = 'general' } = req.body;
      const file = req.file;
      
      console.log('Upload request body:', req.body);
      console.log('Upload file:', file ? { name: file.originalname, size: file.size, type: file.mimetype } : 'No file');
      
      if (!title || title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }

      if (!file) {
        return res.status(400).json({ message: "Video file is required" });
      }

      // Create video data with actual file information
      const videoData = {
        title: title.trim(),
        description: description || '',
        filename: `video_${Date.now()}_${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        duration: Math.floor(Math.random() * 1800) + 300, // This would be extracted from video metadata in a real app
        thumbnailUrl: `https://via.placeholder.com/640x360/4A90B8/ffffff?text=${encodeURIComponent(title)}`,
        uploadedBy: user.id,
        requiredTier: requiredTier,
        category: category,
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
        recipients: targetUsers.length
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
      
      // Get user tier for filtering
      let userTier = 'free';
      if (req.user) {
        try {
          const user = await storage.getUser(req.user.claims.sub);
          userTier = user?.subscriptionTier || 'free';
        } catch (error) {
          console.log("Could not get user tier, defaulting to free:", error);
        }
      }
      
      const videos = await storage.getVideos(
        category as string,
        undefined, // requiredTier filter
        userTier,
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
            uploadedBy: user.id
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
  app.get('/api/challenges', async (req, res) => {
    try {
      const challenges = await storage.getChallenges();
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
      
      const participant = await storage.acceptChallenge(userId, challengeId);
      res.json(participant);
    } catch (error) {
      console.error('Error accepting challenge:', error);
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
      
      const hasAccepted = await storage.hasUserAcceptedChallenge(userId, challengeId);
      res.json({ hasAccepted });
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
      const { search, city, state } = req.query;
      const groups = await warGroupsService.getAllGroups(
        search as string | undefined,
        city as string | undefined,
        state as string | undefined
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
      const { memberId } = req.params;
      
      const membership = await warGroupsService.approveMemberRequest(memberId, userId);
      res.json(membership);
    } catch (error: any) {
      console.error('Error approving member:', error);
      res.status(403).json({ message: error.message || 'Failed to approve member' });
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

  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients with their user IDs
  const connectedClients = new Map<string, WebSocket>();
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'auth' && data.userId) {
          // Store the connection with user ID for targeted messaging
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
      // Remove client from connected clients when they disconnect
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
  
  return httpServer;
}
