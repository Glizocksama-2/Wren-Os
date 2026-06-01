import { freshCommandDeck, normalizeCommandDeck, type CommandDeckState } from "./commandDeck";

const CLOUD_DECK_TABLE = "command_decks";
const TEAMS_TABLE = "teams";
const TEAM_MEMBERSHIPS_TABLE = "team_memberships";
const TEAM_DECK_TABLE = "team_command_decks";
const TEAM_INVITES_TABLE = "team_invites";

export type TeamRole = "owner" | "admin" | "member" | "viewer";

export type TeamWorkspace = {
  id: string;
  name: string;
  slug?: string;
  role: TeamRole;
  createdAt?: string;
};

export type TeamInvite = {
  id: string;
  teamId: string;
  url: string;
  createdAt: string;
  expiresAt: string;
};

export type TeamMember = {
  teamId: string;
  userId: string;
  role: TeamRole;
  email: string | null;
  joinedAt: string;
};

type CloudDeckRow = {
  deck: Partial<CommandDeckState>;
  updated_at: string;
};

type CloudDeckPayload = {
  user_id: string;
  deck: CommandDeckState;
  updated_at: string;
};

type TeamDeckPayload = {
  team_id: string;
  deck: CommandDeckState;
  updated_at: string;
  updated_by: string;
};

