import { githubScanSummary } from "../data/githubProjects";

export type DeckView =
  | "dashboard"
  | "todo"
  | "daily"
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
export type Accent = "amber" | "cyan" | "green" | "red" | "pink";
export type Density = "comfortable" | "compact";
export type BackgroundMode = "black" | "white";
export type LogoStyle = "sentinel" | "monolith" | "radar" | "spire";
export type ProjectSource = "manual" | "github";
export type IntelKind = "stock" | "crypto" | "fund" | "company" | "trend" | "news";
export type IntelSignal = "watching" | "researching" | "high-priority" | "on-hold";
export type RoutineCadence = "daily" | "weekly";
export type RoutineDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type KanbanPriority = "urgent" | "normal" | "later";

export interface CommandTask {
  id: string;
  title: string;
  priority: Priority;
  kanbanPriority: KanbanPriority;
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

export interface RoutineEntry {
  id: string;
  title: string;
  cadence: RoutineCadence;
  days: RoutineDay[];
  completions: string[];
  streak: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookEntry {
  id: string;
  title: string;
  author: string;
  status: "queued" | "reading" | "done";
  progress: number;
  currentChapter: number;
  totalChapters: number;
  currentPage: number;
  totalPages: number;
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

export interface AutonomousIntelFinding {
  title: string;
  symbol: string;
  kind: IntelKind;
  signal: IntelSignal;
  thesis: string;
  sourceUrl: string;
  note: string;
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

export interface IntelAutopilotState {
  enabled: boolean;
  lastRunAt: string | null;
  lastSummary: string;
  lastFindingCount: number;
}

export interface DeckSettings {
  callsign: string;
  avatarUrl: string;
  age: string;
  phoneNumber: string;
  organizationName: string;
  commandCenterName: string;
  logoStyle: LogoStyle;
  accent: Accent;
  density: Density;
  background: BackgroundMode;
  ollamaEnabled: boolean;
  ollamaEndpoint: string;
  ollamaModel: string;
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
  routines: RoutineEntry[];
  projects: CommandProject[];
  calendar: CalendarEntry[];
  workouts: WorkoutEntry[];
  books: BookEntry[];
  journal: JournalEntry[];
  finances: FinanceEntry[];
  intel: IntelItem[];
  intelAutopilot: IntelAutopilotState;
  settings: DeckSettings;
}

export type CommandDeckAction =
  | { type: "task/add"; title: string; priority: Priority; dueDate: string | null }
  | { type: "task/update"; id: string; title: string; priority: Priority; dueDate: string | null }
  | { type: "task/kanban-priority"; id: string; priority: KanbanPriority }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "routine/add"; title: string; cadence: RoutineCadence; days: RoutineDay[] }
  | { type: "routine/update"; id: string; title: string; cadence: RoutineCadence; days: RoutineDay[] }
  | { type: "routine/toggle"; id: string; date?: string }
  | { type: "routine/delete"; id: string }
  | { type: "project/add"; name: string; objective: string; nextAction: string; dueDate: string | null; repositoryUrl?: string; defaultBranch?: string }
  | { type: "project/update"; id: string; name: string; objective: string; nextAction: string; dueDate: string | null; progress: number; repositoryUrl?: string; defaultBranch?: string }
  | { type: "project/complete"; id: string }
  | { type: "project/delete"; id: string }
  | { type: "github/import"; projects: GitHubProjectSeed[]; owner: string; scannedAt: string }
  | { type: "calendar/add"; title: string; date: string; time: string; entryType: CalendarEntry["type"] }
  | { type: "calendar/update"; id: string; title: string; date: string; time: string; entryType: CalendarEntry["type"] }
  | { type: "calendar/delete"; id: string }
  | { type: "workout/add"; name: string; day: string; focus: string }
  | { type: "workout/update"; id: string; name: string; day: string; focus: string }
  | { type: "workout/toggle"; id: string }
  | { type: "workout/delete"; id: string }
  | { type: "book/add"; title: string; author: string; currentChapter: number; totalChapters: number; currentPage: number; totalPages: number }
  | { type: "book/update"; id: string; title: string; author: string; currentChapter: number; totalChapters: number; currentPage: number; totalPages: number }
  | { type: "book/progress"; id: string; currentChapter: number; totalChapters: number; currentPage: number; totalPages: number }
  | { type: "book/delete"; id: string }
  | { type: "journal/add"; mood: string; body: string }
  | { type: "journal/update"; id: string; mood: string; body: string }
  | { type: "journal/delete"; id: string }
  | { type: "finance/add"; label: string; financeType: FinanceType; amount: number; date: string }
  | { type: "finance/update"; id: string; label: string; financeType: FinanceType; amount: number; date: string }
  | { type: "finance/toggle"; id: string }
  | { type: "finance/delete"; id: string }
  | { type: "intel/add"; title: string; symbol: string; kind: IntelKind; signal: IntelSignal; thesis: string; sourceUrl: string }
  | { type: "intel/update"; id: string; title: string; symbol: string; kind: IntelKind; signal: IntelSignal; thesis: string; sourceUrl: string }
  | { type: "intel/note"; id: string; body: string }
  | { type: "intel/delete"; id: string }
  | { type: "intel/autopilot/toggle"; enabled: boolean }
  | { type: "intel/autoscan"; findings: AutonomousIntelFinding[]; summary: string; scannedAt: string }
  | { type: "settings/update"; payload: Partial<DeckSettings> }
  | { type: "deck/import"; deck: Partial<CommandDeckState>; preserveLegacyGitHubProjects?: boolean }
  | { type: "deck/merge-import"; deck: Partial<CommandDeckState>; preserveLegacyGitHubProjects?: boolean }
  | { type: "deck/reset" };

export const COMMAND_DECK_STORAGE_KEY = "northwatch_v1";
const LEGACY_COMMAND_DECK_KEY = "wren-os.command-deck.v1";
const LEGACY_WORKSPACE_KEY = "wren-os.workspace.v1";
const SCHEMA_VERSION = 3;

const nowIso = () => new Date().toISOString();
const todayInput = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const intelKinds: IntelKind[] = ["stock", "crypto", "fund", "company", "trend", "news"];
const intelSignals: IntelSignal[] = ["watching", "researching", "high-priority", "on-hold"];
const logoStyles: LogoStyle[] = ["sentinel", "monolith", "radar", "spire"];
const accents: Accent[] = ["amber", "cyan", "green", "red", "pink"];
const backgroundModes: BackgroundMode[] = ["black", "white"];
const routineDays: RoutineDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface NormalizeCommandDeckOptions {
  preserveLegacyGitHubProjects?: boolean;
}

export const freshCommandDeck: CommandDeckState = {
  version: SCHEMA_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  githubScan: githubScanSummary,
  tasks: [],
  routines: [],
  projects: [],
  calendar: [],
  workouts: [],
  books: [],
  journal: [],
  finances: [],
  intel: [],
  intelAutopilot: {
    enabled: true,
    lastRunAt: null,
    lastSummary: "Autonomous scan is armed.",
    lastFindingCount: 0
  },
  settings: {
    callsign: "Operator",
    avatarUrl: "",
    age: "",
    phoneNumber: "",
    organizationName: "",
    commandCenterName: "Northwatch",
    logoStyle: "radar",
    accent: "amber",
    density: "comfortable",
    background: "black",
    ollamaEnabled: true,
    ollamaEndpoint: "http://127.0.0.1:11434",
    ollamaModel: "qwen2.5:1.5b",
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
            kanbanPriority: priorityToKanbanPriority(action.priority),
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

    case "task/update":
      return touch({
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                title: action.title,
                priority: action.priority,
                kanbanPriority: task.kanbanPriority ?? priorityToKanbanPriority(action.priority),
                dueDate: action.dueDate,
                updatedAt: timestamp
              }
            : task
        )
      }, timestamp);

    case "task/kanban-priority":
      return touch({
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? { ...task, kanbanPriority: action.priority, priority: kanbanPriorityToPriority(action.priority), updatedAt: timestamp }
            : task
        )
      }, timestamp);

