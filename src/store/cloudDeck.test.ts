import { describe, expect, it, vi } from "vitest";
import { freshCommandDeck } from "./commandDeck";
import { loadCloudDeck, saveCloudDeck } from "./cloudDeck";

describe("Supabase command deck persistence", () => {
  it("loads and normalizes a per-user cloud deck", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        deck: {
          ...freshCommandDeck,
          projects: [],
          tasks: [
            {
              id: "task-cloud",
              title: "Cloud task",
              priority: "critical",
              dueDate: null,
              status: "todo",
              createdAt: "2026-05-12T09:00:00.000Z",
              updatedAt: "2026-05-12T09:00:00.000Z"
            }
          ]
        }
      },
      error: null
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const deck = await loadCloudDeck({ from } as never, "user-1");

    expect(from).toHaveBeenCalledWith("command_decks");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deck?.tasks[0].title).toBe("Cloud task");
    expect(deck?.projects.some((project) => project.source === "github")).toBe(true);
  });

  it("upserts the deck against the authenticated user id", async () => {
    const single = vi.fn(async () => ({ data: { updated_at: "2026-05-12T10:00:00.000Z" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));

    const savedAt = await saveCloudDeck({ from } as never, "user-1", freshCommandDeck);

    expect(from).toHaveBeenCalledWith("command_decks");
    const [payload, options] = upsert.mock.calls[0] as unknown as [
      { user_id: string; deck: typeof freshCommandDeck; updated_at: string },
      { onConflict: string }
    ];
    expect(payload.user_id).toBe("user-1");
    expect(payload.deck.version).toBe(freshCommandDeck.version);
    expect(payload.deck.projects.some((project: { source: string }) => project.source === "github")).toBe(true);
    expect(options).toEqual({ onConflict: "user_id" });
    expect(savedAt).toBe("2026-05-12T10:00:00.000Z");
  });
});
