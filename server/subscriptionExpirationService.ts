import { storage } from "./storage";

// Service to handle automatic subscription expiration checks
class SubscriptionExpirationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Check every hour for expired subscriptions
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  start() {
    if (this.isRunning) {
      console.log('Subscription expiration service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting subscription expiration service...');
    
    // Run initial check immediately
    this.checkExpiredSubscriptions();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkExpiredSubscriptions();
    }, this.CHECK_INTERVAL);

    console.log(`Subscription expiration service started - checking every ${this.CHECK_INTERVAL / 1000 / 60} minutes`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Subscription expiration service stopped');
  }

  private async checkExpiredSubscriptions() {
    try {
      console.log('Checking for expired subscriptions...');
      
      // Check for expired subscriptions and automatically downgrade users
      const expiredUsers = await storage.checkExpiredSubscriptions();
      
      if (expiredUsers.length === 0) {
        console.log('No expired subscriptions found');
        return;
      }

      console.log(`Found ${expiredUsers.length} expired subscription(s)/trial(s)`);

      for (const user of expiredUsers) {
        try {
          const isTrialExpiry = user.subscriptionStatus === 'trial' || (!user.stripeSubscriptionId && user.trialEndDate);
          await storage.createNotification({
            userId: user.id,
            type: 'admin',
            title: isTrialExpiry ? 'Free Trial Ended' : 'Subscription Expired',
            message: isTrialExpiry 
              ? `Your free trial has ended. Subscribe now to continue accessing all content and features.`
              : `Your subscription has expired. Resubscribe anytime to regain access to all content and features.`,
            relatedId: null,
          });
        } catch (error) {
          console.error(`Failed to send expiration notification to user ${user.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  }
}

export const subscriptionExpirationService = new SubscriptionExpirationService();