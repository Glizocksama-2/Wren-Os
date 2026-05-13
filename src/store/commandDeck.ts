import { githubProjectSeed, githubScanSummary } from "../data/githubProjects";

export type DeckView =
  | "dashboard"
  | "todo"
  | "projects"
  | "intel"
  | "calendar"
  | "workout"
  | "books"
  | "journal"
  | "finances"
  | "customize"
  | "account";
export type Priority = "low" | "medium" | "high" | "critical";
export type ProjectStatus = "pending" | "done";
export type FinanceType = "income" | "expense" | "savings";
export type Accent = "amber" | "cyan" | "green" | "red";
export type Density = "comfortable" | "compact";
export type LogoStyle = "sentinel" | "monolith" | "radar" | "spire";
export type ProjectSource = "manual" | "github";
export type IntelKind = "stock" | "crypto" | "fund" | "company" | "trend" | "news";
export type IntelSignal = "watching" | "researching" | "high-priority" | "on-hold";

export interface CommandTask {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  status: "todo" | "done";
  createdAt: string;
  updatedAt: string;
}

export interface CommandProject {
  id: string;
  name: string;
  objective: string;
  nextAction: string;
  status: ProjectStatus;
  dueDate: string | null;
  progress: number;
  source: ProjectSource;
  repositoryUrl: string | null;
  language: string | null;
  visibility: "public" | "private" | null;
  defaultBranch: string | null;
  lastPushedAt: string | null;
  openIssues: number;
  openPullRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubProjectSeed {
  name: string;
  objective: string;
  url: string;
  language: string;
  visibility: "public" | "private";
  defaultBranch: string;
  pushedAt: string;
  updatedAt: string;
  openIssues: number;
  openPullRequests: number;
  isArchived: boolean;
}

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "mission" | "training" | "finance" | "personal";
}

export interface WorkoutEntry {
  id: string;
  name: string;
  day: string;
  focus: string;
  status: "planned" | "done";
}

export interface BookEntry {
  id: string;
  title: string;
  author: string;
  status: "queued" | "reading" | "done";
  progress: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  mood: string;
  body: string;
}

export interface FinanceEntry {
  id: string;
  label: string;
  type: FinanceType;
  amount: number;
  date: string;
  status: "planned" | "cleared";
}

export interface IntelNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface IntelItem {
  id: string;
  title: string;
  symbol: string;
  kind: IntelKind;
  signal: IntelSignal;
  thesis: string;
  sourceUrl: string | null;
  notes: IntelNote[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckSettings {
  callsign: string;
  logoStyle: LogoStyle;
  accent: Accent;
  density: Density;
  showOrbit: boolean;
  showFinance: boolean;
  showWorkout: boolean;
  showCalendar: boolean;
  showBooks: boolean;
  showJournal: boolean;
  showIntel: boolean;
}

export interface CommandDeckState {
  version: number;
  createdAt: string;
  updatedAt: string;
  githubScan: {
    owner: string;
    scannedAt: string;
    projectCount: number;
  };
  tasks: CommandTask[];
  projects: CommandProject[];
  calendar: CalendarEntry[];
  workouts: WorkoutEntry[];
  books: BookEntry[];
  journal: JournalEntry[];
  finances: FinanceEntry[];
  intel: IntelItem[];
  settings: DeckSettings;
}

export type CommandDeckAction =
  | { type: "task/add"; title: string; priority: Priority; dueDate: string | null }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "project/add"; name: string; objective: string; nextAction: string; dueDate: string | null }
  | { type: "project/complete"; id: string }
  | { type: "github/import"; projects: GitHubProjectSeed[]; owner: string; scannedAt: string }
  | { type: "calendar/add"; title: string; date: string; time: string; entryType: CalendarEntry["type"] }
  | { type: "workout/add"; name: string; day: string; focus: string }
  | { type: "workout/toggle"; id: string }
  | { type: "book/add"; title: string; author: string }
  | { type: "book/progress"; id: string; progress: number }
  | { type: "journal/add"; mood: string; body: string }
  | { type: "finance/add"; label: string; financeType: FinanceType; amount: number; date: string }
  | { type: "finance/toggle"; id: string }
  | { type: "intel/add"; title: string; symbol: string; kind: IntelKind; signal: IntelSignal; thesis: string; sourceUrl: string }
  | { type: "intel/note"; id: string; body: string }
  | { type: "settings/update"; payload: Partial<DeckSettings> }
  | { type: "deck/import"; deck: Partial<CommandDeckState> }
  | { type: "deck/reset" };

export const COMMAND_DECK_STORAGE_KEY = "wren-os.command-deck.v1";
const LEGACY_WORKSPACE_KEY = "wren-os.workspace.v1";
const SCHEMA_VERSION = 2;

const nowIso = () => new Date().toISOString();
const todayInput = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const intelKinds: IntelKind[] = ["stock", "crypto", "fund", "company", "trend", "news"];
const intelSignals: IntelSignal[] = ["watching", "researching", "high-priority", "on-hold"];
const logoStyles: LogoStyle[] = ["sentinel", "monolith", "radar", "spire"];

export const freshCommandDeck: CommandDeckState = {
  version: SCHEMA_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  githubScan: githubScanSummary,
  tasks: [],
  projects: [],
  calendar: [],
  workouts: [],
  books: [],
  journal: [],
  finances: [],
  intel: [],
  settings: {
    callsign: "Operator",
    logoStyle: "radar",
    accent: "amber",
    density: "comfortable",
    showOrbit: true,
    showFinance: true,
    showWorkout: true,
    showCalendar: true,
    showBooks: true,
    showJournal: true,
    showIntel: true
  }
};

export function reduceCommandDeck(state: CommandDeckState, action: CommandDeckAction): CommandDeckState {
  const timestamp = nowIso();

  switch (action.type) {
    case "task/add":
      return touch({
        ...state,
        tasks: [
          {
            id: makeId("task"),
            title: action.title,
            priority: action.priority,
            dueDate: action.dueDate,
            status: "todo",
            createdAt: timestamp,
            updatedAt: timestamp
          },
          ...state.tasks
        ]
      }, timestamp);

    case "task/toggle":
      return touch({
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: task.status === "done" ? "todo" : "done", updatedAt: timestamp } : task
        )
      }, timestamp);

