import { storage } from "./storage";

// Service to handle automatic daily devotional notifications
class DevotionalNotificationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Check every 15 minutes for new devotionals that need notifications
  private readonly CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

  start() {
    if (this.isRunning) {
      console.log('Devotional notification service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting devotional notification service...');
    
    // Run initial check immediately
    this.checkForNewDevotionals();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkForNewDevotionals();
    }, this.CHECK_INTERVAL);

    console.log(`Devotional notification service started - checking every ${this.CHECK_INTERVAL / 1000 / 60} minutes`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Devotional notification service stopped');
  }

  private async checkForNewDevotionals() {
    try {
      console.log('Checking for devotionals that need notifications...');
      
      // Get devotionals that are available today but haven't had notifications sent
      const availableDevotionals = await storage.getAvailableDevotionalsWithoutNotifications();
      
      if (availableDevotionals.length === 0) {
        console.log('No new devotionals need notifications at this time');
        return;
      }

      console.log(`Found ${availableDevotionals.length} devotional(s) that need notifications`);

      // Get all users to send notifications to
      const allUsers = await storage.getAllUsers();
      
      for (const devotional of availableDevotionals) {
        console.log(`Sending notifications for devotional: "${devotional.title}"`);
        
        // Create notifications for all users (respecting preferences)
        const notificationPromises = allUsers.map(async (user) => {
          try {
            return await storage.createNotificationWithPreferences({
              userId: user.id,
              type: 'devotional',
              title: '🌅 Daily Devotional Available',
              message: `"${devotional.title}" is ready for your daily spiritual growth.`,
              relatedId: devotional.id,
            });
          } catch (error) {
            console.error(`Failed to create notification for user ${user.id}:`, error);
            return null;
          }
        });

        // Send all notifications for this devotional
        await Promise.all(notificationPromises);
        
        // Mark this devotional as having notifications sent
        await storage.markDevotionalNotificationsSent(devotional.id);
        
        console.log(`Sent notifications to ${allUsers.length} users for devotional: "${devotional.title}"`);
      }

    } catch (error) {
      console.error('Error in devotional notification service:', error);
    }
  }

  // Method to manually trigger a check (useful for testing or admin actions)
  async triggerCheck() {
    console.log('Manually triggering devotional notification check...');
    await this.checkForNewDevotionals();
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
      nextCheckIn: this.intervalId ? this.CHECK_INTERVAL : null
    };
  }
}

// Export singleton instance
export const devotionalNotificationService = new DevotionalNotificationService();