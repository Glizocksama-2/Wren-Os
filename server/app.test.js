import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

describe("northwatch app shell", () => {
  it("serves a helpful root page instead of Express Cannot GET", async () => {
    const app = createApp({ skipDatabase: true, authService: createAuthService() });

    const response = await request(app).get("/").expect(200).expect("content-type", /html/);

    expect(response.text).toContain("Northwatch API is running");
    expect(response.text).toContain("/health");
    expect(response.text).toContain("http://127.0.0.1:5173");
  });

  it("returns JSON instead of an HTML shell for missing API routes", async () => {
    const app = createApp({ skipDatabase: true, authService: createAuthService() });

    const response = await request(app).get("/api/teams/gorosei").expect(404).expect("content-type", /json/);

    expect(response.body.error).toContain("Northwatch API route not found");
    expect(response.body.requestId).toMatch(/^req-/);
    expect(response.text).not.toContain("<!DOCTYPE html>");
  });

  it("returns JSON instead of an HTML error page for malformed API JSON", async () => {
    const app = createApp({ skipDatabase: true, authService: createAuthService() });

    const response = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(400)
      .expect("content-type", /json/);

    expect(response.body.error).toContain("Malformed JSON");
    expect(response.body.requestId).toMatch(/^req-/);
    expect(response.text).not.toContain("<!DOCTYPE html>");
  });

  it("adds a request id to responses and structured completion logs", async () => {
    const logs = [];
    const app = createApp({
      skipDatabase: true,
      authService: createAuthService(),
      logger: { info: (entry) => logs.push(entry), warn: vi.fn(), error: vi.fn() },
      requestIdFactory: () => "req-test-1"
    });

    const response = await request(app).get("/health").expect(200);

    expect(response.headers["x-request-id"]).toBe("req-test-1");
    expect(logs).toContainEqual(expect.objectContaining({
      event: "http_request",
      requestId: "req-test-1",
      method: "GET",
      path: "/health",
      statusCode: 200
    }));
  });

  it("checks database reachability on deep health checks", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [{ ok: 1 }] })) };
    const app = createApp({
      pool,
      authDb: null,
      userDataDb: null,
      teamDb: null,
      authService: createAuthService()
    });

    const response = await request(app).get("/health?deep=1").expect(200);

    expect(pool.query).toHaveBeenCalledWith("select 1 as ok");
    expect(response.body.checks.database.status).toBe("ok");
  });

  it("rate limits configured API groups with retry metadata", async () => {
    const rateLimitStore = {
      hit: vi.fn(async () => ({
        allowed: false,
        limit: 2,
        remaining: 0,
        retryAfterSeconds: 45,
        resetAt: "2026-06-01T09:01:00.000Z"
      }))
    };
    const app = createApp({ skipDatabase: true, authService: createAuthService(), rateLimitStore });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "operator@northwatch.dev", password: "Watchtower1" })
      .expect(429)
      .expect("Retry-After", "45");

    expect(response.body.error).toBe("Too many requests. Please retry shortly.");
    expect(response.body.requestId).toMatch(/^req-/);
    expect(response.body.retryAfterSeconds).toBe(45);
    expect(rateLimitStore.hit).toHaveBeenCalledWith(expect.objectContaining({
      routeGroup: "auth",
      limit: expect.any(Number),
      windowMs: expect.any(Number)
    }));
  });
});

function createAuthService() {
  return {
    verifyRequest: async () => null,
    logout: async () => undefined,
    refresh: async () => {
      throw new Error("Authentication required.");
    },
    register: async () => {
      throw new Error("Registration is unavailable in this test.");
    },
    login: async () => {
      throw new Error("Login is unavailable in this test.");
    }
  };
}