    case "task/delete":
      return touch({ ...state, tasks: state.tasks.filter((task) => task.id !== action.id) }, timestamp);

    case "project/add":
      return touch({
        ...state,
        projects: [
          {
            id: makeId("project"),
            name: action.name,
            objective: action.objective,
            nextAction: action.nextAction,
            status: "pending",
            dueDate: action.dueDate,
            progress: 0,
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
          },
          ...state.projects
        ]
      }, timestamp);

    case "project/complete":
      return touch({
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.id ? { ...project, status: project.status === "done" ? "pending" : "done", updatedAt: timestamp } : project
        )
      }, timestamp);

    case "github/import":
      return touch({
        ...state,
        githubScan: {
          owner: action.owner,
          scannedAt: action.scannedAt,
          projectCount: action.projects.length
        },
        projects: mergeGitHubProjects(state.projects, action.projects)
      }, timestamp);

    case "calendar/add":
      return touch({
        ...state,
        calendar: [
          { id: makeId("event"), title: action.title, date: action.date, time: action.time, type: action.entryType },
          ...state.calendar
        ]
      }, timestamp);

    case "workout/add":
      return touch({
        ...state,
        workouts: [{ id: makeId("workout"), name: action.name, day: action.day, focus: action.focus, status: "planned" }, ...state.workouts]
      }, timestamp);

    case "workout/toggle":
      return touch({
        ...state,
        workouts: state.workouts.map((entry) =>
          entry.id === action.id ? { ...entry, status: entry.status === "done" ? "planned" : "done" } : entry
        )
      }, timestamp);

    case "book/add":
      return touch({
        ...state,
        books: [{ id: makeId("book"), title: action.title, author: action.author, status: "reading", progress: 0 }, ...state.books]
      }, timestamp);

    case "book/progress":
      return touch({
        ...state,
        books: state.books.map((book) =>
          book.id === action.id ? { ...book, progress: clampProgress(action.progress), status: action.progress >= 100 ? "done" : "reading" } : book
        )
      }, timestamp);

    case "journal/add":
      return touch({
        ...state,
        journal: [{ id: makeId("journal"), date: todayInput(), mood: action.mood, body: action.body }, ...state.journal]
      }, timestamp);

    case "finance/add":
      return touch({
        ...state,
        finances: [
          {
            id: makeId("finance"),
            label: action.label,
            type: action.financeType,
            amount: action.amount,
            date: action.date,
            status: "planned"
          },
          ...state.finances
        ]
      }, timestamp);

    case "finance/toggle":
      return touch({
        ...state,
        finances: state.finances.map((entry) =>
          entry.id === action.id ? { ...entry, status: entry.status === "cleared" ? "planned" : "cleared" } : entry
        )
      }, timestamp);

    case "intel/add":
      return touch({
        ...state,
        intel: [
          {
            id: makeId("intel"),
            title: action.title,
            symbol: action.symbol.trim().toUpperCase(),
            kind: action.kind,
            signal: action.signal,
            thesis: action.thesis,
            sourceUrl: action.sourceUrl.trim() || null,
            notes: [],
            createdAt: timestamp,
            updatedAt: timestamp
          },
          ...state.intel
        ]
      }, timestamp);

    case "intel/note":
      return touch({
        ...state,
        intel: state.intel.map((item) =>
          item.id === action.id
            ? {
                ...item,
                notes: [{ id: makeId("intel-note"), body: action.body, createdAt: timestamp }, ...item.notes],
                updatedAt: timestamp
              }
            : item
        )
      }, timestamp);

    case "settings/update":
      return touch({ ...state, settings: { ...state.settings, ...action.payload } }, timestamp);

    case "deck/import":
      return normalizeCommandDeck(action.deck);

    case "deck/reset":
      return createFreshDeck();

    default:
      return state;
  }
}

