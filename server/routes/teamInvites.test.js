import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createTeamInvitesRouter, createInviteAcceptRouter } from "./teamInvites.js";

describe("team invite routes", () => {
  it("creates pending invites, emails the accept link, lists them, and revokes by id", async () => {
    const mailer = { sendTeamInvite: vi.fn().mockResolvedValue({ delivered: true, logged: false }) };
    const db = {
      getTeamMembershipBySlug: vi
        .fn()
        .mockResolvedValue({ team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" }, membership: { role: "admin" } }),
      createTeamInvite: vi.fn().mockResolvedValue({
        id: "invite-1",
        teamId: "team-1",
        teamName: "Birunda Farms",
        email: "brian@example.com",
        token: "invite-token",
        role: "member",
        status: "pending",
        expiresAt: "2026-05-21T12:00:00.000Z",
        invitedByName: "Sam"
      }),
      listTeamInvites: vi.fn().mockResolvedValue([{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending" }]),
      revokeTeamInvite: vi.fn().mockResolvedValue(true)
    };
    const app = createInviteApp({ db, mailer });

    const created = await request(app)
      .post("/api/teams/birunda-farms/invites")
      .set("Cookie", "northwatch_session=token")
      .send({ email: " Brian@Example.com ", role: "member" })
      .expect(201);
    const pending = await request(app).get("/api/teams/birunda-farms/invites").set("Cookie", "northwatch_session=token").expect(200);
    await request(app).delete("/api/teams/birunda-farms/invites/invite-1").set("Cookie", "northwatch_session=token").expect(204);

    expect(created.body.invite.acceptUrl).toBe("https://northwatch.test/invite/invite-token");
    expect(created.body.invite.emailDelivery).toEqual({ delivered: true, logged: false, reason: "sent" });
    expect(pending.body.invites).toEqual([{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending" }]);
    expect(mailer.sendTeamInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "brian@example.com",
        acceptUrl: "https://northwatch.test/invite/invite-token",
        teamName: "Birunda Farms"
      })
    );
  });

  it("builds a production invite link from the request origin when no app base URL is configured", async () => {
    const mailer = { sendTeamInvite: vi.fn().mockResolvedValue({ delivered: false, logged: true }) };
    const db = {
      getTeamMembershipBySlug: vi
        .fn()
        .mockResolvedValue({ team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" }, membership: { role: "admin" } }),
      createTeamInvite: vi.fn().mockResolvedValue({
        id: "invite-1",
        teamId: "team-1",
        teamName: "Birunda Farms",
        email: "brian@example.com",
        token: "invite-token",
        role: "member",
        status: "pending",
        expiresAt: "2026-05-21T12:00:00.000Z",
        invitedByName: "Sam"
      })
    };
    const app = createInviteApp({ db, mailer, appBaseUrl: "" });

    const created = await request(app)
      .post("/api/teams/birunda-farms/invites")
      .set("Cookie", "northwatch_session=token")
      .set("Origin", "https://wren-os-henna-six.vercel.app")
      .send({ email: "Brian@Example.com", role: "member" })
      .expect(201);

    expect(created.body.invite.acceptUrl).toBe("https://wren-os-henna-six.vercel.app/invite/invite-token");
    expect(created.body.invite.emailDelivery).toEqual({ delivered: false, logged: true, reason: "not_configured" });
    expect(mailer.sendTeamInvite).toHaveBeenCalledWith(expect.objectContaining({ acceptUrl: "https://wren-os-henna-six.vercel.app/invite/invite-token" }));
  });

  it("keeps the invite link usable when SMTP delivery fails", async () => {
    const mailer = { sendTeamInvite: vi.fn().mockRejectedValue(new Error("SMTP rejected the message")) };
    const db = {
      getTeamMembershipBySlug: vi
        .fn()
        .mockResolvedValue({ team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" }, membership: { role: "admin" } }),
      createTeamInvite: vi.fn().mockResolvedValue({
        id: "invite-1",
        teamId: "team-1",
        teamName: "Birunda Farms",
        email: "brian@example.com",
        token: "invite-token",
        role: "member",
        status: "pending",
        expiresAt: "2026-05-21T12:00:00.000Z",
        invitedByName: "Sam"
      })
    };
    const app = createInviteApp({ db, mailer });

    const created = await request(app)
      .post("/api/teams/birunda-farms/invites")
      .set("Cookie", "northwatch_session=token")
      .send({ email: "brian@example.com", role: "member" })
      .expect(201);

    expect(created.body.invite.acceptUrl).toBe("https://northwatch.test/invite/invite-token");
    expect(created.body.invite.emailDelivery).toEqual({ delivered: false, logged: false, reason: "send_failed", error: "Email delivery failed." });
  });

  it("previews and accepts a valid invite for the authenticated user", async () => {
    const db = {
      getTeamInviteByToken: vi.fn().mockResolvedValue({
        id: "invite-1",
        token: "invite-token",
        email: "sam@example.com",
        role: "member",
        status: "pending",
        expiresAt: "2026-05-21T12:00:00.000Z",
        team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", memberLimit: 10 },
        inviter: { displayName: "Admin" },
        recipientExists: false
      }),
      acceptTeamInvite: vi.fn().mockResolvedValue({
        team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms" },
        membership: { userId: "user-1", role: "member" }
      })
    };
    const app = createAcceptApp({ db });

    const preview = await request(app).get("/api/invites/invite-token").expect(200);
    const accepted = await request(app).post("/api/invites/invite-token/accept").set("Cookie", "northwatch_session=token").expect(200);

    expect(preview.body.invite).toMatchObject({ teamName: "Birunda Farms", inviterName: "Admin", role: "member", recipientExists: false });
    expect(accepted.body.team.slug).toBe("birunda-farms");
    expect(db.acceptTeamInvite).toHaveBeenCalledWith({
      token: "invite-token",
      userId: "user-1",
      userEmail: "sam@example.com"
    });
  });
});

function createInviteApp({ db, mailer, appBaseUrl = "https://northwatch.test" }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/teams/:slug/invites",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1", email: "sam@example.com", displayName: "Sam" } } : null)
      }
    }),
    createTeamInvitesRouter({ express, db, mailer, appBaseUrl })
  );
  return app;
}

function createAcceptApp({ db }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const authService = {
    verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1", email: "sam@example.com" } } : null)
  };
  app.use("/api/invites", createInviteAcceptRouter({ express, db, authenticate: authenticate({ authService }) }));
  return app;
}
