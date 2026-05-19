import { describe, expect, it } from "vitest";
import { COMMAND_DECK_STORAGE_KEY, freshCommandDeck, getCommandDeckStorageKey, loadCommandDeck, normalizeCommandDeck, reduceCommandDeck, type CommandDeckState } from "./commandDeck";

function makeTask(title: string): CommandDeckState["tasks"][number] {
  const timestamp = "2026-05-12T09:00:00.000Z";
  return {
    id: `task-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    priority: "high",
    kanbanPriority: "urgent",
    dueDate: null,
    status: "todo",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function makeProject(name: string): CommandDeckState["projects"][number] {
  const timestamp = "2026-05-12T09:00:00.000Z";
  return {
    id: `project-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    objective: "Recovered objective",
    nextAction: "Review recovered project",
    status: "pending",
    dueDate: null,
    progress: 25,
    source: "manual",
    repositoryUrl: null,
    language: null,
    visibility: null,
    defaultBranch: null,
    lastPushedAt: null,
    openIssues: 0,
    openPullRequests: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("command deck cloud import", () => {
  it("uses the selected Orbit Watch logo as the default mark", () => {
    expect(freshCommandDeck.settings.logoStyle).toBe("radar");
    expect(freshCommandDeck.settings.ollamaEnabled).toBe(true);
    expect(freshCommandDeck.settings.ollamaEndpoint).toBe("http://127.0.0.1:11434");
    expect(freshCommandDeck.settings.ollamaModel).toBe("qwen2.5:1.5b");
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

  it("adopts the existing browser deck when a new authenticated account has no saved deck yet", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      COMMAND_DECK_STORAGE_KEY,
      JSON.stringify({
        ...freshCommandDeck,
        tasks: [makeTask("Old browser task")],
        settings: { ...freshCommandDeck.settings, callsign: "Original Operator" }
      })
    );

    const deck = loadCommandDeck(storage, "user-1");

    expect(deck.settings.callsign).toBe("Original Operator");
    expect(deck.tasks.some((task) => task.title === "Old browser task")).toBe(true);
    expect(storage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Old browser task");
    expect(storage.getItem(COMMAND_DECK_STORAGE_KEY)).toContain("Old browser task");
  });

  it("replaces a fresh authenticated deck with the previous browser deck to recover first-login data", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      COMMAND_DECK_STORAGE_KEY,
      JSON.stringify({
        ...freshCommandDeck,
        tasks: [makeTask("Recover this task")]
      })
    );
    storage.setItem(getCommandDeckStorageKey("user-1"), JSON.stringify(freshCommandDeck));

    const deck = loadCommandDeck(storage, "user-1");

    expect(deck.tasks.some((task) => task.title === "Recover this task")).toBe(true);
    expect(storage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Recover this task");
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
    expect(next.projects).toHaveLength(0);
  });

  it("merges a recovered cloud deck without losing current account data", () => {
    const current = reduceCommandDeck(freshCommandDeck, {
      type: "task/add",
      title: "Current account task",
      priority: "medium",
      dueDate: null
    });
    const recovered: Partial<CommandDeckState> = {
      ...freshCommandDeck,
      tasks: [makeTask("Recovered email task")],
      projects: [
        {
          ...makeProject("Recovered project"),
          repositoryUrl: "https://github.com/glizocksama/recovered-project",
          source: "github"
        }
      ],
      settings: {
        ...freshCommandDeck.settings,
        callsign: "Email Vault"
      }
    };

    const next = reduceCommandDeck(current, { type: "deck/merge-import", deck: recovered });

    expect(next.tasks.some((task) => task.title === "Current account task")).toBe(true);
    expect(next.tasks.some((task) => task.title === "Recovered email task")).toBe(true);
    expect(next.projects.some((project) => project.name === "Recovered project")).toBe(true);
    expect(next.settings.callsign).toBe("Email Vault");
  });

  it("does not seed private GitHub repos into a fresh or normalized deck", () => {
    expect(freshCommandDeck.projects).toHaveLength(0);
    expect(normalizeCommandDeck({}).projects).toHaveLength(0);
    expect(normalizeCommandDeck({}).githubScan).toMatchObject({ owner: "", projectCount: 0 });
  });

  it("preserves legacy GitHub projects only for authenticated email recovery", () => {
    const legacyDeck: Partial<CommandDeckState> = {
      ...freshCommandDeck,
      githubScan: { owner: "Glizocksama-2", scannedAt: "2026-05-19T13:59:20.008Z", projectCount: 1 },
      projects: [
        {
          ...makeProject("Recovered repo"),
          source: "github",
          repositoryUrl: "https://github.com/glizocksama/recovered-repo"
        }
      ]
    };

    expect(normalizeCommandDeck(legacyDeck).projects).toHaveLength(0);

    const recovered = reduceCommandDeck(freshCommandDeck, {
      type: "deck/import",
      deck: legacyDeck,
      preserveLegacyGitHubProjects: true
    });

    expect(recovered.projects).toHaveLength(1);
    expect(recovered.projects[0].name).toBe("Recovered repo");
    expect(recovered.githubScan.owner).toBe("Glizocksama-2");
  });

  it("prunes the legacy baked-in GitHub scan from existing browser decks", () => {
    const deck = normalizeCommandDeck({
      ...freshCommandDeck,
      githubScan: { owner: "Glizocksama-2", scannedAt: "2026-05-12T00:00:00+03:00", projectCount: 1 },
      projects: [
        {
          id: "github-old",
          name: "Should not leak",
          objective: "Private repo",
          nextAction: "Hidden",
          status: "pending",
          dueDate: null,
          progress: 50,
          source: "github",
          repositoryUrl: "https://github.com/example/private",
          language: null,
          visibility: "private",
          defaultBranch: "main",
          lastPushedAt: null,
          openIssues: 0,
          openPullRequests: 0,
          createdAt: "2026-05-12T09:00:00.000Z",
          updatedAt: "2026-05-12T09:00:00.000Z"
        },
        {
          id: "manual-safe",
          name: "Client project",
          objective: "Keep this",
          nextAction: "Next",
          status: "pending",
          dueDate: null,
          progress: 10,
          source: "manual",
          repositoryUrl: null,
          language: null,
          visibility: null,
          defaultBranch: null,
          lastPushedAt: null,
          openIssues: 0,
          openPullRequests: 0,
          createdAt: "2026-05-12T09:00:00.000Z",
          updatedAt: "2026-05-12T09:00:00.000Z"
        }
      ]
    });

    expect(deck.projects.map((project) => project.name)).toEqual(["Client project"]);
    expect(deck.githubScan).toMatchObject({ owner: "", projectCount: 0 });
  });

  it("lets users link and delete their own GitHub repository projects", () => {
    let deck = reduceCommandDeck(freshCommandDeck, {
      type: "project/add",
      name: "Client Portal",
      objective: "Build client dashboard",
      nextAction: "Wire repo",
      dueDate: null,
      repositoryUrl: "github.com/client-org/client-portal.git",
      defaultBranch: "develop"
    });

    expect(deck.projects[0]).toMatchObject({
      name: "Client Portal",
      source: "github",
      repositoryUrl: "https://github.com/client-org/client-portal",
      defaultBranch: "develop"
    });

    deck = reduceCommandDeck(deck, { type: "project/delete", id: deck.projects[0].id });
    expect(deck.projects).toHaveLength(0);
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

  it("updates and deletes editable deck records", () => {
    let deck: CommandDeckState = { ...freshCommandDeck, tasks: [], projects: [], calendar: [], workouts: [], books: [], journal: [], finances: [], intel: [] };

    deck = reduceCommandDeck(deck, { type: "task/add", title: "Draft plan", priority: "medium", dueDate: null });
    deck = reduceCommandDeck(deck, { type: "task/update", id: deck.tasks[0].id, title: "Revised plan", priority: "critical", dueDate: "2026-05-20" });
    expect(deck.tasks[0]).toMatchObject({ title: "Revised plan", priority: "critical", dueDate: "2026-05-20" });
    deck = reduceCommandDeck(deck, { type: "task/delete", id: deck.tasks[0].id });
    expect(deck.tasks).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "project/add", name: "Launch", objective: "Ship", nextAction: "Build", dueDate: null });
    deck = reduceCommandDeck(deck, { type: "project/update", id: deck.projects[0].id, name: "Launch v2", objective: "Ship clean", nextAction: "Verify", dueDate: "2026-05-21", progress: 63 });
    expect(deck.projects[0]).toMatchObject({ name: "Launch v2", objective: "Ship clean", nextAction: "Verify", progress: 63 });
    deck = reduceCommandDeck(deck, { type: "project/delete", id: deck.projects[0].id });
    expect(deck.projects).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "calendar/add", title: "Strategy", date: "2026-05-22", time: "09:00", entryType: "mission" });
    deck = reduceCommandDeck(deck, { type: "calendar/update", id: deck.calendar[0].id, title: "Strategy v2", date: "2026-05-23", time: "10:30", entryType: "personal" });
    expect(deck.calendar[0]).toMatchObject({ title: "Strategy v2", date: "2026-05-23", time: "10:30", type: "personal" });
    deck = reduceCommandDeck(deck, { type: "calendar/delete", id: deck.calendar[0].id });
    expect(deck.calendar).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "workout/add", name: "Push", day: "Monday", focus: "Chest" });
    deck = reduceCommandDeck(deck, { type: "workout/update", id: deck.workouts[0].id, name: "Pull", day: "Tuesday", focus: "Back" });
    expect(deck.workouts[0]).toMatchObject({ name: "Pull", day: "Tuesday", focus: "Back" });
    deck = reduceCommandDeck(deck, { type: "workout/delete", id: deck.workouts[0].id });
    expect(deck.workouts).toHaveLength(0);

    deck = reduceCommandDeck(deck, {
      type: "book/add",
      title: "Deep Work",
      author: "Cal Newport",
      currentChapter: 1,
      totalChapters: 12,
      currentPage: 40,
      totalPages: 320
    });
    deck = reduceCommandDeck(deck, {
      type: "book/update",
      id: deck.books[0].id,
      title: "Slow Productivity",
      author: "Cal Newport",
      currentChapter: 4,
      totalChapters: 10,
      currentPage: 90,
      totalPages: 300
    });
    expect(deck.books[0]).toMatchObject({ title: "Slow Productivity", currentChapter: 4, totalChapters: 10, currentPage: 90, totalPages: 300, progress: 30 });
    deck = reduceCommandDeck(deck, { type: "book/delete", id: deck.books[0].id });
    expect(deck.books).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "journal/add", mood: "Focused", body: "Built." });
    deck = reduceCommandDeck(deck, { type: "journal/update", id: deck.journal[0].id, mood: "Clear", body: "Refined." });
    expect(deck.journal[0]).toMatchObject({ mood: "Clear", body: "Refined." });
    deck = reduceCommandDeck(deck, { type: "journal/delete", id: deck.journal[0].id });
    expect(deck.journal).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "finance/add", label: "Client payment", financeType: "income", amount: 500, date: "2026-05-24" });
    deck = reduceCommandDeck(deck, { type: "finance/update", id: deck.finances[0].id, label: "Client retainer", financeType: "savings", amount: 750, date: "2026-05-25" });
    expect(deck.finances[0]).toMatchObject({ label: "Client retainer", type: "savings", amount: 750 });
    deck = reduceCommandDeck(deck, { type: "finance/delete", id: deck.finances[0].id });
    expect(deck.finances).toHaveLength(0);

    deck = reduceCommandDeck(deck, { type: "intel/add", title: "NVIDIA", symbol: "nvda", kind: "stock", signal: "watching", thesis: "AI chips.", sourceUrl: "" });
    deck = reduceCommandDeck(deck, { type: "intel/update", id: deck.intel[0].id, title: "AMD", symbol: "amd", kind: "company", signal: "researching", thesis: "GPU watch.", sourceUrl: "https://example.com" });
    expect(deck.intel[0]).toMatchObject({ title: "AMD", symbol: "AMD", kind: "company", signal: "researching", thesis: "GPU watch.", sourceUrl: "https://example.com" });
    deck = reduceCommandDeck(deck, { type: "intel/delete", id: deck.intel[0].id });
    expect(deck.intel).toHaveLength(0);
  });

  it("tracks reading progress from pages and chapters", () => {
    let deck: CommandDeckState = { ...freshCommandDeck, tasks: [], projects: [], calendar: [], workouts: [], books: [], journal: [], finances: [], intel: [] };

    deck = reduceCommandDeck(deck, {
      type: "book/add",
      title: "Atomic Habits",
      author: "James Clear",
      currentChapter: 2,
      totalChapters: 20,
      currentPage: 50,
      totalPages: 250
    });

    expect(deck.books[0]).toMatchObject({ currentChapter: 2, totalChapters: 20, currentPage: 50, totalPages: 250, progress: 20 });

    deck = reduceCommandDeck(deck, {
      type: "book/progress",
      id: deck.books[0].id,
      currentChapter: 7,
      totalChapters: 14,
      currentPage: 0,
      totalPages: 0
    });

    expect(deck.books[0]).toMatchObject({ currentChapter: 7, totalChapters: 14, currentPage: 0, totalPages: 0, progress: 50 });

    deck = reduceCommandDeck(deck, {
      type: "settings/update",
      payload: { accent: "pink", background: "white" }
    });

    expect(deck.settings).toMatchObject({ accent: "pink", background: "white" });
  });

  it("tracks repetitive daily and selected-day routines", () => {
    let deck: CommandDeckState = { ...freshCommandDeck, tasks: [], projects: [], routines: [], calendar: [], workouts: [], books: [], journal: [], finances: [], intel: [] };

    deck = reduceCommandDeck(deck, {
      type: "routine/add",
      title: "Morning reset",
      cadence: "daily",
      days: []
    });

    expect(deck.routines[0]).toMatchObject({
      title: "Morning reset",
      cadence: "daily",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      completions: [],
      streak: 0
    });

    deck = reduceCommandDeck(deck, { type: "routine/toggle", id: deck.routines[0].id, date: "2026-05-19" });
    expect(deck.routines[0].completions).toContain("2026-05-19");
    expect(deck.routines[0].streak).toBe(1);

    deck = reduceCommandDeck(deck, { type: "routine/toggle", id: deck.routines[0].id, date: "2026-05-19" });
    expect(deck.routines[0].completions).not.toContain("2026-05-19");
    expect(deck.routines[0].streak).toBe(0);

    deck = reduceCommandDeck(deck, {
      type: "routine/add",
      title: "Strength work",
      cadence: "weekly",
      days: ["mon", "wed", "fri"]
    });

    expect(deck.routines[0]).toMatchObject({
      title: "Strength work",
      cadence: "weekly",
      days: ["mon", "wed", "fri"]
    });
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
