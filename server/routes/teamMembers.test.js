import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createTeamMembersRouter } from "./teamMembers.js";

describe("team member routes", () => {
  it("lists members, changes roles for admins, and prevents removing the team owner", async () => {
    const db = {
      getTeamMembershipBySlug: vi
        .fn()
        .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "member" } })
        .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "admin" } })
        .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "admin" } }),
      listTeamMembers: vi.fn().mockResolvedValue([
        { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" },
        { userId: "user-2", displayName: "Brian", role: "member", joinedAt: "2026-05-19T12:01:00.000Z" }
      ]),
      updateTeamMemberRole: vi.fn().mockResolvedValue({ userId: "user-2", role: "admin" }),
      removeTeamMember: vi.fn().mockResolvedValue({ removed: false, reason: "owner_protected" })
    };
    const app = createProtectedMemberApp({ db });

    const members = await request(app).get("/api/teams/birunda-farms/members").set("Cookie", "northwatch_session=token").expect(200);
    await request(app)
      .patch("/api/teams/birunda-farms/members/user-2/role")
      .set("Cookie", "northwatch_session=token")
      .send({ role: "admin" })
      .expect(200);
    const removeOwner = await request(app).delete("/api/teams/birunda-farms/members/owner-1").set("Cookie", "northwatch_session=token").expect(409);

    expect(members.body.members).toHaveLength(2);
    expect(db.updateTeamMemberRole).toHaveBeenCalledWith({ teamId: "team-1", actorUserId: "user-1", targetUserId: "user-2", role: "admin" });
    expect(removeOwner.body.error).toBe("The team owner cannot be removed.");
  });
});

function createProtectedMemberApp({ db }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/teams/:slug/members",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1" } } : null)
      }
    }),
    createTeamMembersRouter({ express, db })
  );
  return app;
}
