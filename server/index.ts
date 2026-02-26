import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { devotionalNotificationService } from "./devotionalNotificationService";
import { subscriptionExpirationService } from "./subscriptionExpirationService";
import { fitnessReminderService } from "./fitnessReminderService";
import { warGroupsGeocodingService } from "./warGroupsGeocodingService";
import { challengeNotificationService } from "./challengeNotificationService";

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

// Catch uncaught exceptions and unhandled rejections so the process never
// dies silently.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
});
process.on("SIGTERM", () => {
  console.error("[SIGNAL] SIGTERM received");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.error("[SIGNAL] SIGINT received");
  process.exit(0);
});
process.on("SIGHUP", () => {
  console.error("[SIGNAL] SIGHUP received — ignoring (daemon mode)");
  // SIGHUP is sent by Replit when the terminal session refreshes.
  // Ignore it so the server keeps running.
});
process.on("exit", (code) => {
  console.error(`[EXIT] Process exiting with code ${code}`);
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    // Do NOT re-throw — re-throwing after a response is sent creates an
    // uncaught exception that kills the process.
    console.error("[Express error]", err);
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

    // Stagger background service starts by 5 seconds each so they don't all
    // hit the database simultaneously at startup, which spikes memory.
    devotionalNotificationService.start();
    setTimeout(() => subscriptionExpirationService.start(), 5000);
    setTimeout(() => fitnessReminderService.start(), 10000);
    setTimeout(() => warGroupsGeocodingService.start(), 15000);
    setTimeout(() => challengeNotificationService.start(), 20000);
  });
})();
