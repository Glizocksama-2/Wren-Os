import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthService } from "./auth/authService.js";
import { createInviteMailer } from "./email/inviteMailer.js";
import { authenticate } from "./middleware/authenticate.js";
import { createPool, createPostgresAuthDb, createPostgresTeamDb, createPostgresUserDataDb } from "./db/postgres.js";
import { createAuthRouter } from "./routes/auth.js";
import { createIntelRouter } from "./routes/intel.js";
import { createInviteAcceptRouter } from "./routes/teamInvites.js";
import { createLegacyCommandDeckRouter } from "./routes/legacyCommandDeck.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createTelegramRouter } from "./routes/telegram.js";
import { createTeamsRouter } from "./routes/teams.js";
import { createUserDataRouter } from "./routes/userData.js";

export function createApp(options = {}) {
  const app = express();
  const pool = options.pool ?? (options.skipDatabase ? null : createPool());
  const authDb = options.authDb ?? (pool ? createPostgresAuthDb(pool) : null);
  const userDataDb = options.userDataDb ?? (pool ? createPostgresUserDataDb(pool) : null);
  const teamDb = options.teamDb ?? (pool ? createPostgresTeamDb(pool) : null);
  const authService = options.authService ?? createAuthService({ db: authDb, jwtSecret: options.jwtSecret });
  const mailer = options.mailer ?? createInviteMailer();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) ?? true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => response.json({ ok: true, service: "northwatch-auth", checkedAt: new Date().toISOString() }));
  app.use("/auth", createAuthRouter({ express, authService }));
  app.use("/api/auth", createAuthRouter({ express, authService }));
  app.use("/api/intel", createIntelRouter({ express }));
  if (teamDb) {
    app.use("/api/invites", createInviteAcceptRouter({ express, db: teamDb, authenticate: authenticate({ authService }) }));
  }

  if (userDataDb) {
    const protectedApi = authenticate({ authService });
    app.use("/api/telegram", protectedApi, createTelegramRouter({ express, db: userDataDb }));
    app.use("/api/legacy-command-deck", protectedApi, createLegacyCommandDeckRouter({ express, db: userDataDb }));
    if (teamDb) {
      app.use("/api/teams", protectedApi, createTeamsRouter({ express, db: teamDb, mailer }));
      app.use("/api/notifications", protectedApi, createNotificationsRouter({ express, db: teamDb }));
    }
    app.use("/api", protectedApi, createUserDataRouter({ express, db: userDataDb, teamDb }));
  }

  return app;
}
