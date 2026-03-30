import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
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
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
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
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Check if this is a new user before upserting
  const existingUser = await storage.getUser(claims["sub"]);
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
    const claims = tokens.claims();
    // Block banned users from logging in
    const existingUser = await storage.getUser(claims["sub"]);
    if (existingUser?.isBanned) {
      return verified(null, false);
    }
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
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
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/banned",
    })(req, res, next);
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
  const currentUser = await storage.getUser(userId);
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

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    const userId = user.claims?.sub;
    if (userId) {
      const allowed = await checkBanAndUpdateActivity(userId, req, res);
      if (!allowed) return;
    }
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    const userId = user.claims?.sub;
    if (userId) {
      const allowed = await checkBanAndUpdateActivity(userId, req, res);
      if (!allowed) return;
    }
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
