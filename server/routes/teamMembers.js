import { normalizeTeamRole, roleMeetsMinimum } from "../teamPermissions.js";
import { requireTeamRole } from "../middleware/requireTeamRole.js";

export function createTeamMembersRouter({ express, db }) {
  const router = express.Router({ mergeParams: true });

  router.get("/", requireTeamRole({ db, minRole: "viewer" }), async (request, response) => {
    const members = await db.listTeamMembers(request.team.id, request.userId);
    response.json({ members });
  });

  router.patch("/:userId/role", requireTeamRole({ db, minRole: "admin" }), async (request, response) => {
    const role = normalizeTeamRole(request.body?.role);
    if (!["admin", "member", "viewer", "owner"].includes(role)) {
      response.status(400).json({ error: "Invalid team role." });
      return;
    }

    try {
      const member = await db.updateTeamMemberRole({
        teamId: request.team.id,
        actorUserId: request.userId,
        targetUserId: request.params.userId,
        role
      });
      response.json({ member });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.delete("/:userId", requireRemovePermission({ db }), async (request, response) => {
    try {
      const result = await db.removeTeamMember({
        teamId: request.team.id,
        actorUserId: request.userId,
        targetUserId: request.params.userId
      });

      if (result?.removed === false && result.reason === "owner_protected") {
        response.status(409).json({ error: "The team owner cannot be removed." });
        return;
      }

      response.status(204).end();
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  return router;
}

function requireRemovePermission({ db }) {
  return async function removePermission(request, response, next) {
    const slug = String(request.params.slug ?? "").trim();
    const context = await db.getTeamMembershipBySlug(slug, request.userId);
    if (!context?.team || !context?.membership) {
      response.status(404).json({ error: "Team not found." });
      return;
    }

    const isSelfRemoval = request.params.userId === request.userId;
    if (!isSelfRemoval && !roleMeetsMinimum(context.membership.role, "admin")) {
      response.status(403).json({ error: "Team role does not allow this action." });
      return;
    }

    request.team = context.team;
    request.teamRole = context.membership.role;
    next();
  };
}
