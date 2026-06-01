import { canTeamRole } from "../teamPermissions.js";

const ALLOWED_TABLES = new Map([
  ["kanban-cards", "kanban_cards"],
  ["projects", "projects"],
  ["content-queue", "content_queue"],
  ["documents", "documents"],
  ["activity-feed", "activity_feed"],
  ["agent-configs", "agent_configs"],
  ["api-tokens", "api_tokens"]
]);

const RESOURCE_PERMISSIONS = {
  kanban_cards: { create: "create_card", update: "edit_card", delete: "delete_card" },
  projects: { create: "create_project", update: "create_project", delete: "delete_project" },
  documents: { create: "create_doc", update: "create_doc", delete: "delete_doc" },
  content_queue: { create: "create_content", update: "create_content", delete: "delete_content" },
  activity_feed: { create: "create_card", update: "edit_card", delete: "delete_card" },
  agent_configs: { create: "edit_team_settings", update: "edit_team_settings", delete: "edit_team_settings" },
  api_tokens: { create: "edit_team_settings", update: "edit_team_settings", delete: "edit_team_settings" }
};

export function createUserDataRouter({ express, db, teamDb = null }) {
  const router = express.Router();

  router.param("resource", (request, response, next, resource) => {
    const table = ALLOWED_TABLES.get(resource);
    if (!table) {
      response.status(404).json({ error: "Unknown resource." });
      return;
    }
    request.userDataTable = table;
    next();
  });

  router.use("/:resource", async (request, response, next) => {
    try {
      request.workspaceScope = await resolveWorkspaceScope(request, teamDb);
      next();
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.get("/:resource", async (request, response) => {
    const rows = await db.list(request.userDataTable, request.userId, { workspace: request.workspaceScope });
    response.json({ data: rows });
  });

  router.post("/:resource", async (request, response) => {
    if (!canMutate(request, "create")) {
      response.status(403).json({ error: "Team role does not allow this action." });
      return;
    }
    const payload = sanitizePayload(request.body);
    const created = await db.create(request.userDataTable, request.userId, { ...payload, workspace: request.workspaceScope });
    response.status(201).json({ data: created });
  });

  router.patch("/:resource/:id", async (request, response) => {
    if (!canMutate(request, "update")) {
      response.status(403).json({ error: "Team role does not allow this action." });
      return;
    }
    const payload = sanitizePayload(request.body);
    const updated = await db.update(request.userDataTable, request.userId, request.params.id, { ...payload, workspace: request.workspaceScope });
    if (!updated) {
      response.status(404).json({ error: "Record not found." });
      return;
    }
    response.json({ data: updated });
  });

  router.delete("/:resource/:id", async (request, response) => {
    if (!canMutate(request, "delete")) {
      response.status(403).json({ error: "Team role does not allow this action." });
      return;
    }
    const deleted = await db.delete(request.userDataTable, request.userId, request.params.id, { workspace: request.workspaceScope });
    if (!deleted) {
      response.status(404).json({ error: "Record not found." });
      return;
    }
    response.status(204).end();
  });

  return router;
}

function sanitizePayload(body) {
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 240) : "Untitled";
  const {
    user_id: _ignoredUserId,
    userId: _ignoredUserIdCamel,
    workspace_type: _ignoredWorkspaceType,
    workspaceType: _ignoredWorkspaceTypeCamel,
    team_id: _ignoredTeamId,
    teamId: _ignoredTeamIdCamel,
    id: _ignoredId,
    title: _ignoredTitle,
    ...rest
  } = body && typeof body === "object" ? body : {};
  return {
    title: title || "Untitled",
    payload: rest
  };
}

async function resolveWorkspaceScope(request, teamDb) {
  const workspaceType = request.query.workspace_type ?? request.query.workspaceType;
  const teamId = request.query.team_id ?? request.query.teamId;
  if (workspaceType !== "team") return { type: "personal" };

  if (!teamDb) {
    const error = new Error("Team workspace support is not configured.");
    error.status = 503;
    throw error;
  }

  const normalizedTeamId = typeof teamId === "string" ? teamId.trim() : "";
  if (!normalizedTeamId) {
    const error = new Error("Team id is required for team workspace access.");
    error.status = 400;
    throw error;
  }

  const context = await teamDb.getTeamMembershipById(normalizedTeamId, request.userId);
  if (!context?.team || !context?.membership) {
    const error = new Error("Team not found.");
    error.status = 404;
    throw error;
  }

  return { type: "team", teamId: context.team.id, role: context.membership.role };
}

function canMutate(request, action) {
  const workspace = request.workspaceScope;
  if (!workspace || workspace.type === "personal") return true;

  const permission = RESOURCE_PERMISSIONS[request.userDataTable]?.[action];
  return permission ? canTeamRole(workspace.role, permission) : false;
}
