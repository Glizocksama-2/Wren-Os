import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createUserDataRouter } from "./userData.js";

describe("user data routes", () => {
  it("protects resource routes and scopes reads by the authenticated user id", async () => {
    const db = {
      list: vi.fn().mockResolvedValue([{ id: "project-1", title: "Own project" }]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };
    const app = createProtectedApp({ db, verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } } });

    await request(app).get("/api/projects").expect(401);
    const response = await request(app).get("/api/projects").set("Cookie", "northwatch_session=token").expect(200);

    expect(response.body.data).toEqual([{ id: "project-1", title: "Own project" }]);
    expect(db.list).toHaveBeenCalledWith("projects", "user-1", { workspace: { type: "personal" } });
  });

  it("ignores user ids from request bodies when creating records", async () => {
    const db = {
      list: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "card-1", title: "Secure card" }),
      update: vi.fn(),
      delete: vi.fn()
    };
    const app = createProtectedApp({ db, verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } } });

    await request(app)
      .post("/api/kanban-cards")
      .set("Cookie", "northwatch_session=token")
      .send({ title: "Secure card", user_id: "attacker", userId: "attacker", id: "chosen-id", priority: "urgent" })
      .expect(201);

    expect(db.create).toHaveBeenCalledWith("kanban_cards", "user-1", {
      title: "Secure card",
      payload: { priority: "urgent" },
      workspace: { type: "personal" }
    });
  });

  it("injects team workspace scope after verifying membership instead of trusting user ids", async () => {
    const db = {
      list: vi.fn().mockResolvedValue([{ id: "project-1", title: "Shared project", teamId: "team-1" }]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };
    const teamDb = {
      getTeamMembershipById: vi.fn().mockResolvedValue({
        team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" },
        membership: { role: "member" }
      })
    };
    const app = createProtectedApp({ db, teamDb, verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } } });

    const response = await request(app)
      .get("/api/projects?workspace_type=team&team_id=team-1&user_id=attacker")
      .set("Cookie", "northwatch_session=token")
      .expect(200);

    expect(response.body.data).toEqual([{ id: "project-1", title: "Shared project", teamId: "team-1" }]);
    expect(teamDb.getTeamMembershipById).toHaveBeenCalledWith("team-1", "user-1");
    expect(db.list).toHaveBeenCalledWith("projects", "user-1", { workspace: { type: "team", teamId: "team-1", role: "member" } });
  });

  it("blocks viewer roles from mutating team workspace records", async () => {
    const db = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };
    const teamDb = {
      getTeamMembershipById: vi.fn().mockResolvedValue({
        team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" },
        membership: { role: "viewer" }
      })
    };
    const app = createProtectedApp({ db, teamDb, verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } } });

    const response = await request(app)
      .post("/api/kanban-cards?workspace_type=team&team_id=team-1")
      .set("Cookie", "northwatch_session=token")
      .send({ title: "Viewer should not create" })
      .expect(403);

    expect(response.body.error).toBe("Team role does not allow this action.");
    expect(db.create).not.toHaveBeenCalled();
  });
});

function createProtectedApp({ db, teamDb = null, verified }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? verified : null)
      }
    }),
    createUserDataRouter({ express, db, teamDb })
  );
  return app;
}
