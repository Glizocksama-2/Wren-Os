import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthService } from "./auth/authService.js";
import { createErrorTracker } from "./errorTracking.js";
import { createInviteMailer } from "./email/inviteMailer.js";
import { createCopilotService } from "./services/copilot.service.js";
import { authenticate } from "./middleware/authenticate.js";
import { createLogger } from "./logger.js";
import { createRateLimitMiddleware, createPostgresRateLimitStore } from "./middleware/rateLimit.js";
import { createRequestContextMiddleware } from "./middleware/requestContext.js";
import { createPool, createPostgresAuthDb, createPostgresTeamDb, createPostgresUserDataDb } from "./db/postgres.js";
import { createAuthRouter } from "./routes/auth.js";
import { createIntelRouter } from "./routes/intel.js";
import { createInviteAcceptRouter } from "./routes/teamInvites.js";
import { createLegacyCommandDeckRouter } from "./routes/legacyCommandDeck.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createSystemAiRouter } from "./routes/systemAi.js";
import { createTelegramRouter } from "./routes/telegram.js";
import { createTeamsRouter } from "./routes/teams.js";
import { createUserDataRouter } from "./routes/userData.js";
import { createWeatherRouter } from "./routes/weather.js";
import { createWorkoutRouter } from "./routes/workout.js";

export function createApp(options = {}) {
  const app = express();
  const pool = options.pool ?? (options.skipDatabase ? null : createPool());
  const authDb = options.authDb ?? (pool ? createPostgresAuthDb(pool) : null);
  const userDataDb = options.userDataDb ?? (pool ? createPostgresUserDataDb(pool) : null);
  const teamDb = options.teamDb ?? (pool ? createPostgresTeamDb(pool) : null);
  const authService = options.authService ?? createAuthService({ db: authDb, jwtSecret: options.jwtSecret });
  const mailer = options.mailer ?? createInviteMailer();
  const systemAiService = options.systemAiService ?? createCopilotService();
  const logger = options.logger ?? createLogger();
  const errorTracker = options.errorTracker ?? createErrorTracker({ logger });
  const rateLimitStore = options.rateLimitStore ?? (pool ? createPostgresRateLimitStore(pool) : null);
  const configuredAppBaseUrl = options.appBaseUrl ?? process.env.NORTHWATCH_APP_URL ?? "";
  const appBaseUrl = configuredAppBaseUrl || "http://127.0.0.1:5173";

  app.set("trust proxy", 1);
  app.use(createRequestContextMiddleware({ logger, requestIdFactory: options.requestIdFactory }));
  app.use(helmet(createHelmetOptions()));
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) ?? true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(createRateLimitMiddleware({ store: rateLimitStore, rules: options.rateLimitRules, logger }));

  app.get("/", (_request, response) => {
    response.type("html").send(renderRootPage(appBaseUrl));
  });
  app.get("/health", async (request, response) => {
    const checkedAt = new Date().toISOString();
    const isCopilotConfigured = typeof systemAiService.isConfigured === "function" ? systemAiService.isConfigured() : false;
    const checks = {
      api: { status: "ok" },
      database: { status: pool ? "skipped" : "not_configured" }
    };

    if (request.query.deep === "1" && pool) {
      try {
        await pool.query("select 1 as ok");
        checks.database = { status: "ok" };
      } catch (error) {
        checks.database = {
          status: "error",
          detail: error instanceof Error ? error.message : "Database health check failed."
        };
      }
    }

    const ok = checks.database.status !== "error";
    response.status(ok ? 200 : 503).json({
      ok,
      service: "northwatch-auth",
      checkedAt,
      checks,
      agents: [
        { id: "sentinel", status: "alive", checkedAt, detail: "Northwatch API is running." },
        {
          id: "copilot",
          status: isCopilotConfigured ? "idle" : "dead",
          checkedAt,
          detail: isCopilotConfigured ? "Copilot system AI is configured." : "RAPIDAPI_COPILOT_KEY is not set."
        }
      ]
    });
  });
  app.use("/auth", createAuthRouter({ express, authService }));
  app.use("/api/auth", createAuthRouter({ express, authService }));
  app.use("/api/intel", createIntelRouter({ express, authService }));
  app.use("/api/system-ai", authenticate({ authService }), createSystemAiRouter({ express, service: systemAiService }));
  app.use("/api/workout", authenticate({ authService }), createWorkoutRouter({ express }));
  app.use("/api/weather", authenticate({ authService }), createWeatherRouter({ express }));
  if (teamDb) {
    app.use("/api/invites", createInviteAcceptRouter({ express, db: teamDb, authenticate: authenticate({ authService }) }));
  }

  if (userDataDb) {
    const protectedApi = authenticate({ authService });
    app.use("/api/telegram", protectedApi, createTelegramRouter({ express, db: userDataDb }));
    app.use("/api/legacy-command-deck", protectedApi, createLegacyCommandDeckRouter({ express, db: userDataDb }));
    if (teamDb) {
      app.use("/api/teams", protectedApi, createTeamsRouter({ express, db: teamDb, mailer, appBaseUrl: configuredAppBaseUrl }));
      app.use("/api/notifications", protectedApi, createNotificationsRouter({ express, db: teamDb }));
    }
    app.use("/api", protectedApi, createUserDataRouter({ express, db: userDataDb, teamDb }));
  }

  app.use((request, response, next) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/auth")) {
      response.status(404).json({ error: `Northwatch API route not found: ${request.path}`, requestId: request.requestId });
      return;
    }
    next();
  });
  app.use((error, request, response, next) => apiErrorHandler(error, request, response, next, { errorTracker }));

  return app;
}

export function apiErrorHandler(error, request, response, next, { errorTracker } = {}) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const isApiRequest = request.path.startsWith("/api") || request.path.startsWith("/auth") || request.accepts(["json", "html"]) === "json";
  if (!isApiRequest) {
    response.status(error.status ?? error.statusCode ?? 500).type("text").send(error.message ?? "Internal server error.");
    return;
  }

  const isJsonParseError = error instanceof SyntaxError && "body" in error;
  const status = error.status ?? error.statusCode ?? (isJsonParseError ? 400 : 500);
  const message = getPublicErrorMessage(error, status, isJsonParseError);
  if (status >= 500 && !isJsonParseError) {
    errorTracker?.captureException?.(error, {
      requestId: request.requestId,
      method: request.method,
      path: request.path
    });
  }
  response.status(status).json({
    error: message,
    requestId: request.requestId
  });
}

function createHelmetOptions() {
  return {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  };
}

function getPublicErrorMessage(error, status, isJsonParseError) {
  if (isJsonParseError) return "Malformed JSON request body.";
  if (status >= 500 && process.env.NODE_ENV === "production") return "Internal server error.";
  return error.message ?? "Internal server error.";
}

function renderRootPage(appBaseUrl) {
  const frontendUrl = escapeHtml(appBaseUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Northwatch API</title>
  </head>
  <body>
    <main>
      <h1>Northwatch API is running</h1>
      <p>This is the Express backend. Open the React app to use Northwatch.</p>
      <p><a href="${frontendUrl}">Open Northwatch frontend</a></p>
      <p>Health check: <a href="/health">/health</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