    case "task/delete":
      return touch({ ...state, tasks: state.tasks.filter((task) => task.id !== action.id) }, timestamp);

    case "routine/add": {
      const days = normalizeRoutineDays(action.days, action.cadence);
      return touch({
        ...state,
        routines: [
          {
            id: makeId("routine"),
            title: action.title,
            cadence: action.cadence,
            days,
            completions: [],
            streak: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          },
          ...state.routines
        ]
      }, timestamp);
    }

    case "routine/update": {
      const days = normalizeRoutineDays(action.days, action.cadence);
      return touch({
        ...state,
        routines: state.routines.map((routine) =>
          routine.id === action.id
            ? {
                ...routine,
                title: action.title,
                cadence: action.cadence,
                days,
                updatedAt: timestamp
              }
            : routine
        )
      }, timestamp);
    }

    case "routine/toggle": {
      const date = normalizeCompletionDate(action.date) ?? todayInput();
      return touch({
        ...state,
        routines: state.routines.map((routine) => {
          if (routine.id !== action.id) return routine;
          const completions = routine.completions.includes(date)
            ? routine.completions.filter((item) => item !== date)
            : [...routine.completions, date].sort();

          return {
            ...routine,
            completions,
            streak: calculateRoutineStreak(completions),
            updatedAt: timestamp
          };
        })
      }, timestamp);
    }

