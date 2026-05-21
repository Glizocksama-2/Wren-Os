import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeProxyRequestUrl } from "../../api/[...path].js";
import healthHandler from "../../api/health.js";

const projectRoot = process.cwd();
const originalCopilotKey = process.env.RAPIDAPI_COPILOT_KEY;

afterEach(() => {
  if (originalCopilotKey === undefined) {
    delete process.env.RAPIDAPI_COPILOT_KEY;
  } else {
    process.env.RAPIDAPI_COPILOT_KEY = originalCopilotKey;
  }
});

describe("Vercel auth routing", () => {
  it("routes credential auth requests to a serverless Express API instead of the React shell", () => {
    const vercelConfig = JSON.parse(readFileSync(join(projectRoot, "vercel.json"), "utf8"));

    expect(vercelConfig.rewrites).toContainEqual({
      source: "/auth/:path*",
      destination: "/api/auth/:path*"
    });
    expect(existsSync(join(projectRoot, "api", "[...path].js"))).toBe(true);
  });

  it("routes dynamic API prefixes through the Express catch-all before the React shell", () => {
    const vercelConfig = JSON.parse(readFileSync(join(projectRoot, "vercel.json"), "utf8"));

    expect(vercelConfig.rewrites).toContainEqual({
      source: "/api/:path*",
      destination: "/api/[...path]?path=:path*"
    });
  });

  it("publishes concrete Vercel auth functions for the routes used by the client", () => {
    for (const route of ["login", "logout", "me", "refresh", "register"]) {
      expect(existsSync(join(projectRoot, "api", "auth", `${route}.js`))).toBe(true);
    }
  });

  it("publishes the legacy cloud import API as a concrete Vercel function", () => {
    expect(existsSync(join(projectRoot, "api", "legacy-command-deck.js"))).toBe(true);
  });

  it("reports Copilot status from the concrete Vercel health function", () => {
    process.env.RAPIDAPI_COPILOT_KEY = "server-secret";
    const response = createJsonResponse();

    healthHandler({}, response);

    expect(response.statusCode).toBe(200);
    expect(response.payload.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copilot",
          status: "idle",
          detail: "Copilot system AI is configured."
        })
      ])
    );
  });

  it("restores the original API path after the Vercel catch-all rewrite", () => {
    const request = {
      headers: { host: "northwatch.test" },
      url: "/api/[...path]?path=teams/birunda-farms/invites&status=pending"
    };

    expect(normalizeProxyRequestUrl(request)).toBe("/api/teams/birunda-farms/invites?status=pending");
    expect(request.url).toBe("/api/teams/birunda-farms/invites?status=pending");
  });
});

function createJsonResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}
