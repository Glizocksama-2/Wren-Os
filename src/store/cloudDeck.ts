import { normalizeCommandDeck, type CommandDeckState } from "./commandDeck";

const CLOUD_DECK_TABLE = "command_decks";

type CloudDeckRow = {
  deck: Partial<CommandDeckState>;
  updated_at: string;
};

type CloudDeckPayload = {
  user_id: string;
  deck: CommandDeckState;
  updated_at: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type CloudSelectChain<T> = {
  select(columns: string): {
    eq(column: string, value: string): {
      maybeSingle(): Promise<SupabaseResult<T>>;
    };
  };
};

type CloudUpsertChain<T> = {
  upsert(payload: CloudDeckPayload, options: { onConflict: string }): {
    select(columns: string): {
      single(): Promise<SupabaseResult<T>>;
    };
  };
};

export interface CloudDeckClient {
  from(table: string): CloudSelectChain<CloudDeckRow> & CloudUpsertChain<{ updated_at: string }>;
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
