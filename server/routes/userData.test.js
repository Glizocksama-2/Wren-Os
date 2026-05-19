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
    expect(db.list).toHaveBeenCalledWith("projects", "user-1");
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
      payload: { priority: "urgent" }
    });
  });
});

function createProtectedApp({ db, verified }) {
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
    createUserDataRouter({ express, db })
  );
  return app;
}
