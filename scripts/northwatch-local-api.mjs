import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createAuthService } from "../server/auth/authService.js";
import { authenticate } from "../server/middleware/authenticate.js";
import { createAuthRouter } from "../server/routes/auth.js";
import { createIntelRouter } from "../server/routes/intel.js";

const port = Number(process.env.PORT ?? 4000);
const appBaseUrl = process.env.NORTHWATCH_APP_URL ?? "http://127.0.0.1:5173";
const jwtSecret = process.env.JWT_SECRET ?? crypto.randomBytes(48).toString("hex");
const authDb = createMemoryAuthDb();
const authService = createAuthService({ db: authDb, jwtSecret });
const protectedApi = authenticate({ authService });
const telegramConfigs = new Map();
const resourceData = new Map();
const teams = new Map();
const teamMembers = new Map();
const teamInvites = new Map();

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: [
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://localhost:5174"
  ],
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_request, response) => {
  response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Northwatch Local API</title>
  </head>
  <body>
    <main>
      <h1>Northwatch local API is running</h1>
      <p>This development server handles auth cookies, Intel, and local empty workspace endpoints.</p>
      <p><a href="${escapeHtml(appBaseUrl)}">Open Northwatch frontend</a></p>
      <p>Health check: <a href="/health">/health</a></p>
    </main>
  </body>
</html>`);
});

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "northwatch-local-api", checkedAt: new Date().toISOString() });
});

app.use("/auth", createAuthRouter({ express, authService }));
app.use("/api/auth", createAuthRouter({ express, authService }));
app.use("/api/intel", createIntelRouter({ express, authService }));

app.get("/api/activity", protectedApi, (_request, response) => {
  response.json({ events: [] });
});

app.get("/api/legacy-command-deck", protectedApi, (_request, response) => {
  response.status(204).end();
});

app.get("/api/telegram/config", protectedApi, (request, response) => {
  const config = telegramConfigs.get(request.userId);
  response.json({
    configured: Boolean(config),
    botUsername: config?.botUsername ?? null,
    chatId: config?.chatId ?? null,
    updatedAt: config?.updatedAt ?? null
  });
});

app.post("/api/telegram/config", protectedApi, (request, response) => {
  const chatId = typeof request.body?.chatId === "string" ? request.body.chatId.trim() : "";
  const botToken = typeof request.body?.botToken === "string" ? request.body.botToken.trim() : "";
  if (!chatId || !botToken) {
    response.status(400).json({ error: "Bot token and chat id are required." });
    return;
  }

  const config = {
    botUsername: botToken.includes(":") ? botToken.split(":")[0] : "local-bot",
    chatId,
    updatedAt: new Date().toISOString()
  };
  telegramConfigs.set(request.userId, config);
  response.status(201).json({ configured: true, ...config });
});

app.delete("/api/telegram/config", protectedApi, (request, response) => {
  telegramConfigs.delete(request.userId);
  response.status(204).end();
});

app.post("/api/telegram/send", protectedApi, (_request, response) => {
  response.json({ ok: true, delivered: false, mode: "local" });
});

app.post("/api/teams", protectedApi, (request, response) => {
  const name = normalizeTitle(request.body?.name);
  const slug = uniqueTeamSlug(slugify(request.body?.slug || name));
  const now = new Date().toISOString();
  const team = {
    id: crypto.randomUUID(),
    name,
    slug,
    ownerId: request.userId,
    memberLimit: normalizeMemberLimit(request.body?.memberLimit),
    createdAt: now,
    updatedAt: now
  };
  teams.set(team.id, team);
  teamMembers.set(team.id, [
    {
      id: crypto.randomUUID(),
      teamId: team.id,
      userId: request.userId,
      email: request.user?.email ?? null,
      displayName: request.user?.displayName ?? request.user?.email ?? "Local operator",
      role: "owner",
      joinedAt: now,
      invitedBy: request.userId
    }
  ]);
  response.status(201).json({ team: toTeamSummary(team, "owner") });
});

app.get("/api/teams/mine", protectedApi, (request, response) => {
  response.json({ teams: listTeamsForUser(request.userId) });
});

app.get("/api/teams/:slug", protectedApi, (request, response) => {
  const context = getTeamContextBySlug(request.params.slug, request.userId);
  if (!context) {
    response.status(404).json({ error: "Team not found." });
    return;
  }
  response.json({
    team: toTeamSummary(context.team, context.member.role),
    members: listTeamMembers(context.team.id),
    activity: []
  });
});

app.post("/api/teams/:slug/invites", protectedApi, (request, response) => {
  const context = getTeamContextBySlug(request.params.slug, request.userId);
  if (!context) {
    response.status(404).json({ error: "Team not found." });
    return;
  }
  if (!["owner", "admin"].includes(context.member.role)) {
    response.status(403).json({ error: "Team role does not allow this action." });
    return;
  }
  const email = normalizeEmail(request.body?.email);
  if (!email) {
    response.status(400).json({ error: "Invite email is required." });
    return;
  }
  const now = Date.now();
  const invite = {
    id: crypto.randomUUID(),
    teamId: context.team.id,
    teamName: context.team.name,
    teamSlug: context.team.slug,
    email,
    token: crypto.randomUUID(),
    role: normalizeTeamRole(request.body?.role),
    invitedBy: request.userId,
    invitedByName: request.user?.displayName ?? request.user?.email ?? "Local operator",
    expiresAt: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    acceptedAt: null,
    status: "pending"
  };
  teamInvites.set(invite.token, invite);
  response.status(201).json({ invite: { ...invite, acceptUrl: `${appBaseUrl}/invite/${invite.token}` } });
});

app.get("/api/teams/:slug/invites", protectedApi, (request, response) => {
  const context = getTeamContextBySlug(request.params.slug, request.userId);
  if (!context) {
    response.status(404).json({ error: "Team not found." });
    return;
  }
  if (!["owner", "admin"].includes(context.member.role)) {
    response.status(403).json({ error: "Team role does not allow this action." });
    return;
  }
  response.json({
    invites: Array.from(teamInvites.values())
      .filter((invite) => invite.teamId === context.team.id && invite.status === "pending")
      .map((invite) => ({ ...invite, acceptUrl: `${appBaseUrl}/invite/${invite.token}` }))
  });
});

app.delete("/api/teams/:slug/invites/:inviteId", protectedApi, (request, response) => {
  const context = getTeamContextBySlug(request.params.slug, request.userId);
  if (!context) {
    response.status(404).json({ error: "Team not found." });
    return;
  }
  if (!["owner", "admin"].includes(context.member.role)) {
    response.status(403).json({ error: "Team role does not allow this action." });
    return;
  }
  const invite = Array.from(teamInvites.values()).find((item) => item.id === request.params.inviteId && item.teamId === context.team.id);
  if (!invite) {
    response.status(404).json({ error: "Invite not found." });
    return;
  }
  invite.status = "revoked";
  response.status(204).end();
});

app.get("/api/invites/:token", (request, response) => {
  const invite = teamInvites.get(request.params.token);
  if (!invite || invite.status !== "pending") {
    response.status(404).json({ error: "Invite not found." });
    return;
  }
  response.json({
    invite: {
      id: invite.id,
      teamName: invite.teamName,
      teamSlug: invite.teamSlug,
      inviterName: invite.invitedByName,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt
    }
  });
});

app.post("/api/invites/:token/accept", protectedApi, (request, response) => {
  const invite = teamInvites.get(request.params.token);
  if (!invite || invite.status !== "pending" || new Date(invite.expiresAt).getTime() <= Date.now()) {
    response.status(400).json({ error: "Invite is expired or unavailable." });
    return;
  }
  if (request.user?.email && invite.email.toLowerCase() !== request.user.email.toLowerCase()) {
    response.status(403).json({ error: "Invite email does not match this account." });
    return;
  }
  const members = teamMembers.get(invite.teamId) ?? [];
  const team = teams.get(invite.teamId);
  if (!team) {
    response.status(404).json({ error: "Team not found." });
    return;
  }
  if (members.length >= team.memberLimit && !members.some((member) => member.userId === request.userId)) {
    response.status(409).json({ error: "Team member limit reached." });
    return;
  }
  const now = new Date().toISOString();
  let member = members.find((item) => item.userId === request.userId);
  if (member) {
    member.role = invite.role;
  } else {
    member = {
      id: crypto.randomUUID(),
      teamId: invite.teamId,
      userId: request.userId,
      email: request.user?.email ?? null,
      displayName: request.user?.displayName ?? request.user?.email ?? "Local operator",
      role: invite.role,
      joinedAt: now,
      invitedBy: invite.invitedBy
    };
    members.push(member);
    teamMembers.set(invite.teamId, members);
  }
  invite.status = "accepted";
  invite.acceptedAt = now;
  response.json({
    team: toTeamSummary(team, member.role),
    membership: member
  });
});

app.get("/api/notifications", protectedApi, (_request, response) => {
  response.json({ notifications: [], unreadCount: 0 });
});

app.post("/api/notifications/read-all", protectedApi, (_request, response) => {
  response.json({ updated: 0 });
});

app.get("/api/:resource", protectedApi, (request, response) => {
  response.json({ data: listResource(request.userId, request.params.resource) });
});

app.post("/api/:resource", protectedApi, (request, response) => {
  const row = {
    id: crypto.randomUUID(),
    title: normalizeTitle(request.body?.title),
    payload: request.body && typeof request.body === "object" ? request.body : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  listResource(request.userId, request.params.resource).push(row);
  response.status(201).json({ data: row });
});

app.patch("/api/:resource/:id", protectedApi, (request, response) => {
  const rows = listResource(request.userId, request.params.resource);
  const row = rows.find((item) => item.id === request.params.id);
  if (!row) {
    response.status(404).json({ error: "Record not found." });
    return;
  }

  Object.assign(row, request.body && typeof request.body === "object" ? request.body : {}, {
    id: row.id,
    updatedAt: new Date().toISOString()
  });
  response.json({ data: row });
});

app.delete("/api/:resource/:id", protectedApi, (request, response) => {
  const rows = listResource(request.userId, request.params.resource);
  const index = rows.findIndex((item) => item.id === request.params.id);
  if (index < 0) {
    response.status(404).json({ error: "Record not found." });
    return;
  }

  rows.splice(index, 1);
  response.status(204).end();
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Northwatch local API listening on http://127.0.0.1:${port}`);
});

