import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:info@manupgodsway.org',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[Push] VAPID keys configured');
} else {
  console.warn('[Push] VAPID keys not configured - push notifications disabled');
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

// Map notification types to deep-link URLs so tapping opens the right screen
export function getPushUrl(type: string, relatedId?: string | null): string {
  switch (type) {
    case 'message':
    case 'new_message':
    case 'group_message':
      return relatedId ? `/messages?conversation=${relatedId}` : '/messages';
    case 'discussion':
    case 'new_discussion':
      return relatedId ? `/community?discussion=${relatedId}` : '/community';
    case 'discussion_reply': {
      if (relatedId && relatedId.includes('__reply__')) {
        const [discussionId, replyId] = relatedId.split('__reply__');
        return `/community?discussion=${discussionId}&reply=${replyId}`;
      }
      return relatedId ? `/community?discussion=${relatedId}` : '/community';
    }
    case 'study':
    case 'new_study':
      return relatedId ? `/studies/${relatedId}` : '/library';
    case 'video':
    case 'new_video':
      return relatedId ? `/videos?id=${relatedId}` : '/videos';
    case 'devotional':
    case 'new_devotional':
      return '/';
    case 'event':
    case 'new_event':
      return '/events';
    case 'challenge':
    case 'new_challenge':
    case 'challenge_ended':
      return '/challenges';
    case 'brotherhood':
      return '/';
    case 'war_room':
    case 'war_room_comment':
      return relatedId ? `/war-room?post=${relatedId}` : '/war-room';
    case 'under_fire':
    case 'under_fire_comment':
      return relatedId ? `/under-fire?request=${relatedId}` : '/under-fire';
    case 'war_group':
    case 'war_group_post':
    case 'war_group_comment':
      return relatedId ? `/war-groups/${relatedId}` : '/war-groups';
    case 'podcast':
    case 'new_podcast':
      return relatedId ? `/podcasts?id=${relatedId}` : '/podcasts';
    case 'admin':
      return '/notifications';
    case 'prayer_reminder':
      return '/?openPrayerDialog=true';
    case 'fitness':
    case 'fitness_plan':
      return relatedId ? `/fitness?planId=${relatedId}` : '/fitness';
    case 'fitness_community':
      return relatedId ? `/fitness?tab=community&post=${relatedId}` : '/fitness?tab=community';
    case 'fitness_meal':
      return '/fitness?tab=intake&openAddFood=true';
    default:
      return '/';
  }
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<{ success: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] Skipping - VAPID keys not configured');
    return { success: 0, failed: 0 };
  }

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));

    if (subscriptions.length === 0) {
      console.log(`[Push] No active subscriptions for user ${userId}`);
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload), {
          TTL: 3600,        // keep queued for up to 1 hour if device is offline
          urgency: 'high',  // request immediate delivery — bypasses APNs low-power deferral
        });
        success++;
        const host = new URL(subscription.endpoint).hostname;
        console.log(`[Push] Sent to user ${userId} via ${host} (sub ${subscription.id.slice(0,8)})`);
      } catch (error: any) {
        console.error(`[Push] Failed for subscription ${subscription.id}:`, error.message);
        
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(pushSubscriptions.id, subscription.id));
          console.log(`[Push] Deactivated expired subscription ${subscription.id}`);
        }
        failed++;
      }
    }

    return { success, failed };
  } catch (error) {
    console.error('[Push] Error sending notification:', error);
    return { success: 0, failed: 0 };
  }
}

export async function sendPushToMultipleUsers(userIds: string[], payload: PushPayload): Promise<{ success: number; failed: number }> {
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  return { success: totalSuccess, failed: totalFailed };
}

export async function sendPushToAllUsers(payload: PushPayload): Promise<{ success: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] Skipping broadcast - VAPID keys not configured');
    return { success: 0, failed: 0 };
  }

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));

    let success = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload), {
          TTL: 3600,
          urgency: 'high',
        });
        success++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(pushSubscriptions.id, subscription.id));
        }
        failed++;
      }
    }

    console.log(`[Push] Broadcast complete: ${success} sent, ${failed} failed`);
    return { success, failed };
  } catch (error) {
    console.error('[Push] Error in broadcast:', error);
    return { success: 0, failed: 0 };
  }
}

export async function savePushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
): Promise<boolean> {
  try {
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({ 
          userId, 
          p256dh, 
          auth, 
          userAgent, 
          isActive: true, 
          updatedAt: new Date() 
        })
        .where(eq(pushSubscriptions.endpoint, endpoint));
      console.log(`[Push] Updated subscription for user ${userId}`);
    } else {
      // Before inserting, delete any old inactive subscriptions for this user so
      // the table doesn't accumulate stale rows over time.
      const deleted = await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, false)))
        .returning({ id: pushSubscriptions.id });
      if (deleted.length > 0) {
        console.log(`[Push] Cleaned up ${deleted.length} old inactive subscription(s) for user ${userId}`);
      }

      await db
        .insert(pushSubscriptions)
        .values({ userId, endpoint, p256dh, auth, userAgent });
      console.log(`[Push] Created subscription for user ${userId}`);
    }

    return true;
  } catch (error) {
    console.error('[Push] Error saving subscription:', error);
    return false;
  }
}

export async function removePushSubscription(endpoint: string): Promise<boolean> {
  try {
    await db
      .update(pushSubscriptions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, endpoint));
    console.log(`[Push] Deactivated subscription`);
    return true;
  } catch (error) {
    console.error('[Push] Error removing subscription:', error);
    return false;
  }
}

export async function removeAllPushSubscriptionsForUser(userId: string): Promise<boolean> {
  try {
    await db
      .update(pushSubscriptions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
    console.log(`[Push] Deactivated all subscriptions for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[Push] Error removing all subscriptions:', error);
    return false;
  }
}

export async function getUserSubscriptionCount(userId: string): Promise<number> {
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
  return subscriptions.length;
}
