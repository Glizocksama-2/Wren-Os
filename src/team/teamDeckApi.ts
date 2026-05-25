import {
  freshCommandDeck,
  getCommandDeckStorageKey,
  normalizeCommandDeck,
  type CommandDeckState
} from "../store/commandDeck";

const AUTH_API_BASE_URL = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");
const TEAM_COMMAND_DECK_TITLE = "northwatch-command-deck";
const TEAM_COMMAND_DECK_KIND = "northwatch_command_deck";

type TeamDeckRow = {
  id: string;
  title: string;
  payload?: {
    kind?: string;
    deck?: Partial<CommandDeckState>;
  } | null;
  updatedAt?: string;
  updated_at?: string;
};

export type TeamCommandDeckLoadResult = {
  deck: CommandDeckState | null;
  documentId: string | null;
  updatedAt: string | null;
};

export function createFreshTeamCommandDeck(teamName: string): CommandDeckState {
  const timestamp = new Date().toISOString();
  return normalizeCommandDeck({
    ...freshCommandDeck,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: {
      ...freshCommandDeck.settings,
      callsign: "Team workspace",
      organizationName: teamName,
      commandCenterName: teamName || "Team Northwatch"
    }
  });
}

export function loadCachedTeamCommandDeck(storage: Storage, userId: string | null, teamId: string): CommandDeckState | null {
  const raw = storage.getItem(getCommandDeckStorageKey(getTeamDeckCacheScope(userId, teamId)));
  if (!raw) return null;

  try {
    return normalizeCommandDeck(JSON.parse(raw) as Partial<CommandDeckState>);
  } catch {
    return null;
  }
}

export function saveCachedTeamCommandDeck(storage: Storage, userId: string | null, teamId: string, deck: CommandDeckState): void {
  storage.setItem(getCommandDeckStorageKey(getTeamDeckCacheScope(userId, teamId)), JSON.stringify(deck));
}

export async function loadTeamCommandDeck(teamId: string): Promise<TeamCommandDeckLoadResult> {
  const response = await fetch(teamDocumentsUrl(teamId), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readTeamDeckError(response, `Team workspace returned ${response.status}.`));
  }

  const parsed = await response.json() as { data?: TeamDeckRow[] };
  const row = (parsed.data ?? []).find(isTeamDeckRow) ?? null;
  if (!row?.payload?.deck) {
    return { deck: null, documentId: row?.id ?? null, updatedAt: row?.updatedAt ?? row?.updated_at ?? null };
  }

  return {
    deck: normalizeCommandDeck(row.payload.deck),
    documentId: row.id,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

export async function saveTeamCommandDeck(teamId: string, deck: CommandDeckState, documentId: string | null = null): Promise<string> {
  const targetId = documentId ?? (await loadTeamCommandDeck(teamId)).documentId;
  if (targetId) {
    const patched = await writeTeamCommandDeck(teamId, deck, targetId);
    if (patched) return patched;
  }

  return writeTeamCommandDeck(teamId, deck, null);
}

function getTeamDeckCacheScope(userId: string | null, teamId: string): string {
  const owner = userId || "browser";
  return `${owner}:team:${teamId}`;
}

function teamDocumentsUrl(teamId: string, documentId: string | null = null): string {
  const query = `workspace_type=team&team_id=${encodeURIComponent(teamId)}`;
  const path = documentId
    ? `/api/documents/${encodeURIComponent(documentId)}?${query}`
    : `/api/documents?${query}`;
  return `${AUTH_API_BASE_URL}${path}`;
}

async function writeTeamCommandDeck(teamId: string, deck: CommandDeckState, documentId: string | null): Promise<string> {
  const response = await fetch(teamDocumentsUrl(teamId, documentId), {
    method: documentId ? "PATCH" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      title: TEAM_COMMAND_DECK_TITLE,
      kind: TEAM_COMMAND_DECK_KIND,
      deck
    })
  });

  if (documentId && response.status === 404) return "";
  if (!response.ok) {
    throw new Error(await readTeamDeckError(response, `Team workspace save returned ${response.status}.`));
  }

  const parsed = await response.json() as { data?: TeamDeckRow };
  return parsed.data?.id ?? documentId ?? "";
}

function isTeamDeckRow(row: TeamDeckRow): boolean {
  return row.title === TEAM_COMMAND_DECK_TITLE || row.payload?.kind === TEAM_COMMAND_DECK_KIND;
}

async function readTeamDeckError(response: Response, fallback: string): Promise<string> {
  try {
    const parsed = await response.json() as { error?: string; errors?: string[] };
    return parsed.error ?? parsed.errors?.join(" ") ?? fallback;
  } catch {
    return fallback;
  }
}