function createMemoryAuthDb() {
  const users = [];
  const sessions = [];
  const failures = [];

  return {
    async findUserByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async findUserById(userId) {
      return users.find((user) => user.id === userId) ?? null;
    },
    async createUser({ email, passwordHash, displayName, createdAt }) {
      const user = {
        id: `local-user-${users.length + 1}`,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        created_at: createdAt,
        last_login: null,
        is_active: true
      };
      users.push(user);
      return user;
    },
    async updateLastLogin(userId, lastLogin) {
      const user = users.find((item) => item.id === userId);
      if (user) user.last_login = lastLogin;
    },
    async createSession(session) {
      sessions.push(session);
      return session;
    },
    async findSessionByJti(jti) {
      return sessions.find((session) => session.token_jti === jti) ?? null;
    },
    async revokeSession(jti, revokedAt) {
      const session = sessions.find((item) => item.token_jti === jti);
      if (session) session.revoked_at = revokedAt;
    },
    async findRecentLoginFailures(ipAddress, since) {
      return failures.filter((failure) => failure.ip_address === ipAddress && new Date(failure.created_at) >= new Date(since));
    },
    async recordLoginFailure({ ipAddress, email, createdAt }) {
      failures.push({ ip_address: ipAddress, email, created_at: createdAt });
    },
    async clearLoginFailures(ipAddress) {
      for (let index = failures.length - 1; index >= 0; index -= 1) {
        if (failures[index].ip_address === ipAddress) failures.splice(index, 1);
      }
    }
  };
}

