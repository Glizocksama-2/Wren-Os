import { v4 as uuidv4 } from "uuid";
import { requireTeamRole } from "../middleware/requireTeamRole.js";
import { normalizeTeamRole } from "../teamPermissions.js";

const INVITE_EXPIRES_MS = 48 * 60 * 60 * 1000;

export function createTeamInvitesRouter({ express, db, mailer, appBaseUrl = process.env.NORTHWATCH_APP_URL ?? "" }) {
  const router = express.Router({ mergeParams: true });
  const requireAdmin = requireTeamRole({ db, minRole: "admin" });

  router.post("/", requireAdmin, async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    const role = normalizeInviteRole(request.body?.role);
    if (!email) {
      response.status(400).json({ error: "Invite email is required." });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_MS).toISOString();
    try {
      const invite = await db.createTeamInvite({
        teamId: request.team.id,
        email,
        role,
        token,
        invitedBy: request.userId,
        expiresAt
      });
      const acceptUrl = buildInviteUrl(resolveInviteBaseUrl(request, appBaseUrl), invite.token ?? token);
      const emailDelivery = await sendInviteEmailSafely(mailer, {
        to: email,
        teamName: invite.teamName ?? request.team.name,
        inviterName: invite.invitedByName ?? request.user?.displayName ?? request.user?.email ?? "Northwatch",
        role,
        acceptUrl
      });
      response.status(201).json({ invite: { ...invite, acceptUrl, emailDelivery } });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.get("/", requireAdmin, async (request, response) => {
    const inviteBaseUrl = resolveInviteBaseUrl(request, appBaseUrl);
    const invites = (await db.listTeamInvites(request.team.id, request.userId)).map((invite) => ({
      ...invite,
      acceptUrl: invite.token ? buildInviteUrl(inviteBaseUrl, invite.token) : null
    }));
    response.json({ invites });
  });

  router.delete("/:inviteId", requireAdmin, async (request, response) => {
    const revoked = await db.revokeTeamInvite({
      teamId: request.team.id,
      inviteId: request.params.inviteId,
      revokedBy: request.userId
    });
    if (!revoked) {
      response.status(404).json({ error: "Invite not found." });
      return;
    }
    response.status(204).end();
  });

  return router;
}

export function createInviteAcceptRouter({ express, db, authenticate }) {
  const router = express.Router({ mergeParams: true });

  router.get("/:token", async (request, response) => {
    if (!isUuid(request.params.token)) {
      response.status(404).json({ error: "Invite not found." });
      return;
    }
    const invite = await db.getTeamInviteByToken(request.params.token);
    if (!invite) {
      response.status(404).json({ error: "Invite not found." });
      return;
    }
    response.json({ invite: serializeInvitePreview(invite) });
  });

  router.post("/:token/accept", authenticate, async (request, response) => {
    if (!isUuid(request.params.token)) {
      response.status(404).json({ error: "Invite not found." });
      return;
    }
    try {
      const accepted = await db.acceptTeamInvite({
        token: request.params.token,
        userId: request.userId,
        userEmail: request.user?.email
      });
      response.json(accepted);
    } catch (error) {
      response.status(error.status ?? 400).json({ error: error.message });
    }
  });

  return router;
}

export function buildInviteUrl(appBaseUrl, token) {
  return `${String(appBaseUrl).replace(/\/$/, "")}/invite/${encodeURIComponent(token)}`;
}

export function resolveInviteBaseUrl(request, appBaseUrl) {
  const configuredBaseUrl = String(appBaseUrl ?? "").trim();
  if (configuredBaseUrl) return configuredBaseUrl;

  const origin = request.get?.("origin");
  if (isHttpUrl(origin)) return origin;

  const host = request.get?.("x-forwarded-host") ?? request.get?.("host");
  if (host) {
    const forwardedProto = request.get?.("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || request.protocol || "https";
    return `${protocol}://${host}`;
  }

  return "http://localhost:5173";
}

function normalizeEmailDelivery(result) {
  const delivered = Boolean(result?.delivered);
  const logged = Boolean(result?.logged);
  return {
    delivered,
    logged,
    reason: result?.reason ?? (delivered ? "sent" : logged ? "not_configured" : "unknown")
  };
}

async function sendInviteEmailSafely(mailer, payload) {
  try {
    return normalizeEmailDelivery(await mailer.sendTeamInvite(payload));
  } catch {
    return {
      delivered: false,
      logged: false,
      reason: "send_failed",
      error: "Email delivery failed."
    };
  }
}

function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

function serializeInvitePreview(invite) {
  return {
    id: invite.id,
    teamName: invite.team?.name ?? invite.teamName,
    teamSlug: invite.team?.slug ?? invite.teamSlug,
    inviterName: invite.inviter?.displayName ?? invite.invitedByName ?? "A Northwatch admin",
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt ?? invite.expires_at,
    recipientExists: invite.recipientExists ?? null
  };
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeInviteRole(value) {
  const role = normalizeTeamRole(value);
  return role === "owner" ? "member" : role;
}
