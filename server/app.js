import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthService } from "./auth/authService.js";
import { authenticate } from "./middleware/authenticate.js";
import { createPool, createPostgresAuthDb, createPostgresUserDataDb } from "./db/postgres.js";
import { createAuthRouter } from "./routes/auth.js";
import { createTelegramRouter } from "./routes/telegram.js";
import { createUserDataRouter } from "./routes/userData.js";

export function createApp(options = {}) {
  const app = express();
  const pool = options.pool ?? (options.skipDatabase ? null : createPool());
  const authDb = options.authDb ?? (pool ? createPostgresAuthDb(pool) : null);
  const userDataDb = options.userDataDb ?? (pool ? createPostgresUserDataDb(pool) : null);
  const authService = options.authService ?? createAuthService({ db: authDb, jwtSecret: options.jwtSecret });

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) ?? true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => response.json({ ok: true, service: "northwatch-auth", checkedAt: new Date().toISOString() }));
  app.use("/auth", createAuthRouter({ express, authService }));
  app.use("/api/auth", createAuthRouter({ express, authService }));

  if (userDataDb) {
    const protectedApi = authenticate({ authService });
    app.use("/api/telegram", protectedApi, createTelegramRouter({ express, db: userDataDb }));
    app.use("/api", protectedApi, createUserDataRouter({ express, db: userDataDb }));
  }

  return app;
}
