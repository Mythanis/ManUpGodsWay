import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertStudySchema, 
  insertDiscussionSchema, 
  insertDiscussionReplySchema,
  insertDevotionalSchema,
  insertStudyRatingSchema 
} from "@shared/schema";
import { z } from "zod";

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

  // Study routes
  app.get('/api/studies', async (req, res) => {
    try {
      const { category, tier } = req.query;
      const studies = await storage.getStudies(
        category as string, 
        tier as string
      );
      res.json(studies);
    } catch (error) {
      console.error("Error fetching studies:", error);
      res.status(500).json({ message: "Failed to fetch studies" });
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

  app.post('/api/studies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const studyData = insertStudySchema.parse(req.body);
      const study = await storage.createStudy(studyData);
      res.status(201).json(study);
    } catch (error) {
      console.error("Error creating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid study data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create study" });
    }
  });

  app.put('/api/studies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const studyData = insertStudySchema.partial().parse(req.body);
      const study = await storage.updateStudy(req.params.id, studyData);
      res.json(study);
    } catch (error) {
      console.error("Error updating study:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid study data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update study" });
    }
  });

  app.delete('/api/studies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteStudy(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting study:", error);
      res.status(500).json({ message: "Failed to delete study" });
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

  app.post('/api/progress/:studyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studyId } = req.params;
      const progressData = req.body;
      
      const progress = await storage.updateProgress(userId, studyId, progressData);
      res.json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Discussion routes
  app.get('/api/discussions', async (req, res) => {
    try {
      const { category, limit, sortBy } = req.query;
      const discussions = await storage.getDiscussions(
        category as string,
        limit ? parseInt(limit as string) : undefined,
        sortBy as string
      );
      res.json(discussions);
    } catch (error) {
      console.error("Error fetching discussions:", error);
      res.status(500).json({ message: "Failed to fetch discussions" });
    }
  });

  app.get('/api/discussions/:id', async (req, res) => {
    try {
      const discussion = await storage.getDiscussion(req.params.id);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      res.json(discussion);
    } catch (error) {
      console.error("Error fetching discussion:", error);
      res.status(500).json({ message: "Failed to fetch discussion" });
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
      res.status(201).json(discussion);
    } catch (error) {
      console.error("Error creating discussion:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid discussion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create discussion" });
    }
  });

  app.get('/api/discussions/:id/replies', async (req, res) => {
    try {
      const replies = await storage.getDiscussionReplies(req.params.id);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      res.status(500).json({ message: "Failed to fetch replies" });
    }
  });

  app.post('/api/discussions/:id/replies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replyData = insertDiscussionReplySchema.parse({
        ...req.body,
        userId,
        discussionId: req.params.id,
      });
      
      const reply = await storage.createReply(replyData);
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const devotionalData = insertDevotionalSchema.parse(req.body);
      const devotional = await storage.createDevotional(devotionalData);
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const devotionalData = insertDevotionalSchema.parse(req.body);
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteDevotional(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting devotional:", error);
      res.status(500).json({ message: "Failed to delete devotional" });
    }
  });

  // Messaging routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
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
        limit ? parseInt(limit as string) : undefined
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

      const messageData = {
        conversationId,
        userId,
        content,
        messageType,
      };

      const message = await storage.sendMessage(messageData);
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
        subscriptionTier: user.subscriptionTier
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
      if (!user || user.role !== 'admin') {
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { role } = req.body;
      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(req.params.id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
