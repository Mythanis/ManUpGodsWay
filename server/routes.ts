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
  app.get('/api/studies', async (req: any, res) => {
    try {
      const { category, tier } = req.query;
      
      // Check if user is admin
      let isAdmin = false;
      if (req.user) {
        try {
          const user = await storage.getUser(req.user.claims.sub);
          isAdmin = user?.role === 'admin';
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

  // Get study discussion
  app.get('/api/studies/:id/discussion', async (req, res) => {
    try {
      const discussion = await storage.getStudyDiscussion(req.params.id);
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
      if (!user || user.role !== 'admin') {
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
      const { category, limit, sortBy, search } = req.query;
      const discussions = await storage.getDiscussions(
        category as string,
        limit ? parseInt(limit as string) : undefined,
        sortBy as string,
        search as string
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

      // Transform string date to Date object before validation
      const requestData = { ...req.body };
      if (requestData.date && typeof requestData.date === 'string') {
        requestData.date = new Date(requestData.date);
      }

      const devotionalData = insertDevotionalSchema.parse(requestData);
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
        userId,
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

      // Create notifications for other participants in the conversation
      try {
        const conversation = await storage.getConversation(conversationId);
        if (conversation) {
          const otherParticipants = conversation.participants.filter((p: any) => p.userId !== userId);
          const senderUser = await storage.getUser(userId);
          
          for (const participant of otherParticipants) {
            await storage.createNotification({
              userId: participant.userId,
              type: conversation.type === 'direct' ? 'new_message' : 'group_message',
              title: conversation.type === 'direct' ? 'New Message' : `New Group Message in ${conversation.name}`,
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
        if (isAdmin && userProfile?.role === "admin") {
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

  app.put('/api/admin/users/:id/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
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
      if (!user || user.role !== 'admin') {
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
      if (!user || user.role !== 'admin') {
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

  // Video Management API Routes
  app.get('/api/admin/videos', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { limit } = req.query;
      const videos = await storage.getVideos(
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
      if (!user || user.role !== 'admin') {
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

  app.post('/api/admin/videos/upload', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // For now, we'll simulate video upload and processing
      // In a real app, you'd integrate with multer, AWS S3, or similar service
      const { title, description } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Simulate file upload data
      const videoData = {
        title,
        description: description || '',
        filename: `video_${Date.now()}.mp4`,
        originalName: `${title}.mp4`,
        mimeType: 'video/mp4',
        fileSize: Math.floor(Math.random() * 50000000) + 10000000, // Random size 10-60MB
        duration: Math.floor(Math.random() * 1800) + 300, // Random duration 5-35 minutes
        thumbnailUrl: `https://via.placeholder.com/640x360/4A90B8/ffffff?text=${encodeURIComponent(title)}`,
        uploadedBy: user.id,
      };

      const video = await storage.createVideo(videoData);
      
      // Simulate processing
      setTimeout(async () => {
        await storage.updateVideoProcessingStatus(video.id, 'completed', true);
      }, 2000);

      res.json(video);
    } catch (error) {
      console.error("Error uploading video:", error);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  app.put('/api/admin/videos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const video = await storage.updateVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete('/api/admin/videos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  app.get('/api/videos/:id/stream', isAuthenticated, async (req: any, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      // In a real app, this would stream the actual video file
      // For now, we'll just return video metadata
      res.json({
        id: video.id,
        title: video.title,
        streamUrl: `/api/videos/${video.id}/file`,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
      });
    } catch (error) {
      console.error("Error streaming video:", error);
      res.status(500).json({ message: "Failed to stream video" });
    }
  });

  // Broadcast Notification API Route
  app.post('/api/admin/notifications/broadcast', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
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
      
      // Create notifications for targeted users
      const notificationPromises = targetUsers.map(async (targetUser) => {
        return await storage.createNotification({
          userId: targetUser.id,
          type: type || 'general',
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
        const conversation = await storage.createDirectConversation(request.fromUserId, request.toUserId);

        // Send the initial message
        await storage.sendMessage({
          conversationId: conversation.id,
          userId: request.fromUserId,
          content: request.message,
          messageType: 'text',
        });

        // Notify the sender that their request was accepted
        const toUser = await storage.getUser(request.toUserId);
        await storage.createNotification({
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
      const { firstName, lastName, allowDirectMessages, allowGroupInvites } = req.body;

      const updatedUser = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        allowDirectMessages,
        allowGroupInvites,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
