import { db } from './db';
import { users } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { sendPushNotification } from './pushNotificationService';
import { getUncachableResendClient } from './emailService';

const APP_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : 'https://manupgodsway.org';

// Push + email milestones for users who have NEVER started a Stripe subscription
const NUDGE_MILESTONES = [
  {
    key: 'day1',
    minDays: 1,
    maxDays: 2,
    push: {
      title: 'Your Mission Has Just Begun',
      body: 'Day 1 checked in. Unlock the full 52-week study series, War Room, and brotherhood community with a free 7-day trial — no charge until it ends.',
    },
    email: null, // no email on day 1
  },
  {
    key: 'day3',
    minDays: 3,
    maxDays: 4,
    push: {
      title: "Three Days In — Don't Stop Now",
      body: "You're building momentum. Get full access to every study, video, podcast, and War Group with a free 7-day trial. Cancel anytime.",
    },
    email: {
      subject: "You're 3 days in — here's what you're missing",
      preheader: "Full access is just one step away.",
    },
  },
  {
    key: 'day7',
    minDays: 7,
    maxDays: 8,
    push: {
      title: 'One Week Strong',
      body: "A week in the fight. Unlock the complete Man Up God's Way arsenal — studies, community, challenges, and more — free for 7 days.",
    },
    email: {
      subject: "One week in — don't let your momentum stop here",
      preheader: "Your 7-day free trial is waiting.",
    },
  },
] as const;