function listResource(userId, resource) {
  const key = `${userId}:${resource}`;
  if (!resourceData.has(key)) resourceData.set(key, []);
  return resourceData.get(key);
}

function normalizeTitle(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : "Untitled";
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeTeamRole(value) {
  return ["admin", "member", "viewer"].includes(value) ? value : "member";
}

function normalizeMemberLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : 10;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "team";
}

function uniqueTeamSlug(baseSlug) {
  let slug = baseSlug;
  let suffix = 2;
  while (Array.from(teams.values()).some((team) => team.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function listTeamsForUser(userId) {
  return Array.from(teams.values())
    .map((team) => {
      const member = (teamMembers.get(team.id) ?? []).find((item) => item.userId === userId);
      return member ? toTeamSummary(team, member.role) : null;
    })
    .filter(Boolean);
}

function getTeamContextBySlug(slug, userId) {
  const team = Array.from(teams.values()).find((item) => item.slug === slug);
  if (!team) return null;
  const member = (teamMembers.get(team.id) ?? []).find((item) => item.userId === userId);
  return member ? { team, member } : null;
}

function listTeamMembers(teamId) {
  return teamMembers.get(teamId) ?? [];
}

function toTeamSummary(team, role) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    ownerId: team.ownerId,
    memberLimit: team.memberLimit,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    role
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
