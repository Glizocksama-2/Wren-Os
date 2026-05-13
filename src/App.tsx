import {
  Activity,
  Banknote,
  BatteryCharging,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Circle,
  CircleCheck,
  Cloud,
  Database,
  Dumbbell,
  ExternalLink,
  Gauge,
  GitBranch,
  Github,
  Grid2X2,
  KeyRound,
  ListTodo,
  LockKeyhole,
  LogOut,
  Mail,
  NotebookPen,
  Palette,
  PiggyBank,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import { supabase, supabaseConfig, type WrenSession } from "./lib/supabase";
import { loadCloudDeck, saveCloudDeck, type CloudDeckClient } from "./store/cloudDeck";
import {
  type Accent,
  type CalendarEntry,
  type CommandDeckAction,
  type CommandDeckState,
  type DeckSettings,
  type DeckView,
  type FinanceType,
  type Priority,
  getDeckMetrics,
  loadCommandDeck,
  reduceCommandDeck,
  saveCommandDeck
} from "./store/commandDeck";

const navItems: Array<{ view: DeckView; label: string; icon: ReactNode; terms: string[] }> = [
  { view: "dashboard", label: "Command", icon: <Grid2X2 size={18} />, terms: ["command", "dashboard", "home", "deck"] },
  { view: "todo", label: "To Do", icon: <ListTodo size={18} />, terms: ["todo", "task", "tasks", "list"] },
  { view: "projects", label: "Projects", icon: <Target size={18} />, terms: ["project", "projects", "pending", "done"] },
  { view: "calendar", label: "Calendar", icon: <CalendarDays size={18} />, terms: ["calendar", "event", "schedule"] },
  { view: "workout", label: "Workout", icon: <Dumbbell size={18} />, terms: ["workout", "training", "gym"] },
  { view: "books", label: "Books", icon: <BookOpen size={18} />, terms: ["book", "books", "reading"] },
  { view: "journal", label: "Journal", icon: <NotebookPen size={18} />, terms: ["journal", "notes", "log"] },
  { view: "finances", label: "Finances", icon: <Banknote size={18} />, terms: ["finance", "finances", "money", "cash"] },
  { view: "customize", label: "Customize", icon: <Settings2 size={18} />, terms: ["custom", "customize", "settings", "theme"] },
  { view: "account", label: "Account", icon: <UserRound size={18} />, terms: ["account", "profile", "login", "sync"] }
];

const priorityOptions: Priority[] = ["low", "medium", "high", "critical"];
const financeTypes: FinanceType[] = ["income", "expense", "savings"];
const eventTypes: CalendarEntry["type"][] = ["mission", "training", "finance", "personal"];
const accentOptions: Array<{ value: Accent; label: string }> = [
  { value: "amber", label: "Amber" },
  { value: "cyan", label: "Cyan" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" }
];

export default function App() {
  const [state, dispatch] = useReducer(reduceCommandDeck, undefined, () => loadCommandDeck());
  const [view, setView] = useState<DeckView>("dashboard");
  const [notice, setNotice] = useState("Fresh command deck initialized.");
  const [session, setSession] = useState<WrenSession | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfig.isConfigured);
  const [cloudReady, setCloudReady] = useState(!supabaseConfig.isConfigured);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(() => getInitialCloudStatus());
  const latestDeckRef = useRef(state);
  const saveTimerRef = useRef<number | null>(null);
  const metrics = useMemo(() => getDeckMetrics(state), [state]);
  const visibleNavItems = useMemo(() => navItems.filter((item) => isViewEnabled(item.view, state.settings)), [state.settings]);

  useEffect(() => {
    latestDeckRef.current = state;
    saveCommandDeck(state);
  }, [state]);

  useEffect(() => {
    if (!supabaseConfig.isConfigured || !supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setAuthReady(true);
        setCloudReady(true);
        setCloudStatus({
          mode: "error",
          label: "Cloud auth: session error",
          detail: error.message,
          lastSyncedAt: null,
          userEmail: null
        });
        return;
      }

      setSession(data.session);
      setAuthReady(true);
      if (!data.session) {
        setCloudReady(false);
        setCloudStatus({
          mode: "signed-out",
          label: "Cloud auth: sign in required",
          detail: "Use your Supabase magic link to unlock cross-device sync.",
          lastSyncedAt: null,
          userEmail: null
        });
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setCloudReady(false);
        setCloudStatus({
          mode: "signed-out",
          label: "Cloud auth: sign in required",
          detail: "Use your Supabase magic link to unlock cross-device sync.",
          lastSyncedAt: null,
          userEmail: null
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfig.isConfigured || !supabase || !authReady || !session) return;

    const userId = session.user.id;
    const userEmail = session.user.email ?? null;
    let isCancelled = false;
    setCloudReady(false);
    setCloudStatus({
      mode: "syncing",
      label: "Cloud auth: syncing",
      detail: "Loading your private Supabase command deck.",
      lastSyncedAt: null,
      userEmail
    });

    async function hydrateCloudDeck() {
      try {
        const client = supabase as unknown as CloudDeckClient;
        const cloudDeck = await loadCloudDeck(client, userId);

        if (isCancelled) return;

        if (cloudDeck) {
          dispatch({ type: "deck/import", deck: cloudDeck });
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: synced",
            detail: "Loaded your private Supabase workspace.",
            lastSyncedAt: cloudDeck.updatedAt,
            userEmail
          });
        } else {
          const savedAt = await saveCloudDeck(client, userId, latestDeckRef.current);
          if (isCancelled) return;
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: seeded",
            detail: "Created your private Supabase workspace from this browser.",
            lastSyncedAt: savedAt,
            userEmail
          });
        }

        setCloudReady(true);
      } catch (error) {
        if (isCancelled) return;
        setCloudReady(true);
        setCloudStatus({
          mode: "error",
          label: "Cloud auth: sync error",
          detail: getErrorMessage(error),
          lastSyncedAt: null,
          userEmail
        });
      }
    }

    void hydrateCloudDeck();

    return () => {
      isCancelled = true;
    };
  }, [authReady, session?.user.email, session?.user.id]);

  useEffect(() => {
    if (!supabaseConfig.isConfigured || !supabase || !session || !cloudReady) return;

    const userId = session.user.id;
    const userEmail = session.user.email ?? null;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setCloudStatus((current) => ({
      ...current,
      mode: current.mode === "error" ? current.mode : "syncing",
      label: current.mode === "error" ? current.label : "Cloud auth: saving"
    }));

    saveTimerRef.current = window.setTimeout(() => {
      const client = supabase as unknown as CloudDeckClient;
      saveCloudDeck(client, userId, latestDeckRef.current)
        .then((savedAt) => {
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: synced",
            detail: "Private Supabase workspace is current.",
            lastSyncedAt: savedAt,
            userEmail
          });
        })
        .catch((error) => {
          setCloudStatus({
            mode: "error",
            label: "Cloud auth: save error",
            detail: getErrorMessage(error),
            lastSyncedAt: null,
            userEmail
          });
        });
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [state, session?.user.email, session?.user.id, cloudReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (isViewEnabled(view, state.settings)) return;
    setView("customize");
    setNotice("Module hidden. Re-enable it from Customize.");
  }, [state.settings, view]);

  const navigateFromSearch = (query: string) => {
    const normalized = query.toLowerCase().trim();
    const target = visibleNavItems.find((item) => item.terms.some((term) => normalized.includes(term)));
    if (!target) {
      setNotice("No visible module matched. Check Customize if something is hidden.");
      return;
    }
    setView(target.view);
    setNotice(`Opened ${target.label}.`);
  };

  const requestMagicLink = async (email: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Signed out of cloud auth.");
  };

  if (supabaseConfig.isConfigured && !authReady) {
    return <CloudBootScreen status={cloudStatus} />;
  }

  if (supabaseConfig.isConfigured && authReady && !session) {
    return <AuthGate status={cloudStatus} onRequestMagicLink={requestMagicLink} />;
  }

  return (
    <div className="deck-app" data-accent={state.settings.accent} data-density={state.settings.density}>
      <aside className="tactical-rail" aria-label="Primary">
        <div className="rail-brand" aria-label="Wren OS">
          <Shield size={22} />
        </div>
        <nav className="rail-nav" aria-label="Primary">
          {visibleNavItems.map((item) => (
            <button
              className={`rail-button ${view === item.view ? "active" : ""}`}
              type="button"
              key={item.view}
              aria-label={item.label}
              title={item.label}
              onClick={() => setView(item.view)}
            >
              {item.icon}
            </button>
          ))}
        </nav>
        <div className="rail-footer">
          <span>{state.settings.callsign.slice(0, 1).toUpperCase()}</span>
        </div>
      </aside>

      <main className="deck-screen">
        <TopBar callsign={state.settings.callsign} cloudStatus={cloudStatus} onCommand={navigateFromSearch} onSignOut={signOut} />
        <section className="deck-content">
          {view === "dashboard" && <Dashboard state={state} metrics={metrics} dispatch={dispatch} setView={setView} setNotice={setNotice} />}
          {view === "todo" && <TodoModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "projects" && <ProjectsModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "calendar" && <CalendarModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "workout" && <WorkoutModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "books" && <BooksModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "journal" && <JournalModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "finances" && <FinancesModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "customize" && <CustomizeModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "account" && <AccountModule state={state} cloudStatus={cloudStatus} onSignOut={signOut} />}
        </section>
      </main>
      {notice && <div className="deck-toast">{notice}</div>}
    </div>
  );
}

