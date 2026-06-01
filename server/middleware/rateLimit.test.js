import { describe, expect, it, vi } from "vitest";
import { createMemoryRateLimitStore, createRateLimitMiddleware } from "./rateLimit.js";

describe("rate limit middleware", () => {
  it("allows requests inside the route group limit", async () => {
    const store = createMemoryRateLimitStore({ now: () => new Date("2026-06-01T09:00:00.000Z") });
    const middleware = createRateLimitMiddleware({
      store,
      rules: { auth: { limit: 2, windowMs: 60_000 } },
      resolveRule: () => "auth",
      now: () => new Date("2026-06-01T09:00:00.000Z")
    });
    const response = createResponse();
    const next = vi.fn();

    await middleware(createRequest(), response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "2");
    expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
  });

  it("returns 429 with retry metadata once the route group limit is exceeded", async () => {
    const store = createMemoryRateLimitStore({ now: () => new Date("2026-06-01T09:00:00.000Z") });
    const middleware = createRateLimitMiddleware({
      store,
      rules: { auth: { limit: 1, windowMs: 60_000 } },
      resolveRule: () => "auth",
      now: () => new Date("2026-06-01T09:00:00.000Z")
    });
    const next = vi.fn();

    await middleware(createRequest(), createResponse(), next);
    const blockedResponse = createResponse();
    await middleware(createRequest(), blockedResponse, next);

    expect(blockedResponse.setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith({
      error: "Too many requests. Please retry shortly.",
      requestId: "req-test",
      retryAfterSeconds: 60
    });
  });
});

function createRequest() {
  return {
    ip: "203.0.113.10",
    method: "POST",
    path: "/auth/login",
    requestId: "req-test",
    headers: {},
    get: () => "vitest"
  };
}

function createResponse() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(() => response),
    json: vi.fn(() => response)
  };
  return response;
}
