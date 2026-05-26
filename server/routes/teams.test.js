import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createTeamsRouter } from "./teams.js";

describe("team routes", () => {
  it("creates a team and auto-assigns the creator as owner", async () => {
    const db = createTeamDb();
    db.createTeam.mockResolvedValue({
      id: "team-1",
      name: "Birunda Farms",
      slug: "birunda-farms",
      ownerId: "user-1",
      memberLimit: 10,
      role: "owner",
      createdAt: "2026-05-19T12:00:00.000Z"
    });
    const app = createProtectedTeamApp({ db });

    const response = await request(app)
      .post("/api/teams")
      .set("Cookie", "northwatch_session=token")
      .send({ name: "Birunda Farms", slug: "birunda-farms", memberLimit: 10 })
      .expect(201);

    expect(response.body.team).toMatchObject({ name: "Birunda Farms", slug: "birunda-farms", role: "owner" });
    expect(db.createTeam).toHaveBeenCalledWith({
      name: "Birunda Farms",
      slug: "birunda-farms",
      ownerId: "user-1",
      memberLimit: 10
    });
  });

  it("lists the teams the signed-in user belongs to and returns a team's member roster", async () => {
    const db = createTeamDb();
    db.listTeamsForUser.mockResolvedValue([{ id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "member" }]);
    db.getTeamDetailsBySlug.mockResolvedValue({
      team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", memberLimit: 10, role: "member" },
      members: [{ userId: "user-1", displayName: "Sam", email: "sam@northwatch.dev", role: "member", joinedAt: "2026-05-19T12:00:00.000Z" }]
    });
    const app = createProtectedTeamApp({ db });

    const mine = await request(app).get("/api/teams/mine").set("Cookie", "northwatch_session=token").expect(200);
    const details = await request(app).get("/api/teams/birunda-farms").set("Cookie", "northwatch_session=token").expect(200);

    expect(mine.body.teams).toEqual([{ id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "member" }]);
    expect(details.body.members[0]).toMatchObject({ displayName: "Sam", role: "member" });
    expect(db.getTeamDetailsBySlug).toHaveBeenCalledWith("birunda-farms", "user-1");
  });

  it("returns JSON when team details fail instead of leaking an HTML Express error", async () => {
    const db = createTeamDb();
    db.getTeamDetailsBySlug.mockRejectedValue(new Error("activity feed relation is missing"));
    const app = createProtectedTeamApp({ db });

    const response = await request(app)
      .get("/api/teams/birunda-farms")
      .set("Cookie", "northwatch_session=token")
      .expect(500)
      .expect("content-type", /json/);

    expect(response.body.error).toBe("activity feed relation is missing");
  });

  it("returns JSON when team listing fails instead of leaking an HTML Express error", async () => {
    const db = createTeamDb();
    db.listTeamsForUser.mockRejectedValue(new Error("team membership table is missing"));
    const app = createProtectedTeamApp({ db });

    const response = await request(app)
      .get("/api/teams/mine")
      .set("Cookie", "northwatch_session=token")
      .expect(500)
      .expect("content-type", /json/);

    expect(response.body.error).toBe("team membership table is missing");
  });

  it("lets admins update settings but reserves team deletion for owners", async () => {
    const db = createTeamDb();
    db.getTeamMembershipBySlug
      .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "admin" } })
      .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "admin" } })
      .mockResolvedValueOnce({ team: { id: "team-1", slug: "birunda-farms" }, membership: { role: "owner" } });
    db.updateTeam.mockResolvedValue({ id: "team-1", name: "Birunda Ops", slug: "birunda-ops", memberLimit: 12 });
    const app = createProtectedTeamApp({ db });

    await request(app)
      .patch("/api/teams/birunda-farms")
      .set("Cookie", "northwatch_session=token")
      .send({ name: "Birunda Ops", slug: "birunda-ops", memberLimit: 12 })
      .expect(200);
    await request(app).delete("/api/teams/birunda-farms").set("Cookie", "northwatch_session=token").expect(403);
    await request(app).delete("/api/teams/birunda-farms").set("Cookie", "northwatch_session=token").expect(204);

    expect(db.updateTeam).toHaveBeenCalledWith("team-1", { name: "Birunda Ops", slug: "birunda-ops", memberLimit: 12 }, "user-1");
    expect(db.deleteTeam).toHaveBeenCalledWith("team-1", "user-1");
  });
});

function createProtectedTeamApp({ db }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/teams",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1", displayName: "Sam" } } : null)
      }
    }),
    createTeamsRouter({ express, db, mailer: { sendTeamInvite: vi.fn() } })
  );
  return app;
}

function createTeamDb() {
  return {
    createTeam: vi.fn(),
    listTeamsForUser: vi.fn(),
    getTeamDetailsBySlug: vi.fn(),
    getTeamMembershipBySlug: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    listTeamMembers: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    removeTeamMember: vi.fn(),
    createTeamInvite: vi.fn(),
    listTeamInvites: vi.fn(),
    revokeTeamInvite: vi.fn()
  };
}
