import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";
import { subscribeToMailchimp } from "./mailchimpService";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  // Reuse the application's existing Neon pool (WebSocket-based) rather than
  // letting connect-pg-simple open its own raw TCP connection via conString.
  // In production the Neon endpoint is reachable over WebSockets but a bare
  // TCP/DNS path to the internal "helium" host may not be.
  const sessionStore = new pgStore({
    pool: pool as any,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  // Wrap all session store I/O methods so that a DB failure (e.g. the "helium"
  // host is unreachable from a preview/isolated deployment container) is caught
  // and handled gracefully instead of propagating to Express's global error
  // handler as a raw {"message":"getaddrinfo EAI_AGAIN helium"} response.
  //
  // Fail-open strategy:
  //   get  → treat DB error as "no session" (user re-authenticates)
  //   set  → log the error, don't persist the session (acceptable in preview)
  //   destroy → log the error, continue (logout still works client-side)
  const _get = sessionStore.get.bind(sessionStore);
  (sessionStore as any).get = (sid: string, fn: any) => {
    _get(sid, (err: any, sess: any) => {
      if (err) {
        console.error("Session store get error (treating as empty):", err);
        return fn(null, null);
      }
      fn(null, sess);
    });
  };

  const _set = sessionStore.set.bind(sessionStore);
  (sessionStore as any).set = (sid: string, sess: any, fn?: any) => {
    _set(sid, sess, (err: any) => {
      if (err) {
        console.error("Session store set error (session not persisted):", err);
      }
      if (fn) fn();
    });
  };

  const _destroy = sessionStore.destroy.bind(sessionStore);
  (sessionStore as any).destroy = (sid: string, fn?: any) => {
    _destroy(sid, (err: any) => {
      if (err) {
        console.error("Session store destroy error:", err);
      }
      if (fn) fn();
    });
  };

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  // Persist userId as a top-level canonical identity field so isAuthenticated
  // can key off it directly without coupling to OIDC claim shape.
  user.userId = user.claims?.sub;
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
}

async function upsertUser(
  claims: any,
) {
  // Check if this is a new user before upserting.
  // If the DB is temporarily unavailable, assume existing user so we don't
  // accidentally overwrite subscription data with trial defaults.
  let existingUser: any = null;
  try {
    existingUser = await storage.getUser(claims["sub"]);
  } catch (dbErr) {
    console.error("upsertUser: DB error checking existing user, treating as existing:", dbErr);
  }
  const isNewUser = !existingUser;

  const userData: any = {
    id: claims["sub"],
    email: claims["email"],
    profileImageUrl: claims["profile_image_url"],
  };

  // For new users, seed names from Replit claims if available.
  // For existing users, never overwrite — names are user-controlled within the app.
  if (isNewUser) {
    userData.firstName = claims["first_name"] ?? null;
    userData.lastName = claims["last_name"] ?? null;
  }
  
  // Include role from claims if present (for testing purposes)
  if (claims["role"]) {
    userData.role = claims["role"];
  }
  
  // Set trial dates for new users
  if (isNewUser) {
    const now = new Date();
    const trialEnd = new Date(now);
    
    // Get trial duration from subscription settings
    let trialDays = 7;
    try {
      const settings = await storage.getSubscriptionSettings();
      if (settings?.trialDurationDays) {
        trialDays = settings.trialDurationDays;
      }
    } catch (e) {
      console.error("Error fetching subscription settings for trial:", e);
    }
    
    trialEnd.setDate(now.getDate() + trialDays);
    userData.subscriptionStatus = 'trial';
    userData.subscriptionTier = 'free';
    userData.trialStartDate = now;
    userData.trialEndDate = trialEnd;
  }
  
  await storage.upsertUser(userData);
  
  // Subscribe new users to Mailchimp mailing list
  if (isNewUser && claims["email"]) {
    subscribeToMailchimp({
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
    }).catch(err => {
      console.error("Failed to subscribe to Mailchimp:", err);
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const claims = tokens.claims();

      // Block banned users from logging in.
      // If the DB is temporarily unavailable, fail open (allow login) so a
      // transient outage does not lock everyone out of the application.
      let isBanned = false;
      try {
        const existingUser = await storage.getUser(claims["sub"]);
        isBanned = existingUser?.isBanned ?? false;
      } catch (dbErr) {
        console.error("verify: DB error checking ban status, allowing login:", dbErr);
      }
      if (isBanned) {
        // Pass info so the callback handler can redirect to /banned specifically,
        // rather than conflating a genuine ban with other auth failures like a
        // broken PKCE session (which would also produce verified(null, false)).
        return verified(null, false, { banned: true });
      }

      const user = {};
      updateUserSession(user, tokens);

      try {
        await upsertUser(claims);
      } catch (upsertErr) {
        // Log but don't block login — the user's OIDC session is valid even if
        // the DB upsert fails transiently. They'll be re-upserted on next login.
        console.error("verify: DB error during upsertUser, proceeding with login:", upsertErr);
      }

      verified(null, user);
    } catch (err) {
      console.error("verify: unexpected error during OAuth callback:", err);
      // Pass a sanitized error so the global handler shows a clean message.
      const safeErr = new Error("Login failed. Please try again.");
      (safeErr as any).status = 500;
      verified(safeErr);
    }
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(
      `replitauth:${req.hostname}`,
      (err: any, user: any, info: any) => {
        if (err) {
          console.error("OAuth callback error:", err);
          // Pass sanitized error so global handler returns "Login failed" not
          // a raw DB/PKCE message.
          const safeErr = new Error("Login failed. Please try again.");
          (safeErr as any).status = 500;
          return next(safeErr);
        }
        if (!user) {
          // info.banned is set only when the verify function explicitly marks
          // the user as banned.  All other failures (PKCE mismatch, missing
          // session state, token exchange errors) land here too — redirect
          // those to the login page so the user can retry, not to /banned.
          if (info?.banned) {
            return res.redirect("/banned");
          }
          console.warn("OAuth callback: authentication failed (non-ban):", info);
          return res.redirect("/api/login");
        }
        req.logIn(user, (loginErr: any) => {
          if (loginErr) {
            console.error("req.logIn error:", loginErr);
            return next(loginErr);
          }
          return res.redirect("/");
        });
      }
    )(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

async function checkBanAndUpdateActivity(userId: string, req: any, res: any): Promise<boolean> {
  let currentUser: any;
  try {
    currentUser = await storage.getUser(userId);
  } catch (dbErr) {
    console.error("checkBanAndUpdateActivity: DB error fetching user, allowing request through:", dbErr);
    // DB temporarily unavailable — fail open so users aren't locked out during transient outages.
    // Ban checks will resume once the DB recovers.
    return true;
  }
  if (currentUser?.isBanned) {
    req.logout(() => {});
    res.status(401).json({ message: "Your account has been banned.", banned: true });
    return false;
  }
  // Update lastActiveDate if it's a new day
  if (currentUser) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastActiveDate = currentUser.lastActiveDate ? new Date(currentUser.lastActiveDate) : null;
      const lastActiveDateOnly = lastActiveDate ? new Date(lastActiveDate.getFullYear(), lastActiveDate.getMonth(), lastActiveDate.getDate()) : null;
      if (!lastActiveDateOnly || lastActiveDateOnly.getTime() < today.getTime()) {
        await storage.upsertUser({ ...currentUser, lastActiveDate: new Date() });
      }
    } catch (error) {
      console.error("Error updating user lastActiveDate:", error);
    }
  }
  return true;
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Session validity is governed by the 1-week session cookie TTL, not OIDC token
  // expiry. This allows multiple devices to maintain independent, concurrent sessions
  // without being logged out when another device re-authenticates (which would
  // rotate the refresh token and invalidate this session's ability to refresh).
  // userId is the canonical identity field; claims.sub is retained for profile routes.
  const userId = user?.userId ?? user?.claims?.sub;
  if (!req.isAuthenticated() || !userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const allowed = await checkBanAndUpdateActivity(userId, req, res);
    if (!allowed) return;
  } catch (err) {
    console.error("isAuthenticated: unexpected error in checkBanAndUpdateActivity:", err);
    // Don't expose raw DB/network errors to the client.
    return res.status(500).json({ message: "An unexpected error occurred. Please try again." });
  }
  return next();
};
