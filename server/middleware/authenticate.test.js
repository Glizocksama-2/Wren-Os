import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate } from "./authenticate.js";

describe("authenticate middleware", () => {
  it("returns 401 and clears the auth cookie when a token is missing", async () => {
    const app = express();
    app.use(cookieParser());
    app.get("/private", authenticate({ authService: { verifyRequest: async () => null } }), (_request, response) => response.json({ ok: true }));

    const response = await request(app).get("/private").expect(401);

    expect(response.body).toEqual({ error: "Authentication required." });
    expect(response.headers["set-cookie"].join(";")).toContain("northwatch_session=;");
  });

  it("attaches user identity from a verified JWT session", async () => {
    const app = express();
    app.use(cookieParser());
    app.get(
      "/private",
      authenticate({
        authService: {
          verifyRequest: async () => ({
            userId: "user-1",
            sessionId: "session-1",
            user: { id: "user-1", email: "user@northwatch.dev", displayName: "User" }
          })
        }
      }),
      (request, response) => response.json({ userId: request.userId, user: request.user })
    );

    const response = await request(app).get("/private").set("Cookie", "northwatch_session=token").expect(200);

    expect(response.body).toEqual({
      userId: "user-1",
      user: { id: "user-1", email: "user@northwatch.dev", displayName: "User" }
    });
  });
});
