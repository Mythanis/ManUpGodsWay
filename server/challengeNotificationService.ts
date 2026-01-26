import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

// Service to handle automatic challenge end notifications
class ChallengeNotificationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Check every hour for challenges that have ended
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  start() {
    if (this.isRunning) {
      console.log('Challenge notification service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting challenge notification service...');
    
    // Run initial check immediately
    this.checkForEndedChallenges();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkForEndedChallenges();
    }, this.CHECK_INTERVAL);

    console.log(`Challenge notification service started - checking every ${this.CHECK_INTERVAL / 1000 / 60} minutes`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Challenge notification service stopped');
  }

  private async checkForEndedChallenges() {
    try {
      console.log('Checking for challenges that have ended...');
      
      const now = new Date();
      
      // Get all challenges and filter by calculated end date
      const allChallenges = await db.select()
        .from(schema.challenges);
      
      // Filter to challenges that have ended (releaseDate + durationDays is in the past)
      const endedChallenges = allChallenges.filter(challenge => {
        const durationDays = challenge.durationDays || 7;
        const endDate = new Date(challenge.releaseDate);
        endDate.setDate(endDate.getDate() + durationDays);
        return endDate <= now;
      });
      
      if (endedChallenges.length === 0) {
        console.log('No ended challenges to process');
        return;
      }

      for (const challenge of endedChallenges) {
        // Get participants who accepted but haven't completed
        const participants = await db.select({
          participantId: schema.challengeParticipants.id,
          userId: schema.challengeParticipants.userId,
          completedAt: schema.challengeParticipants.completedAt,
        })
          .from(schema.challengeParticipants)
          .where(
            and(
              eq(schema.challengeParticipants.challengeId, challenge.id),
              isNull(schema.challengeParticipants.completedAt)
            )
          );

        if (participants.length === 0) {
          continue;
        }

        console.log(`Found ${participants.length} participants for ended challenge: "${challenge.title}"`);

        // Check if we've already sent end notifications for this challenge
        // We'll use a simple approach: check if any notification with this challenge exists
        const existingNotifications = await db.select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.type, 'challenge_ended'),
              eq(schema.notifications.relatedId, challenge.id)
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          // Already sent notifications for this challenge
          continue;
        }

        // Send notifications to each participant
        const notificationPromises = participants.map(async (participant) => {
          try {
            return await storage.createNotificationWithPreferences({
              userId: participant.userId,
              type: 'challenge_ended',
              title: 'Challenge Time Up!',
              message: `"${challenge.title}" has ended. Did you complete it? Mark it as Complete or Regroup for next time!`,
              relatedId: challenge.id,
            });
          } catch (error) {
            console.error(`Failed to create challenge end notification for user ${participant.userId}:`, error);
            return null;
          }
        });

        await Promise.all(notificationPromises);
        console.log(`Sent challenge end notifications for "${challenge.title}" to ${participants.length} participants`);
      }
    } catch (error) {
      console.error('Error checking for ended challenges:', error);
    }
  }
}

export const challengeNotificationService = new ChallengeNotificationService();
