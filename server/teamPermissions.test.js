import { describe, expect, it } from "vitest";
import { canTeamRole, normalizeTeamRole, roleMeetsMinimum, TEAM_PERMISSIONS } from "./teamPermissions.js";

describe("team permissions", () => {
  it("keeps one central permission matrix for backend and frontend role checks", () => {
    expect(TEAM_PERMISSIONS.delete_team).toEqual(["owner"]);
    expect(TEAM_PERMISSIONS.invite_member).toEqual(["owner", "admin"]);
    expect(TEAM_PERMISSIONS.view_all).toEqual(["owner", "admin", "member", "viewer"]);
  });

  it("normalizes roles and compares hierarchy levels", () => {
    expect(normalizeTeamRole("admin")).toBe("admin");
    expect(normalizeTeamRole("unknown")).toBe("viewer");
    expect(roleMeetsMinimum("owner", "admin")).toBe(true);
    expect(roleMeetsMinimum("member", "admin")).toBe(false);
  });

  it("answers whether a role can perform a named team action", () => {
    expect(canTeamRole("member", "create_card")).toBe(true);
    expect(canTeamRole("viewer", "create_card")).toBe(false);
    expect(canTeamRole("admin", "delete_team")).toBe(false);
    expect(canTeamRole("owner", "delete_team")).toBe(true);
  });
});