export function loadCommandDeck(storage: Storage = window.localStorage): CommandDeckState {
  const migratedLegacyDeck = migrateLegacyWorkspace(storage.getItem(LEGACY_WORKSPACE_KEY));
  const raw = storage.getItem(COMMAND_DECK_STORAGE_KEY);
  if (!raw) return migratedLegacyDeck ?? createFreshDeck();

  try {
    const parsed = JSON.parse(raw) as Partial<CommandDeckState>;
    const normalized = normalizeCommandDeck(parsed);
    if (migratedLegacyDeck && !hasUserDeckData(normalized) && hasUserDeckData(migratedLegacyDeck)) {
      return migratedLegacyDeck;
    }

    return normalized;
  } catch {
    return migratedLegacyDeck ?? createFreshDeck();
  }
}

export function saveCommandDeck(state: CommandDeckState, storage: Storage = window.localStorage): void {
  storage.setItem(COMMAND_DECK_STORAGE_KEY, JSON.stringify(state));
}

export function getDeckMetrics(state: CommandDeckState) {
  const openTasks = state.tasks.filter((task) => task.status === "todo");
  const doneTasks = state.tasks.filter((task) => task.status === "done");
  const pendingProjects = state.projects.filter((project) => project.status === "pending");
  const doneProjects = state.projects.filter((project) => project.status === "done");
  const income = state.finances.filter((entry) => entry.type === "income").reduce((total, entry) => total + entry.amount, 0);
  const expenses = state.finances.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
  const savings = state.finances.filter((entry) => entry.type === "savings").reduce((total, entry) => total + entry.amount, 0);
  const totalActions = state.tasks.length + state.projects.length + state.workouts.length + state.books.length + state.journal.length + state.intel.length;
  const completedActions = doneTasks.length + doneProjects.length + state.workouts.filter((entry) => entry.status === "done").length;
  const projectProgress =
    state.projects.length === 0
      ? 0
      : Math.round(state.projects.reduce((total, project) => total + project.progress, 0) / state.projects.length);

  return {
    openTasks: openTasks.length,
    doneTasks: doneTasks.length,
    pendingProjects: pendingProjects.length,
    doneProjects: doneProjects.length,
    calendarEvents: state.calendar.length,
    workoutsDone: state.workouts.filter((entry) => entry.status === "done").length,
    readingCount: state.books.filter((book) => book.status === "reading").length,
    journalEntries: state.journal.length,
    intelItems: state.intel.length,
    intelResearching: state.intel.filter((item) => item.signal === "researching" || item.signal === "high-priority").length,
    netCash: income + savings - expenses,
    projectProgress,
    readiness:
      totalActions === 0
        ? projectProgress
        : Math.round(((completedActions / totalActions) * 100 + projectProgress) / (state.projects.length > 0 ? 2 : 1))
  };
}