// Email-only milestones for users whose Stripe trial is about to expire / has expired
// These target users who DID start a Stripe trial but haven't converted to paid
const TRIAL_EXPIRY_MILESTONES = [
  {
    key: 'trial_ending_soon',
    // Send when trial ends in 1-2 days
    check: (trialEndDate: Date, now: Date) => {
      const daysLeft = (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= 2;
    },
    push: {
      title: 'Your Trial Ends Soon',
      body: "Don't lose your access. Subscribe now to keep the 52-week library, brotherhood, and War Room.",
    },
    email: {
      subject: "Your Man Up trial ends in 2 days",
      preheader: "Don't lose your access — subscribe now.",
    },
  },
  {
    key: 'trial_just_expired',
    // Send 1-3 days after trial ended
    check: (trialEndDate: Date, now: Date) => {
      const daysPast = (now.getTime() - trialEndDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysPast >= 1 && daysPast < 3;
    },
    push: {
      title: 'Your Trial Has Ended',
      body: "Come back to the brotherhood. Subscribe to regain full access to your studies and community.",
    },
    email: {
      subject: "Your Man Up trial has ended — come back",
      preheader: "Regain full access to everything you've been building.",
    },
  },
  {
    key: 'win_back_14',
    // Win-back: 13-15 days after trial ended
    check: (trialEndDate: Date, now: Date) => {
      const daysPast = (now.getTime() - trialEndDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysPast >= 13 && daysPast < 15;
    },
    push: null,
    email: {
      subject: "We're still here, brother",
      preheader: "Your place in the brotherhood is waiting.",
    },
  },
] as const;

type NudgeKey = typeof NUDGE_MILESTONES[number]['key'];
type TrialExpiryKey = typeof TRIAL_EXPIRY_MILESTONES[number]['key'];

function buildEmailHtml(firstName: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border:2px solid #FDD000;border-radius:4px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#FDD000;padding:20px 28px;">
            <h1 style="margin:0;font-size:22px;font-weight:900;color:#000;text-transform:uppercase;letter-spacing:2px;">Man Up God's Way</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            <p style="color:#fff;font-size:15px;line-height:1.6;margin:0 0 16px;">Hey ${firstName || 'Brother'},</p>
            ${bodyHtml}
            <div style="margin-top:28px;text-align:center;">
              <a href="${APP_URL}/subscribe" style="display:inline-block;background:#FDD000;color:#000;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:14px 32px;text-decoration:none;border:2px solid #000;font-size:14px;">
                Start Free Trial
              </a>
            </div>
            <p style="color:#666;font-size:11px;margin-top:24px;text-align:center;">
              No charge for 7 days. Cancel anytime.<br>
              <a href="${APP_URL}" style="color:#FDD000;">Open the app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const EMAIL_BODIES: Record<string, string> = {
  day3: `
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">You've been showing up for 3 days — that's more than most men do.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">But right now, you're only seeing a fraction of what Man Up God's Way has to offer. Here's what's waiting for you with a free trial:</p>
    <ul style="color:#ccc;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
      <li>Full 52-week Bible study library</li>
      <li>Complete video &amp; podcast archive</li>
      <li>Brotherhood community &amp; War Groups</li>
      <li>War Room prayer network &amp; Under Fire accountability</li>
      <li>Weekly challenges &amp; streak tracking</li>
    </ul>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">7 days free. No charge until it ends. Cancel anytime.</p>
  `,
  day7: `
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">A week in the fight. You're building something real.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Don't let momentum die here. The full Man Up God's Way arsenal — 52-week studies, brotherhood, War Room, and more — is waiting for you, free for 7 days.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Start your trial today. No charge until the 8th day. Cancel anytime.</p>
  `,
  trial_ending_soon: `
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Your free trial ends in the next 2 days.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Don't lose access to the studies, community, and accountability tools you've been using. Subscribe now to keep going — the brotherhood is counting on you.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Less than a dollar a day. Cancel anytime.</p>
  `,
  trial_just_expired: `
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Your free trial has ended — but your mission doesn't have to.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Everything you built during your trial — your progress, your brothers, your streak — is still there waiting for you. Subscribe to pick up right where you left off.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Cancel anytime, no questions asked.</p>
  `,
  win_back_14: `
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">It's been two weeks. We haven't forgotten about you.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">God's work in a man rarely happens alone. The brothers, the studies, the accountability — it's all still here.</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">Come back. Subscribe today and pick up where you left off. The fight isn't over.</p>
  `,
};

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

    // Group 1: users who have NEVER interacted with Stripe checkout
    const nonSubscribers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        createdAt: users.createdAt,
        subscriptionStatus: users.subscriptionStatus,
        conversionNudgesSent: users.conversionNudgesSent,
        trialEndDate: users.trialEndDate,
      })
      .from(users)
      .where(isNull(users.stripeSubscriptionId));

    for (const user of nonSubscribers) {
      try {
        await this.processNonSubscriber(user, now);
      } catch (e) {
        console.error(`[ConversionNudge] Error processing non-subscriber ${user.id}:`, e);
      }
    }

    // Group 2: users who started a trial but are now expired/cancelled (win-back)
    const expiredTrialers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        subscriptionStatus: users.subscriptionStatus,
        conversionNudgesSent: users.conversionNudgesSent,
        trialEndDate: users.trialEndDate,
      })
      .from(users)
      .where(
        or(
          eq(users.subscriptionStatus, 'expired'),
          eq(users.subscriptionStatus, 'trial')
        )
      );

    for (const user of expiredTrialers) {
      if (!user.trialEndDate) continue;
      try {
        await this.processTrialExpiry(user, now);
      } catch (e) {
        console.error(`[ConversionNudge] Error processing trial expiry for ${user.id}:`, e);
      }
    }
  }

  private async processNonSubscriber(
    user: { id: string; email: string | null; firstName: string | null; createdAt: Date | null; subscriptionStatus: string | null; conversionNudgesSent: unknown; trialEndDate: Date | null },
    now: Date
  ) {
    if (!user.createdAt) return;

    const ageMs = now.getTime() - new Date(user.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const sent = (user.conversionNudgesSent as Record<string, boolean>) ?? {};

    for (const milestone of NUDGE_MILESTONES) {
      if (sent[milestone.key]) continue;
      if (ageDays < milestone.minDays || ageDays >= milestone.maxDays) continue;

      let sentSomething = false;

      // Push notification
      const pushResult = await sendPushNotification(user.id, {
        title: milestone.push.title,
        body: milestone.push.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `conversion-nudge-${milestone.key}`,
        url: '/subscribe',
      });
      if (pushResult.success > 0) sentSomething = true;

      // Email (for day3 and day7 only)
      if (milestone.email && user.email) {
        const emailBody = EMAIL_BODIES[milestone.key];
        if (emailBody) {
          await this.sendEmail(
            user.email,
            user.firstName || 'Brother',
            milestone.email.subject,
            emailBody
          );
          sentSomething = true;
        }
      }

      if (sentSomething || pushResult.success === 0) {
        // Mark as sent (even if push had 0 devices — prevents repeated email blasts)
        const updatedSent = { ...sent, [milestone.key]: true };
        await db
          .update(users)
          .set({ conversionNudgesSent: updatedSent })
          .where(eq(users.id, user.id));
        console.log(`[ConversionNudge] Sent ${milestone.key} nudge to user ${user.id}`);
      }
    }
  }

  private async processTrialExpiry(
    user: { id: string; email: string | null; firstName: string | null; subscriptionStatus: string | null; conversionNudgesSent: unknown; trialEndDate: Date | null },
    now: Date
  ) {
    if (!user.trialEndDate || !user.email) return;

    const trialEnd = new Date(user.trialEndDate);
    const sent = (user.conversionNudgesSent as Record<string, boolean>) ?? {};

    for (const milestone of TRIAL_EXPIRY_MILESTONES) {
      if (sent[milestone.key]) continue;
      if (!milestone.check(trialEnd, now)) continue;

      let sentSomething = false;

      // Push notification (if defined)
      if (milestone.push) {
        const pushResult = await sendPushNotification(user.id, {
          title: milestone.push.title,
          body: milestone.push.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `conversion-nudge-${milestone.key}`,
          url: '/subscribe',
        });
        if (pushResult.success > 0) sentSomething = true;
      }

      // Email
      const emailBody = EMAIL_BODIES[milestone.key];
      if (emailBody) {
        await this.sendEmail(
          user.email,
          user.firstName || 'Brother',
          milestone.email.subject,
          emailBody
        );
        sentSomething = true;
      }

      if (sentSomething || !milestone.push) {
        const updatedSent = { ...sent, [milestone.key]: true };
        await db
          .update(users)
          .set({ conversionNudgesSent: updatedSent })
          .where(eq(users.id, user.id));
        console.log(`[ConversionNudge] Sent trial-expiry ${milestone.key} to user ${user.id}`);
      }
    }
  }

  private async sendEmail(to: string, firstName: string, subject: string, bodyHtml: string) {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const html = buildEmailHtml(firstName, bodyHtml);
      const { error } = await client.emails.send({ from: fromEmail, to, subject, html });
      if (error) {
        console.error(`[ConversionNudge] Email error for ${to}:`, error);
      } else {
        console.log(`[ConversionNudge] Email sent to ${to} — "${subject}"`);
      }
    } catch (e) {
      console.error(`[ConversionNudge] Failed to send email to ${to}:`, e);
    }
  }
}

export const conversionNudgeService = new ConversionNudgeService();