type TeamMembershipPayload = {
  team_id: string;
  user_id: string;
  role: TeamRole;
  invite_id?: string;
  member_email?: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export interface CloudDeckClient {
  from(table: string): any;
}

export async function loadCloudDeck(client: CloudDeckClient | null, userId: string): Promise<CommandDeckState | null> {
  if (!client) return null;

  const { data, error } = await client
    .from(CLOUD_DECK_TABLE)
    .select("deck, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.deck ? normalizeCommandDeck(data.deck) : null;
}

export async function saveCloudDeck(
  client: CloudDeckClient | null,
  userId: string,
  deck: CommandDeckState
): Promise<string> {
  if (!client) return deck.updatedAt;

  const updatedAt = new Date().toISOString();
  const normalizedDeck = normalizeCommandDeck({ ...deck, updatedAt });
  const { data, error } = await client
    .from(CLOUD_DECK_TABLE)
    .upsert(
      {
        user_id: userId,
        deck: normalizedDeck,
        updated_at: updatedAt
      },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.updated_at ?? updatedAt;
}

export async function loadTeamCloudDeck(client: CloudDeckClient | null, teamId: string): Promise<CommandDeckState | null> {
  if (!client) return null;

  const { data, error } = await client
    .from(TEAM_DECK_TABLE)
    .select("deck, updated_at")
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.deck ? normalizeCommandDeck(data.deck) : null;
}

export async function saveTeamCloudDeck(
  client: CloudDeckClient | null,
  teamId: string,
  userId: string,
  deck: CommandDeckState
): Promise<string> {
  if (!client) return deck.updatedAt;

  const updatedAt = new Date().toISOString();
  const normalizedDeck = normalizeCommandDeck({ ...deck, updatedAt });
  const { data, error } = await client
    .from(TEAM_DECK_TABLE)
    .upsert(
      {
        team_id: teamId,
        deck: normalizedDeck,
        updated_at: updatedAt,
        updated_by: userId
      } as TeamDeckPayload,
      { onConflict: "team_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.updated_at ?? updatedAt;
}

export async function listTeamWorkspaces(client: CloudDeckClient | null, userId: string): Promise<TeamWorkspace[]> {
  if (!client) return [];

  const memberships = await client
    .from(TEAM_MEMBERSHIPS_TABLE)
    .select("team_id, role")
    .eq("user_id", userId) as SupabaseResult<Array<{ team_id: string; role: TeamRole }>>;

  if (memberships.error) {
    throw new Error(memberships.error.message);
  }

  const membershipRows = memberships.data ?? [];
  if (membershipRows.length === 0) return [];

  const teamIds = membershipRows.map((membership) => membership.team_id);
  const teams = await client
    .from(TEAMS_TABLE)
    .select("id, name, created_at")
    .in("id", teamIds) as SupabaseResult<Array<{ id: string; name: string; created_at: string }>>;

  if (teams.error) {
    throw new Error(teams.error.message);
  }

  const roleByTeam = new Map(membershipRows.map((membership) => [membership.team_id, membership.role]));
  return (teams.data ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    role: roleByTeam.get(team.id) ?? "member",
    createdAt: team.created_at
  }));
}

export async function createTeamWorkspace(
  client: CloudDeckClient | null,
  userId: string,
  name: string,
  makeTeamId = createWorkspaceId,
  userEmail?: string | null
): Promise<TeamWorkspace> {
  if (!client) throw new Error("Supabase is not configured.");

  const teamId = makeTeamId();
  const cleanedName = name.trim();
  if (!cleanedName) throw new Error("Team name is required.");

  const teamInsert = await client.from(TEAMS_TABLE).insert({
    id: teamId,
    name: cleanedName,
    created_by: userId
  }) as SupabaseResult<null>;

  if (teamInsert.error) {
    throw new Error(teamInsert.error.message);
  }

  const ownerMembership: TeamMembershipPayload = {
    team_id: teamId,
    user_id: userId,
    role: "owner"
  };
  if (userEmail) ownerMembership.member_email = userEmail;

  const membershipInsert = await client.from(TEAM_MEMBERSHIPS_TABLE).insert(ownerMembership) as SupabaseResult<null>;

  if (membershipInsert.error) {
    throw new Error(membershipInsert.error.message);
  }

  await saveTeamCloudDeck(client, teamId, userId, freshCommandDeck);

  return {
    id: teamId,
    name: cleanedName,
    role: "owner",
    createdAt: new Date().toISOString()
  };
}

export async function createTeamInvite(
  client: CloudDeckClient | null,
  teamId: string,
  userId: string,
  origin: string
): Promise<TeamInvite> {
  if (!client) throw new Error("Supabase is not configured.");

  const cleanedTeamId = teamId.trim();
  if (!cleanedTeamId) throw new Error("Team id is required.");

  const { data, error } = await client
    .from(TEAM_INVITES_TABLE)
    .insert({ team_id: cleanedTeamId, created_by: userId })
    .select("id, team_id, created_at, expires_at")
    .single() as SupabaseResult<{ id: string; team_id: string; created_at: string; expires_at: string }>;

  if (error) {
    throw new Error(error.message);
  }

  if (!data) throw new Error("Invite link could not be created.");

  return {
    id: data.id,
    teamId: data.team_id,
    url: buildTeamInviteUrl(origin, data.team_id, data.id),
    createdAt: data.created_at,
    expiresAt: data.expires_at
  };
}

export async function joinTeamWorkspace(
  client: CloudDeckClient | null,
  userId: string,
  inviteInput: string,
  userEmail?: string | null
): Promise<TeamWorkspace> {
  if (!client) throw new Error("Supabase is not configured.");

  const invite = parseTeamInviteInput(inviteInput);

  const membership: TeamMembershipPayload = {
    team_id: invite.teamId,
    user_id: userId,
    role: "member",
    invite_id: invite.inviteId
  };
  if (userEmail) membership.member_email = userEmail;

  const membershipInsert = await client.from(TEAM_MEMBERSHIPS_TABLE).insert(membership) as SupabaseResult<null>;

  if (membershipInsert.error) {
    throw new Error(membershipInsert.error.message);
  }

  const teams = await listTeamWorkspaces(client, userId);
  const joinedTeam = teams.find((team) => team.id === invite.teamId);
  if (!joinedTeam) throw new Error("Team joined, but it could not be loaded.");
  return joinedTeam;
}

export async function listTeamMembers(client: CloudDeckClient | null, teamId: string): Promise<TeamMember[]> {
  if (!client) return [];

  const { data, error } = await client
    .from(TEAM_MEMBERSHIPS_TABLE)
    .select("team_id, user_id, role, member_email, joined_at")
    .eq("team_id", teamId) as SupabaseResult<Array<{
      team_id: string;
      user_id: string;
      role: TeamRole;
      member_email: string | null;
      joined_at: string;
    }>>;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((member) => ({
    teamId: member.team_id,
    userId: member.user_id,
    role: member.role,
    email: member.member_email,
    joinedAt: member.joined_at
  }));
}

export async function updateTeamMemberRole(
  client: CloudDeckClient | null,
  teamId: string,
  memberUserId: string,
  role: TeamRole
): Promise<void> {
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client
    .from(TEAM_MEMBERSHIPS_TABLE)
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", memberUserId) as SupabaseResult<null>;

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeTeamMember(client: CloudDeckClient | null, teamId: string, memberUserId: string): Promise<void> {
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client
    .from(TEAM_MEMBERSHIPS_TABLE)
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", memberUserId) as SupabaseResult<null>;

  if (error) {
    throw new Error(error.message);
  }
}

export function buildTeamInviteUrl(origin: string, teamId: string, inviteId: string): string {
  const url = new URL(origin);
  url.searchParams.set("team", teamId);
  url.searchParams.set("invite", inviteId);
  return url.toString();
}

export function parseTeamInviteInput(input: string): { teamId: string; inviteId: string } {
  const cleaned = input.trim();
  if (!cleaned) throw new Error("Invite link is required.");

  try {
    const url = new URL(cleaned);
    const teamId = url.searchParams.get("team")?.trim() ?? "";
    const inviteId = url.searchParams.get("invite")?.trim() ?? "";
    if (teamId && inviteId) return { teamId, inviteId };
  } catch {
    // Fall through to compact invite formats.
  }

  const [teamId, inviteId] = cleaned.split(":").map((part) => part.trim());
  if (teamId && inviteId) return { teamId, inviteId };

  throw new Error("Paste a valid Northwatch invite link.");
}

function createWorkspaceId(): string {
  return crypto.randomUUID();
}
