export const TEAM_ROLES = ["viewer", "member", "admin", "owner"];

export const TEAM_PERMISSIONS = {
  create_card: ["owner", "admin", "member"],
  edit_card: ["owner", "admin", "member"],
  delete_card: ["owner", "admin"],
  assign_card: ["owner", "admin", "member"],
  create_project: ["owner", "admin", "member"],
  delete_project: ["owner", "admin"],
  create_doc: ["owner", "admin", "member"],
  delete_doc: ["owner", "admin"],
  create_content: ["owner", "admin", "member"],
  delete_content: ["owner", "admin"],
  invite_member: ["owner", "admin"],
  remove_member: ["owner", "admin"],
  change_role: ["owner", "admin"],
  edit_team_settings: ["owner", "admin"],
  delete_team: ["owner"],
  view_all: ["owner", "admin", "member", "viewer"]
};

const ROLE_RANK = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3
};

export function normalizeTeamRole(role) {
  return TEAM_ROLES.includes(role) ? role : "viewer";
}

export function roleMeetsMinimum(role, minimumRole) {
  return ROLE_RANK[normalizeTeamRole(role)] >= ROLE_RANK[normalizeTeamRole(minimumRole)];
}

export function canTeamRole(role, permission) {
  const allowedRoles = TEAM_PERMISSIONS[permission] ?? [];
  return allowedRoles.includes(normalizeTeamRole(role));
}

export function getRoleRank(role) {
  return ROLE_RANK[normalizeTeamRole(role)];
}
