const authApiBaseUrl = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");

export async function listMyTeams() {
  const response = await teamRequest("/api/teams/mine");
  return response.teams ?? [];
}

export async function createTeam(input) {
  const response = await teamRequest("/api/teams", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.team;
}

export async function getTeam(slug) {
  return teamRequest(`/api/teams/${encodeURIComponent(slug)}`);
}

export async function updateTeam(slug, input) {
  const response = await teamRequest(`/api/teams/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return response.team;
}

export async function deleteTeam(slug) {
  await teamRequest(`/api/teams/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

export async function updateMemberRole(slug, userId, role) {
  const response = await teamRequest(`/api/teams/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
  return response.member;
}

export async function removeMember(slug, userId) {
  await teamRequest(`/api/teams/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function listInvites(slug) {
  const response = await teamRequest(`/api/teams/${encodeURIComponent(slug)}/invites`);
  return response.invites ?? [];
}

export async function sendInvite(slug, input) {
  const response = await teamRequest(`/api/teams/${encodeURIComponent(slug)}/invites`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.invite;
}

export async function revokeInvite(slug, inviteId) {
  await teamRequest(`/api/teams/${encodeURIComponent(slug)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export async function previewInvite(token) {
  const response = await teamRequest(`/api/invites/${encodeURIComponent(token)}`);
  return response.invite;
}

export async function acceptInvite(token) {
  return teamRequest(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
}

export async function listNotifications() {
  return teamRequest("/api/notifications");
}

export async function markNotificationsRead() {
  return teamRequest("/api/notifications/read-all", { method: "POST" });
}

export async function teamRequest(path, init = {}) {
  const response = await fetch(`${authApiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = "Team request failed.";
    try {
      const parsed = await response.json();
      message = parsed.error ?? parsed.errors?.join(" ") ?? message;
    } catch {
      message = response.statusText || message;
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export function slugifyTeamName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
