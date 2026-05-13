import { describe, expect, it } from "vitest";
import { COMMAND_DECK_STORAGE_KEY, freshCommandDeck, loadCommandDeck, normalizeCommandDeck, reduceCommandDeck, type CommandDeckState } from "./commandDeck";

function makeTask(title: string): CommandDeckState["tasks"][number] {
  const timestamp = "2026-05-12T09:00:00.000Z";
  return {
    id: `task-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    priority: "high",
    dueDate: null,
    status: "todo",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("command deck cloud import", () => {
  it("uses the selected Orbit Watch logo as the default mark", () => {
    expect(freshCommandDeck.settings.logoStyle).toBe("radar");
    expect(normalizeCommandDeck({ version: 1, settings: { ...freshCommandDeck.settings, logoStyle: "sentinel" } }).settings.logoStyle).toBe("radar");
  });

  it("migrates legacy workspace data without deleting the previous storage key", () => {
    const storage = createMemoryStorage();
    const legacyWorkspace = {
      workspace: {
        id: "workspace-legacy",
        name: "Old Northwatch",
        owner: "Alex",
        mode: "local-first",
        schemaVersion: 4,
        version: "1.0.0",
        agentKey: "agent-key",
        createdAt: "2026-05-10T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z"
      },
      projects: [
        {
          id: "project-legacy",
          workspaceId: "workspace-legacy",
          name: "Legacy Project",
          description: "Previous project data.",
          status: "active",
          health: "on_track",
          accent: "cyan",
          owner: "Alex",
          objective: "Preserve this project.",
          tags: [],
          risks: [],
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-12T09:00:00.000Z"
        }
      ],
      tasks: [
        {
          id: "task-legacy",
          workspaceId: "workspace-legacy",
          title: "Legacy task",
          description: "Previous task data.",
          status: "todo",
          priority: "critical",
          dueDate: "2026-05-20",
          tags: [],
          projectId: "project-legacy",
          source: "manual",
          externalLinks: [],
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-12T09:00:00.000Z"
        }
      ],
      agentActions: [],
      automations: [],
      contentItems: [
        {
          id: "content-legacy",
          workspaceId: "workspace-legacy",
          title: "Legacy content",
          stage: "draft",
          platform: "blog",
          owner: "Alex",
          projectId: null,
          scheduledFor: null,
          tags: [],
          updatedAt: "2026-05-12T09:00:00.000Z"
        }
      ],
      documents: [
        {
          id: "doc-legacy",
          workspaceId: "workspace-legacy",
          title: "Legacy note",
          kind: "note",
          url: "",
          body: "Previous knowledge base text.",
          tags: [],
          projectId: null,
          updatedAt: "2026-05-12T09:00:00.000Z"
        }
      ],
      apiProviders: [],
      apiEndpoints: [],
      activityEvents: []
    };

    storage.setItem("wren-os.workspace.v1", JSON.stringify(legacyWorkspace));

    const deck = loadCommandDeck(storage);

    expect(storage.getItem("wren-os.workspace.v1")).not.toBeNull();
    expect(deck.settings.callsign).toBe("Alex");
    expect(deck.settings.logoStyle).toBe("radar");
    expect(deck.tasks.some((task) => task.title === "Legacy task")).toBe(true);
    expect(deck.tasks.some((task) => task.title === "Advance content: Legacy content")).toBe(true);
    expect(deck.projects.some((project) => project.name === "Legacy Project")).toBe(true);
    expect(deck.journal.some((entry) => entry.body.includes("Previous knowledge base text."))).toBe(true);
  });

  it("keeps existing command deck data when legacy data is also present", () => {
    const storage = createMemoryStorage();
    storage.setItem("wren-os.workspace.v1", JSON.stringify({ workspace: { owner: "Legacy" }, tasks: [{ title: "Legacy only" }] }));
    storage.setItem(
      COMMAND_DECK_STORAGE_KEY,
      JSON.stringify({
        ...freshCommandDeck,
        tasks: [makeTask("Current deck task")]
      })
    );

    const deck = loadCommandDeck(storage);

    expect(deck.tasks.some((task) => task.title === "Current deck task")).toBe(true);
    expect(deck.tasks.some((task) => task.title === "Legacy only")).toBe(false);
    expect(storage.getItem("wren-os.workspace.v1")).not.toBeNull();
  });

  it("replaces the local deck with a normalized cloud deck", () => {
    const local = reduceCommandDeck(freshCommandDeck, {
      type: "task/add",
      title: "Keep only local",
      priority: "medium",
      dueDate: null
    });
    const cloudDeck: Partial<CommandDeckState> = {
      ...freshCommandDeck,
      tasks: [makeTask("Synced cloud task")],
      projects: [],
      settings: {
        ...freshCommandDeck.settings,
        callsign: "Cloud"
      }
    };

    const next = reduceCommandDeck(local, { type: "deck/import", deck: cloudDeck });

    expect(next.settings.callsign).toBe("Cloud");
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].title).toBe("Synced cloud task");
    expect(next.projects.some((project) => project.source === "github")).toBe(true);
  });

  it("adds market intel items and research notes", () => {
    const withIntel = reduceCommandDeck(freshCommandDeck, {
      type: "intel/add",
      title: "NVIDIA",
      symbol: "NVDA",
      kind: "stock",
      signal: "researching",
      thesis: "AI chips and data center demand.",
      sourceUrl: "https://example.com/nvda"
    });
    const intelId = withIntel.intel[0].id;
    const withNote = reduceCommandDeck(withIntel, {
      type: "intel/note",
      id: intelId,
      body: "Check earnings call and margin trend."
    });

    expect(withNote.intel).toHaveLength(1);
    expect(withNote.intel[0].symbol).toBe("NVDA");
    expect(withNote.intel[0].notes[0].body).toBe("Check earnings call and margin trend.");
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}
