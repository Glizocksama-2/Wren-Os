import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createTelegramRouter } from "./telegram.js";

const TELEGRAM_SECRET_KEY = "test-telegram-secret-key-with-32-chars";

describe("telegram routes", () => {
  it("protects Telegram configuration routes", async () => {
    const app = createProtectedTelegramApp({
      db: createTelegramDb(),
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    await request(app).get("/api/telegram/config").expect(401);
  });

  it("stores an encrypted bot token scoped to the authenticated user", async () => {
    const db = createTelegramDb();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: { username: "northwatch_test_bot" } }));
    const app = createProtectedTelegramApp({
      db,
      fetchImpl,
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    const response = await request(app)
      .post("/api/telegram/config")
      .set("Cookie", "northwatch_session=token")
      .send({
        user_id: "attacker",
        botToken: "123456:ABCdef_token",
        chatId: "987654321"
      })
      .expect(200);

    expect(response.body).toMatchObject({
      configured: true,
      botUsername: "northwatch_test_bot",
      chatId: "******321"
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.telegram.org/bot123456:ABCdef_token/getMe");
    expect(db.upsertTelegramConfig).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        provider: "telegram",
        chatId: "987654321",
        botUsername: "northwatch_test_bot",
        botToken: expect.objectContaining({
          encrypted: expect.any(String),
          iv: expect.any(String),
          tag: expect.any(String)
        })
      })
    );
    expect(db.upsertTelegramConfig.mock.calls[0][1].botToken.encrypted).not.toContain("ABCdef_token");
  });

  it("sends alerts through the authenticated user's saved bot", async () => {
    const db = createTelegramDb();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: { username: "northwatch_test_bot" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 44 } }));
    const app = createProtectedTelegramApp({
      db,
      fetchImpl,
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    await request(app)
      .post("/api/telegram/config")
      .set("Cookie", "northwatch_session=token")
      .send({ botToken: "123456:ABCdef_token", chatId: "987654321" })
      .expect(200);

    await request(app)
      .post("/api/telegram/send")
      .set("Cookie", "northwatch_session=token")
      .send({ kind: "kanban-card", title: "Ship ops panel", body: "Priority: urgent", meta: "Northwatch" })
      .expect(200);

    expect(fetchImpl).toHaveBeenLastCalledWith(
      "https://api.telegram.org/bot123456:ABCdef_token/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("\"chat_id\":\"987654321\"")
      })
    );
  });

  it("removes only the authenticated user's Telegram configuration", async () => {
    const db = createTelegramDb();
    const app = createProtectedTelegramApp({
      db,
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    await request(app).delete("/api/telegram/config").set("Cookie", "northwatch_session=token").expect(204);

    expect(db.deleteTelegramConfig).toHaveBeenCalledWith("user-1");
  });
});

function createProtectedTelegramApp({ db, fetchImpl, verified }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/telegram",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? verified : null)
      }
    }),
    createTelegramRouter({
      express,
      db,
      fetchImpl: fetchImpl ?? vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: { username: "northwatch_test_bot" } })),
      secretKey: TELEGRAM_SECRET_KEY
    })
  );
  return app;
}

function createTelegramDb() {
  const store = new Map();
  return {
    getTelegramConfig: vi.fn(async (userId) => store.get(userId) ?? null),
    upsertTelegramConfig: vi.fn(async (userId, payload) => {
      store.set(userId, { id: "telegram-config-1", title: "telegram_bot", payload });
      return store.get(userId);
    }),
    deleteTelegramConfig: vi.fn(async (userId) => store.delete(userId))
  };
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body
  };
}
