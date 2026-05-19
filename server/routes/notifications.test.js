import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createNotificationsRouter } from "./notifications.js";

describe("notification routes", () => {
  it("lists unread notifications and marks every notification as read for the signed-in user", async () => {
    const db = {
      listNotifications: vi.fn().mockResolvedValue([
        {
          id: "note-1",
          userId: "user-1",
          type: "team_invite_accepted",
          message: "Your invite to brian@example.com was accepted",
          link: "/team/birunda-farms",
          isRead: false,
          createdAt: "2026-05-19T12:00:00.000Z"
        }
      ]),
      markAllNotificationsRead: vi.fn().mockResolvedValue(1)
    };
    const app = createProtectedNotificationApp({ db });

    const list = await request(app).get("/api/notifications").set("Cookie", "northwatch_session=token").expect(200);
    const marked = await request(app).post("/api/notifications/read-all").set("Cookie", "northwatch_session=token").expect(200);

    expect(list.body.unreadCount).toBe(1);
    expect(list.body.notifications[0].message).toContain("accepted");
    expect(marked.body).toEqual({ updated: 1 });
    expect(db.listNotifications).toHaveBeenCalledWith("user-1");
    expect(db.markAllNotificationsRead).toHaveBeenCalledWith("user-1");
  });
});

function createProtectedNotificationApp({ db }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/notifications",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1" } } : null)
      }
    }),
    createNotificationsRouter({ express, db })
  );
  return app;
}
