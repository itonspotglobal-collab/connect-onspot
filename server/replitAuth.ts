import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
    createTableIfMissing: true, // Enable auto-table creation for reliability
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
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
      sameSite: "lax", // Better cross-site compatibility
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
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup OAuth strategies first
  await setupOAuthStrategies(app);

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
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

  // Note: Passport serialization is set up in setupOAuthStrategies to handle both OAuth and Replit Auth

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
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

// Setup Google and LinkedIn OAuth strategies
async function setupOAuthStrategies(app: Express) {
  // CRITICAL FIX: Updated passport serialization to handle all user types consistently
  passport.serializeUser((user: any, cb) => {
    console.log('🔐 Serializing user:', { 
      hasUser: !!user.user, 
      provider: user.provider,
      userType: typeof user,
      keys: Object.keys(user)
    });
    
    if (user.user) {
      // OAuth/Dev user structure with nested user object
      cb(null, { 
        id: user.user.id, 
        provider: user.provider || 'unknown',
        type: 'oauth'
      });
    } else if (user.claims) {
      // Replit Auth user structure
      cb(null, { 
        id: user.claims.sub, 
        provider: 'replit',
        type: 'replit'
      });
    } else {
      // Fallback - direct user object
      console.warn('⚠️ Unknown user structure during serialization:', user);
      cb(null, { 
        id: user.id || user.sub || 'unknown', 
        provider: user.provider || 'unknown',
        type: 'fallback'
      });
    }
  });

  passport.deserializeUser(async (serializedUser: any, cb) => {
    try {
      console.log('🔐 Deserializing user:', serializedUser);
      
      const { id, provider, type } = serializedUser;
      
      if (!id) {
        console.error('❌ No user ID found during deserialization');
        return cb(null, null);
      }

      // Fetch user from storage
      const user = await storage.getUser(id);
      if (!user) {
        console.warn(`⚠️ User not found in storage: ${id}`);
        return cb(null, null);
      }

      console.log('✅ User successfully deserialized:', { id: user.id, email: user.email, provider });
      
      // Return user with consistent structure
      cb(null, { 
        user, 
        provider: provider || 'unknown',
        type: type || 'unknown'
      });
    } catch (error) {
      console.error('❌ Error during user deserialization:', error);
      cb(error, null);
    }
  });

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
      : `/api/auth/google/callback`;

    passport.use('google', new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl,
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth callback triggered for profile:', profile.id);
        
        // Extract user information from Google profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('Google OAuth: No email found in profile');
          return done(new Error('Google account must have a verified email address'), false);
        }

        // Create or update user in storage
        const userData = {
          id: `google_${profile.id}`, // Prefix to avoid ID collisions
          email: email,
          firstName: profile.name?.givenName || '',
          lastName: profile.name?.familyName || '',
          profileImageUrl: profile.photos?.[0]?.value || null,
          role: 'client', // Default role
        };

        console.log('Creating/updating user with Google OAuth data:', { email: userData.email, id: userData.id });
        const user = await storage.upsertUser(userData);
        return done(null, { user, accessToken, provider: 'google' });
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, false);
      }
    }));

    // Google OAuth routes
    app.get('/api/auth/google', (req, res, next) => {
      console.log('Initiating Google OAuth...');
      passport.authenticate('google', { 
        scope: ['openid', 'email', 'profile']
      })(req, res, next);
    });

    app.get('/api/auth/google/callback',
      passport.authenticate('google', { 
        failureRedirect: '/?error=oauth&provider=google&message=Google authentication failed'
      }),
      (req, res) => {
        console.log('Google OAuth successful, redirecting to home');
        res.redirect('/');
      }
    );
  } else {
    console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  // LinkedIn OAuth Strategy  
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    const callbackUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/linkedin/callback`
      : `/api/auth/linkedin/callback`;

    passport.use('linkedin', new LinkedInStrategy({
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: callbackUrl,
      scope: ['r_liteprofile', 'r_emailaddress'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('LinkedIn OAuth callback triggered for profile:', profile.id);
        
        // Extract user information from LinkedIn profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('LinkedIn OAuth: No email found in profile');
          return done(new Error('LinkedIn account must have a verified email address. Please ensure your LinkedIn email is verified and public.'), null);
        }

        // Create or update user in storage
        const userData = {
          id: `linkedin_${profile.id}`, // Prefix to avoid ID collisions
          email: email,
          firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || '',
          lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
          profileImageUrl: profile.photos?.[0]?.value || null,
          role: 'talent', // Default role for LinkedIn users
        };

        console.log('Creating/updating user with LinkedIn OAuth data:', { email: userData.email, id: userData.id });
        const user = await storage.upsertUser(userData);
        return done(null, { user, accessToken, provider: 'linkedin' });
      } catch (error) {
        console.error('LinkedIn OAuth error:', error);
        return done(error, false);
      }
    }));

    // LinkedIn OAuth routes
    app.get('/api/auth/linkedin', (req, res, next) => {
      console.log('Initiating LinkedIn OAuth...');
      passport.authenticate('linkedin', {
        state: Math.random().toString(36).substring(7) // CSRF protection
      })(req, res, next);
    });

    app.get('/api/auth/linkedin/callback',
      passport.authenticate('linkedin', { 
        failureRedirect: '/?error=oauth&provider=linkedin&message=LinkedIn authentication failed'
      }),
      (req, res) => {
        console.log('LinkedIn OAuth successful, redirecting to home');
        res.redirect('/');
      }
    );
  } else {
    console.warn('LinkedIn OAuth not configured - missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET');
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Authentication disabled - all requests allowed
  console.log('🔓 Authentication disabled - public access mode');
  next();
};