import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createLegacyCommandDeckRouter } from "./legacyCommandDeck.js";

describe("legacy command deck route", () => {
  it("returns the legacy Supabase deck for the authenticated user's email", async () => {
    const db = {
      findLegacyCommandDeckByEmail: vi.fn(async () => ({
        deck: { tasks: [{ title: "Recovered task" }] },
        updated_at: "2026-05-19T13:59:20.008Z"
      }))
    };
    const app = createApp(db, { email: "Operator@Northwatch.dev" });

    const response = await request(app).get("/api/legacy-command-deck").expect(200);

    expect(db.findLegacyCommandDeckByEmail).toHaveBeenCalledWith("operator@northwatch.dev");
    expect(response.body.deck.tasks[0].title).toBe("Recovered task");
    expect(response.body.updatedAt).toBe("2026-05-19T13:59:20.008Z");
  });

  it("returns empty content when there is no legacy deck", async () => {
    const db = {
      findLegacyCommandDeckByEmail: vi.fn(async () => null)
    };
    const app = createApp(db, { email: "operator@northwatch.dev" });

    await request(app).get("/api/legacy-command-deck").expect(204);
  });
});

function createApp(db, user) {
  const app = express();
  app.use((request, _response, next) => {
    request.user = user;
    next();
  });
  app.use("/api/legacy-command-deck", createLegacyCommandDeckRouter({ express, db }));
  return app;
}
