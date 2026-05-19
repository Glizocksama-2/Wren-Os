import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("Vercel auth routing", () => {
  it("routes auth requests to the Express API before the SPA fallback", () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, "vercel.json"), "utf8"));
    const authRewriteIndex = vercelConfig.rewrites.findIndex((rewrite) => rewrite.source === "/auth/:path*");
    const spaRewriteIndex = vercelConfig.rewrites.findIndex((rewrite) => rewrite.source === "/(.*)");

    expect(authRewriteIndex).toBeGreaterThan(-1);
    expect(vercelConfig.rewrites[authRewriteIndex].destination).toBe("/api/auth/:path*");
    expect(spaRewriteIndex).toBeGreaterThan(authRewriteIndex);
  });

  it("has a Vercel serverless catch-all for Express API routes", () => {
    expect(fs.existsSync(path.join(rootDir, "api", "[...path].js"))).toBe(true);
  });

  it("publishes concrete Vercel auth functions for the routes used by the client", () => {
    for (const route of ["login", "logout", "me", "refresh", "register"]) {
      expect(fs.existsSync(path.join(rootDir, "api", "auth", `${route}.js`))).toBe(true);
    }
  });

  it("publishes the legacy cloud import API as a concrete Vercel function", () => {
    expect(fs.existsSync(path.join(rootDir, "api", "legacy-command-deck.js"))).toBe(true);
  });
});