export function normalizeCommandDeck(value: Partial<CommandDeckState>): CommandDeckState {
  const fresh = createFreshDeck();
  const incomingSettings: Partial<DeckSettings> = value.settings ?? {};
  const incomingVersion = typeof value.version === "number" ? value.version : 0;
  return {
    ...fresh,
    ...value,
    version: SCHEMA_VERSION,
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    githubScan: value.githubScan ?? githubScanSummary,
    projects: mergeGitHubProjects(
      Array.isArray(value.projects) ? value.projects.map(normalizeProject) : [],
      githubProjectSeed
    ),
    calendar: Array.isArray(value.calendar) ? value.calendar : [],
    workouts: Array.isArray(value.workouts) ? value.workouts : [],
    books: Array.isArray(value.books) ? value.books : [],
    journal: Array.isArray(value.journal) ? value.journal : [],
    finances: Array.isArray(value.finances) ? value.finances : [],
    intel: Array.isArray(value.intel) ? value.intel.map(normalizeIntelItem) : [],
    settings: {
      ...fresh.settings,
      ...incomingSettings,
      logoStyle: normalizeLogoStyle(incomingSettings.logoStyle, incomingVersion)
    },
    updatedAt: value.updatedAt ?? fresh.updatedAt
  };
}

function createFreshDeck(): CommandDeckState {
  const timestamp = nowIso();
  return {
    ...freshCommandDeck,
    createdAt: timestamp,
    updatedAt: timestamp,
    githubScan: githubScanSummary,
    tasks: [],
    projects: mergeGitHubProjects([], githubProjectSeed),
    calendar: [],
    workouts: [],
    books: [],
    journal: [],
    finances: [],
    intel: []
  };
}

function touch(state: CommandDeckState, updatedAt: string): CommandDeckState {
  return { ...state, updatedAt };
}

