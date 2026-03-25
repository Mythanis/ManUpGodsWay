import { storage } from './storage';
import { sendPushNotification } from './pushNotificationService';

class DailyReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.intervalId) return;
    console.log('[DailyReminder] Service started — checking every 60s');
    this.intervalId = setInterval(() => this.check().catch((e) => {
      console.error('[DailyReminder] Check error:', e);
    }), 60_000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async check() {
    const now = new Date();
    const allReminders = await storage.getAllDailyReminders();
    for (const reminder of allReminders) {
      try {
        if (!reminder.enabled) continue;
        await this.processReminder(reminder, now);
      } catch (e) {
        console.error(`[DailyReminder] Error processing user ${reminder.userId}:`, e);
      }
    }
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

  private async processReminder(
    reminder: Awaited<ReturnType<typeof storage.getAllDailyReminders>>[number],
    now: Date
  ) {
    const userTimezone = reminder.timezone || 'UTC';
    const currentTime = this.getUserLocalTime(now, userTimezone);
    const targetTime = reminder.reminderTime || '08:00';

    if (currentTime !== targetTime) return;

    await sendPushNotification(reminder.userId, {
      title: "Time to Open Man Up",
      body: "Continue your faith journey — your daily mission awaits.",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'daily-app-reminder',
      url: '/',
    });

    console.log(`[DailyReminder] Sent to user ${reminder.userId} at ${currentTime} (${userTimezone})`);
  }
}

export const dailyReminderService = new DailyReminderService();
