import { roleMeetsMinimum } from "../teamPermissions.js";

export function requireTeamRole({ db, minRole = "viewer" }) {
  if (!db) throw new Error("requireTeamRole middleware requires a team database adapter.");

  return async function requireTeamRoleMiddleware(request, response, next) {
    const slug = String(request.params.slug ?? "").trim();
    if (!slug) {
      response.status(400).json({ error: "Team slug is required." });
      return;
    }

    try {
      const context = await db.getTeamMembershipBySlug(slug, request.userId);
      if (!context?.team || !context?.membership) {
        response.status(404).json({ error: "Team not found." });
        return;
      }

      if (!roleMeetsMinimum(context.membership.role, minRole)) {
        response.status(403).json({ error: "Team role does not allow this action." });
        return;
      }

      request.team = context.team;
      request.teamRole = context.membership.role;
      next();
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message ?? "Team role check failed." });
    }
  };
}
