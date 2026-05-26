import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Vite local API proxy", () => {
  it("proxies Northwatch API routes to the local Express server", () => {
    const configSource = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(configSource).toContain('"/api": "http://127.0.0.1:4000"');
    expect(configSource).toContain('"/auth": "http://127.0.0.1:4000"');
    expect(configSource).toContain('"/health": "http://127.0.0.1:4000"');
  });
});
