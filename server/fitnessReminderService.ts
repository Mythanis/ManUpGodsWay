import { storage } from './storage';
import { sendPushNotification } from './pushNotificationService';
import { log } from './vite';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getUserLocalTime(now: Date, timezone: string): { time: string; dayOfWeek: string } {
  try {
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const [hh, mm] = timePart.split(':');
    const time = `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;

    const dayPart = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).format(now);
    const dayOfWeek = dayPart.toLowerCase();

    return { time, dayOfWeek };
  } catch {
    const hh = now.getUTCHours().toString().padStart(2, '0');
    const mm = now.getUTCMinutes().toString().padStart(2, '0');
    const dayOfWeek = DAY_NAMES[now.getUTCDay()];
    return { time: `${hh}:${mm}`, dayOfWeek };
  }
}

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

    let allReminders;
    try {
      allReminders = await storage.getActiveReminders();
    } catch (e) {
      log(`[FitnessReminder] DB error fetching reminders: ${e}`);
      return;
    }

    if (!allReminders || allReminders.length === 0) return;

    for (const reminder of allReminders) {
      try {
        await this.processReminder(reminder, now);
      } catch (e) {
        log(`[FitnessReminder] Error processing reminder ${reminder.id}: ${e}`);
      }
    }
  }

  private async processReminder(
    reminder: Awaited<ReturnType<typeof storage.getActiveReminders>>[number],
    now: Date
  ) {
    const userId = reminder.plan.userId;

    // Get user's timezone
    let userTimezone = 'UTC';
    try {
      const user = await storage.getUser(userId);
      if (user?.timezone) userTimezone = user.timezone;
    } catch {
      // fall back to UTC
    }

    // Check local time matches reminder schedule
    const { time: localTime, dayOfWeek: localDay } = getUserLocalTime(now, userTimezone);
    if (localDay !== reminder.dayOfWeek || localTime !== reminder.time) return;

    // Avoid firing twice in the same calendar day (user-local)
    if (reminder.lastSent) {
      const lastSentLocal = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(reminder.lastSent));
      const nowLocal = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(now);
      if (lastSentLocal === nowLocal) return;
    }

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
    const todayExercises = await storage.getTodayFitnessPlanExercises(reminder.planId, localDay);
    const exerciseCount = todayExercises.length;

    const body = exerciseCount > 0
      ? `${exerciseCount} exercise${exerciseCount > 1 ? 's' : ''} scheduled today — let's go!`
      : `Your "${reminder.plan.name}" workout is scheduled — time to man up!`;

    // Send push notification
    const deepLinkUrl = `/fitness?planId=${reminder.planId}`;

    await sendPushNotification(userId, {
      title: `💪 ${reminder.plan.name}`,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `fitness-reminder-${reminder.planId}`,
      url: deepLinkUrl,
    });

    // Also create an in-app notification
    await storage.createNotificationWithPreferences({
      userId,
      type: 'fitness_plan',
      title: '💪 Workout Reminder',
      message: `Time for your "${reminder.plan.name}" workout! ${body}`,
      relatedId: reminder.planId,
    });

    await storage.markFitnessReminderSent(reminder.id);
    log(`[FitnessReminder] Sent reminder to user ${userId} for plan "${reminder.plan.name}" (${localTime} ${userTimezone})`);
  }
}

export const fitnessReminderService = new FitnessReminderService();
