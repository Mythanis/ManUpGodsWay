import type { Request, Response } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not set. Add it to Replit Secrets (Stripe Dashboard → Developers → Webhooks → Signing secret).");
      return res.status(503).json({ message: "Webhook signing secret not configured" });
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`[Webhook] Signature verification failed: ${err.message}`);
      return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
    }

    // Handle the subscription checkout completion event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Handle fitness membership subscription
      if (session.mode === "subscription" && session.metadata?.type === "fitness_membership") {
        const { userId } = session.metadata;
        if (userId) {
          const subscriptions = await stripe.subscriptions.list({ customer: session.customer as string, limit: 1 });
          const sub = subscriptions.data[0];
          const periodEnd = sub ? new Date(sub.current_period_end * 1000) : null;

          await db.insert(schema.fitnessMemberships).values({
            userId,
            stripeSubscriptionId: sub?.id,
            stripeCustomerId: session.customer as string,
            status: "active",
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          }).onConflictDoUpdate({
            target: schema.fitnessMemberships.userId,
            set: {
              stripeSubscriptionId: sub?.id,
              stripeCustomerId: session.customer as string,
              status: "active",
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              updatedAt: new Date(),
            },
          });

          await storage.setUserFitnessAccess(userId, true);

          await storage.createNotification({
            userId,
            type: "admin",
            title: "Fitness Community Access Unlocked!",
            message: "Welcome to the Man Up God's Way Fitness Community! You now have full access to workouts, plans, and the exercise library.",
            relatedId: null,
          });
          console.log(`[Fitness] Membership activated for user ${userId}`);
        }
      }

      // Handle individual fitness plan purchase
      if (session.mode === "payment" && session.metadata?.type === "fitness_plan_purchase") {
        const { userId, planId } = session.metadata;
        if (userId && planId) {
          await db.insert(schema.fitnessPlanPurchases).values({
            userId,
            planId,
            stripePaymentIntentId: session.payment_intent as string,
            amountPaid: session.amount_total || 0,
          }).onConflictDoNothing();

          await storage.createNotification({
            userId,
            type: "admin",
            title: "Fitness Plan Purchased!",
            message: `Your fitness plan "${session.metadata.planTitle}" is now available to download in the Fitness section.`,
            relatedId: null,
          });
          console.log(`[Fitness] Plan ${planId} purchased by user ${userId}`);
        }
      }

      if (session.mode === "subscription" && session.metadata?.type !== "fitness_membership") {
        const { userId, billingCycle, startTrial } = session.metadata;

        if (userId) {
          const subscription = await stripe.subscriptions.list({
            customer: session.customer,
            limit: 1,
          });

          const stripeSubscription = subscription.data[0];
          const isTrialSubscription = startTrial === "true" && stripeSubscription?.trial_end;

          if (isTrialSubscription) {
            const trialEnd = new Date(stripeSubscription.trial_end! * 1000);
            await storage.updateUserSubscriptionDetails(userId, {
              subscriptionTier: "subscriber",
              subscriptionStatus: "active",
              trialStartDate: new Date(),
              trialEndDate: trialEnd,
              subscriptionExpiresAt: trialEnd,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: stripeSubscription.id,
            });

            console.log(`User ${userId} started free trial via Stripe (trial ends: ${trialEnd.toISOString()})`);

            const user = await storage.getUser(userId);
            if (user) {
              const notification = await storage.createNotification({
                userId: user.id,
                type: "admin",
                title: "Free Trial Started!",
                message: `Welcome! Your free trial is now active. You have full access to all content and features until ${trialEnd.toLocaleDateString()}.`,
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(user.id, notification);
              }
            }
          } else {
            const now = new Date();
            const expirationDate = new Date(now);
            if (billingCycle === "yearly") {
              expirationDate.setFullYear(now.getFullYear() + 1);
            } else {
              expirationDate.setMonth(now.getMonth() + 1);
            }

            await storage.updateUserSubscriptionDetails(userId, {
              subscriptionTier: "subscriber",
              subscriptionStatus: "active",
              subscriptionExpiresAt: expirationDate,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: stripeSubscription?.id,
            });

            console.log(`User ${userId} subscribed via Stripe (expires: ${expirationDate.toISOString()})`);

            const user = await storage.getUser(userId);
            if (user) {
              const notification = await storage.createNotification({
                userId: user.id,
                type: "admin",
                title: "Subscription Activated!",
                message: "Welcome! Your subscription is now active. You have full access to all content and features.",
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(user.id, notification);
              }
            }
          }
        }
      }
    }

    // Handle subscription updates (trial conversion + cancellations)
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const previousAttributes = event.data.previous_attributes;

      // Trial converted to paid subscription
      if (previousAttributes?.trial_end && !subscription.trial_end && subscription.status === "active") {
        const userId = subscription.metadata?.userId;
        if (userId) {
          const expirationDate = new Date(subscription.current_period_end * 1000);

          await storage.updateUserSubscriptionDetails(userId, {
            subscriptionTier: "subscriber",
            subscriptionStatus: "active",
            subscriptionExpiresAt: expirationDate,
          });

          console.log(`User ${userId} trial converted to paid subscription (expires: ${expirationDate.toISOString()})`);

          const user = await storage.getUser(userId);
          if (user) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: "admin",
              title: "Trial Converted to Subscription!",
              message: "Your free trial has ended and your subscription is now active. Thank you for subscribing!",
              relatedId: null,
            });
            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(user.id, notification);
            }
          }
        }
      }

      // User cancelled but subscription continues until period end
      if (subscription.cancel_at_period_end) {
        const user = await storage.getUser(subscription.metadata?.userId);
        if (user && user.stripeSubscriptionId === subscription.id) {
          await storage.cancelUserSubscription(user.id);

          const notification = await storage.createNotification({
            userId: user.id,
            type: "admin",
            title: "Subscription Cancelled",
            message: `Your subscription has been cancelled and will continue until ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}. You can reactivate it anytime before then.`,
            relatedId: null,
          });

          if ((req.app as any).sendRealtimeNotification) {
            (req.app as any).sendRealtimeNotification(user.id, notification);
          }
        }
      }

      // Fitness membership: revoke access when subscription is fully cancelled
      if (subscription.status === "canceled") {
        try {
          const [fitnessMembership] = await db
            .select()
            .from(schema.fitnessMemberships)
            .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscription.id))
            .limit(1);
          if (fitnessMembership) {
            await db.update(schema.fitnessMemberships)
              .set({ status: "cancelled", updatedAt: new Date() })
              .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
            await storage.setUserFitnessAccess(fitnessMembership.userId, false);
            console.log(`[Fitness] Membership cancelled and access revoked for user ${fitnessMembership.userId}`);
          }
        } catch (err) {
          console.error("[Fitness] Error revoking fitness access on subscription cancel:", err);
        }
      }
    }

    // invoice.payment_failed — suspend access immediately
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        // Main subscription
        try {
          const [affectedUser] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.stripeSubscriptionId, subscriptionId))
            .limit(1);
          if (affectedUser) {
            await storage.updateUserSubscriptionDetails(affectedUser.id, {
              subscriptionStatus: "past_due",
              subscriptionTier: "expired",
            });
            const notification = await storage.createNotification({
              userId: affectedUser.id,
              type: "admin",
              title: "Payment Failed",
              message: "Your last payment was declined. Please update your payment method to restore your access.",
              relatedId: null,
            });
            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
            }
            console.log(`[Billing] Main subscription payment failed for user ${affectedUser.id} — status set to past_due`);
          }
        } catch (err) {
          console.error("[Billing] Error handling payment_failed for main subscription:", err);
        }

        // Fitness membership
        try {
          const [fitnessMembership] = await db
            .select()
            .from(schema.fitnessMemberships)
            .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscriptionId))
            .limit(1);
          if (fitnessMembership) {
            await db.update(schema.fitnessMemberships)
              .set({ status: "past_due", updatedAt: new Date() })
              .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
            await storage.setUserFitnessAccess(fitnessMembership.userId, false);
            const notification = await storage.createNotification({
              userId: fitnessMembership.userId,
              type: "admin",
              title: "Fitness Payment Failed",
              message: "Your fitness membership payment failed. Please update your payment method to restore fitness access.",
              relatedId: null,
            });
            if ((req.app as any).sendRealtimeNotification) {
              (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
            }
            console.log(`[Billing] Fitness membership payment failed for user ${fitnessMembership.userId} — access revoked`);
          }
        } catch (err) {
          console.error("[Billing] Error handling payment_failed for fitness membership:", err);
        }
      }
    }

    // invoice.paid — renew access on successful charge (renewals + payment recovery)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;
      const billingReason = invoice.billing_reason;
      // Skip first-time checkout — already handled by checkout.session.completed
      if (subscriptionId && billingReason !== "subscription_create") {
        // Main subscription renewal / recovery
        try {
          const [affectedUser] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.stripeSubscriptionId, subscriptionId))
            .limit(1);
          if (affectedUser) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const newPeriodEnd = new Date(subscription.current_period_end * 1000);
            await storage.updateUserSubscriptionDetails(affectedUser.id, {
              subscriptionStatus: "active",
              subscriptionTier: "subscriber",
              subscriptionExpiresAt: newPeriodEnd,
            });
            if (affectedUser.subscriptionStatus === "past_due") {
              const notification = await storage.createNotification({
                userId: affectedUser.id,
                type: "admin",
                title: "Payment Successful — Access Restored",
                message: "Your payment went through and your subscription is active again. Welcome back!",
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
              }
            }
            console.log(`[Billing] Main subscription renewed for user ${affectedUser.id} — expires ${newPeriodEnd.toISOString()}`);
          }
        } catch (err) {
          console.error("[Billing] Error handling invoice.paid for main subscription:", err);
        }

        // Fitness membership renewal / recovery
        try {
          const [fitnessMembership] = await db
            .select()
            .from(schema.fitnessMemberships)
            .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscriptionId))
            .limit(1);
          if (fitnessMembership) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const newPeriodEnd = new Date(subscription.current_period_end * 1000);
            await db.update(schema.fitnessMemberships)
              .set({ status: "active", currentPeriodEnd: newPeriodEnd, cancelAtPeriodEnd: false, updatedAt: new Date() })
              .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
            await storage.setUserFitnessAccess(fitnessMembership.userId, true);
            if (fitnessMembership.status === "past_due") {
              const notification = await storage.createNotification({
                userId: fitnessMembership.userId,
                type: "admin",
                title: "Fitness Access Restored",
                message: "Your fitness membership payment went through. You have full fitness access again!",
                relatedId: null,
              });
              if ((req.app as any).sendRealtimeNotification) {
                (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
              }
            }
            console.log(`[Billing] Fitness membership renewed for user ${fitnessMembership.userId} — expires ${newPeriodEnd.toISOString()}`);
          }
        } catch (err) {
          console.error("[Billing] Error handling invoice.paid for fitness membership:", err);
        }
      }
    }

    // customer.subscription.deleted — fully revoke access after all retries exhausted or period ends
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;

      // Main subscription
      try {
        const [affectedUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.stripeSubscriptionId, subscription.id))
          .limit(1);
        if (affectedUser) {
          await storage.updateUserSubscriptionDetails(affectedUser.id, {
            subscriptionStatus: "expired",
            subscriptionTier: "expired",
            stripeSubscriptionId: undefined,
          });
          const notification = await storage.createNotification({
            userId: affectedUser.id,
            type: "admin",
            title: "Subscription Ended",
            message: "Your subscription has ended. Subscribe again anytime to restore full access.",
            relatedId: null,
          });
          if ((req.app as any).sendRealtimeNotification) {
            (req.app as any).sendRealtimeNotification(affectedUser.id, notification);
          }
          console.log(`[Billing] Main subscription deleted for user ${affectedUser.id} — status set to expired`);
        }
      } catch (err) {
        console.error("[Billing] Error handling subscription.deleted for main subscription:", err);
      }

      // Fitness membership
      try {
        const [fitnessMembership] = await db
          .select()
          .from(schema.fitnessMemberships)
          .where(eq(schema.fitnessMemberships.stripeSubscriptionId, subscription.id))
          .limit(1);
        if (fitnessMembership) {
          await db.update(schema.fitnessMemberships)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(schema.fitnessMemberships.id, fitnessMembership.id));
          await storage.setUserFitnessAccess(fitnessMembership.userId, false);
          const notification = await storage.createNotification({
            userId: fitnessMembership.userId,
            type: "admin",
            title: "Fitness Membership Ended",
            message: "Your fitness membership has ended. Rejoin anytime to restore access to fitness content.",
            relatedId: null,
          });
          if ((req.app as any).sendRealtimeNotification) {
            (req.app as any).sendRealtimeNotification(fitnessMembership.userId, notification);
          }
          console.log(`[Billing] Fitness membership deleted for user ${fitnessMembership.userId} — access revoked`);
        }
      } catch (err) {
        console.error("[Billing] Error handling subscription.deleted for fitness membership:", err);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(400).json({ message: "Webhook error" });
  }
}
