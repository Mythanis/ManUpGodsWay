import { db } from './db';
import { users } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { sendPushNotification } from './pushNotificationService';

const NUDGE_MILESTONES = [
  {
    key: 'day1',
    minDays: 1,
    maxDays: 2,
    title: 'Your Mission Has Just Begun',
    body: 'Day 1 checked in. Unlock the full 52-week study series, War Room, and brotherhood community with a free 7-day trial — no charge until it ends.',
    url: '/subscribe',
  },
  {
    key: 'day3',
    minDays: 3,
    maxDays: 4,
    title: 'Three Days In — Don\'t Stop Now',
    body: 'You\'re building momentum. Get full access to every study, video, podcast, and War Group with a free 7-day trial. Cancel anytime.',
    url: '/subscribe',
  },
  {
    key: 'day7',
    minDays: 7,
    maxDays: 8,
    title: 'One Week Strong',
    body: 'A week in the fight. Unlock the complete Man Up God\'s Way arsenal — studies, community, challenges, and more — free for 7 days.',
    url: '/subscribe',
  },
] as const;

type NudgeKey = typeof NUDGE_MILESTONES[number]['key'];

class ConversionNudgeService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.intervalId) return;
    console.log('[ConversionNudge] Service started — checking every 60 minutes');
    this.check().catch((e) => console.error('[ConversionNudge] Initial check error:', e));
    this.intervalId = setInterval(() => {
      this.check().catch((e) => console.error('[ConversionNudge] Check error:', e));
    }, 60 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async check() {
    const now = new Date();

    // Target users who have never started a real Stripe subscription.
    // The default subscriptionStatus is 'trial' for all new accounts, so we
    // can't reliably filter on status alone — users with a genuine Stripe trial
    // also have status='trial'. The reliable signal is the absence of a
    // stripeSubscriptionId (which is only set after a real Stripe checkout completes).
    const nonSubscribers = await db
      .select({
        id: users.id,
        createdAt: users.createdAt,
        subscriptionStatus: users.subscriptionStatus,
        conversionNudgesSent: users.conversionNudgesSent,
      })
      .from(users)
      .where(
        isNull(users.stripeSubscriptionId)
      );

    for (const user of nonSubscribers) {
      try {
        await this.processUser(user, now);
      } catch (e) {
        console.error(`[ConversionNudge] Error processing user ${user.id}:`, e);
      }
    }
  }

  private async processUser(
    user: { id: string; createdAt: Date | null; subscriptionStatus: string | null; conversionNudgesSent: unknown },
    now: Date
  ) {
    if (!user.createdAt) return;

    const ageMs = now.getTime() - new Date(user.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const sent = (user.conversionNudgesSent as Record<string, boolean>) ?? {};

    for (const milestone of NUDGE_MILESTONES) {
      if (sent[milestone.key]) continue;
      if (ageDays < milestone.minDays || ageDays >= milestone.maxDays) continue;

      await sendPushNotification(user.id, {
        title: milestone.title,
        body: milestone.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `conversion-nudge-${milestone.key}`,
        url: milestone.url,
      });

      const updatedSent = { ...sent, [milestone.key]: true };
      await db
        .update(users)
        .set({ conversionNudgesSent: updatedSent })
        .where(eq(users.id, user.id));

      console.log(`[ConversionNudge] Sent ${milestone.key} nudge to user ${user.id}`);
    }
  }
}

export const conversionNudgeService = new ConversionNudgeService();
