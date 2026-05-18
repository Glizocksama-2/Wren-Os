import { freshCommandDeck, normalizeCommandDeck, type CommandDeckState } from "./commandDeck";

const CLOUD_DECK_TABLE = "command_decks";
const TEAMS_TABLE = "teams";
const TEAM_MEMBERSHIPS_TABLE = "team_memberships";
const TEAM_DECK_TABLE = "team_command_decks";

export type TeamRole = "owner" | "member";

export type TeamWorkspace = {
  id: string;
  name: string;
  role: TeamRole;
  createdAt: string;
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
  makeTeamId = createWorkspaceId
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

  const membershipInsert = await client.from(TEAM_MEMBERSHIPS_TABLE).insert({
    team_id: teamId,
    user_id: userId,
    role: "owner"
  }) as SupabaseResult<null>;

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

export async function joinTeamWorkspace(client: CloudDeckClient | null, userId: string, teamId: string): Promise<TeamWorkspace> {
  if (!client) throw new Error("Supabase is not configured.");

  const cleanedTeamId = teamId.trim();
  if (!cleanedTeamId) throw new Error("Team code is required.");

  const membershipInsert = await client.from(TEAM_MEMBERSHIPS_TABLE).insert({
    team_id: cleanedTeamId,
    user_id: userId,
    role: "member"
  }) as SupabaseResult<null>;

  if (membershipInsert.error) {
    throw new Error(membershipInsert.error.message);
  }

  const teams = await listTeamWorkspaces(client, userId);
  const joinedTeam = teams.find((team) => team.id === cleanedTeamId);
  if (!joinedTeam) throw new Error("Team joined, but it could not be loaded.");
  return joinedTeam;
}

function createWorkspaceId(): string {
  return crypto.randomUUID();
}
