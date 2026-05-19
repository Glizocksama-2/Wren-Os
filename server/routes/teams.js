import { requireTeamRole } from "../middleware/requireTeamRole.js";
import { createTeamInvitesRouter } from "./teamInvites.js";
import { createTeamMembersRouter } from "./teamMembers.js";

export function createTeamsRouter({ express, db, mailer }) {
  const router = express.Router();

  router.post("/", async (request, response) => {
    const input = sanitizeTeamInput(request.body);
    if (!input.name) {
      response.status(400).json({ error: "Team name is required." });
      return;
    }

    try {
      const team = await db.createTeam({
        name: input.name,
        slug: input.slug || slugify(input.name),
        ownerId: request.userId,
        memberLimit: input.memberLimit
      });
      response.status(201).json({ team });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.get("/mine", async (request, response) => {
    const teams = await db.listTeamsForUser(request.userId);
    response.json({ teams });
  });

  router.get("/:slug", async (request, response) => {
    const details = await db.getTeamDetailsBySlug(request.params.slug, request.userId);
    if (!details) {
      response.status(404).json({ error: "Team not found." });
      return;
    }
    response.json(details);
  });

  router.patch("/:slug", requireTeamRole({ db, minRole: "admin" }), async (request, response) => {
    const input = sanitizeTeamInput(request.body);
    try {
      const team = await db.updateTeam(request.team.id, input);
      response.json({ team });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.delete("/:slug", requireTeamRole({ db, minRole: "owner" }), async (request, response) => {
    await db.deleteTeam(request.team.id);
    response.status(204).end();
  });

  router.use("/:slug/members", createTeamMembersRouter({ express, db }));
  router.use("/:slug/invites", createTeamInvitesRouter({ express, db, mailer }));

  return router;
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeTeamInput(body) {
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const slug = typeof body?.slug === "string" ? slugify(body.slug) : "";
  const memberLimitValue = Number(body?.memberLimit);
  const memberLimit = Number.isFinite(memberLimitValue) ? Math.min(100, Math.max(1, Math.round(memberLimitValue))) : 10;
  return { name, slug, memberLimit };
}
