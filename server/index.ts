import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { devotionalNotificationService } from "./devotionalNotificationService";
import { subscriptionExpirationService } from "./subscriptionExpirationService";
import { fitnessReminderService } from "./fitnessReminderService";
import { warGroupsGeocodingService } from "./warGroupsGeocodingService";
import { challengeNotificationService } from "./challengeNotificationService";
import { prayerReminderService } from "./prayerReminderService";
import { dailyReminderService } from "./dailyReminderService";
import { conversionNudgeService } from "./conversionNudgeService";
import { startAuditJob, isAuditJobRunning } from "./exerciseAuditJob";
import { db } from "./db";
import { exercises, exerciseInstructionReviews } from "../shared/schema";
import { sql as sqlExpr } from "drizzle-orm";
import { stripeWebhookHandler } from "./stripeWebhook";
import { generalLimiter } from "./rateLimiter";

const app = express();

// Trust the first proxy hop (Replit's reverse proxy) so req.ip reflects the real client IP
// This ensures rate limiting buckets per user rather than per proxy
app.set("trust proxy", 1);

// Stripe webhook MUST be registered before express.json() and the general rate limiter
// so it receives the raw body for signature verification and is exempt from IP-based throttling
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
// Alias so both /api/stripe/webhook and /api/stripe-webhook are accepted
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

// WHIP proxy route needs raw text/plain body (SDP) before express.json() parses it
app.post(/^\/api\/live-streams\/[^/]+\/whip$/, express.text({ type: "application/sdp", limit: "64kb" }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Prevent HTTP 304 "Not Modified" responses for all API routes.
// Browsers cache API responses via ETags; after a mutation the cached JSON can
// be silently reused, causing stale data in the UI even after a mutation.
// Stripping the conditional-request headers forces a full 200 response every time.
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  delete (req.headers as any)["if-none-match"];
  delete (req.headers as any)["if-modified-since"];
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// General rate limit: 200 requests/min per IP across all /api/* routes
// The Stripe webhook above is exempt because it is registered before this middleware
app.use("/api", generalLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Never expose raw internal error messages (e.g. DB connection strings,
    // internal hostnames like "helium") to the client.  Only pass through
    // client-safe messages for 4xx errors; everything else becomes generic.
    const isClientError = status >= 400 && status < 500;
    const message = isClientError
      ? (err.message || "Bad Request")
      : "Internal Server Error";

    console.error(`[error] ${status} ${err.message || err}`);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start the devotional notification service
    devotionalNotificationService.start();
    
    // Start the subscription expiration service
    subscriptionExpirationService.start();
    
    // Start the fitness reminder service
    fitnessReminderService.start();
    
    // Start the war groups geocoding service
    warGroupsGeocodingService.start();
    
    // Start the challenge notification service
    challengeNotificationService.start();
    
    // Start the prayer reminder service
    prayerReminderService.start();
    
    // Start the daily app reminder service
    dailyReminderService.start();
    
    // Start the subscription conversion nudge service
    conversionNudgeService.start();

    // Auto-start exercise instruction audit if exercises haven't been fully audited yet.
    // The job writes to exercise_instruction_reviews; once all exercises are covered the
    // check will find reviewed >= total and skip quietly on subsequent restarts.
    (async () => {
      try {
        if (isAuditJobRunning()) return;
        const [{ total }] = await db.select({ total: sqlExpr<number>`COUNT(*)` }).from(exercises);
        const [{ reviewed }] = await db.select({ reviewed: sqlExpr<number>`COUNT(*)` }).from(exerciseInstructionReviews);
        const remaining = Number(total) - Number(reviewed);
        if (remaining > 0) {
          log(`[exercise-audit] ${remaining} exercises unreviewed — starting audit job`);
          await startAuditJob(false);
        } else {
          log('[exercise-audit] All exercises already reviewed — skipping auto-start');
        }
      } catch (err: any) {
        log(`[exercise-audit] Auto-start failed: ${err.message}`);
      }
    })();
  });
})();
