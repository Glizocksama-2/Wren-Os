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
      connect: vi.fn(async () => client)
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
});
