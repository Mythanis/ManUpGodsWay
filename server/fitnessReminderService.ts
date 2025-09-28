import { storage } from './storage';
import { log } from './vite';

class FitnessReminderService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

  start() {
    if (this.isRunning) {
      log('Fitness reminder service is already running');
      return;
    }

    this.isRunning = true;
    log('Starting fitness reminder service...');
    
    // Run initial check immediately
    this.checkForDueReminders();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkForDueReminders();
    }, this.CHECK_INTERVAL);

    log(`Fitness reminder service started - checking every ${this.CHECK_INTERVAL / 1000 / 60} minutes`);
  }

  stop() {
    if (!this.isRunning) {
      log('Fitness reminder service is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    log('Fitness reminder service stopped');
  }

  private async checkForDueReminders() {
    try {
      log('Checking for due fitness reminders...');
      
      // Get current date and day information
      const now = new Date();
      const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      
      // Get all active fitness plan reminders for today
      const dueReminders = await storage.getDueFitnessReminders(currentDayOfWeek, currentTime);
      
      if (!dueReminders || dueReminders.length === 0) {
        log('No fitness reminders due at this time');
        return;
      }

      log(`Found ${dueReminders.length} fitness reminder(s) due for processing`);

      // Group reminders by user and fitness plan
      const remindersByUser = new Map<string, Array<{planName: string, exercises: string[]}>>();
      
      for (const reminder of dueReminders) {
        if (!reminder || !reminder.plan) {
          log(`Skipping invalid reminder: ${JSON.stringify(reminder)}`);
          continue;
        }
        
        const userId = reminder.plan.userId;
        
        if (!remindersByUser.has(userId)) {
          remindersByUser.set(userId, []);
        }
        
        // Get exercises for this plan that are scheduled for today
        const todayExercises = await storage.getTodayFitnessPlanExercises(reminder.planId, currentDayOfWeek);
        
        if (!todayExercises || todayExercises.length === 0) {
          log(`No exercises scheduled for today for plan: ${reminder.plan.name}`);
          continue;
        }
        
        const exerciseNames = todayExercises.map(ex => ex.exerciseName || 'Unknown Exercise').filter(name => name);
        
        remindersByUser.get(userId)!.push({
          planName: reminder.plan.name,
          exercises: exerciseNames
        });
      }

      // Send notifications to each user
      for (const [userId, userReminders] of Array.from(remindersByUser.entries())) {
        try {
          // Create a consolidated notification for all due workouts
          const totalExercises = userReminders.reduce((sum: number, plan: {planName: string, exercises: string[]}) => sum + plan.exercises.length, 0);
          const planNames = userReminders.map((plan: {planName: string, exercises: string[]}) => plan.planName).join(', ');
          
          let message: string;
          if (userReminders.length === 1) {
            const plan = userReminders[0];
            message = `Time for your "${plan.planName}" workout! ${plan.exercises.length} exercise${plan.exercises.length > 1 ? 's' : ''} scheduled for today.`;
          } else {
            message = `You have ${userReminders.length} workout plans scheduled today: ${planNames}. Total of ${totalExercises} exercises ready for you!`;
          }

          await storage.createNotificationWithPreferences({
            userId: userId,
            type: 'fitness',
            title: '💪 Workout Reminder',
            message: message,
            relatedId: null, // No specific plan since it could be multiple
          });

          // Mark reminders as sent for today
          for (const reminder of dueReminders) {
            if (reminder.plan.userId === userId) {
              await storage.markFitnessReminderSent(reminder.id);
            }
          }

          log(`Sent fitness reminder notification to user ${userId}`);
        } catch (error) {
          log(`Failed to send fitness reminder to user ${userId}: ${error}`);
        }
      }

    } catch (error) {
      log(`Error in fitness reminder service: ${error}`);
    }
  }
}

export const fitnessReminderService = new FitnessReminderService();