function isViewEnabled(view: DeckView, settings: DeckSettings): boolean {
  switch (view) {
    case "calendar":
      return settings.showCalendar;
    case "workout":
      return settings.showWorkout;
    case "books":
      return settings.showBooks;
    case "journal":
      return settings.showJournal;
    case "finances":
      return settings.showFinance;
    default:
      return true;
  }
}

function TopBar({
  callsign,
  cloudStatus,
  onCommand,
  onSignOut
}: {
  callsign: string;
  cloudStatus: CloudStatus;
  onCommand: (query: string) => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState("");
  const checkedAt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCommand(query);
    setQuery("");
  };

  return (
    <header className="deck-topbar">
      <div>
        <span className="micro-label">Hello {callsign}</span>
        <strong>Wren OS Tactical Ledger</strong>
      </div>
      <form className="deck-search" onSubmit={submit}>
        <Gauge size={16} />
        <input
          aria-label="Command search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to todo, finances, journal..."
        />
      </form>
      <div className="deck-status-strip">
        <span>Last check: {checkedAt}</span>
        <span className={`cloud-status-pill ${cloudStatus.mode}`} title={cloudStatus.detail}>
          <Cloud size={14} />
          {cloudStatus.label}
        </span>
        {cloudStatus.userEmail && (
          <button className="topbar-icon-button" type="button" aria-label="Sign out of Wren OS" onClick={onSignOut}>
            <LogOut size={15} />
          </button>
        )}
        <Circle size={10} fill="currentColor" />
        <BatteryCharging size={17} />
        <strong>72%</strong>
      </div>
    </header>
  );
}

