import { storage } from './storage';
import { sendPushNotification } from './pushNotificationService';

class MealReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.intervalId) {
      console.log('[MealReminder] Service already running');
      return;
    }
    console.log('[MealReminder] Service started — checking every 60s');
    this.intervalId = setInterval(() => {
      this.check().catch((e) => {
        console.error('[MealReminder] Check error:', e);
      });
    }, 60_000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[MealReminder] Service stopped');
  }

  private getUserLocalTime(now: Date, timezone: string): string {
    try {
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      const [hh, mm] = formatted.split(':');
      return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
    } catch {
      const hh = now.getUTCHours().toString().padStart(2, '0');
      const mm = now.getUTCMinutes().toString().padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }

  private async check() {
    const now = new Date();
    let reminders;
    try {
      reminders = await storage.getAllActiveMealReminders();
    } catch (e) {
      console.error('[MealReminder] DB error:', e);
      return;
    }

    if (!reminders || reminders.length === 0) return;

    for (const reminder of reminders) {
      try {
        // Get user timezone from their profile
        const user = await storage.getUser(reminder.userId);
        const timezone = (user as any)?.timezone || 'UTC';
        const localTime = this.getUserLocalTime(now, timezone);

        if (localTime !== reminder.time) continue;

        // Check if already sent within the past 50 minutes (prevent double fire)
        if (reminder.lastSent) {
          const minutesSinceSent = (now.getTime() - reminder.lastSent.getTime()) / 60_000;
          if (minutesSinceSent < 50) continue;
        }

        // Check notification preference
        try {
          const prefs = await storage.getNotificationPreferences(reminder.userId);
          if (prefs && prefs.mealReminderNotifications === false) {
            console.log(`[MealReminder] User ${reminder.userId} has mealReminderNotifications disabled — skipping`);
            continue;
          }
        } catch {
          // default is true, proceed
        }

        const label = reminder.label || 'Meal';
        const title = `🍽️ ${label} Reminder`;
        const body = `Time for ${label.toLowerCase()}! Log your meal to stay on track.`;

        await sendPushNotification(reminder.userId, {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `meal-reminder-${reminder.id}`,
          url: '/fitness?tab=intake&openAddFood=true',
        });

        await storage.createNotificationWithPreferences({
          userId: reminder.userId,
          type: 'fitness_meal',
          title,
          message: body,
          relatedId: null,
        });

        await storage.markMealReminderSent(reminder.id);
        console.log(`[MealReminder] Sent reminder "${label}" to user ${reminder.userId} at ${localTime}`);
      } catch (e) {
        console.error(`[MealReminder] Error processing reminder ${reminder.id}:`, e);
      }
    }
  }
}

export const mealReminderService = new MealReminderService();