function migrateLegacyWorkspace(raw: string | null): CommandDeckState | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;

    const timestamp = nowIso();
    const legacyTasks = Array.isArray(value.tasks) ? value.tasks.filter(isRecord) : [];
    const legacyProjects = Array.isArray(value.projects) ? value.projects.filter(isRecord) : [];
    const legacyDocuments = Array.isArray(value.documents) ? value.documents.filter(isRecord) : [];
    const legacyContent = Array.isArray(value.contentItems) ? value.contentItems.filter(isRecord) : [];
    const legacyAgentActions = Array.isArray(value.agentActions) ? value.agentActions.filter(isRecord) : [];
    const workspace = isRecord(value.workspace) ? value.workspace : {};

    const migrated: Partial<CommandDeckState> = {
      version: SCHEMA_VERSION,
      createdAt: getString(workspace.createdAt) ?? timestamp,
      updatedAt: timestamp,
      githubScan: githubScanSummary,
      tasks: [
        ...legacyTasks.map((task) => migrateLegacyTask(task, timestamp)),
        ...legacyAgentActions.map((action) => migrateLegacyAgentAction(action, timestamp)),
        ...legacyContent.filter((item) => getString(item.stage) !== "published").map((item) => migrateLegacyContentTask(item, timestamp))
      ],
      projects: legacyProjects.map((project) => migrateLegacyProject(project, legacyTasks, timestamp)),
      journal: [
        ...legacyDocuments.map((document) => migrateLegacyDocument(document, timestamp)),
        ...legacyContent.map((item) => migrateLegacyContentJournal(item, timestamp))
      ],
      settings: {
        ...freshCommandDeck.settings,
        callsign: getString(workspace.owner) ?? getString(workspace.name) ?? freshCommandDeck.settings.callsign,
        logoStyle: "radar"
      }
    };

    const normalized = normalizeCommandDeck(migrated);
    return hasUserDeckData(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function migrateLegacyTask(task: Record<string, unknown>, fallbackTimestamp: string): CommandTask {
  const updatedAt = getString(task.updatedAt) ?? fallbackTimestamp;
  return {
    id: getString(task.id) ?? makeId("legacy-task"),
    title: getString(task.title) ?? "Untitled legacy task",
    priority: normalizePriority(task.priority),
    dueDate: getNullableString(task.dueDate),
    status: task.status === "done" ? "done" : "todo",
    createdAt: getString(task.createdAt) ?? updatedAt,
    updatedAt
  };
}

function migrateLegacyAgentAction(action: Record<string, unknown>, fallbackTimestamp: string): CommandTask {
  const updatedAt = getString(action.updatedAt) ?? getString(action.createdAt) ?? fallbackTimestamp;
  const title = getString(action.title) ?? "Legacy agent action";
  return {
    id: `legacy-agent-${getString(action.id) ?? makeId("action")}`,
    title: `Review agent action: ${title}`,
    priority: action.status === "pending" ? "high" : "medium",
    dueDate: null,
    status: action.status === "approved" ? "done" : "todo",
    createdAt: getString(action.createdAt) ?? updatedAt,
    updatedAt
  };
}

function migrateLegacyContentTask(item: Record<string, unknown>, fallbackTimestamp: string): CommandTask {
  const updatedAt = getString(item.updatedAt) ?? fallbackTimestamp;
  return {
    id: `legacy-content-${getString(item.id) ?? makeId("content")}`,
    title: `Advance content: ${getString(item.title) ?? "Untitled content"}`,
    priority: "medium",
    dueDate: getNullableString(item.scheduledFor),
    status: "todo",
    createdAt: updatedAt,
    updatedAt
  };
}

function migrateLegacyProject(
  project: Record<string, unknown>,
  legacyTasks: Record<string, unknown>[],
  fallbackTimestamp: string
): CommandProject {
  const id = getString(project.id) ?? makeId("legacy-project");
  const updatedAt = getString(project.updatedAt) ?? fallbackTimestamp;
  return {
    id,
    name: getString(project.name) ?? "Untitled legacy project",
    objective: getString(project.objective) ?? getString(project.description) ?? "",
    nextAction: getLegacyProjectNextAction(id, legacyTasks),
    status: project.status === "archived" ? "done" : "pending",
    dueDate: null,
    progress: getLegacyProjectProgress(id, legacyTasks),
    source: "manual",
    repositoryUrl: null,
    language: null,
    visibility: null,
    defaultBranch: null,
    lastPushedAt: null,
    openIssues: 0,
    openPullRequests: 0,
    createdAt: getString(project.createdAt) ?? updatedAt,
    updatedAt
  };
}

function migrateLegacyDocument(document: Record<string, unknown>, fallbackTimestamp: string): JournalEntry {
  const updatedAt = getString(document.updatedAt) ?? fallbackTimestamp;
  const title = getString(document.title) ?? "Legacy document";
  const body = getString(document.body) ?? getString(document.url) ?? "";
  return {
    id: `legacy-doc-${getString(document.id) ?? makeId("doc")}`,
    date: updatedAt.slice(0, 10),
    mood: `Knowledge: ${title}`,
    body: body ? `${title}\n\n${body}` : title
  };
}

function migrateLegacyContentJournal(item: Record<string, unknown>, fallbackTimestamp: string): JournalEntry {
  const updatedAt = getString(item.updatedAt) ?? fallbackTimestamp;
  const title = getString(item.title) ?? "Legacy content";
  return {
    id: `legacy-content-journal-${getString(item.id) ?? makeId("content-note")}`,
    date: updatedAt.slice(0, 10),
    mood: `Content: ${getString(item.stage) ?? "tracked"}`,
    body: `${title}${getString(item.platform) ? `\nPlatform: ${getString(item.platform)}` : ""}`
  };
}

function normalizePriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function normalizeLogoStyle(value: unknown, version: number): LogoStyle {
  if (logoStyles.includes(value as LogoStyle)) {
    return version < SCHEMA_VERSION && value === "sentinel" ? "radar" : value as LogoStyle;
  }

  return "radar";
}

function hasUserDeckData(state: CommandDeckState): boolean {
  return (
    state.tasks.length > 0 ||
    state.projects.some((project) => project.source !== "github") ||
    state.calendar.length > 0 ||
    state.workouts.length > 0 ||
    state.books.length > 0 ||
    state.journal.length > 0 ||
    state.finances.length > 0 ||
    state.intel.length > 0
  );
}

function getLegacyProjectNextAction(projectId: string, legacyTasks: Record<string, unknown>[]): string {
  const nextTask = legacyTasks.find((task) => getNullableString(task.projectId) === projectId && task.status !== "done");
  return nextTask ? getString(nextTask.title) ?? "Review next legacy task." : "Review migrated legacy project.";
}

function getLegacyProjectProgress(projectId: string, legacyTasks: Record<string, unknown>[]): number {
  const projectTasks = legacyTasks.filter((task) => getNullableString(task.projectId) === projectId);
  if (projectTasks.length === 0) return 0;
  return clampProgress((projectTasks.filter((task) => task.status === "done").length / projectTasks.length) * 100);
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeIntelItem(item: Partial<IntelItem>): IntelItem {
  const timestamp = nowIso();
  const kind = intelKinds.includes(item.kind as IntelKind) ? item.kind as IntelKind : "trend";
  const signal = intelSignals.includes(item.signal as IntelSignal) ? item.signal as IntelSignal : "watching";
  return {
    id: item.id ?? makeId("intel"),
    title: item.title ?? "Untitled intel",
    symbol: (item.symbol ?? "").trim().toUpperCase(),
    kind,
    signal,
    thesis: item.thesis ?? "",
    sourceUrl: item.sourceUrl ?? null,
    notes: Array.isArray(item.notes)
      ? item.notes.map((note) => ({
          id: note.id ?? makeId("intel-note"),
          body: note.body ?? "",
          createdAt: note.createdAt ?? timestamp
        }))
      : [],
    createdAt: item.createdAt ?? timestamp,
    updatedAt: item.updatedAt ?? timestamp
  };
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

function mergeGitHubProjects(currentProjects: CommandProject[], seeds: GitHubProjectSeed[]): CommandProject[] {
  const timestamp = nowIso();
  const projectsById = new Map(currentProjects.map((project) => [project.id, normalizeProject(project)]));

  seeds.forEach((seed) => {
    const id = getGitHubProjectId(seed.name);
    const existing = projectsById.get(id);
    const progress = calculateGitHubProgress(seed);
    const imported: CommandProject = {
      id,
      name: seed.name,
      objective: seed.objective,
      nextAction: getGitHubNextAction(seed),
      status: seed.isArchived ? "done" : existing?.status ?? "pending",
      dueDate: existing?.dueDate ?? null,
      progress,
      source: "github",
      repositoryUrl: seed.url,
      language: seed.language,
      visibility: seed.visibility,
      defaultBranch: seed.defaultBranch,
      lastPushedAt: seed.pushedAt,
      openIssues: seed.openIssues,
      openPullRequests: seed.openPullRequests,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: seed.updatedAt
    };

    projectsById.set(id, existing ? { ...existing, ...imported, status: existing.status } : imported);
  });

  return [...projectsById.values()].sort((left, right) => {
    if (left.source !== right.source) return left.source === "github" ? -1 : 1;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function normalizeProject(project: Partial<CommandProject>): CommandProject {
  return {
    id: project.id ?? makeId("project"),
    name: project.name ?? "Untitled project",
    objective: project.objective ?? "",
    nextAction: project.nextAction ?? "",
    status: project.status ?? "pending",
    dueDate: project.dueDate ?? null,
    progress: clampProgress(project.progress ?? 0),
    source: project.source ?? "manual",
    repositoryUrl: project.repositoryUrl ?? null,
    language: project.language ?? null,
    visibility: project.visibility ?? null,
    defaultBranch: project.defaultBranch ?? null,
    lastPushedAt: project.lastPushedAt ?? null,
    openIssues: project.openIssues ?? 0,
    openPullRequests: project.openPullRequests ?? 0,
    createdAt: project.createdAt ?? nowIso(),
    updatedAt: project.updatedAt ?? nowIso()
  };
}

function getGitHubProjectId(name: string): string {
  return `github-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function calculateGitHubProgress(seed: GitHubProjectSeed): number {
  const daysSincePush = Math.max(0, Math.round((Date.now() - new Date(seed.pushedAt).getTime()) / 86_400_000));
  const recencyScore = daysSincePush <= 7 ? 35 : daysSincePush <= 30 ? 25 : daysSincePush <= 90 ? 15 : 8;
  const descriptionScore = seed.objective && seed.objective !== "No GitHub description yet." ? 15 : 5;
  const languageScore = seed.language && seed.language !== "Unknown" ? 10 : 3;
  const branchScore = seed.defaultBranch ? 10 : 0;
  const issueScore = seed.openIssues + seed.openPullRequests === 0 ? 20 : Math.max(5, 20 - (seed.openIssues + seed.openPullRequests) * 4);
  const visibilityScore = seed.visibility === "private" ? 5 : 3;

  return clampProgress(Math.min(95, recencyScore + descriptionScore + languageScore + branchScore + issueScore + visibilityScore));
}

function getGitHubNextAction(seed: GitHubProjectSeed): string {
  if (seed.openPullRequests > 0) return `Review ${seed.openPullRequests} open pull request${seed.openPullRequests === 1 ? "" : "s"}.`;
  if (seed.openIssues > 0) return `Clear ${seed.openIssues} open issue${seed.openIssues === 1 ? "" : "s"}.`;
  if (!seed.objective || seed.objective === "No GitHub description yet.") return "Add a project description and define the next mission.";
  return `Review ${seed.defaultBranch} branch and set the next milestone.`;
}