function CloudBootScreen({ status }: { status: CloudStatus }) {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="micro-label">Wren OS secure boot</span>
        <h1>Checking private access.</h1>
        <p>{status.detail}</p>
      </section>
    </main>
  );
}

function AuthGate({
  status,
  onRequestMagicLink
}: {
  status: CloudStatus;
  onRequestMagicLink: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(status.detail);
  const [isSending, setIsSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    try {
      await onRequestMagicLink(email.trim());
      setMessage("Magic link sent. Open it on this device to unlock Wren OS.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="micro-label">Private command deck</span>
        <h1>Wren OS is locked.</h1>
        <p>Sign in with Supabase Auth to sync your projects, tasks, journal, books, workouts, and finances across devices.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input
              aria-label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <button type="submit" disabled={isSending}>
            <Mail size={16} /> {isSending ? "Sending" : "Send magic link"}
          </button>
        </form>
        <small>{message}</small>
      </section>
    </main>
  );
}

function Dashboard({
  state,
  metrics,
  dispatch,
  setView,
  setNotice
}: {
  state: CommandDeckState;
  metrics: ReturnType<typeof getDeckMetrics>;
  dispatch: React.Dispatch<CommandDeckAction>;
  setView: (view: DeckView) => void;
  setNotice: (message: string) => void;
}) {
  const openProjects = state.projects.filter((project) => project.status === "pending").slice(0, 4);
  const topTasks = state.tasks.filter((task) => task.status === "todo").slice(0, 4);

  return (
    <div className="dashboard-layout">
      <section className="hero-command">
        <div className="hero-copy">
          <span className="system-dot">System operational</span>
          <h1>Your command deck, live. Built to keep you ready to move.</h1>
          <p>
            A fresh local-first base for tasks, projects, training, reading, journal, calendar, and finances.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => setView("todo")}>Add to do</button>
            <button type="button" onClick={() => setView("projects")}>Open projects</button>
          </div>
        </div>
        {state.settings.showOrbit && <OrbitGauge value={metrics.readiness} />}
      </section>

      <section className="github-scan-strip dashboard-scan">
        <Github size={18} />
        <div>
          <strong>{state.githubScan.projectCount} GitHub repos imported from {state.githubScan.owner}</strong>
          <span>Average project progress: {metrics.projectProgress}%</span>
        </div>
      </section>

      <section className="readiness-panel">
        <div>
          <span className="micro-label">Readiness Ratio</span>
          <h2>{metrics.readiness}%</h2>
          <p>{metrics.openTasks + metrics.pendingProjects === 0 ? "No pending pressure." : "Pending work is visible and contained."}</p>
        </div>
        <div className="long-meter">
          <span style={{ width: `${metrics.readiness}%` }} />
        </div>
      </section>

      {state.settings.showFinance && (
        <section className="battery-card">
          <span className="micro-label">Financial Position</span>
          <strong>{formatMoney(metrics.netCash)}</strong>
          <div className="battery-bars">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} className={index < Math.max(2, Math.min(18, Math.round((metrics.netCash + 1000) / 250))) ? "charged" : ""} />
            ))}
          </div>
          <small>{state.finances.length} finance entries tracked</small>
        </section>
      )}

      <MetricGrid metrics={metrics} />

      <section className="deck-panel wide-panel">
        <PanelHead title="Immediate Orders" action={<button onClick={() => setView("todo")} type="button">Open to do</button>} />
        <div className="ops-list">
          {topTasks.map((task) => (
            <button
              className="ops-row"
              key={task.id}
              type="button"
              onClick={() => {
                dispatch({ type: "task/toggle", id: task.id });
                setNotice("Task status updated.");
              }}
            >
              <span>{task.title}</span>
              <em>{task.priority}</em>
            </button>
          ))}
          {topTasks.length === 0 && <EmptyState>No to do items yet. Add the first order.</EmptyState>}
        </div>
      </section>

      <section className="deck-panel">
        <PanelHead title="Pending Projects" action={<button onClick={() => setView("projects")} type="button">Projects</button>} />
        <div className="ops-list">
          {openProjects.map((project) => (
            <div className="ops-row" key={project.id}>
              <span>{project.name}</span>
              <em>{project.nextAction || "No next action"}</em>
            </div>
          ))}
          {openProjects.length === 0 && <EmptyState>No pending projects.</EmptyState>}
        </div>
      </section>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: ReturnType<typeof getDeckMetrics> }) {
  const items = [
    ["To do", metrics.openTasks],
    ["Pending projects", metrics.pendingProjects],
    ["Done projects", metrics.doneProjects],
    ["GitHub progress", `${metrics.projectProgress}%`],
    ["Calendar", metrics.calendarEvents],
    ["Workouts done", metrics.workoutsDone],
    ["Reading", metrics.readingCount],
    ["Journal", metrics.journalEntries],
    ["Net cash", formatMoney(metrics.netCash)]
  ];

  return (
    <section className="metric-grid">
      {items.map(([label, value]) => (
        <div className="metric-tile" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function TodoModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const open = state.tasks.filter((task) => task.status === "todo");
  const done = state.tasks.filter((task) => task.status === "done");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: "task/add", title: title.trim(), priority, dueDate: dueDate || null });
    setTitle("");
    setDueDate("");
    setNotice("To do item added.");
  };

  return (
    <ModuleShell title="To Do List" description="Capture orders, finish them, clear the board.">
      <form className="command-form" onSubmit={submit}>
        <label>
          <span>Task</span>
          <input aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs action?" />
        </label>
        <label>
          <span>Priority</span>
          <select aria-label="Task priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {priorityOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Due</span>
          <input aria-label="Task due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <button type="submit"><Plus size={16} /> Add task</button>
      </form>
      <TwoColumn titleLeft="Active" titleRight="Done">
        <ItemList empty="No active tasks.">
          {open.map((task) => (
            <ActionRow key={task.id} title={task.title} meta={`${task.priority}${task.dueDate ? ` - ${formatDate(task.dueDate)}` : ""}`}>
              <button onClick={() => dispatch({ type: "task/toggle", id: task.id })} type="button">Done</button>
              <button onClick={() => dispatch({ type: "task/delete", id: task.id })} type="button" aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button>
            </ActionRow>
          ))}
        </ItemList>
        <ItemList empty="No completed tasks.">
          {done.map((task) => (
            <ActionRow key={task.id} title={task.title} meta="completed">
              <button onClick={() => dispatch({ type: "task/toggle", id: task.id })} type="button">Reopen</button>
            </ActionRow>
          ))}
        </ItemList>
      </TwoColumn>
    </ModuleShell>
  );
}

function ProjectsModule({ state, dispatch, setNotice }: ModuleProps) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const pending = state.projects.filter((project) => project.status === "pending");
  const done = state.projects.filter((project) => project.status === "done");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch({
      type: "project/add",
      name: name.trim(),
      objective: objective.trim(),
      nextAction: nextAction.trim(),
      dueDate: dueDate || null
    });
    setName("");
    setObjective("");
    setNextAction("");
    setDueDate("");
    setNotice("Project added to pending.");
  };

  return (
    <ModuleShell title="Projects" description="GitHub scan plus manual projects, with progress and next action visible.">
      <section className="github-scan-strip">
        <Github size={18} />
        <div>
          <strong>{state.githubScan.projectCount} GitHub repos imported from {state.githubScan.owner}</strong>
          <span>Last scan: {formatDateTime(state.githubScan.scannedAt)}</span>
        </div>
      </section>
      <form className="command-form project-form" onSubmit={submit}>
        <label><span>Name</span><input aria-label="Project name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Objective</span><input aria-label="Project objective" value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
        <label><span>Next action</span><input aria-label="Project next action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label>
        <label><span>Due</span><input aria-label="Project due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add project</button>
      </form>
      <TwoColumn titleLeft="Pending Projects" titleRight="Done Projects">
        <ItemList empty="No pending projects.">
          {pending.map((project) => (
            <ProjectRow key={project.id} project={project}>
              <button onClick={() => dispatch({ type: "project/complete", id: project.id })} type="button">Complete</button>
            </ProjectRow>
          ))}
        </ItemList>
        <ItemList empty="No done projects.">
          {done.map((project) => (
            <ProjectRow key={project.id} project={project}>
              <button onClick={() => dispatch({ type: "project/complete", id: project.id })} type="button">Reopen</button>
            </ProjectRow>
          ))}
        </ItemList>
      </TwoColumn>
    </ModuleShell>
  );
}

function CalendarModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [entryType, setEntryType] = useState<CalendarEntry["type"]>("mission");
  const sortedEvents = state.calendar.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const upcomingEvents = sortedEvents.filter((entry) => getDayDelta(entry.date) >= 0).slice(0, 5);
  const nextSevenDays = sortedEvents.filter((entry) => {
    const delta = getDayDelta(entry.date);
    return delta >= 0 && delta <= 6;
  });
  const eventMix = eventTypes.map((type) => ({
    type,
    count: state.calendar.filter((entry) => entry.type === type).length
  }));
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const dateValue = shiftDate(index);
    return {
      dateValue,
      label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${dateValue}T12:00:00`)),
      count: state.calendar.filter((entry) => entry.date === dateValue).length
    };
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: "calendar/add", title: title.trim(), date, time, entryType });
    setTitle("");
    setNotice("Calendar event added.");
  };

  return (
    <ModuleShell title="Calendar" description="Time blocks, appointments, training, and finance checkpoints.">
      <section className="life-layout calendar-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Time command</span>
            <h2>Mission Radar</h2>
            <p>{nextSevenDays.length === 0 ? "The next seven days are open. Build the week before it builds you." : `${nextSevenDays.length} event${nextSevenDays.length === 1 ? "" : "s"} inside the next seven days.`}</p>
          </div>
          <div className="week-strip" aria-label="Next seven day density">
            {weekDays.map((day) => (
              <div className={`week-node ${day.count > 0 ? "active" : ""}`} key={day.dateValue}>
                <strong>{day.label}</strong>
                <span>{day.count}</span>
              </div>
            ))}
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Next seven days" />
          <div className="timeline-list">
            {upcomingEvents.length === 0 && <EmptyState>No incoming events.</EmptyState>}
            {upcomingEvents.map((entry) => (
              <div className="timeline-item" key={entry.id}>
                <strong>{entry.time}</strong>
                <div>
                  <span>{entry.title}</span>
                  <em>{formatDate(entry.date)} - {entry.type}</em>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Event mix" />
          <div className="signal-grid compact">
            {eventMix.map((item) => (
              <div className="signal-card" key={item.type}>
                <span>{item.type}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
      <form className="command-form" onSubmit={submit}>
        <label><span>Event</span><input aria-label="Calendar event title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Date</span><input aria-label="Calendar date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label><span>Time</span><input aria-label="Calendar time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        <label>
          <span>Type</span>
          <select aria-label="Calendar type" value={entryType} onChange={(event) => setEntryType(event.target.value as CalendarEntry["type"])}>
            {eventTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button type="submit"><Plus size={16} /> Add event</button>
      </form>
      <section className="deck-panel">
        <PanelHead title="Full schedule" />
        <ItemList empty="No calendar entries.">
          {sortedEvents.map((entry) => (
            <ActionRow key={entry.id} title={entry.title} meta={`${formatDate(entry.date)} at ${entry.time} - ${entry.type}`} />
          ))}
        </ItemList>
      </section>
    </ModuleShell>
  );
}

function WorkoutModule({ state, dispatch, setNotice }: ModuleProps) {
  const [name, setName] = useState("");
  const [day, setDay] = useState("Monday");
  const [focus, setFocus] = useState("");
  const plannedCount = state.workouts.filter((entry) => entry.status === "planned").length;
  const doneCount = state.workouts.filter((entry) => entry.status === "done").length;
  const completion = state.workouts.length === 0 ? 0 : Math.round((doneCount / state.workouts.length) * 100);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const focusMix = state.workouts.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.focus || "general";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch({ type: "workout/add", name: name.trim(), day, focus: focus.trim() });
    setName("");
    setFocus("");
    setNotice("Workout added.");
  };

  return (
    <ModuleShell title="Workout" description="Plan training and mark sessions complete.">
      <section className="life-layout workout-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Physical systems</span>
            <h2>Training Split</h2>
            <p>{plannedCount === 0 ? "No planned sessions waiting." : `${plannedCount} planned session${plannedCount === 1 ? "" : "s"} waiting for execution.`}</p>
          </div>
          <div className="heat-strip" aria-label="Completion heat">
            {days.map((item) => {
              const dayWorkouts = state.workouts.filter((entry) => entry.day.toLowerCase() === item.toLowerCase());
              const completed = dayWorkouts.some((entry) => entry.status === "done");
              return <span key={item} className={completed ? "done" : dayWorkouts.length > 0 ? "planned" : ""}>{item.slice(0, 3)}</span>;
            })}
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Completion heat" />
          <div className="big-readout">
            <strong>{completion}%</strong>
            <span>{doneCount} done / {state.workouts.length || 0} total sessions</span>
          </div>
          <div className="long-meter"><span style={{ width: `${completion}%` }} /></div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Focus load" />
          <div className="tag-cloud">
            {Object.keys(focusMix).length === 0 && <span>general</span>}
            {Object.entries(focusMix).map(([label, count]) => <span key={label}>{label} x{count}</span>)}
          </div>
        </section>
      </section>
      <form className="command-form" onSubmit={submit}>
        <label><span>Session</span><input aria-label="Workout name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Day</span><input aria-label="Workout day" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <label><span>Focus</span><input aria-label="Workout focus" value={focus} onChange={(event) => setFocus(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add workout</button>
      </form>
      <section className="deck-panel">
        <PanelHead title="Training log" />
        <ItemList empty="No workouts planned.">
          {state.workouts.map((entry) => (
            <ActionRow key={entry.id} title={entry.name} meta={`${entry.day} - ${entry.focus || "general"} - ${entry.status}`}>
              <button onClick={() => dispatch({ type: "workout/toggle", id: entry.id })} type="button">
                {entry.status === "done" ? "Reopen" : "Done"}
              </button>
            </ActionRow>
          ))}
        </ItemList>
      </section>
    </ModuleShell>
  );
}

function BooksModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const reading = state.books.filter((book) => book.status === "reading");
  const done = state.books.filter((book) => book.status === "done");
  const averageProgress = state.books.length === 0 ? 0 : Math.round(state.books.reduce((total, book) => total + book.progress, 0) / state.books.length);
  const topBook = state.books.slice().sort((left, right) => right.progress - left.progress)[0];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: "book/add", title: title.trim(), author: author.trim() || "Unknown" });
    setTitle("");
    setAuthor("");
    setNotice("Book added.");
  };

  return (
    <ModuleShell title="Books Reading" description="Track the books you are reading and push progress forward.">
      <section className="life-layout books-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Knowledge intake</span>
            <h2>Reading Radar</h2>
            <p>{topBook ? `${topBook.title} is leading the stack at ${topBook.progress}%.` : "Start a reading stack and keep the signal moving."}</p>
          </div>
          <div className="book-spines" aria-label="Reading stack visualization">
            {(state.books.length ? state.books.slice(0, 6) : [{ id: "empty", progress: 12, title: "No book" }]).map((book) => (
              <span key={book.id} style={{ height: `${Math.max(18, book.progress)}%` }} title={book.title} />
            ))}
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Library lanes" />
          <div className="signal-grid compact">
            <div className="signal-card"><span>Reading</span><strong>{reading.length}</strong></div>
            <div className="signal-card"><span>Done</span><strong>{done.length}</strong></div>
            <div className="signal-card"><span>Average</span><strong>{averageProgress}%</strong></div>
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Next page" />
          <p className="panel-copy">{reading[0] ? `${reading[0].title} by ${reading[0].author}` : "Add a book to create the next reading action."}</p>
        </section>
      </section>
      <form className="command-form" onSubmit={submit}>
        <label><span>Title</span><input aria-label="Book title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Author</span><input aria-label="Book author" value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add book</button>
      </form>
      <div className="book-grid">
        {state.books.map((book) => (
          <article className="book-card" key={book.id}>
            <div>
              <BookMarked size={18} />
              <h3>{book.title}</h3>
              <p>{book.author}</p>
            </div>
            <div className="long-meter"><span style={{ width: `${book.progress}%` }} /></div>
            <label>
              <span className="micro-label">Progress {book.progress}%</span>
              <input
                aria-label={`${book.title} progress`}
                type="range"
                min="0"
                max="100"
                value={book.progress}
                onChange={(event) => dispatch({ type: "book/progress", id: book.id, progress: Number(event.target.value) })}
              />
            </label>
          </article>
        ))}
        {state.books.length === 0 && <EmptyState>No books tracked.</EmptyState>}
      </div>
    </ModuleShell>
  );
}

function JournalModule({ state, dispatch, setNotice }: ModuleProps) {
  const [mood, setMood] = useState("Focused");
  const [body, setBody] = useState("");
  const latestEntry = state.journal[0];
  const moodMix = state.journal.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] ?? 0) + 1;
    return acc;
  }, {});
  const prompts = ["What moved today?", "What is the next clean action?", "What pattern is repeating?"];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    dispatch({ type: "journal/add", mood: mood.trim() || "Logged", body: body.trim() });
    setBody("");
    setNotice("Journal entry saved.");
  };

  return (
    <ModuleShell title="Journal" description="Keep the internal log clean: what happened, what changed, what matters.">
      <section className="life-layout journal-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Internal signal</span>
            <h2>Reflection Brief</h2>
            <p>{latestEntry ? `${latestEntry.mood}: ${latestEntry.body.slice(0, 96)}${latestEntry.body.length > 96 ? "..." : ""}` : "Write the first log and give the day a clean record."}</p>
          </div>
          <div className="prompt-stack">
            {prompts.map((prompt) => <span key={prompt}>{prompt}</span>)}
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Mood signal" />
          <div className="tag-cloud">
            {Object.keys(moodMix).length === 0 && <span>Focused x0</span>}
            {Object.entries(moodMix).map(([label, count]) => <span key={label}>{label} x{count}</span>)}
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Entry archive" />
          <div className="big-readout">
            <strong>{state.journal.length}</strong>
            <span>total journal entries</span>
          </div>
        </section>
      </section>
      <form className="journal-form" onSubmit={submit}>
        <label><span>Mood</span><input aria-label="Journal mood" value={mood} onChange={(event) => setMood(event.target.value)} /></label>
        <label><span>Entry</span><textarea aria-label="Journal entry" value={body} onChange={(event) => setBody(event.target.value)} rows={8} /></label>
        <button type="submit"><Plus size={16} /> Save entry</button>
      </form>
      <section className="journal-archive">
        {state.journal.length === 0 && <EmptyState>No journal entries.</EmptyState>}
        {state.journal.map((entry) => (
          <article className="journal-card" key={entry.id}>
            <span>{formatDate(entry.date)}</span>
            <h3>{entry.mood}</h3>
            <p>{entry.body}</p>
          </article>
        ))}
      </section>
    </ModuleShell>
  );
}

function FinancesModule({ state, dispatch, setNotice }: ModuleProps) {
  const [label, setLabel] = useState("");
  const [financeType, setFinanceType] = useState<FinanceType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const metrics = getDeckMetrics(state);
  const income = state.finances.filter((entry) => entry.type === "income").reduce((total, entry) => total + entry.amount, 0);
  const expenses = state.finances.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
  const savings = state.finances.filter((entry) => entry.type === "savings").reduce((total, entry) => total + entry.amount, 0);
  const cleared = state.finances.filter((entry) => entry.status === "cleared").length;
  const planned = state.finances.length - cleared;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!label.trim() || !Number.isFinite(numericAmount)) return;
    dispatch({ type: "finance/add", label: label.trim(), financeType, amount: numericAmount, date });
    setLabel("");
    setAmount("");
    setNotice("Finance entry added.");
  };

  return (
    <ModuleShell title="Finances" description="Track income, expenses, savings, and cleared status.">
      <section className="life-layout finances-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Money systems</span>
            <h2>Cashflow Command</h2>
            <p>{metrics.netCash >= 0 ? "Net position is above zero. Keep pressure clean and visible." : "Net position is negative. Contain the leak and sequence the next move."}</p>
          </div>
          <div className="cash-orbit">
            <Wallet size={28} />
            <strong>{formatMoney(metrics.netCash)}</strong>
            <span>net cash</span>
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Flow mix" />
          <div className="money-grid">
            <div><TrendingUp size={16} /><span>Income</span><strong>{formatMoney(income)}</strong></div>
            <div><TrendingDown size={16} /><span>Expense</span><strong>{formatMoney(expenses)}</strong></div>
            <div><PiggyBank size={16} /><span>Savings</span><strong>{formatMoney(savings)}</strong></div>
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Ledger state" />
          <div className="big-readout">
            <strong>{cleared}/{state.finances.length}</strong>
            <span>{planned} planned entries waiting</span>
          </div>
        </section>
      </section>
      <section className="finance-summary">
        <div><span>Net</span><strong>{formatMoney(metrics.netCash)}</strong></div>
        <div><span>Entries</span><strong>{state.finances.length}</strong></div>
        <div><span>Cleared</span><strong>{state.finances.filter((entry) => entry.status === "cleared").length}</strong></div>
      </section>
      <form className="command-form" onSubmit={submit}>
        <label><span>Label</span><input aria-label="Finance label" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
        <label>
          <span>Type</span>
          <select aria-label="Finance type" value={financeType} onChange={(event) => setFinanceType(event.target.value as FinanceType)}>
            {financeTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label><span>Amount</span><input aria-label="Finance amount" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label><span>Date</span><input aria-label="Finance date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add finance</button>
      </form>
      <section className="deck-panel">
        <PanelHead title="Ledger stream" />
        <ItemList empty="No finance entries.">
          {state.finances.map((entry) => (
            <ActionRow key={entry.id} title={entry.label} meta={`${entry.type} - ${formatMoney(entry.amount)} - ${entry.status}`}>
              <button onClick={() => dispatch({ type: "finance/toggle", id: entry.id })} type="button">
                {entry.status === "cleared" ? "Plan" : "Clear"}
              </button>
            </ActionRow>
          ))}
        </ItemList>
      </section>
    </ModuleShell>
  );
}

function CustomizeModule({ state, dispatch, setNotice }: ModuleProps) {
  const enabledModules = [
    state.settings.showOrbit,
    state.settings.showFinance,
    state.settings.showWorkout,
    state.settings.showCalendar,
    state.settings.showBooks,
    state.settings.showJournal
  ].filter(Boolean).length;

  return (
    <ModuleShell title="Customize Options" description="Tune callsign, accent, density, dashboard modules, and reset the fresh deck.">
      <section className="life-layout customize-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Interface command</span>
            <h2>Interface Presets</h2>
            <p>{enabledModules}/6 visible systems are active. Shape Wren OS around the day you actually run.</p>
          </div>
          <div className="theme-preview">
            <Palette size={22} />
            <span>{state.settings.accent}</span>
            <strong>{state.settings.density}</strong>
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Module switches" />
          <div className="mini-toggle-list">
            <ToggleCard label="Calendar module" checked={state.settings.showCalendar} onChange={(checked) => dispatch({ type: "settings/update", payload: { showCalendar: checked } })} />
            <ToggleCard label="Books module" checked={state.settings.showBooks} onChange={(checked) => dispatch({ type: "settings/update", payload: { showBooks: checked } })} />
            <ToggleCard label="Journal module" checked={state.settings.showJournal} onChange={(checked) => dispatch({ type: "settings/update", payload: { showJournal: checked } })} />
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="System style" />
          <div className="setting-stack">
            <span><SlidersHorizontal size={15} /> {state.settings.density} density</span>
            <span><Activity size={15} /> {state.settings.showOrbit ? "orbit visible" : "orbit hidden"}</span>
            <span><Database size={15} /> local cache active</span>
          </div>
        </section>
      </section>
      <section className="custom-grid">
        <label className="custom-card">
          <span>Callsign</span>
          <input
            aria-label="Callsign"
            value={state.settings.callsign}
            onChange={(event) => dispatch({ type: "settings/update", payload: { callsign: event.target.value } })}
          />
        </label>
        <div className="custom-card">
          <span>Accent</span>
          <div className="swatch-row">
            {accentOptions.map((option) => (
              <button
                className={`swatch swatch-${option.value} ${state.settings.accent === option.value ? "active" : ""}`}
                type="button"
                key={option.value}
                aria-label={`Use ${option.label} accent`}
                onClick={() => dispatch({ type: "settings/update", payload: { accent: option.value } })}
              />
            ))}
          </div>
        </div>
        <div className="custom-card">
          <span>Density</span>
          <div className="segmented">
            <button
              className={state.settings.density === "comfortable" ? "active" : ""}
              onClick={() => dispatch({ type: "settings/update", payload: { density: "comfortable" } })}
              type="button"
            >
              Comfortable
            </button>
            <button
              className={state.settings.density === "compact" ? "active" : ""}
              onClick={() => dispatch({ type: "settings/update", payload: { density: "compact" } })}
              type="button"
            >
              Compact
            </button>
          </div>
        </div>
        <ToggleCard label="Show orbit radar" checked={state.settings.showOrbit} onChange={(checked) => dispatch({ type: "settings/update", payload: { showOrbit: checked } })} />
        <ToggleCard label="Show finance card" checked={state.settings.showFinance} onChange={(checked) => dispatch({ type: "settings/update", payload: { showFinance: checked } })} />
        <ToggleCard label="Show workout systems" checked={state.settings.showWorkout} onChange={(checked) => dispatch({ type: "settings/update", payload: { showWorkout: checked } })} />
        <div className="custom-card">
          <span>Cloud lock</span>
          <p>
            {supabaseConfig.isConfigured
              ? "Supabase Auth is configured. This deck syncs to a private per-user row after sign-in."
              : "Cloud auth: local fallback. Add Supabase env vars before deploying for cross-device private sync."}
          </p>
        </div>
        <div className="custom-card danger-zone">
          <span>Fresh start</span>
          <p>Reset clears this new command deck only. It does not touch files on your laptop.</p>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "deck/reset" });
              setNotice("Command deck reset.");
            }}
          >
            <RotateCcw size={16} /> Reset deck
          </button>
        </div>
      </section>
    </ModuleShell>
  );
}

function AccountModule({
  state,
  cloudStatus,
  onSignOut
}: {
  state: CommandDeckState;
  cloudStatus: CloudStatus;
  onSignOut: () => void;
}) {
  const lastSync = cloudStatus.lastSyncedAt ? formatDateTime(cloudStatus.lastSyncedAt) : "Not synced yet";
  const userEmail = cloudStatus.userEmail ?? "Local operator";

  return (
    <ModuleShell title="Account Settings" description="Identity, cloud sync, privacy posture, and deployment readiness.">
      <section className="account-layout">
        <article className="account-hero">
          <div className="account-avatar">
            <UserRound size={34} />
          </div>
          <div>
            <span className="micro-label">Identity and sync</span>
            <h2>{state.settings.callsign}</h2>
            <p>{userEmail}</p>
          </div>
        </article>
        <section className="deck-panel account-panel">
          <PanelHead title="Access state" />
          <div className="account-status-grid">
            <div><KeyRound size={16} /><span>Auth</span><strong>{supabaseConfig.isConfigured ? "Supabase" : "Local"}</strong></div>
            <div><Cloud size={16} /><span>Status</span><strong>{cloudStatus.label.replace("Cloud auth: ", "")}</strong></div>
            <div><Database size={16} /><span>Storage</span><strong>{supabaseConfig.isConfigured ? "Cloud + local" : "Browser only"}</strong></div>
            <div><CalendarCheck size={16} /><span>Last sync</span><strong>{lastSync}</strong></div>
          </div>
        </section>
        <section className="deck-panel account-panel">
          <PanelHead title="Privacy checklist" />
          <div className="check-list">
            <span><CircleCheck size={16} /> Supabase RLS protects command deck rows.</span>
            <span><CircleCheck size={16} /> Local browser cache remains available offline.</span>
            <span><Shield size={16} /> Vercel URL is public unless deployment protection is enabled.</span>
          </div>
        </section>
        <section className="deck-panel account-panel">
          <PanelHead title="Session controls" />
          <div className="account-actions">
            <button type="button" onClick={onSignOut} disabled={!cloudStatus.userEmail}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
          <p className="panel-copy">{cloudStatus.detail}</p>
        </section>
      </section>
    </ModuleShell>
  );
}

function OrbitGauge({ value }: { value: number }) {
  const dots = Array.from({ length: 108 }, (_, index) => {
    const ring = Math.floor(index / 27);
    const position = index % 27;
    const radius = 44 + ring * 22;
    const angle = (position / 27) * Math.PI * 2 + ring * 0.16;
    const x = 150 + Math.cos(angle) * radius;
    const y = 150 + Math.sin(angle) * radius;
    return { x, y, ring, active: index < Math.round((value / 100) * 108) };
  });

  return (
    <div className="orbit-wrap" aria-label={`Readiness orbit ${value}%`}>
      <svg viewBox="0 0 300 300">
        {dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={3.3 + dot.ring * 0.65}
            className={dot.active ? "active" : ""}
          />
        ))}
      </svg>
      <div className="orbit-core">
        <strong>{value}%</strong>
        <span>Readiness</span>
      </div>
    </div>
  );
}

function ModuleShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="module-shell">
      <header className="module-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

function PanelHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="panel-headline">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function TwoColumn({ titleLeft, titleRight, children }: { titleLeft: string; titleRight: string; children: [ReactNode, ReactNode] }) {
  return (
    <div className="two-column">
      <section className="deck-panel">
        <PanelHead title={titleLeft} />
        {children[0]}
      </section>
      <section className="deck-panel">
        <PanelHead title={titleRight} />
        {children[1]}
      </section>
    </div>
  );
}

function ItemList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return <div className="ops-list">{Array.isArray(items) && items.length === 0 ? <EmptyState>{empty}</EmptyState> : children}</div>;
}

function ActionRow({ title, meta, children }: { title: string; meta: string; children?: ReactNode }) {
  return (
    <div className="ops-row">
      <span>{title}</span>
      <em>{meta}</em>
      {children && <div className="row-actions">{children}</div>}
    </div>
  );
}

function ProjectRow({ project, children }: { project: CommandDeckState["projects"][number]; children?: ReactNode }) {
  return (
    <div className="ops-row project-row">
      <div className="project-main">
        <span>{project.name}</span>
        <em>{project.nextAction || project.objective || "No next action"}</em>
        <div className="mini-progress" aria-label={`${project.name} progress ${project.progress}%`}>
          <span style={{ width: `${project.progress}%` }} />
        </div>
      </div>
      <div className="repo-meta">
        {project.source === "github" && <span className="source-pill"><Github size={13} /> GitHub</span>}
        {project.language && <span className="source-pill">{project.language}</span>}
        {project.defaultBranch && <span className="source-pill"><GitBranch size={13} /> {project.defaultBranch}</span>}
        <strong>{project.progress}%</strong>
      </div>
      <div className="row-actions">
        {project.repositoryUrl && (
          <a className="repo-link" href={project.repositoryUrl} target="_blank" rel="noreferrer" aria-label={`Open ${project.name} on GitHub`}>
            <ExternalLink size={15} />
          </a>
        )}
        {children}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function ToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="custom-card toggle-card">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

interface ModuleProps {
  state: CommandDeckState;
  dispatch: React.Dispatch<CommandDeckAction>;
  setNotice: (message: string) => void;
}

type CloudMode = "local" | "connecting" | "signed-out" | "syncing" | "synced" | "error";

interface CloudStatus {
  mode: CloudMode;
  label: string;
  detail: string;
  lastSyncedAt: string | null;
  userEmail: string | null;
}

function getInitialCloudStatus(): CloudStatus {
  if (!supabaseConfig.isConfigured) {
    return {
      mode: "local",
      label: "Cloud auth: local fallback",
      detail: "Supabase env vars are missing, so this browser is using localStorage only.",
      lastSyncedAt: null,
      userEmail: null
    };
  }

  return {
    mode: "connecting",
    label: "Cloud auth: checking",
    detail: "Checking for an active Supabase session.",
    lastSyncedAt: null,
    userEmail: null
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected cloud sync error.";
}

function shiftDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function getDayDelta(value: string): number {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`).getTime();
  const target = new Date(`${value}T12:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
