import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "northwatch_auth_rls.sql");
const isolatedTables = ["kanban_cards", "projects", "content_queue", "documents", "activity_feed", "agent_configs", "api_tokens"];

describe("northwatch auth RLS migration", () => {
  it("defines users, sessions, login failures, user-owned tables, and RLS policies", async () => {
    const sql = await readFile(sqlPath, "utf8");

    expect(sql).toContain("create table if not exists users");
    expect(sql).toContain("create table if not exists user_sessions");
    expect(sql).toContain("create table if not exists auth_login_failures");
    expect(sql).toContain("current_setting('app.current_user_id', true)");

    for (const table of isolatedTables) {
      expect(sql).toContain(`create table if not exists ${table}`);
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`alter table ${table} force row level security`);
      expect(sql).toContain(`${table}_select_own`);
      expect(sql).toContain(`${table}_insert_own`);
      expect(sql).toContain(`${table}_update_own`);
      expect(sql).toContain(`${table}_delete_own`);
      expect(sql).toContain(`create index if not exists ${table}_user_id_idx`);
    }
  });
});
