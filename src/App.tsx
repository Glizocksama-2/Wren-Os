import {
  Activity,
  Banknote,
  BatteryCharging,
  Bot,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Circle,
  CircleCheck,
  Cloud,
  Copy,
  Cpu,
  Crown,
  Database,
  Dumbbell,
  ExternalLink,
  Gauge,
  GitBranch,
  Github,
  Grid2X2,
  Eye,
  KeyRound,
  ListTodo,
  LockKeyhole,
  LogOut,
  Mail,
  Newspaper,
  NotebookPen,
  Palette,
  Pencil,
  PiggyBank,
  Plus,
  Radar,
  Repeat2,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserRound,
  UsersRound,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import orbitWatchLogoBoardUrl from "./assets/northwatch-logo-board.png";
import {
  forgetRememberedAccount,
  loadRememberedAccounts,
  rememberAuthAccount,
  type RememberedAuthAccount
} from "./lib/authMemory";
import { checkOllamaConnection, requestOllamaAgentReply } from "./lib/ollama";
import { supabase, supabaseConfig, type WrenSession } from "./lib/supabase";
import {
  buildTeamInviteUrl,
  createTeamInvite,
  createTeamWorkspace,
  joinTeamWorkspace,
  listTeamMembers,
  listTeamWorkspaces,
  loadCloudDeck,
  loadTeamCloudDeck,
  removeTeamMember,
  saveCloudDeck,
  saveTeamCloudDeck,
  updateTeamMemberRole,
  type CloudDeckClient,
  type TeamMember,
  type TeamRole,
  type TeamWorkspace
} from "./store/cloudDeck";
import {
  type Accent,
  type BackgroundMode,
  type CalendarEntry,
  type CommandDeckAction,
  type CommandDeckState,
  type DeckSettings,
  type DeckView,
  type FinanceType,
  type IntelItem,
  type IntelKind,
  type IntelSignal,
  type LogoStyle,
  type Priority,
  type RoutineCadence,
  type RoutineDay,
  freshCommandDeck,
  getDeckMetrics,
  loadCommandDeck,
  reduceCommandDeck,
  saveCommandDeck
} from "./store/commandDeck";

const navItems: Array<{ view: DeckView; label: string; icon: ReactNode; terms: string[] }> = [
  { view: "dashboard", label: "Command", icon: <Grid2X2 size={18} />, terms: ["command", "dashboard", "home", "deck"] },
  { view: "todo", label: "To Do", icon: <ListTodo size={18} />, terms: ["todo", "task", "tasks", "list"] },
  { view: "daily", label: "Daily", icon: <Repeat2 size={18} />, terms: ["daily", "routine", "routines", "repeat", "habit", "habits"] },
  { view: "projects", label: "Projects", icon: <Target size={18} />, terms: ["project", "projects", "pending", "done"] },
  { view: "intel", label: "Intel", icon: <Newspaper size={18} />, terms: ["intel", "news", "stock", "stocks", "market", "watchlist", "invest", "investing"] },
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
const intelKinds: IntelKind[] = ["stock", "crypto", "fund", "company", "trend", "news"];
const intelSignals: IntelSignal[] = ["watching", "researching", "high-priority", "on-hold"];
const routineDayOptions: Array<{ value: RoutineDay; label: string; short: string }> = [
  { value: "mon", label: "Monday", short: "Mon" },
  { value: "tue", label: "Tuesday", short: "Tue" },
  { value: "wed", label: "Wednesday", short: "Wed" },
  { value: "thu", label: "Thursday", short: "Thu" },
  { value: "fri", label: "Friday", short: "Fri" },
  { value: "sat", label: "Saturday", short: "Sat" },
  { value: "sun", label: "Sunday", short: "Sun" }
];
const accentOptions: Array<{ value: Accent; label: string }> = [
  { value: "amber", label: "Amber" },
  { value: "cyan", label: "Cyan" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "pink", label: "Pink" }
];

const backgroundOptions: Array<{ value: BackgroundMode; label: string }> = [
  { value: "black", label: "Black" },
  { value: "white", label: "White" }
];

const logoOptions: Array<{ value: LogoStyle; label: string; description: string }> = [
  { value: "sentinel", label: "Sentinel Wing", description: "Protective angular crest for the main command identity." },
  { value: "monolith", label: "Black Tower", description: "A vertical signal mark for discipline, privacy, and control." },
  { value: "radar", label: "Orbit Watch", description: "The third 3D concept: a surveillance ring for market intel and project awareness." },
  { value: "spire", label: "North Spire", description: "A sharp forward mark for momentum and execution." }
];

type AgentMessage = {
  id: string;
  role: "agent" | "operator";
  body: string;
};

type AgentConnectionState = {
  mode: "disabled" | "checking" | "online" | "offline" | "thinking";
  label: string;
  detail: string;
};

type WorkspaceMode = { kind: "personal" } | { kind: "team"; teamId: string };
const PENDING_TEAM_INVITE_STORAGE_KEY = "northwatch.pendingTeamInvite.v1";

const agentQuickPrompts = [
  "Brief my next move",
  "Find the bottleneck",
  "Balance today",
  "Create focus task"
];

export default function App() {
  const [state, dispatch] = useReducer(reduceCommandDeck, undefined, () => loadCommandDeck());
  const [view, setView] = useState<DeckView>("dashboard");
  const [notice, setNotice] = useState("Fresh command deck initialized.");
  const [session, setSession] = useState<WrenSession | null>(null);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAuthAccount[]>(() => loadRememberedAccounts());
  const [authReady, setAuthReady] = useState(!supabaseConfig.isConfigured);
  const [cloudReady, setCloudReady] = useState(!supabaseConfig.isConfigured);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(() => getInitialCloudStatus());
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>({ kind: "personal" });
  const [teams, setTeams] = useState<TeamWorkspace[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInviteLink, setTeamInviteLink] = useState("");
  const [isTeamBusy, setIsTeamBusy] = useState(false);
  const latestDeckRef = useRef(state);
  const saveTimerRef = useRef<number | null>(null);
  const pendingInviteAttemptRef = useRef<string | null>(null);
  const metrics = useMemo(() => getDeckMetrics(state), [state]);
  const visibleNavItems = useMemo(() => navItems.filter((item) => isViewEnabled(item.view, state.settings)), [state.settings]);
  const activeTeam = useMemo(
    () => (workspaceMode.kind === "team" ? teams.find((team) => team.id === workspaceMode.teamId) ?? null : null),
    [teams, workspaceMode]
  );
  const workspaceLabel = activeTeam ? `Team: ${activeTeam.name}` : "Personal vault";

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
      if (data.session?.user.email) {
        setRememberedAccounts(rememberAuthAccount(data.session.user.email, data.session.user.id));
      }
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
      if (nextSession?.user.email) {
        setRememberedAccounts(rememberAuthAccount(nextSession.user.email, nextSession.user.id));
      }
      setAuthReady(true);
      if (!nextSession) {
        setCloudReady(false);
        setWorkspaceMode({ kind: "personal" });
        setTeams([]);
        setTeamMembers([]);
        setTeamInviteLink("");
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
    setWorkspaceMode({ kind: "personal" });
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
        const teamWorkspaces = await listTeamWorkspaces(client, userId);

        if (isCancelled) return;

        if (cloudDeck) {
          dispatch({ type: "deck/import", deck: cloudDeck });
          setTeams(teamWorkspaces);
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: synced",
            detail: "Loaded your private Supabase workspace.",
            lastSyncedAt: cloudDeck.updatedAt,
            userEmail
          });
        } else {
          dispatch({ type: "deck/import", deck: freshCommandDeck });
          setTeams(teamWorkspaces);
          const savedAt = await saveCloudDeck(client, userId, freshCommandDeck);
          if (isCancelled) return;
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: seeded",
            detail: "Created a private Supabase workspace for this signed-in user.",
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
    const currentWorkspace = workspaceMode;

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
      const saveOperation =
        currentWorkspace.kind === "team"
          ? saveTeamCloudDeck(client, currentWorkspace.teamId, userId, latestDeckRef.current)
          : saveCloudDeck(client, userId, latestDeckRef.current);

      saveOperation
        .then((savedAt) => {
          const teamName = currentWorkspace.kind === "team" ? teams.find((team) => team.id === currentWorkspace.teamId)?.name : null;
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: synced",
            detail: teamName ? `Shared team workspace "${teamName}" is current.` : "Private Supabase workspace is current.",
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
  }, [state, session?.user.email, session?.user.id, cloudReady, workspaceMode, teams]);

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
    const pendingInvite = readTeamInviteFromLocation();
    if (pendingInvite) {
      window.localStorage.setItem(PENDING_TEAM_INVITE_STORAGE_KEY, pendingInvite);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;
    setRememberedAccounts(rememberAuthAccount(email, null));
  };

  const forgetAuthAccount = (email: string) => {
    setRememberedAccounts(forgetRememberedAccount(email));
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

  const refreshTeamMembers = async (teamId: string) => {
    if (!supabaseConfig.isConfigured || !supabase || !session) {
      setTeamMembers([]);
      return;
    }

    try {
      const client = supabase as unknown as CloudDeckClient;
      const members = await listTeamMembers(client, teamId);
      setTeamMembers(members);
    } catch (error) {
      setTeamMembers([]);
      setNotice(getErrorMessage(error));
    }
  };

  const switchWorkspace = async (nextWorkspace: WorkspaceMode) => {
    if (!supabaseConfig.isConfigured || !supabase || !session) return;

    const isSameWorkspace =
      workspaceMode.kind === nextWorkspace.kind &&
      (workspaceMode.kind === "personal" || (nextWorkspace.kind === "team" && workspaceMode.teamId === nextWorkspace.teamId));
    if (isSameWorkspace) return;

    const client = supabase as unknown as CloudDeckClient;
    const userId = session.user.id;
    const userEmail = session.user.email ?? null;
    const teamName = nextWorkspace.kind === "team" ? teams.find((team) => team.id === nextWorkspace.teamId)?.name ?? "team" : null;

    setIsTeamBusy(true);
    setCloudReady(false);
    setCloudStatus({
      mode: "syncing",
      label: "Cloud auth: switching",
      detail: teamName ? `Loading shared workspace for ${teamName}.` : "Loading your private workspace.",
      lastSyncedAt: null,
      userEmail
    });

    try {
      if (nextWorkspace.kind === "team") {
        const teamDeck = await loadTeamCloudDeck(client, nextWorkspace.teamId);
        if (teamDeck) {
          dispatch({ type: "deck/import", deck: teamDeck });
          setWorkspaceMode(nextWorkspace);
          setTeamInviteLink("");
          await refreshTeamMembers(nextWorkspace.teamId);
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: synced",
            detail: `Loaded shared team workspace "${teamName ?? nextWorkspace.teamId}".`,
            lastSyncedAt: teamDeck.updatedAt,
            userEmail
          });
        } else {
          dispatch({ type: "deck/import", deck: freshCommandDeck });
          const savedAt = await saveTeamCloudDeck(client, nextWorkspace.teamId, userId, freshCommandDeck);
          setWorkspaceMode(nextWorkspace);
          setTeamInviteLink("");
          await refreshTeamMembers(nextWorkspace.teamId);
          setCloudStatus({
            mode: "synced",
            label: "Cloud auth: seeded",
            detail: `Created a fresh shared workspace for ${teamName ?? "this team"}.`,
            lastSyncedAt: savedAt,
            userEmail
          });
        }
      } else {
        const personalDeck = await loadCloudDeck(client, userId);
        const safeDeck = personalDeck ?? freshCommandDeck;
        dispatch({ type: "deck/import", deck: safeDeck });
        const savedAt = personalDeck ? personalDeck.updatedAt : await saveCloudDeck(client, userId, safeDeck);
        setWorkspaceMode(nextWorkspace);
        setTeamMembers([]);
        setTeamInviteLink("");
        setCloudStatus({
          mode: "synced",
          label: personalDeck ? "Cloud auth: synced" : "Cloud auth: seeded",
          detail: personalDeck ? "Loaded your private Supabase workspace." : "Created a private Supabase workspace for this signed-in user.",
          lastSyncedAt: savedAt,
          userEmail
        });
      }
      setCloudReady(true);
    } catch (error) {
      setCloudReady(true);
      setCloudStatus({
        mode: "error",
        label: "Cloud auth: workspace error",
        detail: getErrorMessage(error),
        lastSyncedAt: null,
        userEmail
      });
    } finally {
      setIsTeamBusy(false);
    }
  };

  const createTeam = async (name: string) => {
    if (!supabaseConfig.isConfigured || !supabase || !session) {
      setNotice("Team mode requires Supabase sign-in.");
      return;
    }

    const client = supabase as unknown as CloudDeckClient;
    setIsTeamBusy(true);
    try {
      const team = await createTeamWorkspace(client, session.user.id, name, undefined, session.user.email);
      setTeams((current) => [team, ...current.filter((item) => item.id !== team.id)]);
      setNotice(`Team created: ${team.name}.`);
      await switchWorkspace({ kind: "team", teamId: team.id });
    } catch (error) {
      setNotice(getErrorMessage(error));
      setIsTeamBusy(false);
    }
  };

  const joinTeam = async (teamCode: string) => {
    if (!supabaseConfig.isConfigured || !supabase || !session) {
      setNotice("Team mode requires Supabase sign-in.");
      return;
    }

    const client = supabase as unknown as CloudDeckClient;
    setIsTeamBusy(true);
    try {
      const team = await joinTeamWorkspace(client, session.user.id, teamCode, session.user.email);
      clearPendingTeamInvite();
      setTeams((current) => [team, ...current.filter((item) => item.id !== team.id)]);
      setNotice(`Joined team: ${team.name}.`);
      await switchWorkspace({ kind: "team", teamId: team.id });
    } catch (error) {
      setNotice(getErrorMessage(error));
      setIsTeamBusy(false);
    }
  };

  const createInviteLink = async () => {
    if (!supabaseConfig.isConfigured || !supabase || !session || !activeTeam) {
      setNotice("Open a signed-in team workspace before creating an invite.");
      return;
    }

    const client = supabase as unknown as CloudDeckClient;
    setIsTeamBusy(true);
    try {
      const invite = await createTeamInvite(client, activeTeam.id, session.user.id, window.location.origin);
      setTeamInviteLink(invite.url);
      try {
        await navigator.clipboard?.writeText(invite.url);
        setNotice("Invite link created and copied.");
      } catch {
        setNotice("Invite link created. Copy it from the field.");
      }
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsTeamBusy(false);
    }
  };

  const updateMemberRole = async (memberUserId: string, role: TeamRole) => {
    if (!supabaseConfig.isConfigured || !supabase || !session || !activeTeam) {
      setNotice("Open an owner team workspace before changing roles.");
      return;
    }

    const client = supabase as unknown as CloudDeckClient;
    setIsTeamBusy(true);
    try {
      await updateTeamMemberRole(client, activeTeam.id, memberUserId, role);
      const nextTeams = await listTeamWorkspaces(client, session.user.id);
      setTeams(nextTeams);
      await refreshTeamMembers(activeTeam.id);
      setNotice(role === "owner" ? "Member promoted to owner." : "Member role set to member.");
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsTeamBusy(false);
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!supabaseConfig.isConfigured || !supabase || !session || !activeTeam) {
      setNotice("Open an owner team workspace before removing members.");
      return;
    }

    const client = supabase as unknown as CloudDeckClient;
    setIsTeamBusy(true);
    try {
      await removeTeamMember(client, activeTeam.id, memberUserId);
      const nextTeams = await listTeamWorkspaces(client, session.user.id);
      setTeams(nextTeams);
      setTeamMembers((current) => current.filter((member) => member.userId !== memberUserId));
      setNotice("Member removed from team.");
      if (memberUserId === session.user.id) {
        await switchWorkspace({ kind: "personal" });
      } else {
        await refreshTeamMembers(activeTeam.id);
      }
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsTeamBusy(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfig.isConfigured || !session || !cloudReady) return;

    const pendingInvite = readPendingTeamInvite();
    if (!pendingInvite || pendingInviteAttemptRef.current === pendingInvite) return;

    pendingInviteAttemptRef.current = pendingInvite;
    void joinTeam(pendingInvite);
  }, [cloudReady, session?.user.id]);

  if (supabaseConfig.isConfigured && !authReady) {
    return <CloudBootScreen status={cloudStatus} />;
  }

  if (supabaseConfig.isConfigured && authReady && !session) {
    return (
      <AuthGate
        status={cloudStatus}
        rememberedAccounts={rememberedAccounts}
        onRequestMagicLink={requestMagicLink}
        onForgetRememberedAccount={forgetAuthAccount}
      />
    );
  }

  if (supabaseConfig.isConfigured && authReady && session && !cloudReady) {
    return <CloudBootScreen status={cloudStatus} />;
  }

  return (
    <div className="deck-app" data-accent={state.settings.accent} data-density={state.settings.density} data-background={state.settings.background}>
      <TechBackdrop metrics={metrics} />
      <aside className="tactical-rail" aria-label="Primary">
        <div className="rail-brand" aria-label="Northwatch">
          <LogoMark variant={state.settings.logoStyle} />
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
        <TopBar callsign={state.settings.callsign} cloudStatus={cloudStatus} workspaceLabel={workspaceLabel} onCommand={navigateFromSearch} onSignOut={signOut} />
        <section className="deck-content">
          {view === "dashboard" && <Dashboard state={state} metrics={metrics} dispatch={dispatch} setView={setView} setNotice={setNotice} />}
          {view === "todo" && <TodoModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "daily" && <DailyModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "projects" && <ProjectsModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "intel" && <IntelModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "calendar" && <CalendarModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "workout" && <WorkoutModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "books" && <BooksModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "journal" && <JournalModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "finances" && <FinancesModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "customize" && <CustomizeModule state={state} dispatch={dispatch} setNotice={setNotice} />}
          {view === "account" && (
            <AccountModule
              state={state}
              cloudStatus={cloudStatus}
              workspaceMode={workspaceMode}
              teams={teams}
              activeTeam={activeTeam}
              teamMembers={teamMembers}
              teamInviteLink={teamInviteLink}
              isTeamBusy={isTeamBusy}
              onSwitchWorkspace={switchWorkspace}
              onCreateTeam={createTeam}
              onJoinTeam={joinTeam}
              onCreateInviteLink={createInviteLink}
              onUpdateMemberRole={updateMemberRole}
              onRemoveMember={removeMember}
              onSignOut={signOut}
            />
          )}
        </section>
      </main>
      <AgentDock
        state={state}
        metrics={metrics}
        activeView={view}
        dispatch={dispatch}
        setView={setView}
        setNotice={setNotice}
      />
      {notice && <div className="deck-toast">{notice}</div>}
    </div>
  );
}

function isViewEnabled(view: DeckView, settings: DeckSettings): boolean {
  switch (view) {
    case "intel":
      return settings.showIntel;
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
  workspaceLabel,
  onCommand,
  onSignOut
}: {
  callsign: string;
  cloudStatus: CloudStatus;
  workspaceLabel: string;
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
        <strong>Northwatch Tactical Ledger</strong>
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
        <span className="workspace-status-pill">
          <Shield size={14} />
          {workspaceLabel}
        </span>
        <span className={`cloud-status-pill ${cloudStatus.mode}`} title={cloudStatus.detail}>
          <Cloud size={14} />
          {cloudStatus.label}
        </span>
        {cloudStatus.userEmail && (
          <button className="topbar-icon-button" type="button" aria-label="Sign out of Northwatch" onClick={onSignOut}>
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
        <span className="micro-label">Northwatch secure boot</span>
        <h1>Checking private access.</h1>
        <p>{status.detail}</p>
      </section>
    </main>
  );
}

export function AuthGate({
  status,
  rememberedAccounts,
  onRequestMagicLink,
  onForgetRememberedAccount
}: {
  status: CloudStatus;
  rememberedAccounts: RememberedAuthAccount[];
  onRequestMagicLink: (email: string) => Promise<void>;
  onForgetRememberedAccount: (email: string) => void;
}) {
  const [email, setEmail] = useState(rememberedAccounts[0]?.email ?? "");
  const [message, setMessage] = useState(status.detail);
  const [isSending, setIsSending] = useState(false);
  const firstRememberedEmail = rememberedAccounts[0]?.email ?? "";

  useEffect(() => {
    if (!email && firstRememberedEmail) {
      setEmail(firstRememberedEmail);
    }
  }, [email, firstRememberedEmail]);

  useEffect(() => {
    setMessage(status.detail);
  }, [status.detail]);

  const sendMagicLink = async (targetEmail: string) => {
    const normalizedEmail = targetEmail.trim();
    if (!normalizedEmail) return;

    setEmail(normalizedEmail);
    setIsSending(true);
    try {
      await onRequestMagicLink(normalizedEmail);
      setMessage("Magic link sent. Open it on this device to unlock Northwatch.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMagicLink(email);
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="micro-label">Private command deck</span>
        <h1>Northwatch is locked.</h1>
        <p>Sign in with Supabase Auth to sync your projects, tasks, journal, books, workouts, and finances across devices.</p>
        {rememberedAccounts.length > 0 && (
          <div className="remembered-accounts" aria-label="Remembered accounts">
            <span>Known accounts on this device</span>
            {rememberedAccounts.map((account) => (
              <div className="remembered-account" key={account.email}>
                <button className="remembered-account-main" type="button" disabled={isSending} onClick={() => sendMagicLink(account.email)}>
                  <UserRound size={15} />
                  <span>Continue as</span>
                  <strong>{account.email}</strong>
                </button>
                <button
                  className="remembered-account-forget"
                  type="button"
                  aria-label={`Forget ${account.email}`}
                  onClick={() => onForgetRememberedAccount(account.email)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
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
        <small>Northwatch remembers only the account email on this browser. Supabase still keeps the session secure.</small>
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
            A fresh local-first base for tasks, projects, market intel, training, reading, journal, calendar, and finances.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => setView("todo")}>Add to do</button>
            <button type="button" onClick={() => setView("daily")}>Daily list</button>
            <button type="button" onClick={() => setView("projects")}>Open projects</button>
          </div>
          <div className="hero-signal-row" aria-label="Northwatch live systems">
            <span><Bot size={14} /> Sentinel agent online</span>
            <span><Radar size={14} /> {metrics.intelItems} intel targets</span>
            <span><Zap size={14} /> {metrics.openTasks} active orders</span>
            <span><Repeat2 size={14} /> {metrics.routinesDoneToday}/{metrics.routinesDueToday} daily systems</span>
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
    ["Daily done", `${metrics.routinesDoneToday}/${metrics.routinesDueToday}`],
    ["Pending projects", metrics.pendingProjects],
    ["Done projects", metrics.doneProjects],
    ["GitHub progress", `${metrics.projectProgress}%`],
    ["Intel", metrics.intelItems],
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const open = state.tasks.filter((task) => task.status === "todo");
  const done = state.tasks.filter((task) => task.status === "done");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    if (editingTaskId) {
      dispatch({ type: "task/update", id: editingTaskId, title: title.trim(), priority, dueDate: dueDate || null });
      setEditingTaskId(null);
      setNotice("Task updated.");
    } else {
      dispatch({ type: "task/add", title: title.trim(), priority, dueDate: dueDate || null });
      setNotice("To do item added.");
    }
    setTitle("");
    setDueDate("");
  };

  const startEdit = (task: CommandDeckState["tasks"][number]) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setPriority(task.priority);
    setDueDate(task.dueDate ?? "");
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setTitle("");
    setPriority("medium");
    setDueDate("");
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
        <button type="submit"><Plus size={16} /> {editingTaskId ? "Save task" : "Add task"}</button>
        {editingTaskId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <TwoColumn titleLeft="Active" titleRight="Done">
        <ItemList empty="No active tasks.">
          {open.map((task) => (
            <ActionRow key={task.id} title={task.title} meta={`${task.priority}${task.dueDate ? ` - ${formatDate(task.dueDate)}` : ""}`}>
              <button onClick={() => startEdit(task)} type="button"><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "task/toggle", id: task.id })} type="button">Done</button>
              <button onClick={() => dispatch({ type: "task/delete", id: task.id })} type="button" aria-label={`Delete ${task.title}`}><Trash2 size={15} /> Delete</button>
            </ActionRow>
          ))}
        </ItemList>
        <ItemList empty="No completed tasks.">
          {done.map((task) => (
            <ActionRow key={task.id} title={task.title} meta="completed">
              <button onClick={() => startEdit(task)} type="button"><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "task/toggle", id: task.id })} type="button">Reopen</button>
              <button onClick={() => dispatch({ type: "task/delete", id: task.id })} type="button" aria-label={`Delete ${task.title}`}><Trash2 size={15} /> Delete</button>
            </ActionRow>
          ))}
        </ItemList>
      </TwoColumn>
    </ModuleShell>
  );
}

function DailyModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<RoutineCadence>("daily");
  const [selectedDays, setSelectedDays] = useState<RoutineDay[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const today = getTodayInput();
  const todayDay = getRoutineDayForDate(today);
  const dueToday = state.routines.filter((routine) => routine.days.includes(todayDay));
  const doneToday = dueToday.filter((routine) => routine.completions.includes(today));
  const completion = dueToday.length === 0 ? 0 : Math.round((doneToday.length / dueToday.length) * 100);
  const longestStreak = state.routines.reduce((max, routine) => Math.max(max, routine.streak), 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    if (editingRoutineId) {
      dispatch({ type: "routine/update", id: editingRoutineId, title: title.trim(), cadence, days: cadence === "daily" ? [] : selectedDays });
      setEditingRoutineId(null);
      setNotice("Routine updated.");
    } else {
      dispatch({ type: "routine/add", title: title.trim(), cadence, days: cadence === "daily" ? [] : selectedDays });
      setNotice("Routine added.");
    }
    setTitle("");
    setCadence("daily");
    setSelectedDays([]);
  };

  const startEdit = (routine: CommandDeckState["routines"][number]) => {
    setEditingRoutineId(routine.id);
    setTitle(routine.title);
    setCadence(routine.cadence);
    setSelectedDays(routine.cadence === "daily" ? [] : routine.days);
  };

  const cancelEdit = () => {
    setEditingRoutineId(null);
    setTitle("");
    setCadence("daily");
    setSelectedDays([]);
  };

  const toggleDay = (day: RoutineDay) => {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((left, right) => getRoutineDayIndex(left) - getRoutineDayIndex(right))
    );
  };

  return (
    <ModuleShell title="Daily To Do" description="Repeatable routines for daily work and the tasks that need to happen a few times each week.">
      <section className="life-layout routine-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Repeat command</span>
            <h2>Daily Systems</h2>
            <p>{dueToday.length === 0 ? "No routines are scheduled for today." : `${doneToday.length} of ${dueToday.length} routines cleared today.`}</p>
          </div>
          <div className="routine-orbit" aria-label="Routine completion">
            <strong>{completion}%</strong>
            <span>{doneToday.length} completed today</span>
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Today" />
          <div className="big-readout">
            <strong>{doneToday.length}/{dueToday.length}</strong>
            <span>done today</span>
          </div>
          <div className="long-meter"><span style={{ width: `${completion}%` }} /></div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Streak" />
          <div className="big-readout">
            <strong>{longestStreak}</strong>
            <span>best active streak</span>
          </div>
        </section>
      </section>

      <form className="command-form routine-form" onSubmit={submit}>
        <label><span>Routine</span><input aria-label="Routine title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Morning reset" /></label>
        <label>
          <span>Cadence</span>
          <select
            aria-label="Routine cadence"
            value={cadence}
            onChange={(event) => {
              setCadence(event.target.value as RoutineCadence);
              setSelectedDays([]);
            }}
          >
            <option value="daily">Every day</option>
            <option value="weekly">Selected days</option>
          </select>
        </label>
        {cadence === "weekly" && (
          <fieldset className="routine-day-picker">
            <legend>Days</legend>
            {routineDayOptions.map((day) => (
              <label key={day.value}>
                <input
                  aria-label={day.label}
                  checked={selectedDays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  type="checkbox"
                />
                <span>{day.short}</span>
              </label>
            ))}
          </fieldset>
        )}
        <button type="submit" disabled={cadence === "weekly" && selectedDays.length === 0}>
          <Plus size={16} /> {editingRoutineId ? "Save routine" : "Add routine"}
        </button>
        {editingRoutineId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>

      <section className="routine-grid">
        {state.routines.map((routine) => {
          const done = routine.completions.includes(today);
          const days = getRoutineDaysLabel(routine.days);
          return (
            <article className={`routine-card ${done ? "done" : ""}`} key={routine.id}>
              <div>
                <Repeat2 size={18} />
                <h3>{routine.title}</h3>
                <p>{routine.cadence === "daily" ? "Daily" : days}</p>
              </div>
              <div className="routine-day-row" aria-label={`${routine.title} schedule`}>
                {routineDayOptions.map((day) => (
                  <span className={routine.days.includes(day.value) ? "active" : ""} key={day.value}>{day.short.slice(0, 1)}</span>
                ))}
              </div>
              <div className="routine-card-meta">
                <span>{routine.streak} day streak</span>
                <span>{routine.completions.length} total clears</span>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "routine/toggle", id: routine.id });
                    setNotice(done ? "Routine reopened for today." : "Routine cleared for today.");
                  }}
                >
                  <CircleCheck size={15} /> {done ? "Reopen today" : "Done today"}
                </button>
                <button type="button" onClick={() => startEdit(routine)}><Pencil size={15} /> Modify</button>
                <button type="button" aria-label={`Delete ${routine.title}`} onClick={() => dispatch({ type: "routine/delete", id: routine.id })}><Trash2 size={15} /> Delete</button>
              </div>
            </article>
          );
        })}
        {state.routines.length === 0 && <EmptyState>No repetitive routines yet.</EmptyState>}
      </section>
    </ModuleShell>
  );
}

function ProjectsModule({ state, dispatch, setNotice }: ModuleProps) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [progress, setProgress] = useState("0");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const pending = state.projects.filter((project) => project.status === "pending");
  const done = state.projects.filter((project) => project.status === "done");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (editingProjectId) {
      dispatch({
        type: "project/update",
        id: editingProjectId,
        name: name.trim(),
        objective: objective.trim(),
        nextAction: nextAction.trim(),
        dueDate: dueDate || null,
        progress: Number(progress)
      });
      setEditingProjectId(null);
      setNotice("Project updated.");
    } else {
      dispatch({
        type: "project/add",
        name: name.trim(),
        objective: objective.trim(),
        nextAction: nextAction.trim(),
        dueDate: dueDate || null
      });
      setNotice("Project added to pending.");
    }
    setName("");
    setObjective("");
    setNextAction("");
    setDueDate("");
    setProgress("0");
  };

  const startEdit = (project: CommandDeckState["projects"][number]) => {
    setEditingProjectId(project.id);
    setName(project.name);
    setObjective(project.objective);
    setNextAction(project.nextAction);
    setDueDate(project.dueDate ?? "");
    setProgress(String(project.progress));
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    setName("");
    setObjective("");
    setNextAction("");
    setDueDate("");
    setProgress("0");
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
        <label><span>Progress</span><input aria-label="Project progress" type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> {editingProjectId ? "Save project" : "Add project"}</button>
        {editingProjectId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <TwoColumn titleLeft="Pending Projects" titleRight="Done Projects">
        <ItemList empty="No pending projects.">
          {pending.map((project) => (
            <ProjectRow key={project.id} project={project}>
              <button onClick={() => startEdit(project)} type="button"><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "project/complete", id: project.id })} type="button">Complete</button>
              <button onClick={() => dispatch({ type: "project/delete", id: project.id })} type="button" aria-label={`Delete ${project.name}`}><Trash2 size={15} /> Delete</button>
            </ProjectRow>
          ))}
        </ItemList>
        <ItemList empty="No done projects.">
          {done.map((project) => (
            <ProjectRow key={project.id} project={project}>
              <button onClick={() => startEdit(project)} type="button"><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "project/complete", id: project.id })} type="button">Reopen</button>
              <button onClick={() => dispatch({ type: "project/delete", id: project.id })} type="button" aria-label={`Delete ${project.name}`}><Trash2 size={15} /> Delete</button>
            </ProjectRow>
          ))}
        </ItemList>
      </TwoColumn>
    </ModuleShell>
  );
}

function IntelModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<IntelKind>("stock");
  const [signal, setSignal] = useState<IntelSignal>("watching");
  const [thesis, setThesis] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [editingIntelId, setEditingIntelId] = useState<string | null>(null);
  const selected = state.intel.find((item) => item.id === selectedId) ?? state.intel[0] ?? null;
  const signalCounts = intelSignals.map((item) => ({
    signal: item,
    count: state.intel.filter((entry) => entry.signal === item).length
  }));
  const researchQueue = state.intel
    .filter((item) => item.signal === "researching" || item.signal === "high-priority")
    .slice(0, 4);

  useEffect(() => {
    if (selectedId && state.intel.some((item) => item.id === selectedId)) return;
    setSelectedId(state.intel[0]?.id ?? "");
  }, [selectedId, state.intel]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    if (editingIntelId) {
      dispatch({
        type: "intel/update",
        id: editingIntelId,
        title: title.trim(),
        symbol: symbol.trim(),
        kind,
        signal,
        thesis: thesis.trim(),
        sourceUrl: sourceUrl.trim()
      });
      setSelectedId(editingIntelId);
      setEditingIntelId(null);
      setNotice("Intel item updated.");
    } else {
      dispatch({
        type: "intel/add",
        title: title.trim(),
        symbol: symbol.trim(),
        kind,
        signal,
        thesis: thesis.trim(),
        sourceUrl: sourceUrl.trim()
      });
      setNotice("Intel item added.");
    }
    setTitle("");
    setSymbol("");
    setThesis("");
    setSourceUrl("");
  };

  const startEdit = (item: IntelItem) => {
    setEditingIntelId(item.id);
    setTitle(item.title);
    setSymbol(item.symbol);
    setKind(item.kind);
    setSignal(item.signal);
    setThesis(item.thesis);
    setSourceUrl(item.sourceUrl ?? "");
    setSelectedId(item.id);
  };

  const cancelEdit = () => {
    setEditingIntelId(null);
    setTitle("");
    setSymbol("");
    setKind("stock");
    setSignal("watching");
    setThesis("");
    setSourceUrl("");
  };

  const deleteIntelItem = (id: string, label: string) => {
    dispatch({ type: "intel/delete", id });
    if (selectedId === id) {
      setSelectedId(state.intel.find((item) => item.id !== id)?.id ?? "");
    }
    if (editingIntelId === id) cancelEdit();
    setNotice(`${label} deleted.`);
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    dispatch({ type: "intel/note", id: selected.id, body: note.trim() });
    setNote("");
    setNotice("Intel note logged.");
  };

  return (
    <ModuleShell title="Market Intel" description="Track stocks, companies, trends, crypto, funds, and news topics without losing the thesis.">
      <section className="life-layout intel-layout">
        <article className="life-hero intel-hero">
          <div>
            <span className="micro-label">Research command</span>
            <h2>Watchtower</h2>
            <p>{state.intel.length === 0 ? "Build a watchlist before capital or attention moves." : `${state.intel.length} item${state.intel.length === 1 ? "" : "s"} under observation.`}</p>
          </div>
          <div className="intel-radar">
            <Newspaper size={24} />
            <strong>{state.intel.length}</strong>
            <span>Tracked signals</span>
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Signal board" />
          <div className="signal-grid compact">
            {signalCounts.map((item) => (
              <div className="signal-card" key={item.signal}>
                <span>{item.signal}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="deck-panel life-panel">
          <PanelHead title="Research queue" />
          <div className="timeline-list">
            {researchQueue.length === 0 && <EmptyState>No high-signal research queued.</EmptyState>}
            {researchQueue.map((item) => (
              <div className="timeline-item" key={item.id}>
                <strong>{item.symbol || item.kind}</strong>
                <div>
                  <span>{item.title}</span>
                  <em>{item.signal}</em>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <form className="command-form intel-form" onSubmit={submit}>
        <label><span>Name</span><input aria-label="Intel title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Company, stock, trend, or topic" /></label>
        <label><span>Symbol</span><input aria-label="Ticker or topic" value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="NVDA, BTC, AI" /></label>
        <label>
          <span>Type</span>
          <select aria-label="Intel type" value={kind} onChange={(event) => setKind(event.target.value as IntelKind)}>
            {intelKinds.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Signal</span>
          <select aria-label="Intel signal" value={signal} onChange={(event) => setSignal(event.target.value as IntelSignal)}>
            {intelSignals.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="intel-wide"><span>Thesis</span><input aria-label="Intel thesis" value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="Why it matters" /></label>
        <label><span>Source</span><input aria-label="Intel source URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" /></label>
        <button type="submit"><Plus size={16} /> {editingIntelId ? "Save intel" : "Add intel"}</button>
        {editingIntelId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>

      <div className="intel-grid">
        <section className="deck-panel">
          <PanelHead title="Tracked watchlist" />
          <div className="intel-list">
            {state.intel.length === 0 && <EmptyState>No intel tracked yet.</EmptyState>}
            {state.intel.map((item) => (
              <div className={`intel-row ${selected?.id === item.id ? "active" : ""}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <em>{[item.symbol, item.kind, item.signal].filter(Boolean).join(" - ")}</em>
                  {item.thesis && <p>{item.thesis}</p>}
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => setSelectedId(item.id)}><Eye size={15} /> Focus</button>
                  <button type="button" onClick={() => startEdit(item)}><Pencil size={15} /> Modify</button>
                  <button type="button" aria-label={`Delete ${item.title}`} onClick={() => deleteIntelItem(item.id, item.title)}><Trash2 size={15} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="deck-panel">
          <PanelHead title="Focused item" />
          {!selected && <EmptyState>Select or add an intel item.</EmptyState>}
          {selected && (
            <div className="intel-focus">
              <div className="intel-focus-head">
                <span className="source-pill">{selected.kind}</span>
                <h3>{selected.title}</h3>
                <p>{selected.thesis || "No thesis recorded yet."}</p>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => startEdit(selected)}><Pencil size={15} /> Modify</button>
                <button type="button" aria-label={`Delete ${selected.title}`} onClick={() => deleteIntelItem(selected.id, selected.title)}><Trash2 size={15} /> Delete</button>
              </div>
              <div className="research-links">
                <a href={getIntelNewsUrl(selected)} target="_blank" rel="noreferrer" aria-label={`News search for ${selected.title}`}>
                  <Search size={15} /> News search
                </a>
                <a href={getIntelFinanceUrl(selected)} target="_blank" rel="noreferrer" aria-label={`Finance lookup for ${selected.title}`}>
                  <ExternalLink size={15} /> Market lookup
                </a>
                {selected.sourceUrl && (
                  <a href={selected.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open source for ${selected.title}`}>
                    <ExternalLink size={15} /> Source
                  </a>
                )}
              </div>
              <form className="journal-form intel-note-form" onSubmit={submitNote}>
                <label><span>Note</span><textarea aria-label="Intel note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catalyst, risk, question, or update" /></label>
                <button type="submit"><Plus size={16} /> Add note</button>
              </form>
              <ItemList empty="No notes logged.">
                {selected.notes.map((entry) => (
                  <ActionRow key={entry.id} title={entry.body} meta={formatDateTime(entry.createdAt)} />
                ))}
              </ItemList>
            </div>
          )}
        </section>
      </div>
    </ModuleShell>
  );
}

function CalendarModule({ state, dispatch, setNotice }: ModuleProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [entryType, setEntryType] = useState<CalendarEntry["type"]>("mission");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
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
    if (editingEventId) {
      dispatch({ type: "calendar/update", id: editingEventId, title: title.trim(), date, time, entryType });
      setEditingEventId(null);
      setNotice("Calendar event updated.");
    } else {
      dispatch({ type: "calendar/add", title: title.trim(), date, time, entryType });
      setNotice("Calendar event added.");
    }
    setTitle("");
  };

  const startEdit = (entry: CalendarEntry) => {
    setEditingEventId(entry.id);
    setTitle(entry.title);
    setDate(entry.date);
    setTime(entry.time);
    setEntryType(entry.type);
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10));
    setTime("09:00");
    setEntryType("mission");
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
        <button type="submit"><Plus size={16} /> {editingEventId ? "Save event" : "Add event"}</button>
        {editingEventId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <section className="deck-panel">
        <PanelHead title="Full schedule" />
        <ItemList empty="No calendar entries.">
          {sortedEvents.map((entry) => (
            <ActionRow key={entry.id} title={entry.title} meta={`${formatDate(entry.date)} at ${entry.time} - ${entry.type}`}>
              <button type="button" onClick={() => startEdit(entry)}><Pencil size={15} /> Modify</button>
              <button type="button" aria-label={`Delete ${entry.title}`} onClick={() => dispatch({ type: "calendar/delete", id: entry.id })}><Trash2 size={15} /> Delete</button>
            </ActionRow>
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
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
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
    if (editingWorkoutId) {
      dispatch({ type: "workout/update", id: editingWorkoutId, name: name.trim(), day, focus: focus.trim() });
      setEditingWorkoutId(null);
      setNotice("Workout updated.");
    } else {
      dispatch({ type: "workout/add", name: name.trim(), day, focus: focus.trim() });
      setNotice("Workout added.");
    }
    setName("");
    setFocus("");
  };

  const startEdit = (entry: CommandDeckState["workouts"][number]) => {
    setEditingWorkoutId(entry.id);
    setName(entry.name);
    setDay(entry.day);
    setFocus(entry.focus);
  };

  const cancelEdit = () => {
    setEditingWorkoutId(null);
    setName("");
    setDay("Monday");
    setFocus("");
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
        <button type="submit"><Plus size={16} /> {editingWorkoutId ? "Save workout" : "Add workout"}</button>
        {editingWorkoutId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <section className="deck-panel">
        <PanelHead title="Training log" />
        <ItemList empty="No workouts planned.">
          {state.workouts.map((entry) => (
            <ActionRow key={entry.id} title={entry.name} meta={`${entry.day} - ${entry.focus || "general"} - ${entry.status}`}>
              <button type="button" onClick={() => startEdit(entry)}><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "workout/toggle", id: entry.id })} type="button">
                {entry.status === "done" ? "Reopen" : "Done"}
              </button>
              <button type="button" aria-label={`Delete ${entry.name}`} onClick={() => dispatch({ type: "workout/delete", id: entry.id })}><Trash2 size={15} /> Delete</button>
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
  const [currentChapter, setCurrentChapter] = useState("0");
  const [totalChapters, setTotalChapters] = useState("0");
  const [currentPage, setCurrentPage] = useState("0");
  const [totalPages, setTotalPages] = useState("0");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const reading = state.books.filter((book) => book.status === "reading");
  const done = state.books.filter((book) => book.status === "done");
  const averageProgress = state.books.length === 0 ? 0 : Math.round(state.books.reduce((total, book) => total + book.progress, 0) / state.books.length);
  const topBook = state.books.slice().sort((left, right) => right.progress - left.progress)[0];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    if (editingBookId) {
      dispatch({
        type: "book/update",
        id: editingBookId,
        title: title.trim(),
        author: author.trim() || "Unknown",
        currentChapter: Number(currentChapter),
        totalChapters: Number(totalChapters),
        currentPage: Number(currentPage),
        totalPages: Number(totalPages)
      });
      setEditingBookId(null);
      setNotice("Book updated.");
    } else {
      dispatch({
        type: "book/add",
        title: title.trim(),
        author: author.trim() || "Unknown",
        currentChapter: Number(currentChapter),
        totalChapters: Number(totalChapters),
        currentPage: Number(currentPage),
        totalPages: Number(totalPages)
      });
      setNotice("Book added.");
    }
    setTitle("");
    setAuthor("");
    resetReadingFields();
  };

  const startEdit = (book: CommandDeckState["books"][number]) => {
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setCurrentChapter(String(book.currentChapter));
    setTotalChapters(String(book.totalChapters));
    setCurrentPage(String(book.currentPage));
    setTotalPages(String(book.totalPages));
  };

  const cancelEdit = () => {
    setEditingBookId(null);
    setTitle("");
    setAuthor("");
    resetReadingFields();
  };

  const resetReadingFields = () => {
    setCurrentChapter("0");
    setTotalChapters("0");
    setCurrentPage("0");
    setTotalPages("0");
  };

  return (
    <ModuleShell title="Books Reading" description="Track the books you are reading and push progress forward.">
      <section className="life-layout books-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Knowledge intake</span>
            <h2>Reading Radar</h2>
            <p>{topBook ? `${topBook.title} is leading the stack at ${topBook.progress}% from page and chapter tracking.` : "Start a reading stack and keep the signal moving."}</p>
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
        <label><span>Current chapter</span><input aria-label="Current chapter" type="number" min="0" value={currentChapter} onChange={(event) => setCurrentChapter(event.target.value)} /></label>
        <label><span>Total chapters</span><input aria-label="Total chapters" type="number" min="0" value={totalChapters} onChange={(event) => setTotalChapters(event.target.value)} /></label>
        <label><span>Current page</span><input aria-label="Current page" type="number" min="0" value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} /></label>
        <label><span>Total pages</span><input aria-label="Total pages" type="number" min="0" value={totalPages} onChange={(event) => setTotalPages(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> {editingBookId ? "Save book" : "Add book"}</button>
        {editingBookId && <button type="button" onClick={cancelEdit}>Cancel</button>}
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
            <div className="reading-progress-detail">
              <span className="micro-label">Progress {book.progress}%</span>
              <strong>Chapter {book.currentChapter} / {book.totalChapters || "?"}</strong>
              <strong>Page {book.currentPage} / {book.totalPages || "?"}</strong>
            </div>
            <div className="reading-stepper-grid">
              <label>
                <span>Chapter</span>
                <input
                  aria-label={`${book.title} current chapter`}
                  type="number"
                  min="0"
                  value={book.currentChapter}
                  onChange={(event) =>
                    dispatch({
                      type: "book/progress",
                      id: book.id,
                      currentChapter: Number(event.target.value),
                      totalChapters: book.totalChapters,
                      currentPage: book.currentPage,
                      totalPages: book.totalPages
                    })
                  }
                />
              </label>
              <label>
                <span>Page</span>
                <input
                  aria-label={`${book.title} current page`}
                  type="number"
                  min="0"
                  value={book.currentPage}
                  onChange={(event) =>
                    dispatch({
                      type: "book/progress",
                      id: book.id,
                      currentChapter: book.currentChapter,
                      totalChapters: book.totalChapters,
                      currentPage: Number(event.target.value),
                      totalPages: book.totalPages
                    })
                  }
                />
              </label>
            </div>
            <div className="card-actions">
              <button type="button" onClick={() => startEdit(book)}><Pencil size={15} /> Modify</button>
              <button type="button" aria-label={`Delete ${book.title}`} onClick={() => dispatch({ type: "book/delete", id: book.id })}><Trash2 size={15} /> Delete</button>
            </div>
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
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const latestEntry = state.journal[0];
  const moodMix = state.journal.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] ?? 0) + 1;
    return acc;
  }, {});
  const prompts = ["What moved today?", "What is the next clean action?", "What pattern is repeating?"];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    if (editingJournalId) {
      dispatch({ type: "journal/update", id: editingJournalId, mood: mood.trim() || "Logged", body: body.trim() });
      setEditingJournalId(null);
      setNotice("Journal entry updated.");
    } else {
      dispatch({ type: "journal/add", mood: mood.trim() || "Logged", body: body.trim() });
      setNotice("Journal entry saved.");
    }
    setBody("");
  };

  const startEdit = (entry: CommandDeckState["journal"][number]) => {
    setEditingJournalId(entry.id);
    setMood(entry.mood);
    setBody(entry.body);
  };

  const cancelEdit = () => {
    setEditingJournalId(null);
    setMood("Focused");
    setBody("");
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
        <button type="submit"><Plus size={16} /> {editingJournalId ? "Save changes" : "Save entry"}</button>
        {editingJournalId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <section className="journal-archive">
        {state.journal.length === 0 && <EmptyState>No journal entries.</EmptyState>}
        {state.journal.map((entry) => (
          <article className="journal-card" key={entry.id}>
            <span>{formatDate(entry.date)}</span>
            <h3>{entry.mood}</h3>
            <p>{entry.body}</p>
            <div className="card-actions">
              <button type="button" onClick={() => startEdit(entry)}><Pencil size={15} /> Modify</button>
              <button type="button" aria-label={`Delete ${entry.mood}`} onClick={() => dispatch({ type: "journal/delete", id: entry.id })}><Trash2 size={15} /> Delete</button>
            </div>
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
  const [editingFinanceId, setEditingFinanceId] = useState<string | null>(null);
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
    if (editingFinanceId) {
      dispatch({ type: "finance/update", id: editingFinanceId, label: label.trim(), financeType, amount: numericAmount, date });
      setEditingFinanceId(null);
      setNotice("Finance entry updated.");
    } else {
      dispatch({ type: "finance/add", label: label.trim(), financeType, amount: numericAmount, date });
      setNotice("Finance entry added.");
    }
    setLabel("");
    setAmount("");
  };

  const startEdit = (entry: CommandDeckState["finances"][number]) => {
    setEditingFinanceId(entry.id);
    setLabel(entry.label);
    setFinanceType(entry.type);
    setAmount(String(entry.amount));
    setDate(entry.date);
  };

  const cancelEdit = () => {
    setEditingFinanceId(null);
    setLabel("");
    setFinanceType("expense");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
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
        <button type="submit"><Plus size={16} /> {editingFinanceId ? "Save finance" : "Add finance"}</button>
        {editingFinanceId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <section className="deck-panel">
        <PanelHead title="Ledger stream" />
        <ItemList empty="No finance entries.">
          {state.finances.map((entry) => (
            <ActionRow key={entry.id} title={entry.label} meta={`${entry.type} - ${formatMoney(entry.amount)} - ${entry.status}`}>
              <button type="button" onClick={() => startEdit(entry)}><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "finance/toggle", id: entry.id })} type="button">
                {entry.status === "cleared" ? "Plan" : "Clear"}
              </button>
              <button type="button" aria-label={`Delete ${entry.label}`} onClick={() => dispatch({ type: "finance/delete", id: entry.id })}><Trash2 size={15} /> Delete</button>
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
    state.settings.showJournal,
    state.settings.showIntel
  ].filter(Boolean).length;

  const testOllama = async () => {
    setNotice("Checking Ollama...");
    const result = await checkOllamaConnection({
      enabled: state.settings.ollamaEnabled,
      endpoint: state.settings.ollamaEndpoint,
      model: state.settings.ollamaModel
    });

    if (!result.ok) {
      setNotice(`Ollama offline: ${result.error}`);
      return;
    }

    const hasModel = result.models.includes(state.settings.ollamaModel);
    setNotice(hasModel ? `Ollama ready: ${state.settings.ollamaModel}.` : `Ollama online. Model not found: ${state.settings.ollamaModel}.`);
  };

  return (
    <ModuleShell title="Customize Options" description="Tune callsign, accent, density, dashboard modules, and reset the fresh deck.">
      <section className="life-layout customize-layout">
        <article className="life-hero">
          <div>
            <span className="micro-label">Interface command</span>
            <h2>Interface Presets</h2>
            <p>{enabledModules}/7 visible systems are active. Shape Northwatch around the day you actually run.</p>
          </div>
          <div className="theme-preview">
            <Palette size={22} />
            <span>{state.settings.accent}</span>
            <strong>{state.settings.density}</strong>
            <em>{state.settings.background}</em>
          </div>
        </article>
        <section className="deck-panel life-panel">
          <PanelHead title="Module switches" />
          <div className="mini-toggle-list">
            <ToggleCard label="Calendar module" checked={state.settings.showCalendar} onChange={(checked) => dispatch({ type: "settings/update", payload: { showCalendar: checked } })} />
            <ToggleCard label="Books module" checked={state.settings.showBooks} onChange={(checked) => dispatch({ type: "settings/update", payload: { showBooks: checked } })} />
            <ToggleCard label="Journal module" checked={state.settings.showJournal} onChange={(checked) => dispatch({ type: "settings/update", payload: { showJournal: checked } })} />
            <ToggleCard label="Intel module" checked={state.settings.showIntel} onChange={(checked) => dispatch({ type: "settings/update", payload: { showIntel: checked } })} />
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
        <div className="custom-card">
          <span>Background</span>
          <div className="segmented">
            {backgroundOptions.map((option) => (
              <button
                className={state.settings.background === option.value ? "active" : ""}
                key={option.value}
                onClick={() => dispatch({ type: "settings/update", payload: { background: option.value } })}
                type="button"
              >
                Use {option.label} background
              </button>
            ))}
          </div>
        </div>
        <div className="custom-card logo-select-card">
          <span>Northwatch mark</span>
          <div className="logo-options" aria-label="Northwatch logo options">
            {logoOptions.map((option) => (
              <button
                className={`logo-option ${state.settings.logoStyle === option.value ? "active" : ""}`}
                type="button"
                key={option.value}
                aria-label={`Use ${option.label} logo`}
                onClick={() => dispatch({ type: "settings/update", payload: { logoStyle: option.value } })}
              >
                <LogoMark variant={option.value} />
                <strong>{option.label}</strong>
                <em>{option.description}</em>
              </button>
            ))}
          </div>
        </div>
        <ToggleCard label="Show orbit radar" checked={state.settings.showOrbit} onChange={(checked) => dispatch({ type: "settings/update", payload: { showOrbit: checked } })} />
        <ToggleCard label="Show finance card" checked={state.settings.showFinance} onChange={(checked) => dispatch({ type: "settings/update", payload: { showFinance: checked } })} />
        <ToggleCard label="Show workout systems" checked={state.settings.showWorkout} onChange={(checked) => dispatch({ type: "settings/update", payload: { showWorkout: checked } })} />
        <div className="custom-card ollama-card">
          <span>Sentinel brain</span>
          <label className="inline-check">
            <input
              aria-label="Use Ollama for Sentinel"
              type="checkbox"
              checked={state.settings.ollamaEnabled}
              onChange={(event) => dispatch({ type: "settings/update", payload: { ollamaEnabled: event.target.checked } })}
            />
            <strong>Ollama</strong>
          </label>
          <label>
            <span>Endpoint</span>
            <input
              aria-label="Ollama endpoint"
              value={state.settings.ollamaEndpoint}
              onChange={(event) => dispatch({ type: "settings/update", payload: { ollamaEndpoint: event.target.value } })}
            />
          </label>
          <label>
            <span>Model</span>
            <input
              aria-label="Ollama model"
              value={state.settings.ollamaModel}
              onChange={(event) => dispatch({ type: "settings/update", payload: { ollamaModel: event.target.value } })}
            />
          </label>
          <button type="button" onClick={testOllama}>
            <Bot size={16} /> Test Ollama
          </button>
        </div>
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
  workspaceMode,
  teams,
  activeTeam,
  teamMembers,
  teamInviteLink,
  isTeamBusy,
  onSwitchWorkspace,
  onCreateTeam,
  onJoinTeam,
  onCreateInviteLink,
  onUpdateMemberRole,
  onRemoveMember,
  onSignOut
}: {
  state: CommandDeckState;
  cloudStatus: CloudStatus;
  workspaceMode: WorkspaceMode;
  teams: TeamWorkspace[];
  activeTeam: TeamWorkspace | null;
  teamMembers: TeamMember[];
  teamInviteLink: string;
  isTeamBusy: boolean;
  onSwitchWorkspace: (workspace: WorkspaceMode) => Promise<void>;
  onCreateTeam: (name: string) => Promise<void>;
  onJoinTeam: (teamCode: string) => Promise<void>;
  onCreateInviteLink: () => Promise<void>;
  onUpdateMemberRole: (memberUserId: string, role: TeamRole) => Promise<void>;
  onRemoveMember: (memberUserId: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const lastSync = cloudStatus.lastSyncedAt ? formatDateTime(cloudStatus.lastSyncedAt) : "Not synced yet";
  const userEmail = cloudStatus.userEmail ?? "Local operator";
  const isCloudUser = supabaseConfig.isConfigured && Boolean(cloudStatus.userEmail);
  const canManageTeam = activeTeam?.role === "owner";
  const activeTeamName = activeTeam?.name ?? "No team selected";

  const submitCreateTeam = async (event: FormEvent) => {
    event.preventDefault();
    await onCreateTeam(teamName);
    setTeamName("");
  };

  const submitJoinTeam = async (event: FormEvent) => {
    event.preventDefault();
    await onJoinTeam(teamCode);
    setTeamCode("");
  };

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
            <span><CircleCheck size={16} /> Personal decks are isolated by signed-in user id.</span>
            <span><CircleCheck size={16} /> Team decks require explicit membership before data is shared.</span>
            <span><CircleCheck size={16} /> Local browser cache remains available offline.</span>
            <span><Shield size={16} /> Netlify URL is public; Supabase Auth protects workspace data.</span>
          </div>
        </section>
        <section className="deck-panel account-panel team-panel">
          <PanelHead title="Workspace mode" />
          <div className="team-switcher">
            <button
              className={workspaceMode.kind === "personal" ? "active" : ""}
              type="button"
              onClick={() => void onSwitchWorkspace({ kind: "personal" })}
              disabled={isTeamBusy || workspaceMode.kind === "personal"}
            >
              <LockKeyhole size={16} /> Personal vault
            </button>
            {teams.map((team) => (
              <button
                className={workspaceMode.kind === "team" && workspaceMode.teamId === team.id ? "active" : ""}
                type="button"
                key={team.id}
                onClick={() => void onSwitchWorkspace({ kind: "team", teamId: team.id })}
                disabled={isTeamBusy || (workspaceMode.kind === "team" && workspaceMode.teamId === team.id)}
              >
                <Shield size={16} /> {team.name}
              </button>
            ))}
          </div>
          <p className="panel-copy">
            {isCloudUser
              ? "Personal data stays private. Team mode only shares the selected team workspace with joined members."
              : "Team mode requires Supabase sign-in so Northwatch can enforce membership before sharing data."}
          </p>
          {teams.length > 0 && (
            <div className="team-code-list">
              {teams.map((team) => (
                <span key={team.id}>
                  <strong>{team.name}</strong>
                  <code>{team.id}</code>
                  <em>{team.role}</em>
                </span>
              ))}
            </div>
          )}
          <form className="team-form" onSubmit={submitCreateTeam}>
            <label>
              <span>New team</span>
              <input
                aria-label="Team name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="North Unit"
                disabled={!isCloudUser || isTeamBusy}
              />
            </label>
            <button type="submit" disabled={!isCloudUser || isTeamBusy || !teamName.trim()}>
              <Plus size={16} /> Create team
            </button>
          </form>
          <form className="team-form" onSubmit={submitJoinTeam}>
            <label>
              <span>Invite link</span>
              <input
                aria-label="Invite link"
                value={teamCode}
                onChange={(event) => setTeamCode(event.target.value)}
                placeholder="Paste team invite link"
                disabled={!isCloudUser || isTeamBusy}
              />
            </label>
            <button type="submit" disabled={!isCloudUser || isTeamBusy || !teamCode.trim()}>
              <KeyRound size={16} /> Join team
            </button>
          </form>
          <div className="team-ops-grid">
            <div className="team-ops-card">
              <div className="team-ops-head">
                <Copy size={16} />
                <div>
                  <strong>Invite links</strong>
                  <span>{activeTeam ? `For ${activeTeam.name}` : "Switch to a team first"}</span>
                </div>
              </div>
              <button type="button" onClick={() => void onCreateInviteLink()} disabled={!canManageTeam || isTeamBusy}>
                <Plus size={16} /> Create invite link
              </button>
              <input
                aria-label="Team invite link"
                value={teamInviteLink}
                readOnly
                placeholder={canManageTeam ? "Generated invite link appears here" : "Owner access required"}
              />
            </div>
            <div className="team-ops-card">
              <div className="team-ops-head">
                <UsersRound size={16} />
                <div>
                  <strong>Member command</strong>
                  <span>{activeTeamName}</span>
                </div>
              </div>
              <p className="panel-copy">
                {canManageTeam
                  ? "Owners can promote, demote, and remove team members."
                  : "Role management unlocks when an owner opens a team workspace."}
              </p>
              <div className="team-member-list">
                {teamMembers.length === 0 ? (
                  <span className="team-empty-state">No team members loaded.</span>
                ) : (
                  teamMembers.map((member) => {
                    const memberLabel = member.email ?? member.userId;
                    return (
                      <article className="team-member-row" key={`${member.teamId}-${member.userId}`}>
                        <div>
                          <strong>{memberLabel}</strong>
                          <span>{member.userId}</span>
                        </div>
                        <em>{member.role}</em>
                        <div className="team-member-actions">
                          <button
                            type="button"
                            aria-label={`Make ${memberLabel} owner`}
                            onClick={() => void onUpdateMemberRole(member.userId, "owner")}
                            disabled={!canManageTeam || isTeamBusy || member.role === "owner"}
                            title="Make owner"
                          >
                            <Crown size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Make ${memberLabel} member`}
                            onClick={() => void onUpdateMemberRole(member.userId, "member")}
                            disabled={!canManageTeam || isTeamBusy || member.role === "member"}
                            title="Make member"
                          >
                            <Shield size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${memberLabel}`}
                            onClick={() => void onRemoveMember(member.userId)}
                            disabled={!canManageTeam || isTeamBusy}
                            title="Remove member"
                          >
                            <UserMinus size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
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

function readPendingTeamInvite(): string | null {
  const inviteFromLocation = readTeamInviteFromLocation();
  if (inviteFromLocation) return inviteFromLocation;
  return window.localStorage.getItem(PENDING_TEAM_INVITE_STORAGE_KEY);
}

function readTeamInviteFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const teamId = params.get("team")?.trim();
  const inviteId = params.get("invite")?.trim();
  if (!teamId || !inviteId) return null;
  return buildTeamInviteUrl(window.location.origin, teamId, inviteId);
}

function clearPendingTeamInvite() {
  window.localStorage.removeItem(PENDING_TEAM_INVITE_STORAGE_KEY);
  const url = new URL(window.location.href);
  if (!url.searchParams.has("team") && !url.searchParams.has("invite")) return;
  url.searchParams.delete("team");
  url.searchParams.delete("invite");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function LogoMark({ variant }: { variant: LogoStyle }) {
  if (variant === "monolith") {
    return (
      <svg className="northwatch-logo" viewBox="0 0 64 64" role="img" aria-label="Black Tower logo">
        <path d="M32 6 48 18v36H16V18L32 6Z" />
        <path d="M32 15v39" />
        <path d="M24 24h16" />
        <path d="M22 34h20" />
      </svg>
    );
  }

  if (variant === "radar") {
    return (
      <span
        className="northwatch-logo northwatch-logo-orbit-watch"
        role="img"
        aria-label="Orbit Watch logo"
        style={{ backgroundImage: `url(${orbitWatchLogoBoardUrl})` }}
      />
    );
  }

  if (variant === "spire") {
    return (
      <svg className="northwatch-logo" viewBox="0 0 64 64" role="img" aria-label="North Spire logo">
        <path d="M32 6 52 56 32 44 12 56 32 6Z" />
        <path d="M32 16v28" />
        <path d="M22 46h20" />
      </svg>
    );
  }

  return (
    <svg className="northwatch-logo" viewBox="0 0 64 64" role="img" aria-label="Sentinel Wing logo">
      <path d="M32 8 54 20 47 48 32 56 17 48 10 20 32 8Z" />
      <path d="M18 23h28" />
      <path d="M21 31 32 43 43 31" />
      <path d="M32 17v26" />
    </svg>
  );
}

function TechBackdrop({ metrics }: { metrics: ReturnType<typeof getDeckMetrics> }) {
  const nodes = [
    [8, 18, 0],
    [16, 72, 1],
    [28, 28, 2],
    [38, 84, 3],
    [52, 14, 1],
    [64, 68, 2],
    [74, 32, 0],
    [88, 76, 3],
    [93, 20, 2]
  ];

  return (
    <div className="tech-backdrop" aria-hidden="true">
      <div className="backdrop-grid" />
      <div className="backdrop-sweep" />
      <div className="backdrop-core">
        <span />
        <span />
        <span />
        <strong>{metrics.readiness}</strong>
      </div>
      <svg className="circuit-web" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <path d="M72 620 C260 460 305 555 450 390 S760 250 1128 116" />
        <path d="M118 180 C306 260 330 138 528 250 S790 424 1134 332" />
        <path d="M238 760 L420 610 L620 610 L790 474 L1060 474" />
        <path d="M100 420 L250 420 L330 500 L520 500 L650 370 L910 370 L1080 238" />
        <circle cx="250" cy="420" r="6" />
        <circle cx="528" cy="250" r="7" />
        <circle cx="790" cy="474" r="7" />
        <circle cx="910" cy="370" r="5" />
      </svg>
      {nodes.map(([left, top, delay], index) => (
        <span
          className="backdrop-node"
          key={`${left}-${top}`}
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay * 0.7}s` }}
        >
          {index % 3 === 0 && <i />}
        </span>
      ))}
    </div>
  );
}

function AgentDock({
  state,
  metrics,
  activeView,
  dispatch,
  setView,
  setNotice
}: {
  state: CommandDeckState;
  metrics: ReturnType<typeof getDeckMetrics>;
  activeView: DeckView;
  dispatch: React.Dispatch<CommandDeckAction>;
  setView: (view: DeckView) => void;
  setNotice: (message: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentConnectionState>(() =>
    state.settings.ollamaEnabled
      ? {
          mode: "checking",
          label: "Ollama checking",
          detail: "Checking the local Ollama server."
        }
      : {
          mode: "disabled",
          label: "Local brain",
          detail: "Ollama is disabled in Customize."
        }
  );
  const [messages, setMessages] = useState<AgentMessage[]>(() => [
    {
      id: "sentinel-boot",
      role: "agent",
      body: state.settings.ollamaEnabled
        ? `Ollama route armed for ${state.settings.ollamaModel}.\nIf the local server is running, I will use it. If not, I will fall back to deck logic.`
        : composeAgentReply(state, metrics, "dashboard", "Brief my next move")
    }
  ]);
  const priorityProject = getPriorityProject(state);
  const priorityTask = getPriorityTask(state);
  const activeLabel = navItems.find((item) => item.view === activeView)?.label ?? "Command";
  const ollamaConfig = {
    enabled: state.settings.ollamaEnabled,
    endpoint: state.settings.ollamaEndpoint,
    model: state.settings.ollamaModel
  };

  useEffect(() => {
    let isCancelled = false;

    if (!state.settings.ollamaEnabled) {
      setAgentStatus({
        mode: "disabled",
        label: "Local brain",
        detail: "Ollama is disabled in Customize."
      });
      return;
    }

    if (!isOpen) return;

    setAgentStatus({
      mode: "checking",
      label: "Ollama checking",
      detail: "Checking the local Ollama server."
    });

    checkOllamaConnection(ollamaConfig).then((result) => {
      if (isCancelled) return;

      if (!result.ok) {
        setAgentStatus({
          mode: "offline",
          label: "Ollama offline",
          detail: result.error ?? "Could not reach Ollama."
        });
        return;
      }

      const hasModel = result.models.includes(state.settings.ollamaModel);
      setAgentStatus({
        mode: hasModel ? "online" : "offline",
        label: hasModel ? `Ollama: ${state.settings.ollamaModel}` : "Model missing",
        detail: hasModel
          ? `${result.models.length} local model${result.models.length === 1 ? "" : "s"} available.`
          : `Pull ${state.settings.ollamaModel} or choose one of: ${result.models.join(", ") || "none installed"}.`
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, state.settings.ollamaEnabled, state.settings.ollamaEndpoint, state.settings.ollamaModel]);

  const sendPrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt) return;

    if (/create|add|make/i.test(prompt) && /focus|task|order/i.test(prompt)) {
      const title = getFocusTaskTitle(state);
      dispatch({ type: "task/add", title, priority: "high", dueDate: new Date().toISOString().slice(0, 10) });
      setView("todo");
      setNotice("Sentinel created a focus task.");
      setMessages((current) => [
        ...current,
        { id: `operator-${Date.now()}`, role: "operator", body: prompt },
        {
          id: `sentinel-${Date.now()}`,
          role: "agent",
          body: `Created a high-priority focus task: ${title}\nI moved you to To Do so you can execute or edit it.`
        }
      ]);
      setInput("");
      setIsOpen(true);
      return;
    }

    const fallbackReply = composeAgentReply(state, metrics, activeView, prompt);
    const pendingId = `sentinel-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `operator-${Date.now()}`, role: "operator", body: prompt },
      {
        id: pendingId,
        role: "agent",
        body: state.settings.ollamaEnabled ? `Thinking locally with ${state.settings.ollamaModel}...` : fallbackReply
      }
    ]);
    setInput("");
    setIsOpen(true);

    if (!state.settings.ollamaEnabled) return;

    setAgentStatus((current) => ({
      ...current,
      mode: "thinking",
      label: `Ollama: ${state.settings.ollamaModel}`
    }));

    try {
      const reply = await requestOllamaAgentReply({
        config: ollamaConfig,
        state,
        metrics,
        activeView,
        prompt,
        history: messages
      });
      setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, body: reply } : message)));
      setAgentStatus({
        mode: "online",
        label: `Ollama: ${state.settings.ollamaModel}`,
        detail: "Last reply came from local Ollama."
      });
    } catch (error) {
      const detail = getErrorMessage(error);
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                body: `${fallbackReply}\n\nOllama could not answer: ${detail}`
              }
            : message
        )
      );
      setAgentStatus({
        mode: "offline",
        label: "Ollama fallback",
        detail
      });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sendPrompt(input);
  };

  return (
    <section className={`agent-dock ${isOpen ? "open" : "collapsed"}`} aria-label="Sentinel Agent">
      <header className="agent-header">
        <div className="agent-orb">
          <Bot size={19} />
          <span />
        </div>
        <div>
          <span>Sentinel Agent</span>
          <strong>{agentStatus.mode === "thinking" ? "Ollama thinking" : `${activeLabel} scan active`}</strong>
        </div>
        <button type="button" aria-label={isOpen ? "Collapse Sentinel Agent" : "Open Sentinel Agent"} onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={16} /> : <Sparkles size={16} />}
        </button>
      </header>

      {isOpen && (
        <>
          <div className="agent-vitals" aria-label="Sentinel live vitals">
            <span><Cpu size={14} /> {metrics.readiness}% ready</span>
            <span><Target size={14} /> {metrics.pendingProjects} projects</span>
            <span><ListTodo size={14} /> {metrics.openTasks} orders</span>
            <span className={`agent-model-pill ${agentStatus.mode}`} title={agentStatus.detail}><Bot size={14} /> {agentStatus.label}</span>
          </div>

          <div className="agent-context">
            <div>
              <span>Priority project</span>
              <strong>{priorityProject?.name ?? "No active project pressure"}</strong>
            </div>
            <div>
              <span>Next order</span>
              <strong>{priorityTask?.title ?? "Ask for a focus task"}</strong>
            </div>
          </div>

          <div className="agent-messages" aria-live="polite">
            {messages.slice(-5).map((message) => (
              <article className={`agent-message ${message.role}`} key={message.id}>
                {message.body.split("\n").map((line, index) => (
                  <p key={`${message.id}-${index}`}>{line}</p>
                ))}
              </article>
            ))}
          </div>

          <div className="agent-quick-row">
            {agentQuickPrompts.map((prompt) => (
              <button type="button" key={prompt} onClick={() => sendPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="agent-route-row" aria-label="Agent route controls">
            <button type="button" onClick={() => setView("todo")}>To Do</button>
            <button type="button" onClick={() => setView("projects")}>Projects</button>
            <button type="button" onClick={() => setView("intel")}>Intel</button>
          </div>

          <form className="agent-input" onSubmit={submit}>
            <input
              aria-label="Ask Sentinel"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Sentinel what to do next..."
            />
            <button type="submit" aria-label="Send to Sentinel">
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </section>
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

function composeAgentReply(
  state: CommandDeckState,
  metrics: ReturnType<typeof getDeckMetrics>,
  activeView: DeckView,
  prompt: string
): string {
  const normalized = prompt.toLowerCase();
  const project = getPriorityProject(state);
  const task = getPriorityTask(state);
  const intel = state.intel.find((item) => item.signal === "high-priority" || item.signal === "researching");
  const financeLine =
    metrics.netCash >= 0
      ? `Net cash is positive at ${formatMoney(metrics.netCash)}. Keep logging cleared income, expenses, and savings.`
      : `Net cash is negative at ${formatMoney(metrics.netCash)}. Review expenses before adding new commitments.`;

  if (normalized.includes("bottleneck") || normalized.includes("blocked")) {
    const projectLine = project
      ? `${project.name} is the main pressure point: ${project.nextAction || project.objective || "define the next action."}`
      : "No pending project is currently bottlenecking the deck.";
    const taskLine = task ? `The next loose order is ${task.title}.` : "There are no open to do items yet.";
    return `${projectLine}\n${taskLine}\nBest move: create one visible next action, then close the smallest unfinished loop first.`;
  }

  if (normalized.includes("balance") || normalized.includes("today") || normalized.includes("day")) {
    return `Today should stay simple: one project push, one body signal, one money check.\nProject: ${project?.name ?? "choose a pending project"}.\nBody: ${
      state.workouts.find((entry) => entry.status === "planned")?.name ?? "add a short workout"
    }.\nMoney: ${financeLine}`;
  }

  if (normalized.includes("finance") || normalized.includes("money") || normalized.includes("cash")) {
    return `${financeLine}\nYou have ${state.finances.length} ledger entries and ${state.finances.filter((entry) => entry.status === "planned").length} waiting to clear.`;
  }

  if (normalized.includes("intel") || normalized.includes("invest") || normalized.includes("stock")) {
    return `Intel board has ${metrics.intelItems} tracked targets and ${metrics.intelResearching} active research signals.\n${
      intel ? `Lead target: ${intel.title}${intel.symbol ? ` (${intel.symbol})` : ""}. ${intel.thesis}` : "Add one market, stock, company, trend, or news item worth watching."
    }`;
  }

  if (normalized.includes("journal") || normalized.includes("reflect")) {
    return `Journal has ${metrics.journalEntries} entries. Capture one honest line after the next work block: what moved, what resisted, what gets cut next.`;
  }

  const viewLine = `Current module: ${navItems.find((item) => item.view === activeView)?.label ?? "Command"}.`;
  const taskLine = task ? `Execute next: ${task.title}${task.dueDate ? ` by ${formatDate(task.dueDate)}` : ""}.` : "No open task is waiting. Create a focus task if you want a hard target.";
  const projectLine = project ? `Project pressure: ${project.name} at ${project.progress}% with next action "${project.nextAction || "define next action"}".` : "Project pressure is clear.";

  return `${viewLine}\n${taskLine}\n${projectLine}\nReadiness is ${metrics.readiness}%. Keep the deck small, visible, and moving.`;
}

function getPriorityTask(state: CommandDeckState): CommandDeckState["tasks"][number] | null {
  const priorityWeight: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const openTasks = state.tasks.filter((task) => task.status === "todo");
  if (openTasks.length === 0) return null;

  return [...openTasks].sort((left, right) => {
    const priorityDelta = priorityWeight[left.priority] - priorityWeight[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0];
}

function getTodayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRoutineDayForDate(date: string): RoutineDay {
  const dayIndex = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return routineDayOptions[dayIndex === 0 ? 6 : dayIndex - 1].value;
}

function getRoutineDayIndex(day: RoutineDay): number {
  return routineDayOptions.findIndex((option) => option.value === day);
}

function getRoutineDaysLabel(days: RoutineDay[]): string {
  return routineDayOptions.filter((option) => days.includes(option.value)).map((option) => option.short).join(" ");
}

function getPriorityProject(state: CommandDeckState): CommandDeckState["projects"][number] | null {
  const pending = state.projects.filter((project) => project.status === "pending");
  if (pending.length === 0) return null;

  return [...pending].sort((left, right) => {
    const issueDelta = right.openIssues + right.openPullRequests - (left.openIssues + left.openPullRequests);
    if (issueDelta !== 0) return issueDelta;
    const progressDelta = left.progress - right.progress;
    if (progressDelta !== 0) return progressDelta;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0];
}

function getFocusTaskTitle(state: CommandDeckState): string {
  const task = getPriorityTask(state);
  if (task) return `Finish: ${task.title}`;

  const project = getPriorityProject(state);
  if (project) return `Advance ${project.name}: ${project.nextAction || "define the next milestone"}`;

  const intel = state.intel.find((item) => item.signal === "high-priority" || item.signal === "researching");
  if (intel) return `Research ${intel.title}${intel.symbol ? ` (${intel.symbol})` : ""}`;

  return "Run a 30 minute Northwatch review";
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

function getIntelQuery(item: IntelItem): string {
  return encodeURIComponent(item.symbol || item.title);
}

function getIntelNewsUrl(item: IntelItem): string {
  return `https://news.google.com/search?q=${getIntelQuery(item)}`;
}

function getIntelFinanceUrl(item: IntelItem): string {
  if (item.symbol) return `https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}`;
  return `https://www.google.com/search?q=${getIntelQuery(item)}%20market%20research`;
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
