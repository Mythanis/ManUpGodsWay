import { storage } from './storage';
import { sendPushNotification } from './pushNotificationService';

class PrayerReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.intervalId) return;
    console.log('[PrayerReminder] Service started — checking every 60s');
    this.intervalId = setInterval(() => this.check().catch((e) => {
      console.error('[PrayerReminder] Check error:', e);
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
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const allReminders = await storage.getAllPrayerReminders();
    for (const reminder of allReminders) {
      try {
        await this.processReminder(reminder, currentTime);
      } catch (e) {
        console.error(`[PrayerReminder] Error processing user ${reminder.userId}:`, e);
      }
    }
  }

  private async processReminder(
    reminder: Awaited<ReturnType<typeof storage.getAllPrayerReminders>>[number],
    currentTime: string
  ) {
    const shouldSend = this.shouldFireNow(reminder, currentTime);
    if (!shouldSend) return;

    await sendPushNotification(reminder.userId, {
      title: 'Time to Pray',
      body: 'Take a moment to connect with God. Open the app to start your prayer time.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'prayer-reminder',
      url: '/?openPrayerDialog=true',
    });

    console.log(`[PrayerReminder] Sent reminder to user ${reminder.userId} at ${currentTime}`);
  }

  private shouldFireNow(
    reminder: Awaited<ReturnType<typeof storage.getAllPrayerReminders>>[number],
    currentTime: string
  ): boolean {
    // Check midday reminder (12:00)
    if (reminder.middayEnabled && currentTime === '12:00') {
      return true;
    }

    // Check custom times
    const customTimes = reminder.customTimes ?? [];
    if (customTimes.includes(currentTime)) {
      return true;
    }

    // Check hourly reminder within window, on the hour (:00)
    if (reminder.hourlyEnabled && currentTime.endsWith(':00')) {
      const start = reminder.hourlyStartTime ?? '06:00';
      const end = reminder.hourlyEndTime ?? '22:00';
      if (currentTime >= start && currentTime <= end) {
        return true;
      }
    }

    return false;
  }
}

export const prayerReminderService = new PrayerReminderService();