    case "routine/delete":
      return touch({ ...state, routines: state.routines.filter((routine) => routine.id !== action.id) }, timestamp);

    case "project/add": {
      const repoLink = normalizeGitHubRepositoryLink(action.repositoryUrl, action.defaultBranch);
      return touch({
        ...state,
        projects: [
          {
            id: makeId("project"),
            name: action.name || repoLink?.name || "Untitled project",
            objective: action.objective,
            nextAction: action.nextAction,
            status: "pending",
            dueDate: action.dueDate,
            progress: 0,
            source: repoLink ? "github" : "manual",
            repositoryUrl: repoLink?.url ?? null,
            language: null,
            visibility: null,
            defaultBranch: repoLink?.defaultBranch ?? null,
            lastPushedAt: null,
            openIssues: 0,
            openPullRequests: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          },
          ...state.projects
        ]
      }, timestamp);
    }

    case "project/complete":
      return touch({
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.id ? { ...project, status: project.status === "done" ? "pending" : "done", updatedAt: timestamp } : project
        )
      }, timestamp);

    case "project/update":
      return touch({
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== action.id) return project;
          const repoLink = normalizeGitHubRepositoryLink(action.repositoryUrl, action.defaultBranch);
          return {
            ...project,
            name: action.name || repoLink?.name || project.name,
            objective: action.objective,
            nextAction: action.nextAction,
            dueDate: action.dueDate,
            progress: clampProgress(action.progress),
            source: repoLink ? "github" : "manual",
            repositoryUrl: repoLink?.url ?? null,
            defaultBranch: repoLink?.defaultBranch ?? null,
            updatedAt: timestamp
          };
        })
      }, timestamp);

    case "project/delete":
      return touch({ ...state, projects: state.projects.filter((project) => project.id !== action.id) }, timestamp);

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

    case "calendar/update":
      return touch({
        ...state,
        calendar: state.calendar.map((entry) =>
          entry.id === action.id ? { ...entry, title: action.title, date: action.date, time: action.time, type: action.entryType } : entry
        )
      }, timestamp);

    case "calendar/delete":
      return touch({ ...state, calendar: state.calendar.filter((entry) => entry.id !== action.id) }, timestamp);

    case "workout/add":
      return touch({
        ...state,
        workouts: [{ id: makeId("workout"), name: action.name, day: action.day, focus: action.focus, status: "planned" }, ...state.workouts]
      }, timestamp);

    case "workout/update":
      return touch({
        ...state,
        workouts: state.workouts.map((entry) =>
          entry.id === action.id ? { ...entry, name: action.name, day: action.day, focus: action.focus } : entry
        )
      }, timestamp);

    case "workout/toggle":
      return touch({
        ...state,
        workouts: state.workouts.map((entry) =>
          entry.id === action.id ? { ...entry, status: entry.status === "done" ? "planned" : "done" } : entry
        )
      }, timestamp);

    case "workout/delete":
      return touch({ ...state, workouts: state.workouts.filter((entry) => entry.id !== action.id) }, timestamp);

    case "book/add":
      const addedBookProgress = calculateBookProgress(action.currentChapter, action.totalChapters, action.currentPage, action.totalPages);
      return touch({
        ...state,
        books: [
          {
            id: makeId("book"),
            title: action.title,
            author: action.author,
            status: addedBookProgress >= 100 ? "done" : "reading",
            progress: addedBookProgress,
            currentChapter: clampCount(action.currentChapter),
            totalChapters: clampCount(action.totalChapters),
            currentPage: clampCount(action.currentPage),
            totalPages: clampCount(action.totalPages)
          },
          ...state.books
        ]
      }, timestamp);

    case "book/update": {
      const updatedBookProgress = calculateBookProgress(action.currentChapter, action.totalChapters, action.currentPage, action.totalPages);
      return touch({
        ...state,
        books: state.books.map((book) =>
          book.id === action.id
            ? {
                ...book,
                title: action.title,
                author: action.author,
                progress: updatedBookProgress,
                currentChapter: clampCount(action.currentChapter),
                totalChapters: clampCount(action.totalChapters),
                currentPage: clampCount(action.currentPage),
                totalPages: clampCount(action.totalPages),
                status: updatedBookProgress >= 100 ? "done" : "reading"
              }
            : book
        )
      }, timestamp);
    }

    case "book/progress": {
      const progress = calculateBookProgress(action.currentChapter, action.totalChapters, action.currentPage, action.totalPages);
      return touch({
        ...state,
        books: state.books.map((book) =>
          book.id === action.id
            ? {
                ...book,
                progress,
                currentChapter: clampCount(action.currentChapter),
                totalChapters: clampCount(action.totalChapters),
                currentPage: clampCount(action.currentPage),
                totalPages: clampCount(action.totalPages),
                status: progress >= 100 ? "done" : "reading"
              }
            : book
        )
      }, timestamp);
    }

    case "book/delete":
      return touch({ ...state, books: state.books.filter((book) => book.id !== action.id) }, timestamp);

    case "journal/add":
      return touch({
        ...state,
        journal: [{ id: makeId("journal"), date: todayInput(), mood: action.mood, body: action.body }, ...state.journal]
      }, timestamp);

    case "journal/update":
      return touch({
        ...state,
        journal: state.journal.map((entry) => (entry.id === action.id ? { ...entry, mood: action.mood, body: action.body } : entry))
      }, timestamp);

    case "journal/delete":
      return touch({ ...state, journal: state.journal.filter((entry) => entry.id !== action.id) }, timestamp);

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

    case "finance/update":
      return touch({
        ...state,
        finances: state.finances.map((entry) =>
          entry.id === action.id
            ? { ...entry, label: action.label, type: action.financeType, amount: action.amount, date: action.date }
            : entry
        )
      }, timestamp);

    case "finance/toggle":
      return touch({
        ...state,
        finances: state.finances.map((entry) =>
          entry.id === action.id ? { ...entry, status: entry.status === "cleared" ? "planned" : "cleared" } : entry
        )
      }, timestamp);

    case "finance/delete":
      return touch({ ...state, finances: state.finances.filter((entry) => entry.id !== action.id) }, timestamp);

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

    case "intel/update":
      return touch({
        ...state,
        intel: state.intel.map((item) =>
          item.id === action.id
            ? {
                ...item,
                title: action.title,
                symbol: action.symbol.trim().toUpperCase(),
                kind: action.kind,
                signal: action.signal,
                thesis: action.thesis,
                sourceUrl: action.sourceUrl.trim() || null,
                updatedAt: timestamp
              }
            : item
        )
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

    case "intel/delete":
      return touch({ ...state, intel: state.intel.filter((item) => item.id !== action.id) }, timestamp);

    case "intel/autopilot/toggle":
      return touch({ ...state, intelAutopilot: { ...state.intelAutopilot, enabled: action.enabled } }, timestamp);

    case "intel/autoscan":
      return touch({
        ...state,
        intel: mergeAutonomousIntelFindings(state.intel, action.findings, action.scannedAt || timestamp),
        intelAutopilot: {
          ...state.intelAutopilot,
          lastRunAt: action.scannedAt || timestamp,
          lastSummary: action.summary,
          lastFindingCount: action.findings.length
        }
      }, timestamp);

    case "settings/update":
      return touch({ ...state, settings: { ...state.settings, ...action.payload } }, timestamp);

    case "deck/import":
      return normalizeCommandDeck(action.deck, { preserveLegacyGitHubProjects: Boolean(action.preserveLegacyGitHubProjects) });

    case "deck/merge-import":
      return mergeImportedCommandDeck(state, action.deck, timestamp, {
        preserveLegacyGitHubProjects: Boolean(action.preserveLegacyGitHubProjects)
      });

    case "deck/reset":
      return createFreshDeck();

    default:
      return state;
  }
}

