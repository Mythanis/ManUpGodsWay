import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { devotionalNotificationService } from "./devotionalNotificationService";
import { subscriptionExpirationService } from "./subscriptionExpirationService";
import { fitnessReminderService } from "./fitnessReminderService";
import { warGroupsGeocodingService } from "./warGroupsGeocodingService";
import { challengeNotificationService } from "./challengeNotificationService";

// Intercept process.exit to capture stack trace before death
const _origExit = process.exit.bind(process);
(process as any).exit = (code?: number) => {
  console.error(`[EXIT INTERCEPTED] code=${code} stack=`, new Error().stack);
  _origExit(code);
};

// Capture ALL process exits - fires even for process.exit() calls
process.on('exit', (code) => {
  console.error(`[PROCESS EXIT] Process exiting with code: ${code}`);
});
process.on('SIGTERM', () => {
  console.error('[PROCESS SIGTERM] Received SIGTERM signal');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.error('[PROCESS SIGINT] Received SIGINT signal');
  process.exit(0);
});
// Capture unhandled errors BEFORE they silently kill the process
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  });
})();
