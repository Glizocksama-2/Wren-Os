import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTeamApiBaseUrl, teamRequest } from "./teamApi.js";

describe("team API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults localhost team API calls to the local Express API", () => {
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "", location: { hostname: "127.0.0.1" } })).toBe("http://127.0.0.1:4000");
  });

  it("routes Vite dev hosts on a LAN to the Express API instead of the frontend shell", () => {
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "", location: { protocol: "http:", hostname: "192.168.1.44", port: "5173" } })).toBe("http://192.168.1.44:4000");
  });

  it("routes private-network browser hosts to the same machine's Express API", () => {
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "", location: { protocol: "http:", hostname: "192.168.1.44", port: "" } })).toBe("http://192.168.1.44:4000");
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "", location: { protocol: "http:", hostname: "10.0.0.12", port: "8080" } })).toBe("http://10.0.0.12:4000");
  });

  it("rewrites loopback API env URLs when the app is opened from a private-network host", () => {
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "http://127.0.0.1:4000", location: { protocol: "http:", hostname: "192.168.1.44", port: "5173" } })).toBe("http://192.168.1.44:4000");
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "http://localhost:4000", location: { protocol: "http:", hostname: "10.0.0.12", port: "5173" } })).toBe("http://10.0.0.12:4000");
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "http://127.0.0.1:4000", location: { protocol: "http:", hostname: "192.168.1.44", port: "" } })).toBe("http://192.168.1.44:4000");
  });

  it("normalizes an accidental Vite frontend API base URL to the Express API port", () => {
    expect(resolveTeamApiBaseUrl({ envBaseUrl: "http://192.168.1.44:5173", location: { protocol: "http:", hostname: "192.168.1.44", port: "5173" } })).toBe("http://192.168.1.44:4000");
  });

  it("keeps JSON error messages from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Invite email does not match this account." })
    }));

    await expect(teamRequest("/api/invites/invite-token/accept")).rejects.toThrow("Invite email does not match this account.");
  });

  it("explains when a team route returns the frontend app instead of JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
      text: async () => "<!doctype html><html><body>Northwatch</body></html>"
    }));

    await expect(teamRequest("/api/teams")).rejects.toThrow(/returned the frontend app/i);
  });

  it("keeps non-JSON API error bodies instead of hiding them behind a generic 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers({ "content-type": "text/plain" }),
      json: async () => {
        throw new SyntaxError("Unexpected token d in JSON");
      },
      text: async () => "database policy rejected team insert"
    }));

    await expect(teamRequest("/api/teams")).rejects.toThrow("database policy rejected team insert");
  });
});
