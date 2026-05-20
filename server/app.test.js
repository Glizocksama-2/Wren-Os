import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("northwatch app shell", () => {
  it("serves a helpful root page instead of Express Cannot GET", async () => {
    const app = createApp({ skipDatabase: true, authService: createAuthService() });

    const response = await request(app).get("/").expect(200).expect("content-type", /html/);

    expect(response.text).toContain("Northwatch API is running");
    expect(response.text).toContain("/health");
    expect(response.text).toContain("http://127.0.0.1:5173");
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
