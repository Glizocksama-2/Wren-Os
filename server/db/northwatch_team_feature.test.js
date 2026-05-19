import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "northwatch_team_feature.sql");
const teamScopedTables = ["kanban_cards", "projects", "documents", "content_queue", "activity_feed", "agent_configs"];

describe("northwatch team feature migration", () => {
  it("defines teams, invites, notifications, workspace scope columns, and RLS policies", async () => {
    const sql = await readFile(sqlPath, "utf8");

    expect(sql).toContain("create table if not exists teams");
    expect(sql).toContain("owner_id uuid not null references users(id)");
    expect(sql).toContain("create table if not exists team_members");
    expect(sql).toContain("role text not null check (role in ('owner', 'admin', 'member', 'viewer'))");
    expect(sql).toContain("create table if not exists team_invites");
    expect(sql).toContain("token uuid not null unique");
    expect(sql).toContain("create table if not exists notifications");
    expect(sql).toContain("northwatch_team_role_allowed");

    for (const table of teamScopedTables) {
      expect(sql).toContain(`alter table ${table} add column if not exists workspace_type text not null default 'personal'`);
      expect(sql).toContain(`alter table ${table} add column if not exists team_id uuid references teams(id) on delete cascade`);
      expect(sql).toContain(`${table}_team_workspace_idx`);
      expect(sql).toContain(`${table}_select_workspace`);
      expect(sql).toContain(`${table}_insert_workspace`);
      expect(sql).toContain(`${table}_update_workspace`);
      expect(sql).toContain(`${table}_delete_workspace`);
    }
  });
});
