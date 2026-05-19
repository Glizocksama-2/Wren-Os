const ALLOWED_TABLES = new Map([
  ["kanban-cards", "kanban_cards"],
  ["projects", "projects"],
  ["content-queue", "content_queue"],
  ["documents", "documents"],
  ["activity-feed", "activity_feed"],
  ["agent-configs", "agent_configs"],
  ["api-tokens", "api_tokens"]
]);

export function createUserDataRouter({ express, db }) {
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

  router.get("/:resource", async (request, response) => {
    const rows = await db.list(request.userDataTable, request.userId);
    response.json({ data: rows });
  });

  router.post("/:resource", async (request, response) => {
    const payload = sanitizePayload(request.body);
    const created = await db.create(request.userDataTable, request.userId, payload);
    response.status(201).json({ data: created });
  });

  router.patch("/:resource/:id", async (request, response) => {
    const payload = sanitizePayload(request.body);
    const updated = await db.update(request.userDataTable, request.userId, request.params.id, payload);
    if (!updated) {
      response.status(404).json({ error: "Record not found." });
      return;
    }
    response.json({ data: updated });
  });

  router.delete("/:resource/:id", async (request, response) => {
    const deleted = await db.delete(request.userDataTable, request.userId, request.params.id);
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
  const { user_id: _ignoredUserId, userId: _ignoredUserIdCamel, id: _ignoredId, title: _ignoredTitle, ...rest } = body && typeof body === "object" ? body : {};
  return {
    title: title || "Untitled",
    payload: rest
  };
}
