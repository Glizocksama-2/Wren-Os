import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "./authenticate.js";
import { requireTeamRole } from "./requireTeamRole.js";

describe("requireTeamRole middleware", () => {
  it("rejects authenticated users whose team role is below the required level", async () => {
    const db = {
      getTeamMembershipBySlug: vi.fn().mockResolvedValue({
        team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" },
        membership: { role: "viewer" }
      })
    };
    const app = createRoleApp({ db, minRole: "admin" });

    const response = await request(app)
      .patch("/api/teams/birunda-farms")
      .set("Cookie", "northwatch_session=token")
      .send({ name: "Birunda Ops" })
      .expect(403);

    expect(response.body).toEqual({ error: "Team role does not allow this action." });
    expect(db.getTeamMembershipBySlug).toHaveBeenCalledWith("birunda-farms", "user-1");
  });

  it("attaches team and role context when the user has enough permission", async () => {
    const db = {
      getTeamMembershipBySlug: vi.fn().mockResolvedValue({
        team: { id: "team-1", slug: "birunda-farms", name: "Birunda Farms" },
        membership: { role: "admin" }
      })
    };
    const app = createRoleApp({ db, minRole: "admin" });

    const response = await request(app)
      .patch("/api/teams/birunda-farms")
      .set("Cookie", "northwatch_session=token")
      .send({ name: "Birunda Ops" })
      .expect(200);

    expect(response.body).toEqual({
      teamId: "team-1",
      teamSlug: "birunda-farms",
      teamRole: "admin"
    });
  });
});

function createRoleApp({ db, minRole }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.patch(
    "/api/teams/:slug",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? { userId: "user-1", user: { id: "user-1" } } : null)
      }
    }),
    requireTeamRole({ db, minRole }),
    (request, response) => {
      response.json({
        teamId: request.team.id,
        teamSlug: request.team.slug,
        teamRole: request.teamRole
      });
    }
  );
  return app;
}
