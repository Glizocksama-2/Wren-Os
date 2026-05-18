import { describe, expect, it, vi } from "vitest";
import { freshCommandDeck } from "./commandDeck";
import {
  createTeamInvite,
  createTeamWorkspace,
  joinTeamWorkspace,
  listTeamMembers,
  listTeamWorkspaces,
  loadCloudDeck,
  loadTeamCloudDeck,
  removeTeamMember,
  saveCloudDeck,
  saveTeamCloudDeck,
  updateTeamMemberRole
} from "./cloudDeck";

describe("Supabase command deck persistence", () => {
  it("loads and normalizes a per-user cloud deck", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        deck: {
          ...freshCommandDeck,
          projects: [],
          tasks: [
            {
              id: "task-cloud",
              title: "Cloud task",
              priority: "critical",
              dueDate: null,
              status: "todo",
              createdAt: "2026-05-12T09:00:00.000Z",
              updatedAt: "2026-05-12T09:00:00.000Z"
            }
          ]
        }
      },
      error: null
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const deck = await loadCloudDeck({ from } as never, "user-1");

    expect(from).toHaveBeenCalledWith("command_decks");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deck?.tasks[0].title).toBe("Cloud task");
    expect(deck?.projects.some((project) => project.source === "github")).toBe(true);
  });

  it("upserts the deck against the authenticated user id", async () => {
    const single = vi.fn(async () => ({ data: { updated_at: "2026-05-12T10:00:00.000Z" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));

    const savedAt = await saveCloudDeck({ from } as never, "user-1", freshCommandDeck);

    expect(from).toHaveBeenCalledWith("command_decks");
    const [payload, options] = upsert.mock.calls[0] as unknown as [
      { user_id: string; deck: typeof freshCommandDeck; updated_at: string },
      { onConflict: string }
    ];
    expect(payload.user_id).toBe("user-1");
    expect(payload.deck.version).toBe(freshCommandDeck.version);
    expect(payload.deck.projects.some((project: { source: string }) => project.source === "github")).toBe(true);
    expect(options).toEqual({ onConflict: "user_id" });
    expect(savedAt).toBe("2026-05-12T10:00:00.000Z");
  });

  it("loads and saves team decks by team id instead of user id", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        deck: {
          ...freshCommandDeck,
          settings: { ...freshCommandDeck.settings, callsign: "Team One" }
        },
        updated_at: "2026-05-18T10:00:00.000Z"
      },
      error: null
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const loadSelect = vi.fn(() => ({ eq }));

    const single = vi.fn(async () => ({ data: { updated_at: "2026-05-18T10:05:00.000Z" }, error: null }));
    const saveSelect = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: saveSelect }));
    const from = vi.fn((table: string) => (table === "team_command_decks" ? { select: loadSelect, upsert } : {}));

    const teamDeck = await loadTeamCloudDeck({ from } as never, "team-1");
    const savedAt = await saveTeamCloudDeck({ from } as never, "team-1", "user-1", freshCommandDeck);

    expect(from).toHaveBeenCalledWith("team_command_decks");
    expect(eq).toHaveBeenCalledWith("team_id", "team-1");
    expect(teamDeck?.settings.callsign).toBe("Team One");
    const [payload, options] = upsert.mock.calls[0] as unknown as [
      { team_id: string; updated_by: string; deck: typeof freshCommandDeck },
      { onConflict: string }
    ];
    expect(payload.team_id).toBe("team-1");
    expect(payload.updated_by).toBe("user-1");
    expect(options).toEqual({ onConflict: "team_id" });
    expect(savedAt).toBe("2026-05-18T10:05:00.000Z");
  });

  it("lists teams through the signed-in user's memberships", async () => {
    const membershipEq = vi.fn(async () => ({
      data: [
        { team_id: "team-1", role: "owner" },
        { team_id: "team-2", role: "member" }
      ],
      error: null
    }));
    const teamIn = vi.fn(async () => ({
      data: [
        { id: "team-1", name: "North Unit", created_at: "2026-05-18T09:00:00.000Z" },
        { id: "team-2", name: "Ops Cell", created_at: "2026-05-18T09:05:00.000Z" }
      ],
      error: null
    }));
    const from = vi.fn((table: string) => {
      if (table === "team_memberships") return { select: vi.fn(() => ({ eq: membershipEq })) };
      if (table === "teams") return { select: vi.fn(() => ({ in: teamIn })) };
      return {};
    });

    const teams = await listTeamWorkspaces({ from } as never, "user-1");

    expect(membershipEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(teamIn).toHaveBeenCalledWith("id", ["team-1", "team-2"]);
    expect(teams).toEqual([
      { id: "team-1", name: "North Unit", role: "owner", createdAt: "2026-05-18T09:00:00.000Z" },
      { id: "team-2", name: "Ops Cell", role: "member", createdAt: "2026-05-18T09:05:00.000Z" }
    ]);
  });

  it("creates a team with an owner membership and a fresh shared deck", async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const single = vi.fn(async () => ({ data: { updated_at: "2026-05-18T11:00:00.000Z" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => {
      if (table === "teams") return { insert };
      if (table === "team_memberships") return { insert };
      if (table === "team_command_decks") return { upsert };
      return {};
    });

    const team = await createTeamWorkspace({ from } as never, "user-1", "North Unit", () => "team-1");

    expect(insert).toHaveBeenCalledWith({ id: "team-1", name: "North Unit", created_by: "user-1" });
    expect(insert).toHaveBeenCalledWith({ team_id: "team-1", user_id: "user-1", role: "owner" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: "team-1",
        updated_by: "user-1",
        deck: expect.objectContaining({ version: freshCommandDeck.version })
      }),
      { onConflict: "team_id" }
    );
    expect(team).toMatchObject({ id: "team-1", name: "North Unit", role: "owner" });
  });

  it("creates a shareable invite link for a team", async () => {
    const single = vi.fn(async () => ({
      data: { id: "invite-1", team_id: "team-1", created_at: "2026-05-18T12:00:00.000Z", expires_at: "2026-06-01T12:00:00.000Z" },
      error: null
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => (table === "team_invites" ? { insert } : {}));

    const invite = await createTeamInvite({ from } as never, "team-1", "user-1", "https://northwatch.netlify.app");

    expect(from).toHaveBeenCalledWith("team_invites");
    expect(insert).toHaveBeenCalledWith({ team_id: "team-1", created_by: "user-1" });
    expect(invite.url).toBe("https://northwatch.netlify.app/?team=team-1&invite=invite-1");
    expect(invite.expiresAt).toBe("2026-06-01T12:00:00.000Z");
  });

  it("joins a team through an invite link without touching personal storage", async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const membershipEq = vi.fn(async () => ({ data: [{ team_id: "team-1", role: "member" }], error: null }));
    const teamIn = vi.fn(async () => ({
      data: [{ id: "team-1", name: "North Unit", created_at: "2026-05-18T09:00:00.000Z" }],
      error: null
    }));
    const from = vi.fn((table: string) => {
      if (table === "team_memberships") {
        return { insert, select: vi.fn(() => ({ eq: membershipEq })) };
      }
      if (table === "teams") return { select: vi.fn(() => ({ in: teamIn })) };
      return {};
    });

    const team = await joinTeamWorkspace(
      { from } as never,
      "user-2",
      "https://northwatch.netlify.app/?team=team-1&invite=invite-1",
      "user2@example.com"
    );

    expect(from).not.toHaveBeenCalledWith("command_decks");
    expect(insert).toHaveBeenCalledWith({
      team_id: "team-1",
      user_id: "user-2",
      role: "member",
      invite_id: "invite-1",
      member_email: "user2@example.com"
    });
    expect(team).toEqual({ id: "team-1", name: "North Unit", role: "member", createdAt: "2026-05-18T09:00:00.000Z" });
  });

  it("lists team members for owner management", async () => {
    const eq = vi.fn(async () => ({
      data: [
        {
          team_id: "team-1",
          user_id: "user-1",
          role: "owner",
          member_email: "owner@example.com",
          joined_at: "2026-05-18T09:00:00.000Z"
        },
        {
          team_id: "team-1",
          user_id: "user-2",
          role: "member",
          member_email: "member@example.com",
          joined_at: "2026-05-18T09:10:00.000Z"
        }
      ],
      error: null
    }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn((table: string) => (table === "team_memberships" ? { select } : {}));

    const members = await listTeamMembers({ from } as never, "team-1");

    expect(select).toHaveBeenCalledWith("team_id, user_id, role, member_email, joined_at");
    expect(eq).toHaveBeenCalledWith("team_id", "team-1");
    expect(members).toEqual([
      { teamId: "team-1", userId: "user-1", role: "owner", email: "owner@example.com", joinedAt: "2026-05-18T09:00:00.000Z" },
      { teamId: "team-1", userId: "user-2", role: "member", email: "member@example.com", joinedAt: "2026-05-18T09:10:00.000Z" }
    ]);
  });

  it("updates member roles and removes members by team/user keys", async () => {
    const updateUserEq = vi.fn(async () => ({ data: null, error: null }));
    const updateTeamEq = vi.fn(() => ({ eq: updateUserEq }));
    const update = vi.fn(() => ({ eq: updateTeamEq }));

    const deleteUserEq = vi.fn(async () => ({ data: null, error: null }));
    const deleteTeamEq = vi.fn(() => ({ eq: deleteUserEq }));
    const deleteFn = vi.fn(() => ({ eq: deleteTeamEq }));
    const from = vi.fn((table: string) => (table === "team_memberships" ? { update, delete: deleteFn } : {}));

    await updateTeamMemberRole({ from } as never, "team-1", "user-2", "owner");
    await removeTeamMember({ from } as never, "team-1", "user-2");

    expect(update).toHaveBeenCalledWith({ role: "owner" });
    expect(updateTeamEq).toHaveBeenCalledWith("team_id", "team-1");
    expect(updateUserEq).toHaveBeenCalledWith("user_id", "user-2");
    expect(deleteTeamEq).toHaveBeenCalledWith("team_id", "team-1");
    expect(deleteUserEq).toHaveBeenCalledWith("user_id", "user-2");
  });
});
