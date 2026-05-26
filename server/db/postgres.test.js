import { describe, expect, it, vi } from "vitest";
import { createPostgresTeamDb } from "./postgres.js";

function createTeamRow() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "North Unit",
    slug: "north-unit",
    owner_id: "22222222-2222-4222-8222-222222222222",
    member_limit: 10,
    created_at: new Date("2026-05-21T10:00:00.000Z"),
    updated_at: new Date("2026-05-21T10:00:00.000Z")
  };
}

function createMockPool({ createdByReferencesExternalUser = true } = {}) {
  const queries = [];
  const client = {
    query: vi.fn(async (sql, params = []) => {
      queries.push({ sql: String(sql), params });
      if (String(sql).includes("information_schema.columns")) {
        return { rows: [{ exists: true }] };
      }
      if (String(sql).includes("information_schema.table_constraints")) {
        return { rows: [{ has_external_user_reference: createdByReferencesExternalUser }] };
      }
      if (String(sql).includes("insert into teams")) {
        return { rows: [createTeamRow()] };
      }
      if (String(sql).includes("from team_invites")) {
        return { rows: [{ id: "invite-1", team_id: params[0], email: "brian@example.com", token: "11111111-1111-4111-8111-111111111111", role: "member", invited_by: "user-1", expires_at: new Date("2026-05-22T10:00:00.000Z"), accepted_at: null, status: "pending" }] };
      }
      if (String(sql).includes("from team_members tm")) {
        return { rows: [{ membership_id: "membership-1", team_id: params[0], user_id: "user-1", role: "owner", joined_at: new Date("2026-05-21T10:00:00.000Z"), invited_by: null, email: "sam@example.com", display_name: "Sam" }] };
      }
      if (String(sql).includes("insert into notifications")) {
        return { rows: [{ id: "notification-1", user_id: params[0], type: params[1], message: params[2], link: params[3], is_read: false, created_at: new Date("2026-05-21T10:01:00.000Z") }] };
      }
      return { rows: [] };
    }),
    release: vi.fn()
  };

  return {
    queries,
    client,
    pool: {
      connect: vi.fn(async () => client),
      query: client.query
    }
  };
}

describe("createPostgresTeamDb", () => {
  it("sets both Northwatch and Supabase RLS user context before creating a team", async () => {
    const { pool, queries } = createMockPool();
    const db = createPostgresTeamDb(pool);

    await db.createTeam({
      name: "North Unit",
      slug: "north-unit",
      ownerId: "22222222-2222-4222-8222-222222222222",
      memberLimit: 10
    });

    expect(queries.some((query) => query.sql.includes("set_config('app.current_user_id'"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("set_config('request.jwt.claim.sub'"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("set_config('request.jwt.claim.role'"))).toBe(true);
  });

  it("does not populate legacy created_by when it references Supabase auth users", async () => {
    const { pool, queries } = createMockPool({ createdByReferencesExternalUser: true });
    const db = createPostgresTeamDb(pool);

    await db.createTeam({
      name: "North Unit",
      slug: "north-unit",
      ownerId: "22222222-2222-4222-8222-222222222222",
      memberLimit: 10
    });

    const teamInsert = queries.find((query) => query.sql.includes("insert into teams"));
    expect(teamInsert?.sql).not.toContain("created_by");
    expect(teamInsert?.params).toEqual(["North Unit", "north-unit", "22222222-2222-4222-8222-222222222222", 10]);
  });

  it("does not populate legacy created_by even when the column exists for old Supabase workspaces", async () => {
    const { pool, queries } = createMockPool({ createdByReferencesExternalUser: false });
    const db = createPostgresTeamDb(pool);

    await db.createTeam({
      name: "North Unit",
      slug: "north-unit",
      ownerId: "22222222-2222-4222-8222-222222222222",
      memberLimit: 10
    });

    const teamInsert = queries.find((query) => query.sql.includes("insert into teams"));
    expect(teamInsert?.sql).not.toContain("created_by");
    expect(teamInsert?.params).toEqual(["North Unit", "north-unit", "22222222-2222-4222-8222-222222222222", 10]);
  });

  it("sets RLS user context before listing team invites and members", async () => {
    const { pool, queries } = createMockPool();
    const db = createPostgresTeamDb(pool);

    await db.listTeamInvites("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
    await db.listTeamMembers("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");

    const contextQueries = queries.filter((query) => query.sql.includes("set_config('app.current_user_id'"));
    expect(contextQueries).toHaveLength(2);
    expect(contextQueries.every((query) => query.params[0] === "22222222-2222-4222-8222-222222222222")).toBe(true);
  });
});
