import { storage } from './storage';
import { sendPushNotification } from './pushNotificationService';
import { log } from './vite';

class FitnessReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.intervalId) {
      log('[FitnessReminder] Service already running');
      return;
    }
    log('[FitnessReminder] Service started — checking every 60s');
    this.intervalId = setInterval(() => {
      this.check().catch((e) => {
        log(`[FitnessReminder] Check error: ${e}`);
      });
    }, 60_000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log('[FitnessReminder] Service stopped');
  }

  private async check() {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const utcDay = dayNames[now.getUTCDay()];
    const utcTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    let dueReminders;
    try {
      dueReminders = await storage.getDueFitnessReminders(utcDay, utcTime);
    } catch (e) {
      log(`[FitnessReminder] DB error: ${e}`);
      return;
    }

    if (!dueReminders || dueReminders.length === 0) return;

    for (const reminder of dueReminders) {
      try {
        await this.processReminder(reminder);
      } catch (e) {
        log(`[FitnessReminder] Error processing reminder ${reminder.id}: ${e}`);
      }
    }
  }

  private async processReminder(reminder: Awaited<ReturnType<typeof storage.getDueFitnessReminders>>[number]) {
    const userId = reminder.plan.userId;

    // Check notification preference
    try {
      const prefs = await storage.getNotificationPreferences(userId);
      if (prefs && prefs.fitnessPlanReminderNotifications === false) {
        log(`[FitnessReminder] User ${userId} has fitnessPlanReminderNotifications disabled — skipping`);
        await storage.markFitnessReminderSent(reminder.id);
        return;
      }
    } catch {
      // If prefs can't be loaded, still send (default is true)
    }

    // Get today's exercises for the plan
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[now.getUTCDay()];
    const todayExercises = await storage.getTodayFitnessPlanExercises(reminder.planId, dayOfWeek);

    const exerciseNames = todayExercises.map((ex) => ex.exerciseName || 'Exercise').filter(Boolean);
    const exerciseCount = exerciseNames.length;

    const body = exerciseCount > 0
      ? `${exerciseCount} exercise${exerciseCount > 1 ? 's' : ''} scheduled today — let's go!`
      : `Your "${reminder.plan.name}" workout is scheduled — time to man up!`;

    // Send push notification
    await sendPushNotification(userId, {
      title: `💪 ${reminder.plan.name}`,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `fitness-reminder-${reminder.planId}`,
      url: '/fitness',
    });

    // Also create an in-app notification
    await storage.createNotificationWithPreferences({
      userId,
      type: 'fitness',
      title: '💪 Workout Reminder',
      message: `Time for your "${reminder.plan.name}" workout! ${body}`,
      relatedId: reminder.planId,
    });

    await storage.markFitnessReminderSent(reminder.id);
    log(`[FitnessReminder] Sent reminder to user ${userId} for plan "${reminder.plan.name}"`);
  }
}

export const fitnessReminderService = new FitnessReminderService();
