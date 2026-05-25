import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ownerContextMigrationPath = join(process.cwd(), "supabase", "migrations", "20260521041000_repair_team_rls_owner_context.sql");
const backendRoleMigrationPath = join(process.cwd(), "supabase", "migrations", "20260525165503_repair_team_rls_backend_role.sql");
const noAuthSchemaMigrationPath = join(process.cwd(), "supabase", "migrations", "20260525180245_repair_team_rls_without_auth_schema.sql");
const expressTeamTablesMigrationPath = join(process.cwd(), "supabase", "migrations", "20260525184009_add_express_team_tables.sql");
const inviteRolesMigrationPath = join(process.cwd(), "supabase", "migrations", "20260518020000_add_team_invites_and_member_roles.sql");

describe("team RLS repair migration", () => {
  it("keeps the invite and member role migration rerunnable when old policies already exist", async () => {
    const sql = await readFile(inviteRolesMigrationPath, "utf8");

    expect(sql).toContain('drop policy if exists "team_memberships_select_self"');
    expect(sql).toContain('drop policy if exists "team_memberships_select_self_or_owner"');
    expect(sql).toMatch(/drop policy if exists "team_memberships_select_self_or_owner"[\s\S]+create policy "team_memberships_select_self_or_owner"/);
  });

  it("allows team creation through the current owner_id API context and legacy Supabase auth context", async () => {
    const sql = await readFile(ownerContextMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.northwatch_app_user_id()");
    expect(sql).toContain("current_setting('app.current_user_id', true)");
    expect(sql).toContain("(select auth.uid())");
    expect(sql).toContain("drop policy if exists \"teams_insert_creator\"");
    expect(sql).toContain("create policy \"teams_insert_owner_or_creator\"");
    expect(sql).toContain("created_by = public.northwatch_app_user_id()");
    expect(sql).toContain("owner_id = public.northwatch_app_user_id()");
  });

  it("does not scope team policies only to Supabase's authenticated role because the Express API uses its own database role", async () => {
    const sql = await readFile(backendRoleMigrationPath, "utf8");

    expect(sql).toContain("grant select, insert, update, delete on table public.teams to authenticated");
    expect(sql).toContain("rolname = 'northwatch_app'");
    expect(sql).toContain("grant select, insert, update, delete on table public.teams to northwatch_app");
    expect(sql).toContain("create policy \"teams_insert_owner_or_creator\"");
    expect(sql).toContain("with check (\n  created_by = public.northwatch_app_user_id()\n  or owner_id = public.northwatch_app_user_id()\n)");
    expect(sql).not.toContain("create policy \"teams_insert_owner_or_creator\"\non public.teams\nfor insert\nto authenticated");
  });

  it("repairs both the legacy Supabase membership table and the Express team_members table when present", async () => {
    const sql = await readFile(backendRoleMigrationPath, "utf8");

    expect(sql).toContain("to_regclass('public.team_members')");
    expect(sql).toContain("to_regclass('public.team_memberships')");
    expect(sql).toContain("northwatch_team_membership_exists(check_team_id uuid)");
    expect(sql).toContain("northwatch_team_owner_matches(check_team_id uuid)");
    expect(sql).toContain("team_members_insert_owner_or_invited_user");
  });

  it("removes auth schema dependencies from backend team RLS helpers", async () => {
    const sql = await readFile(noAuthSchemaMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.northwatch_app_user_id()");
    expect(sql).toContain("current_setting('app.current_user_id', true)");
    expect(sql).toContain("grant execute on function public.northwatch_app_user_id() to northwatch_app");
    expect(sql).toContain("create policy \"teams_insert_owner_or_creator\"");
    expect(sql).not.toContain("auth.uid()");
    expect(sql).not.toContain("auth.users");
  });

  it("adds the Express team tables that are missing from the older Supabase workspace schema", async () => {
    const sql = await readFile(expressTeamTablesMigrationPath, "utf8");

    expect(sql).toContain("create table if not exists public.team_members");
    expect(sql).toContain("references public.users(id)");
    expect(sql).toContain("alter table public.team_invites add column if not exists email text");
    expect(sql).toContain("alter table public.team_invites add column if not exists invited_by uuid references public.users(id)");
    expect(sql).toContain("create table if not exists public.notifications");
    expect(sql).toContain("grant select, insert, update, delete on table public.team_members to northwatch_app");
    expect(sql).toContain("team_members_insert_owner_or_invited_user");
    expect(sql).toContain("invite.token::text = current_setting('app.current_invite_token', true)");
  });
});
