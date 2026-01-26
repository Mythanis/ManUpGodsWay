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

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        success++;
        console.log(`[Push] Sent to user ${userId}`);
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

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
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

export async function getUserSubscriptionCount(userId: string): Promise<number> {
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
  return subscriptions.length;
}