export function getCommandDeckStorageKey(userId?: string | null): string {
  if (!userId) return COMMAND_DECK_STORAGE_KEY;
  return `${COMMAND_DECK_STORAGE_KEY}:${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function loadCommandDeck(storage: Storage = window.localStorage, userId?: string | null): CommandDeckState {
  const storageKey = getCommandDeckStorageKey(userId);
  if (userId) {
    const browserDeck = loadBrowserDeckFallback(storage);
    const rawUserDeck = storage.getItem(storageKey);
    if (!rawUserDeck) {
      if (browserDeck) {
        saveCommandDeck(browserDeck, storage, userId);
        return browserDeck;
      }

      return createFreshDeck();
    }

    try {
      const userDeck = normalizeCommandDeck(JSON.parse(rawUserDeck) as Partial<CommandDeckState>);
      if (browserDeck && !hasMeaningfulDeckData(userDeck)) {
        saveCommandDeck(browserDeck, storage, userId);
        return browserDeck;
      }

      return userDeck;
    } catch {
      if (browserDeck) {
        saveCommandDeck(browserDeck, storage, userId);
        return browserDeck;
      }

      return createFreshDeck();
    }
  }

  return loadBrowserDeckFallback(storage) ?? createFreshDeck();
}

function loadBrowserDeckFallback(storage: Storage): CommandDeckState | null {
  const migratedLegacyDeck = migrateLegacyWorkspace(storage.getItem(LEGACY_WORKSPACE_KEY));
  const raw = storage.getItem(COMMAND_DECK_STORAGE_KEY) ?? storage.getItem(LEGACY_COMMAND_DECK_KEY);
  if (!raw) return migratedLegacyDeck;

  try {
    const parsed = JSON.parse(raw) as Partial<CommandDeckState>;
    const normalized = normalizeCommandDeck(parsed);
    if (migratedLegacyDeck && !hasUserDeckData(normalized) && hasUserDeckData(migratedLegacyDeck)) {
      return migratedLegacyDeck;
    }

    return hasMeaningfulDeckData(normalized) ? normalized : migratedLegacyDeck;
  } catch {
    return migratedLegacyDeck;
  }
}

export function saveCommandDeck(state: CommandDeckState, storage: Storage = window.localStorage, userId?: string | null): void {
  storage.setItem(getCommandDeckStorageKey(userId), JSON.stringify(state));
}

export function getDeckMetrics(state: CommandDeckState) {
  const openTasks = state.tasks.filter((task) => task.status === "todo");
  const doneTasks = state.tasks.filter((task) => task.status === "done");
  const today = todayInput();
  const todayDay = getRoutineDay(today);
  const routinesDueToday = state.routines.filter((routine) => routine.days.includes(todayDay));
  const routinesDoneToday = routinesDueToday.filter((routine) => routine.completions.includes(today));
  const pendingProjects = state.projects.filter((project) => project.status === "pending");
  const doneProjects = state.projects.filter((project) => project.status === "done");
  const income = state.finances.filter((entry) => entry.type === "income").reduce((total, entry) => total + entry.amount, 0);
  const expenses = state.finances.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
  const savings = state.finances.filter((entry) => entry.type === "savings").reduce((total, entry) => total + entry.amount, 0);
  const totalActions = state.tasks.length + state.routines.length + state.projects.length + state.workouts.length + state.books.length + state.journal.length + state.intel.length;
  const completedActions = doneTasks.length + routinesDoneToday.length + doneProjects.length + state.workouts.filter((entry) => entry.status === "done").length;
  const projectProgress =
    state.projects.length === 0
      ? 0
      : Math.round(state.projects.reduce((total, project) => total + project.progress, 0) / state.projects.length);

  return {
    openTasks: openTasks.length,
    doneTasks: doneTasks.length,
    routinesDueToday: routinesDueToday.length,
    routinesDoneToday: routinesDoneToday.length,
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

export function normalizeCommandDeck(value: Partial<CommandDeckState>, options: NormalizeCommandDeckOptions = {}): CommandDeckState {
  const fresh = createFreshDeck();
  const incomingSettings: Partial<DeckSettings> = value.settings ?? {};
  const incomingVersion = typeof value.version === "number" ? value.version : 0;
  const projects = getSafeNormalizedProjects(value, options);
  return {
    ...fresh,
    ...value,
    version: SCHEMA_VERSION,
    tasks: Array.isArray(value.tasks) ? value.tasks.map(normalizeTask) : [],
    routines: Array.isArray(value.routines) ? value.routines.map(normalizeRoutine) : [],
    githubScan: normalizeGithubScan(value.githubScan, projects, options),
    projects,
    calendar: Array.isArray(value.calendar) ? value.calendar : [],
    workouts: Array.isArray(value.workouts) ? value.workouts : [],
    books: Array.isArray(value.books) ? value.books.map(normalizeBook) : [],
    journal: Array.isArray(value.journal) ? value.journal : [],
    finances: Array.isArray(value.finances) ? value.finances : [],
    intel: Array.isArray(value.intel) ? value.intel.map(normalizeIntelItem) : [],
    intelAutopilot: normalizeIntelAutopilot(value.intelAutopilot),
    settings: {
      ...fresh.settings,
      ...incomingSettings,
      callsign: getString(incomingSettings.callsign) ?? fresh.settings.callsign,
      avatarUrl: getString(incomingSettings.avatarUrl) ?? fresh.settings.avatarUrl,
      age: getString(incomingSettings.age) ?? fresh.settings.age,
      phoneNumber: getString(incomingSettings.phoneNumber) ?? fresh.settings.phoneNumber,
      organizationName: getString(incomingSettings.organizationName) ?? fresh.settings.organizationName,
      commandCenterName: getString(incomingSettings.commandCenterName) ?? fresh.settings.commandCenterName,
      accent: normalizeAccent(incomingSettings.accent),
      background: normalizeBackground(incomingSettings.background),
      logoStyle: normalizeLogoStyle(incomingSettings.logoStyle, incomingVersion)
    },
    updatedAt: value.updatedAt ?? fresh.updatedAt
  };
}

export function mergeImportedCommandDeck(
  currentDeck: CommandDeckState,
  importedValue: Partial<CommandDeckState>,
  updatedAt: string = nowIso(),
  options: NormalizeCommandDeckOptions = {}
): CommandDeckState {
  const importedDeck = normalizeCommandDeck(importedValue, options);
  const mergedProjects = mergeDeckItems(importedDeck.projects, currentDeck.projects);

  return {
    ...currentDeck,
    createdAt: getOlderTimestamp(currentDeck.createdAt, importedDeck.createdAt),
    updatedAt,
    githubScan: normalizeGithubScan(
      currentDeck.githubScan.projectCount > 0 ? currentDeck.githubScan : importedDeck.githubScan,
      mergedProjects,
      options
    ),
    tasks: mergeDeckItems(importedDeck.tasks, currentDeck.tasks),
    routines: mergeDeckItems(importedDeck.routines, currentDeck.routines),
    projects: mergedProjects,
    calendar: mergeDeckItems(importedDeck.calendar, currentDeck.calendar),
    workouts: mergeDeckItems(importedDeck.workouts, currentDeck.workouts),
    books: mergeDeckItems(importedDeck.books, currentDeck.books),
    journal: mergeDeckItems(importedDeck.journal, currentDeck.journal),
    finances: mergeDeckItems(importedDeck.finances, currentDeck.finances),
    intel: mergeDeckItems(importedDeck.intel, currentDeck.intel),
    intelAutopilot: currentDeck.intel.length > 0 ? currentDeck.intelAutopilot : importedDeck.intelAutopilot,
    settings: hasCustomizedSettings(currentDeck) ? currentDeck.settings : importedDeck.settings
  };
}

function mergeDeckItems<T extends { id: string }>(importedItems: T[], currentItems: T[]): T[] {
  const byId = new Map<string, T>();
  importedItems.forEach((item) => byId.set(item.id, item));
  currentItems.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

function getOlderTimestamp(left: string, right: string): string {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  if (Number.isNaN(leftTime)) return right;
  if (Number.isNaN(rightTime)) return left;
  return leftTime <= rightTime ? left : right;
}

function createFreshDeck(): CommandDeckState {
  const timestamp = nowIso();
  return {
    ...freshCommandDeck,
    createdAt: timestamp,
    updatedAt: timestamp,
    githubScan: githubScanSummary,
    tasks: [],
    routines: [],
    projects: [],
    calendar: [],
    workouts: [],
    books: [],
    journal: [],
    finances: [],
    intel: [],
    intelAutopilot: { ...freshCommandDeck.intelAutopilot }
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
        commandCenterName: getString(workspace.name) ?? freshCommandDeck.settings.commandCenterName,
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
  const priority = normalizePriority(task.priority);
  return {
    id: getString(task.id) ?? makeId("legacy-task"),
    title: getString(task.title) ?? "Untitled legacy task",
    priority,
    kanbanPriority: priorityToKanbanPriority(priority),
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
    kanbanPriority: action.status === "pending" ? "urgent" : "normal",
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
    kanbanPriority: "normal",
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

function normalizeTask(task: Partial<CommandTask>): CommandTask {
  const updatedAt = getString(task.updatedAt) ?? nowIso();
  const priority = normalizePriority(task.priority);
  return {
    id: getString(task.id) ?? makeId("task"),
    title: getString(task.title) ?? "Untitled task",
    priority,
    kanbanPriority: normalizeKanbanPriority(task.kanbanPriority, priority),
    dueDate: getNullableString(task.dueDate),
    status: task.status === "done" ? "done" : "todo",
    createdAt: getString(task.createdAt) ?? updatedAt,
    updatedAt
  };
}

function normalizePriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function normalizeKanbanPriority(value: unknown, fallbackPriority: Priority): KanbanPriority {
  if (value === "urgent" || value === "normal" || value === "later") return value;
  return priorityToKanbanPriority(fallbackPriority);
}

function priorityToKanbanPriority(priority: Priority): KanbanPriority {
  if (priority === "critical" || priority === "high") return "urgent";
  if (priority === "low") return "later";
  return "normal";
}

function kanbanPriorityToPriority(priority: KanbanPriority): Priority {
  if (priority === "urgent") return "critical";
  if (priority === "later") return "low";
  return "medium";
}

function normalizeAccent(value: unknown): Accent {
  return accents.includes(value as Accent) ? value as Accent : freshCommandDeck.settings.accent;
}

function normalizeBackground(value: unknown): BackgroundMode {
  return backgroundModes.includes(value as BackgroundMode) ? value as BackgroundMode : freshCommandDeck.settings.background;
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
    state.routines.length > 0 ||
    state.projects.length > 0 ||
    state.calendar.length > 0 ||
    state.workouts.length > 0 ||
    state.books.length > 0 ||
    state.journal.length > 0 ||
    state.finances.length > 0 ||
    state.intel.length > 0
  );
}

export function hasMeaningfulDeckData(state: CommandDeckState): boolean {
  return hasUserDeckData(state) || hasCustomizedSettings(state);
}

function hasCustomizedSettings(state: CommandDeckState): boolean {
  return Object.entries(freshCommandDeck.settings).some(([key, defaultValue]) => {
    const settingKey = key as keyof DeckSettings;
    return state.settings[settingKey] !== defaultValue;
  });
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

function normalizeIntelAutopilot(value: Partial<IntelAutopilotState> | undefined): IntelAutopilotState {
  return {
    enabled: value?.enabled !== false,
    lastRunAt: getNullableString(value?.lastRunAt),
    lastSummary: getString(value?.lastSummary) ?? freshCommandDeck.intelAutopilot.lastSummary,
    lastFindingCount: Number.isFinite(value?.lastFindingCount) ? Math.max(0, Math.round(value?.lastFindingCount ?? 0)) : 0
  };
}

function mergeAutonomousIntelFindings(current: IntelItem[], findings: AutonomousIntelFinding[], timestamp: string): IntelItem[] {
  return findings.reduce((items, finding) => {
    const normalized = normalizeAutonomousIntelFinding(finding);
    if (!normalized) return items;

    const existingIndex = items.findIndex((item) => getIntelIdentity(item.title, item.symbol) === getIntelIdentity(normalized.title, normalized.symbol));
    if (existingIndex === -1) {
      const nextItem: IntelItem = {
        id: makeId("intel-auto"),
        title: normalized.title,
        symbol: normalized.symbol,
        kind: normalized.kind,
        signal: normalized.signal,
        thesis: normalized.thesis,
        sourceUrl: normalized.sourceUrl || null,
        notes: normalized.note ? [{ id: makeId("intel-note"), body: normalized.note, createdAt: timestamp }] : [],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return [nextItem, ...items];
    }

    const existing = items[existingIndex];
    const noteAlreadyExists = normalized.note && existing.notes.some((note) => note.body === normalized.note);
    const notes = normalized.note && !noteAlreadyExists
      ? [{ id: makeId("intel-note"), body: normalized.note, createdAt: timestamp }, ...existing.notes]
      : existing.notes;
    const nextItems = items.slice();
    nextItems[existingIndex] = {
      ...existing,
      kind: normalized.kind,
      signal: getStrongerIntelSignal(existing.signal, normalized.signal),
      thesis: normalized.thesis || existing.thesis,
      sourceUrl: normalized.sourceUrl || existing.sourceUrl,
      notes,
      updatedAt: timestamp
    };
    return nextItems;
  }, current.map(normalizeIntelItem));
}

function normalizeAutonomousIntelFinding(finding: AutonomousIntelFinding): AutonomousIntelFinding | null {
  const title = finding.title.trim();
  if (!title) return null;

  return {
    title,
    symbol: finding.symbol.trim().toUpperCase(),
    kind: intelKinds.includes(finding.kind) ? finding.kind : "trend",
    signal: intelSignals.includes(finding.signal) ? finding.signal : "researching",
    thesis: finding.thesis.trim(),
    sourceUrl: finding.sourceUrl.trim(),
    note: finding.note.trim()
  };
}

function getIntelIdentity(title: string, symbol: string): string {
  if (title.trim().toLowerCase().startsWith("repo:")) {
    return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  return normalizedSymbol || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getStrongerIntelSignal(current: IntelSignal, incoming: IntelSignal): IntelSignal {
  const priority: Record<IntelSignal, number> = {
    "on-hold": 0,
    watching: 1,
    researching: 2,
    "high-priority": 3
  };

  return priority[incoming] > priority[current] ? incoming : current;
}

function normalizeRoutine(routine: Partial<RoutineEntry>): RoutineEntry {
  const timestamp = nowIso();
  const cadence = routine.cadence === "weekly" ? "weekly" : "daily";
  const completions = Array.isArray(routine.completions)
    ? Array.from(new Set(routine.completions.map(normalizeCompletionDate).filter((date): date is string => Boolean(date)))).sort()
    : [];

  return {
    id: routine.id ?? makeId("routine"),
    title: routine.title ?? "Untitled routine",
    cadence,
    days: normalizeRoutineDays(routine.days ?? [], cadence),
    completions,
    streak: calculateRoutineStreak(completions),
    createdAt: routine.createdAt ?? timestamp,
    updatedAt: routine.updatedAt ?? timestamp
  };
}

function normalizeRoutineDays(days: unknown[], cadence: RoutineCadence): RoutineDay[] {
  if (cadence === "daily") return routineDays;
  const normalized = days.filter((day): day is RoutineDay => routineDays.includes(day as RoutineDay));
  return Array.from(new Set(normalized));
}

function normalizeCompletionDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function calculateRoutineStreak(completions: string[]): number {
  if (completions.length === 0) return 0;
  const completionSet = new Set(completions);
  const latest = completions.slice().sort().at(-1);
  if (!latest) return 0;

  let streak = 0;
  let cursor = parseDateInput(latest);
  while (completionSet.has(formatDateInput(cursor))) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return streak;
}

function getRoutineDay(date: string): RoutineDay {
  return routineDays[parseDateInput(date).getUTCDay() === 0 ? 6 : parseDateInput(date).getUTCDay() - 1];
}

function parseDateInput(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeBook(book: Partial<BookEntry>): BookEntry {
  const currentChapter = clampCount(book.currentChapter ?? 0);
  const totalChapters = clampCount(book.totalChapters ?? 0);
  const currentPage = clampCount(book.currentPage ?? 0);
  const totalPages = clampCount(book.totalPages ?? 0);
  const progress = totalPages > 0 || totalChapters > 0
    ? calculateBookProgress(currentChapter, totalChapters, currentPage, totalPages)
    : clampProgress(book.progress ?? 0);

  return {
    id: book.id ?? makeId("book"),
    title: book.title ?? "Untitled book",
    author: book.author ?? "Unknown",
    status: progress >= 100 ? "done" : book.status ?? "reading",
    progress,
    currentChapter,
    totalChapters,
    currentPage,
    totalPages
  };
}

function calculateBookProgress(currentChapter: number, totalChapters: number, currentPage: number, totalPages: number): number {
  const safeCurrentPage = clampCount(currentPage);
  const safeTotalPages = clampCount(totalPages);
  const safeCurrentChapter = clampCount(currentChapter);
  const safeTotalChapters = clampCount(totalChapters);

  if (safeTotalPages > 0) {
    return clampProgress((Math.min(safeCurrentPage, safeTotalPages) / safeTotalPages) * 100);
  }

  if (safeTotalChapters > 0) {
    return clampProgress((Math.min(safeCurrentChapter, safeTotalChapters) / safeTotalChapters) * 100);
  }

  return 0;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
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

function getSafeNormalizedProjects(value: Partial<CommandDeckState>, options: NormalizeCommandDeckOptions): CommandProject[] {
  const projects = Array.isArray(value.projects) ? value.projects.map(normalizeProject) : [];
  if (!options.preserveLegacyGitHubProjects && isLegacySeededGitHubScan(value.githubScan)) {
    return projects.filter((project) => project.source !== "github");
  }

  return projects;
}

function normalizeGithubScan(
  scan: CommandDeckState["githubScan"] | undefined,
  projects: CommandProject[],
  options: NormalizeCommandDeckOptions = {}
): CommandDeckState["githubScan"] {
  if (!scan || (!options.preserveLegacyGitHubProjects && isLegacySeededGitHubScan(scan))) {
    return {
      ...githubScanSummary,
      projectCount: projects.filter((project) => project.source === "github").length
    };
  }

  return {
    owner: scan.owner ?? "",
    scannedAt: scan.scannedAt ?? "",
    projectCount: projects.filter((project) => project.source === "github").length
  };
}

function normalizeProject(project: Partial<CommandProject>): CommandProject {
  const repoLink = normalizeGitHubRepositoryLink(project.repositoryUrl, project.defaultBranch);
  return {
    id: project.id ?? makeId("project"),
    name: project.name ?? "Untitled project",
    objective: project.objective ?? "",
    nextAction: project.nextAction ?? "",
    status: project.status ?? "pending",
    dueDate: project.dueDate ?? null,
    progress: clampProgress(project.progress ?? 0),
    source: repoLink ? "github" : project.source ?? "manual",
    repositoryUrl: repoLink?.url ?? null,
    language: project.language ?? null,
    visibility: project.visibility ?? null,
    defaultBranch: repoLink?.defaultBranch ?? project.defaultBranch ?? null,
    lastPushedAt: project.lastPushedAt ?? null,
    openIssues: project.openIssues ?? 0,
    openPullRequests: project.openPullRequests ?? 0,
    createdAt: project.createdAt ?? nowIso(),
    updatedAt: project.updatedAt ?? nowIso()
  };
}

function normalizeGitHubRepositoryLink(repositoryUrl?: string | null, defaultBranch?: string | null): { name: string; url: string; defaultBranch: string | null } | null {
  const raw = repositoryUrl?.trim();
  if (!raw) return null;

  const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(prefixed);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const [owner, repoWithSuffix] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repoWithSuffix) return null;

    const repo = repoWithSuffix.replace(/\.git$/i, "");
    if (!repo || owner.includes("..") || repo.includes("..")) return null;
    return {
      name: repo,
      url: `https://github.com/${owner}/${repo}`,
      defaultBranch: defaultBranch?.trim() || null
    };
  } catch {
    return null;
  }
}

function isLegacySeededGitHubScan(scan: CommandDeckState["githubScan"] | undefined): boolean {
  return scan?.owner === "Glizocksama-2";
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
