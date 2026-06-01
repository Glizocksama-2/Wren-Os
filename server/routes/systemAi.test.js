import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createSystemAiRouter } from "./systemAi.js";

describe("system AI routes", () => {
  it("requires an authenticated cookie before proxying Copilot prompts", async () => {
    const service = createService();
    const app = createProtectedApp({ service, verified: null });

    await request(app).post("/api/system-ai/chat").send({ message: "Brief me" }).expect(401);

    expect(service.chat).not.toHaveBeenCalled();
  });

  it("proxies authenticated Sentinel prompts to the system AI service", async () => {
    const service = createService();
    const app = createProtectedApp({
      service,
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    const response = await request(app)
      .post("/api/system-ai/chat")
      .set("Cookie", "northwatch_session=token")
      .send({
        message: "Brief me",
        context: "Northwatch deck snapshot",
        conversationId: "conv-0"
      })
      .expect(200);

    expect(response.body).toEqual({ reply: "Use the calm plan.", conversationId: "conv-1", provider: "copilot5" });
    expect(service.chat).toHaveBeenCalledWith({
      userId: "user-1",
      message: "Brief me",
      context: "Northwatch deck snapshot",
      conversationId: "conv-0"
    });
  });
});

function createProtectedApp({ service, verified }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/system-ai",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? verified : null)
      }
    }),
    createSystemAiRouter({ express, service })
  );
  return app;
}

function createService() {
  return {
    chat: vi.fn(async () => ({ reply: "Use the calm plan.", conversationId: "conv-1", provider: "copilot5" }))
  };
}
