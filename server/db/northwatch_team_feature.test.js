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
    expect(sql).toContain("alter table teams add column if not exists slug text");
    expect(sql).toContain("northwatch_backfill_team_slugs");
    expect(sql).toContain("create unique index if not exists teams_slug_unique_idx on teams(slug)");
    expect(sql).toContain("alter table teams add column if not exists owner_id uuid references users(id) on delete cascade");
    expect(sql).toContain("alter table teams add column if not exists member_limit integer not null default 10");
    expect(sql).toContain("alter table teams add column if not exists updated_at timestamptz not null default now()");
    expect(sql).toContain("alter table teams alter column created_by drop not null");
    expect(sql).toContain("alter table teams add constraint teams_name_length_check");
    expect(sql).toContain("create table if not exists team_members");
    expect(sql).toContain("role text not null check (role in ('owner', 'admin', 'member', 'viewer'))");
    expect(sql).toContain("create table if not exists team_invites");
    expect(sql).toContain("token uuid not null unique");
    expect(sql).toContain("create table if not exists notifications");
    expect(sql).toContain("northwatch_team_role_allowed");
    expect(sql).toContain("northwatch_team_owner_is_current");
    expect(sql).toContain("app.current_invite_token");
    expect(sql).toContain("team_invites_select_pending_by_token");
    expect(sql).toContain("team_members_insert_owner_or_invited_user");
    expect(sql).toContain("exists (");
    expect(sql).toContain("ti.token::text = current_setting('app.current_invite_token', true)");
    expect(sql).toContain("team_invites_update_admin_or_accepting_user");

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
