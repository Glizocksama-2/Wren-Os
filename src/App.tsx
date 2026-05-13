import {
  Banknote,
  BatteryCharging,
  BookOpen,
  CalendarDays,
  Circle,
  Cloud,
  Dumbbell,
  ExternalLink,
  Gauge,
  GitBranch,
  Github,
  Grid2X2,
  ListTodo,
  LockKeyhole,
  LogOut,
  Mail,
  NotebookPen,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  Target,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import { supabase, supabaseConfig, type WrenSession } from "./lib/supabase";
import { loadCloudDeck, saveCloudDeck, type CloudDeckClient } from "./store/cloudDeck";
import {
  type Accent,
  type CalendarEntry,
  type CommandDeckAction,
  type CommandDeckState,
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
  { view: "customize", label: "Customize", icon: <Settings2 size={18} />, terms: ["custom", "customize", "settings", "theme"] }
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

  const navigateFromSearch = (query: string) => {
    const normalized = query.toLowerCase().trim();
    const target = navItems.find((item) => item.terms.some((term) => normalized.includes(term)));
    if (!target) {
      setNotice("No module matched. Try todo, projects, calendar, workout, books, journal, finances, or customize.");
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
          {navItems.map((item) => (
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
        </section>
      </main>
      {notice && <div className="deck-toast">{notice}</div>}
    </div>
  );
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: "calendar/add", title: title.trim(), date, time, entryType });
    setTitle("");
    setNotice("Calendar event added.");
  };

  return (
    <ModuleShell title="Calendar" description="Time blocks, appointments, training, and finance checkpoints.">
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
      <ItemList empty="No calendar entries.">
        {state.calendar
          .slice()
          .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
          .map((entry) => (
            <ActionRow key={entry.id} title={entry.title} meta={`${formatDate(entry.date)} at ${entry.time} - ${entry.type}`} />
          ))}
      </ItemList>
    </ModuleShell>
  );
}

function WorkoutModule({ state, dispatch, setNotice }: ModuleProps) {
  const [name, setName] = useState("");
  const [day, setDay] = useState("Monday");
  const [focus, setFocus] = useState("");

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
      <form className="command-form" onSubmit={submit}>
        <label><span>Session</span><input aria-label="Workout name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Day</span><input aria-label="Workout day" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <label><span>Focus</span><input aria-label="Workout focus" value={focus} onChange={(event) => setFocus(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add workout</button>
      </form>
      <ItemList empty="No workouts planned.">
        {state.workouts.map((entry) => (
          <ActionRow key={entry.id} title={entry.name} meta={`${entry.day} - ${entry.focus || "general"} - ${entry.status}`}>
            <button onClick={() => dispatch({ type: "workout/toggle", id: entry.id })} type="button">
              {entry.status === "done" ? "Reopen" : "Done"}
            </button>
          </ActionRow>
        ))}
      </ItemList>
    </ModuleShell>
  );
}

function BooksModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

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
      <form className="command-form" onSubmit={submit}>
        <label><span>Title</span><input aria-label="Book title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Author</span><input aria-label="Book author" value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> Add book</button>
      </form>
      <div className="book-grid">
        {state.books.map((book) => (
          <article className="book-card" key={book.id}>
            <div>
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    dispatch({ type: "journal/add", mood: mood.trim() || "Logged", body: body.trim() });
    setBody("");
    setNotice("Journal entry saved.");
  };

  return (
    <ModuleShell title="Journal" description="Keep the internal log clean: what happened, what changed, what matters.">
      <form className="journal-form" onSubmit={submit}>
        <label><span>Mood</span><input aria-label="Journal mood" value={mood} onChange={(event) => setMood(event.target.value)} /></label>
        <label><span>Entry</span><textarea aria-label="Journal entry" value={body} onChange={(event) => setBody(event.target.value)} rows={8} /></label>
        <button type="submit"><Plus size={16} /> Save entry</button>
      </form>
      <ItemList empty="No journal entries.">
        {state.journal.map((entry) => (
          <ActionRow key={entry.id} title={entry.mood} meta={`${formatDate(entry.date)} - ${entry.body}`} />
        ))}
      </ItemList>
    </ModuleShell>
  );
}

function FinancesModule({ state, dispatch, setNotice }: ModuleProps) {
  const [label, setLabel] = useState("");
  const [financeType, setFinanceType] = useState<FinanceType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const metrics = getDeckMetrics(state);

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
      <ItemList empty="No finance entries.">
        {state.finances.map((entry) => (
          <ActionRow key={entry.id} title={entry.label} meta={`${entry.type} - ${formatMoney(entry.amount)} - ${entry.status}`}>
            <button onClick={() => dispatch({ type: "finance/toggle", id: entry.id })} type="button">
              {entry.status === "cleared" ? "Plan" : "Clear"}
            </button>
          </ActionRow>
        ))}
      </ItemList>
    </ModuleShell>
  );
}

function CustomizeModule({ state, dispatch, setNotice }: ModuleProps) {
  return (
    <ModuleShell title="Customize Options" description="Tune callsign, accent, density, dashboard modules, and reset the fresh deck.">
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
