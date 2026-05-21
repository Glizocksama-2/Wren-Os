const configuredAuthApiBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? "";

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

export function extractInviteToken(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, "https://northwatch.local");
    const match = url.pathname.match(/^\/invite\/([^/]+)$/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // Fall back to plain token parsing below.
  }

  const marker = "/invite/";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    return decodeURIComponent(raw.slice(markerIndex + marker.length).split(/[?#]/)[0].replace(/\/+$/, ""));
  }

  return raw.split(/[?#]/)[0].replace(/\/+$/, "");
}

export async function listNotifications() {
  return teamRequest("/api/notifications");
}

export async function markNotificationsRead() {
  return teamRequest("/api/notifications/read-all", { method: "POST" });
}

export async function teamRequest(path, init = {}) {
  const response = await fetch(`${resolveTeamApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const contentType = response.headers?.get?.("content-type")?.toLowerCase() ?? "";

  if (!response.ok) {
    let message = `Team request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`;
    if (contentType.includes("application/json") || typeof response.json === "function") {
      const parsed = await response.json().catch(() => null);
      message = parsed?.error ?? parsed?.errors?.join(" ") ?? message;
    } else {
      const body = typeof response.text === "function" ? await response.text().catch(() => "") : "";
      if (looksLikeHtml(body)) {
        message = `Team API route ${path} returned the frontend app instead of the Northwatch API. Make sure VITE_AUTH_API_BASE_URL points to your Express API, and that the API server is running.`;
      } else if (body.trim()) {
        message = body.trim().slice(0, 240);
      }
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  if (contentType && !contentType.includes("application/json")) {
    const body = typeof response.text === "function" ? await response.text().catch(() => "") : "";
    const message = looksLikeHtml(body)
      ? `Team API route ${path} returned the frontend app instead of JSON. Check VITE_AUTH_API_BASE_URL and the API route wiring.`
      : `Team API route ${path} returned a non-JSON response.`;
    throw new Error(message);
  }
  return response.json();
}

export function resolveTeamApiBaseUrl(options = {}) {
  const envBaseUrl = options.envBaseUrl ?? configuredAuthApiBaseUrl;
  const normalized = String(envBaseUrl ?? "").trim().replace(/\/$/, "");
  if (normalized) return normalized;

  const location = options.location ?? globalThis.location;
  if (["127.0.0.1", "localhost", "::1"].includes(location?.hostname)) {
    return "http://127.0.0.1:4000";
  }

  return "";
}

function looksLikeHtml(value) {
  return /<!doctype html|<html[\s>]/i.test(String(value ?? ""));
}

export function slugifyTeamName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
