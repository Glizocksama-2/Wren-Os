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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import orbitWatchLogoBoardUrl from "./assets/northwatch-logo-board.png";
import type { AuthUser } from "./auth/AuthContext";
import { IntelPage } from "./components/IntelPage";
import { CurrencyProvider } from "./context/CurrencyContext";
import { buildAutonomousIntelScan } from "./lib/intelAutopilot";
import { checkOllamaConnection, requestOllamaAgentReply } from "./lib/ollama";
import { supabase, supabaseConfig, type WrenSession } from "./lib/supabase";
import { toKSH } from "./utils/currency";
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
import { NotificationBell, WorkspaceSwitcher } from "./team/TeamPages.jsx";
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
  type KanbanPriority,
  type LogoStyle,
  type Priority,
  type RoutineCadence,
  type RoutineDay,
  freshCommandDeck,
  getDeckMetrics,
  hasMeaningfulDeckData,
  loadCommandDeck,
  reduceCommandDeck,
  saveCommandDeck
} from "./store/commandDeck";

interface AppProps {
  authUser?: AuthUser | null;
  onAuthLogout?: () => void | Promise<void>;
}

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
  { view: "finances", label: "Finances", icon: <Banknote size={18} />, terms: ["finance", "finances", "money", "cash"] }
];

const priorityOptions: Priority[] = ["low", "medium", "high", "critical"];
const financeTypes: FinanceType[] = ["income", "expense", "savings"];
const eventTypes: CalendarEntry["type"][] = ["mission", "training", "finance", "personal"];
const intelKinds: IntelKind[] = ["stock", "crypto", "fund", "company", "trend", "news"];
const intelSignals: IntelSignal[] = ["watching", "researching", "high-priority", "on-hold"];
const journalMoodOptions = ["Focused", "Locked in", "Clear", "Restless", "Tired", "Stressed", "Grateful", "Low energy"];
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
type TeamWorkspaceSelection = { type: "personal" } | { type: "team"; teamId: string; slug: string; name: string; role: string };
const PENDING_TEAM_INVITE_STORAGE_KEY = "northwatch.pendingTeamInvite.v1";
const ACTIVE_TEAM_WORKSPACE_STORAGE_KEY = "northwatch.active-team-workspace.v1";
export const LEGAL_CONSENT_STORAGE_KEY = "northwatch.legal-consent.v1";
export const TERMS_VERSION = "2026-05-19";
export const PRIVACY_VERSION = "2026-05-19";
const LEGAL_JURISDICTION_LABEL = "Kenyan data protection law and applicable international privacy principles";
export const SESSION_TOKEN_STORAGE_KEY = "northwatch.session-token.v1";
export const SESSION_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const AGENT_HEALTH_POLL_MS = 30000;
const ACTIVITY_FEED_POLL_MS = 60000;
const AUTH_API_BASE_URL = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");
const TELEGRAM_SEND_ENDPOINT = `${AUTH_API_BASE_URL}/api/telegram/send`;
const TELEGRAM_CONFIG_ENDPOINT = `${AUTH_API_BASE_URL}/api/telegram/config`;
const LEGACY_COMMAND_DECK_ENDPOINT = `${AUTH_API_BASE_URL}/api/legacy-command-deck`;
const LEGACY_SUPABASE_CLOUD_SYNC_ENABLED = false;
const LEGACY_CLOUD_IMPORT_STORAGE_PREFIX = "northwatch.legacy-cloud-import.v2";

type LegalPanel = "settings" | "help" | "privacy" | "terms";
type AgentHealthStatus = "alive" | "dead" | "idle";

export interface LegalConsentRecord {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  jurisdiction: string;
}

export interface SessionTokenRecord {
  token: string;
  createdAt: string;
  rotatedAt: string;
}

interface AgentHealthRecord {
  id: string;
  label: string;
  status: AgentHealthStatus;
  checkedAt: string | null;
  detail: string;
}

interface ActivityFeedItem {
  id: string;
  label: string;
  createdAt: string;
}

interface TelegramPayload {
  kind: "kanban-card" | "doc" | "agent-alert";
  title: string;
  body: string;
  meta?: string;
}

interface TelegramConfigStatus {
  configured: boolean;
  botUsername: string | null;
  chatId: string | null;
  updatedAt: string | null;
}

interface LegacyCommandDeckPayload {
  deck: Partial<CommandDeckState>;
  updatedAt: string | null;
}

function loadLegalConsent(): LegalConsentRecord | null {
  try {
    const stored = window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LegalConsentRecord;
  } catch {
    return null;
  }
}

function saveLegalConsent(record: LegalConsentRecord) {
  window.localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(record));
}

export function hasValidLegalConsent(record: LegalConsentRecord | null): boolean {
  return Boolean(
    record &&
      record.termsVersion === TERMS_VERSION &&
      record.privacyVersion === PRIVACY_VERSION &&
      record.jurisdiction === LEGAL_JURISDICTION_LABEL
  );
}

function loadOrCreateSessionToken(): SessionTokenRecord {
  try {
    const stored = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SessionTokenRecord>;
      if (parsed.token && parsed.createdAt && parsed.rotatedAt) {
        return parsed as SessionTokenRecord;
      }
    }
  } catch {
    // Fall through to a fresh token.
  }

  const token = createSessionToken();
  saveSessionToken(token);
  return token;
}

function saveSessionToken(record: SessionTokenRecord) {
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify(record));
}

function createSessionToken(): SessionTokenRecord {
  const now = new Date().toISOString();
  return {
    token: `nw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`,
    createdAt: now,
    rotatedAt: now
  };
}

function isSessionTokenExpired(record: SessionTokenRecord): boolean {
  return Date.now() - new Date(record.createdAt).getTime() > SESSION_TOKEN_MAX_AGE_MS;
}

const agentQuickPrompts = [
  "Brief my next move",
  "Find the bottleneck",
  "Scan intel",
  "Balance today",
  "Create focus task"
];

export default function App(props: AppProps = {}) {
  return (
    <CurrencyProvider>
      <NorthwatchApp {...props} />
    </CurrencyProvider>
  );
}

function NorthwatchApp({ authUser = null, onAuthLogout }: AppProps = {}) {
  const authUserId = authUser?.id ?? null;
  const isSupabaseCloudConfigured = LEGACY_SUPABASE_CLOUD_SYNC_ENABLED && supabaseConfig.isConfigured;
  const [state, dispatch] = useReducer(reduceCommandDeck, undefined, () => loadCommandDeck(window.localStorage, authUserId));
  const [view, setView] = useState<DeckView>("dashboard");
  const [notice, setNotice] = useState("Fresh command deck initialized.");
  const [session, setSession] = useState<WrenSession | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseCloudConfigured);
  const [cloudReady, setCloudReady] = useState(!isSupabaseCloudConfigured);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(() => getInitialCloudStatus());
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>({ kind: "personal" });
  const [activeTeamWorkspace, setActiveTeamWorkspace] = useState<TeamWorkspaceSelection>(() => loadActiveTeamWorkspace());
  const [teams, setTeams] = useState<TeamWorkspace[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInviteLink, setTeamInviteLink] = useState("");
  const [isTeamBusy, setIsTeamBusy] = useState(false);
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);
  const [legalConsent, setLegalConsent] = useState<LegalConsentRecord | null>(() => loadLegalConsent());
  const [sessionToken, setSessionToken] = useState<SessionTokenRecord>(() => loadOrCreateSessionToken());
  const [isShortcutOverlayOpen, setIsShortcutOverlayOpen] = useState(false);
  const [isRecoveringLegacyDeck, setIsRecoveringLegacyDeck] = useState(false);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const latestDeckRef = useRef(state);
  const saveTimerRef = useRef<number | null>(null);
  const pendingInviteAttemptRef = useRef<string | null>(null);
  const logoMenuRef = useRef<HTMLDivElement | null>(null);
  const lastActivityPollRef = useRef(state.updatedAt);
  const shortcutChordRef = useRef<{ key: string; armedAt: number } | null>(null);
  const metrics = useMemo(() => getDeckMetrics(state), [state]);
  const visibleNavItems = useMemo(() => navItems.filter((item) => isViewEnabled(item.view, state.settings)), [state.settings]);
  const activeTeam = useMemo(
    () => (workspaceMode.kind === "team" ? teams.find((team) => team.id === workspaceMode.teamId) ?? null : null),
    [teams, workspaceMode]
  );
  const workspaceLabel = activeTeamWorkspace.type === "team" ? `Team: ${activeTeamWorkspace.name}` : activeTeam ? `Team: ${activeTeam.name}` : "Personal vault";

  useEffect(() => {
    latestDeckRef.current = state;
    saveCommandDeck(state, window.localStorage, authUserId);
  }, [authUserId, state]);

  useEffect(() => {
    if (!authUserId) return;

    const importKey = `${LEGACY_CLOUD_IMPORT_STORAGE_PREFIX}:${authUserId}`;
    if (window.localStorage.getItem(importKey)) return;

    let isCancelled = false;

    async function importLegacyCloudDeck() {
      try {
        const payload = await fetchLegacyCommandDeck();
        if (isCancelled || !payload) return;

        const hasCurrentDeckData = hasMeaningfulDeckData(latestDeckRef.current);
        dispatch({
          type: hasCurrentDeckData ? "deck/merge-import" : "deck/import",
          deck: payload.deck,
          preserveLegacyGitHubProjects: true
        });
        window.localStorage.setItem(importKey, payload.updatedAt ?? new Date().toISOString());
        setNotice(hasCurrentDeckData ? "Recovered and merged the command deck saved under your email." : "Recovered the command deck saved under your email.");
      } catch {
        // Legacy cloud import is best-effort; local account storage still works without it.
      }
    }

    void importLegacyCloudDeck();

    return () => {
      isCancelled = true;
    };
  }, [authUserId]);

  const recoverLegacyEmailDeck = useCallback(async () => {
    if (!authUserId) {
      setNotice("Sign in first, then recover data saved under your email.");
      return;
    }

    setIsRecoveringLegacyDeck(true);
    try {
      const payload = await fetchLegacyCommandDeck();
      if (!payload) {
        setNotice("No previous email data was found for this account yet.");
        return;
      }

      const hasCurrentDeckData = hasMeaningfulDeckData(latestDeckRef.current);
      dispatch({
        type: hasCurrentDeckData ? "deck/merge-import" : "deck/import",
        deck: payload.deck,
        preserveLegacyGitHubProjects: true
      });
      window.localStorage.setItem(`${LEGACY_CLOUD_IMPORT_STORAGE_PREFIX}:${authUserId}`, payload.updatedAt ?? new Date().toISOString());
      setNotice(hasCurrentDeckData ? "Recovered and merged the command deck saved under your email." : "Recovered the command deck saved under your email.");
    } catch (error) {
      setNotice(`Email data recovery failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRecoveringLegacyDeck(false);
    }
  }, [authUserId]);

  useEffect(() => {
    if (!isSupabaseCloudConfigured || !supabase) return;

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
          detail: "Use your Northwatch email and password account to open the deck.",
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
        setWorkspaceMode({ kind: "personal" });
        setTeams([]);
        setTeamMembers([]);
        setTeamInviteLink("");
        setCloudStatus({
          mode: "signed-out",
          label: "Cloud auth: sign in required",
          detail: "Use your Northwatch email and password account to open the deck.",
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
    if (!isSupabaseCloudConfigured || !supabase || !authReady || !session) return;

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
    if (!isSupabaseCloudConfigured || !supabase || !session || !cloudReady) return;

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
    const label = getDocumentTitleForView(view);
    document.title = `${label} · Northwatch`;
  }, [view]);

  useEffect(() => {
    const handleNewItem = () => {
      const targetView = view === "dashboard" || view === "account" || view === "customize" ? "todo" : view;
      if (targetView !== view) {
        setView(targetView);
      }
      window.setTimeout(() => focusNewItemField(targetView), 0);
      setNotice(`Ready to add ${getNewItemLabel(targetView)}.`);
    };

    window.addEventListener("northwatch:new-item", handleNewItem);
    return () => window.removeEventListener("northwatch:new-item", handleNewItem);
  }, [view]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (isTyping) return;

      if (event.key === "?") {
        event.preventDefault();
        setIsShortcutOverlayOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setIsShortcutOverlayOpen(false);
        shortcutChordRef.current = null;
        return;
      }

      const normalized = event.key.toLowerCase();
      const chord = shortcutChordRef.current;
      if (chord?.key === "g" && Date.now() - chord.armedAt < 1200) {
        const targetView = getShortcutView(normalized);
        shortcutChordRef.current = null;
        if (targetView) {
          event.preventDefault();
          setView(targetView);
          setNotice(`Opened ${getDocumentTitleForView(targetView)}.`);
        }
        return;
      }

      if (normalized === "g") {
        shortcutChordRef.current = { key: "g", armedAt: Date.now() };
        return;
      }

      if (normalized === "n") {
        event.preventDefault();
        window.dispatchEvent(new Event("northwatch:new-item"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const pollActivityFeed = async () => {
      try {
        await fetch(`/api/activity?since=${encodeURIComponent(lastActivityPollRef.current)}`, { cache: "no-store" });
      } catch {
        // Static/local builds may not have an activity API; the local state snapshot still drives the banner.
      }

      const nextFeed = buildLocalActivityFeed(latestDeckRef.current);
      const freshEvents = nextFeed.filter((event) => new Date(event.createdAt).getTime() > new Date(lastActivityPollRef.current).getTime());
      if (freshEvents.length > 0) {
        setNewActivityCount((current) => current + freshEvents.length);
        lastActivityPollRef.current = freshEvents[0].createdAt;
      }
    };

    const timer = window.setInterval(pollActivityFeed, ACTIVITY_FEED_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLogoMenuOpen) return;

    const closeFromOutside = (event: MouseEvent) => {
      if (!logoMenuRef.current?.contains(event.target as Node)) {
        setIsLogoMenuOpen(false);
      }
    };

    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLogoMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);

    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [isLogoMenuOpen]);

  useEffect(() => {
    if (isViewEnabled(view, state.settings)) return;
    setView("dashboard");
    setNotice("Module hidden. Returned to Command.");
  }, [state.settings, view]);

  const navigateFromSearch = (query: string) => {
    const normalized = query.toLowerCase().trim();
    if (["account", "profile", "user", "identity"].some((term) => normalized.includes(term))) {
      setView("account");
      setNotice("Opened Account.");
      return;
    }
    if (["customize", "customise", "theme", "logo", "appearance"].some((term) => normalized.includes(term))) {
      setView("customize");
      setNotice("Opened Customize.");
      return;
    }
    if (["privacy", "policy"].some((term) => normalized.includes(term))) {
      setLegalPanel("privacy");
      setNotice("Opened Privacy Policy.");
      return;
    }
    if (["terms", "conditions", "service"].some((term) => normalized.includes(term))) {
      setLegalPanel("terms");
      setNotice("Opened Terms and Conditions.");
      return;
    }
    if (["settings", "help"].some((term) => normalized.includes(term))) {
      setLegalPanel(normalized.includes("help") ? "help" : "settings");
      setNotice(normalized.includes("help") ? "Opened Help." : "Opened Settings.");
      return;
    }
    const target = visibleNavItems.find((item) => item.terms.some((term) => normalized.includes(term)));
    if (!target) {
      setNotice("No visible module matched.");
      return;
    }
    setView(target.view);
    setNotice(`Opened ${target.label}.`);
  };

  const signOut = async () => {
    if (onAuthLogout) {
      await onAuthLogout();
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Signed out of cloud auth.");
  };

  const refreshTeamMembers = async (teamId: string) => {
    if (!isSupabaseCloudConfigured || !supabase || !session) {
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
    if (!isSupabaseCloudConfigured || !supabase || !session) return;

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
    if (!isSupabaseCloudConfigured || !supabase || !session) {
      setNotice("Team mode is paused while Northwatch uses credential auth.");
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
    if (!isSupabaseCloudConfigured || !supabase || !session) {
      setNotice("Team mode is paused while Northwatch uses credential auth.");
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
    if (!isSupabaseCloudConfigured || !supabase || !session || !activeTeam) {
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
    if (!isSupabaseCloudConfigured || !supabase || !session || !activeTeam) {
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
    if (!isSupabaseCloudConfigured || !supabase || !session || !activeTeam) {
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
    if (!isSupabaseCloudConfigured || !session || !cloudReady) return;

    const pendingInvite = readPendingTeamInvite();
    if (!pendingInvite || pendingInviteAttemptRef.current === pendingInvite) return;

    pendingInviteAttemptRef.current = pendingInvite;
    void joinTeam(pendingInvite);
  }, [cloudReady, session?.user.id]);

  if (isSupabaseCloudConfigured && !authReady) {
    return <CloudBootScreen status={cloudStatus} />;
  }

  if (isSupabaseCloudConfigured && authReady && session && !cloudReady) {
    return <CloudBootScreen status={cloudStatus} />;
  }

  const commandCenterName = getCommandCenterName(state.settings);
  const hasAcceptedLegalTerms = hasValidLegalConsent(legalConsent);

  const openLogoView = (targetView: DeckView) => {
    setView(targetView);
    setIsLogoMenuOpen(false);
    setNotice(targetView === "account" ? "Opened Account." : targetView === "customize" ? "Opened Customize." : "Opened module.");
  };

  const openLegalPanel = (panel: LegalPanel) => {
    setLegalPanel(panel);
    setIsLogoMenuOpen(false);
  };

  const acceptLegalTerms = () => {
    const record: LegalConsentRecord = {
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
      jurisdiction: LEGAL_JURISDICTION_LABEL
    };
    saveLegalConsent(record);
    setLegalConsent(record);
    setNotice("Terms and Privacy Policy accepted.");
  };

  const rotateSessionToken = () => {
    const nextToken = createSessionToken();
    saveSessionToken(nextToken);
    setSessionToken(nextToken);
    setNotice("Session token rotated.");
  };

  const switchExpressWorkspace = (workspace: TeamWorkspaceSelection) => {
    saveActiveTeamWorkspace(workspace);
    setActiveTeamWorkspace(workspace);
    setNotice(workspace.type === "team" ? `Switched to ${workspace.name} workspace.` : "Switched to personal workspace.");
  };

  if (isSessionTokenExpired(sessionToken)) {
    return <SessionExpiredScreen sessionToken={sessionToken} onRotate={rotateSessionToken} />;
  }

  return (
    <div className="deck-app" data-accent={state.settings.accent} data-density={state.settings.density} data-background={state.settings.background}>
      <TechBackdrop metrics={metrics} />
      <aside className="tactical-rail" aria-label="Primary">
        <div className="rail-brand-shell" ref={logoMenuRef}>
          <button
            className={`rail-brand ${isLogoMenuOpen ? "active" : ""}`}
            type="button"
            aria-label={`Open ${commandCenterName} menu`}
            aria-haspopup="menu"
            aria-expanded={isLogoMenuOpen}
            onClick={() => setIsLogoMenuOpen((current) => !current)}
          >
            <LogoMark variant={state.settings.logoStyle} />
          </button>
          {isLogoMenuOpen && (
            <LogoMenu
              hasAcceptedLegalTerms={hasAcceptedLegalTerms}
              onOpenView={openLogoView}
              onOpenPanel={openLegalPanel}
            />
          )}
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
              <span className="rail-label" data-label={item.label} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="rail-footer">
          <ProfileAvatar settings={state.settings} compact ariaHidden />
        </div>
      </aside>

      <main className="deck-screen">
        <TopBar
          settings={state.settings}
          cloudStatus={cloudStatus}
          workspaceLabel={workspaceLabel}
          activeWorkspace={activeTeamWorkspace}
          authUser={authUser}
          onCommand={navigateFromSearch}
          onWorkspaceChange={switchExpressWorkspace}
          onSignOut={signOut}
          onAuthLogout={onAuthLogout}
        />
        {newActivityCount > 0 && (
          <ActivityFeedBanner
            count={newActivityCount}
            onJump={() => {
              setView("dashboard");
              setNewActivityCount(0);
              setNotice("Activity feed acknowledged.");
            }}
          />
        )}
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
              authUser={authUser}
              workspaceMode={workspaceMode}
              teams={teams}
              activeTeam={activeTeam}
              teamMembers={teamMembers}
              teamInviteLink={teamInviteLink}
              isTeamBusy={isTeamBusy}
              dispatch={dispatch}
              onSwitchWorkspace={switchWorkspace}
              onCreateTeam={createTeam}
              onJoinTeam={joinTeam}
              onCreateInviteLink={createInviteLink}
              onUpdateMemberRole={updateMemberRole}
              onRemoveMember={removeMember}
              onRecoverEmailDeck={recoverLegacyEmailDeck}
              isRecoveringEmailDeck={isRecoveringLegacyDeck}
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
      {legalPanel && (
        <LegalInfoWindow
          panel={legalPanel}
          consentRecord={legalConsent}
          sessionToken={sessionToken}
          onRotateSessionToken={rotateSessionToken}
          onNotice={setNotice}
          onClose={() => setLegalPanel(null)}
        />
      )}
      {!hasAcceptedLegalTerms && (
        <LegalConsentGate
          onAccept={acceptLegalTerms}
          onOpenPanel={openLegalPanel}
        />
      )}
      {isShortcutOverlayOpen && <ShortcutOverlay onClose={() => setIsShortcutOverlayOpen(false)} />}
      {notice && <div className="deck-toast">{notice}</div>}
    </div>
  );
}

function LogoMenu({
  hasAcceptedLegalTerms,
  onOpenView,
  onOpenPanel
}: {
  hasAcceptedLegalTerms: boolean;
  onOpenView: (view: DeckView) => void;
  onOpenPanel: (panel: LegalPanel) => void;
}) {
  return (
    <div className="logo-menu" role="menu" aria-label="Northwatch menu">
      <div className="logo-menu-head">
        <span className="micro-label">Northwatch</span>
        <strong>Operator menu</strong>
        <small>{hasAcceptedLegalTerms ? "Legal consent active" : "Legal consent required"}</small>
      </div>
      <button type="button" role="menuitem" onClick={() => onOpenView("account")}>
        <UserRound size={16} /> Account
      </button>
      <button type="button" role="menuitem" onClick={() => onOpenView("customize")}>
        <Palette size={16} /> Customize
      </button>
      <button type="button" role="menuitem" onClick={() => onOpenPanel("settings")}>
        <Settings2 size={16} /> Settings
      </button>
      <button type="button" role="menuitem" onClick={() => onOpenPanel("help")}>
        <Sparkles size={16} /> Help
      </button>
      <button type="button" role="menuitem" onClick={() => onOpenPanel("privacy")}>
        <Shield size={16} /> Privacy Policy
      </button>
      <button type="button" role="menuitem" onClick={() => onOpenPanel("terms")}>
        <LockKeyhole size={16} /> Terms and Conditions
      </button>
    </div>
  );
}

function LegalConsentGate({
  onAccept,
  onOpenPanel
}: {
  onAccept: () => void;
  onOpenPanel: (panel: LegalPanel) => void;
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const canContinue = termsAccepted && privacyAccepted;

  return (
    <div className="legal-consent-gate">
      <section className="legal-consent-card" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
        <div className="legal-consent-icon"><Shield size={20} /></div>
        <span className="micro-label">Required agreement</span>
        <h2 id="legal-consent-title">Review and accept the legal terms</h2>
        <p>
          Northwatch needs explicit agreement to the Terms and Conditions and acknowledgement of the Privacy Policy before the
          command deck opens. The language is drafted around Kenyan data protection duties and international consent principles.
        </p>
        <div className="legal-link-row">
          <button type="button" onClick={() => onOpenPanel("terms")}>
            <LockKeyhole size={15} /> Read Terms
          </button>
          <button type="button" onClick={() => onOpenPanel("privacy")}>
            <Shield size={15} /> Read Privacy Policy
          </button>
        </div>
        <div className="consent-checks">
          <label className="legal-check">
            <input
              type="checkbox"
              aria-label="I agree to the Terms and Conditions"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>
              <strong>I agree to the Terms and Conditions.</strong>
              <small>Use Northwatch lawfully, verify AI/intel outputs, and protect account and team access.</small>
            </span>
          </label>
          <label className="legal-check">
            <input
              type="checkbox"
              aria-label="I acknowledge the Privacy Policy"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
            />
            <span>
              <strong>I acknowledge the Privacy Policy.</strong>
              <small>Personal data may be stored locally, synced through configured cloud services, and used only for stated purposes.</small>
            </span>
          </label>
        </div>
        <button className="legal-continue" type="button" disabled={!canContinue} onClick={onAccept}>
          <CircleCheck size={16} /> Continue to Northwatch
        </button>
        <small className="legal-note">Product baseline only. Have qualified counsel review before relying on this in a regulated launch.</small>
      </section>
    </div>
  );
}

function LegalInfoWindow({
  panel,
  consentRecord,
  sessionToken,
  onRotateSessionToken,
  onNotice,
  onClose
}: {
  panel: LegalPanel;
  consentRecord: LegalConsentRecord | null;
  sessionToken: SessionTokenRecord;
  onRotateSessionToken: () => void;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const content = getLegalPanelContent(panel, consentRecord);
  const tokenAgeDays = Math.max(0, Math.floor((Date.now() - new Date(sessionToken.createdAt).getTime()) / (24 * 60 * 60 * 1000)));

  return (
    <div className="legal-window-backdrop" onMouseDown={onClose}>
      <section
        className={`legal-window legal-window-${panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`legal-window-${panel}-title`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="legal-window-head">
          <div>
            <span className="micro-label">{content.eyebrow}</span>
            <h2 id={`legal-window-${panel}-title`}>{content.title}</h2>
            <p>{content.summary}</p>
          </div>
          <button type="button" aria-label="Close legal window" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="legal-copy">
          {content.sections.map((section) => (
            <article key={section.heading}>
              <h3>{section.heading}</h3>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
          {panel === "settings" && (
            <article className="session-token-card">
              <h3>Session token</h3>
              <p>Current token age: {tokenAgeDays} day{tokenAgeDays === 1 ? "" : "s"}. Tokens expire after 7 days.</p>
              <code>{maskSessionToken(sessionToken.token)}</code>
              <button type="button" onClick={onRotateSessionToken}>
                <RotateCcw size={15} /> Rotate token
              </button>
            </article>
          )}
          {panel === "settings" && <TelegramSettingsCard onNotice={onNotice} />}
        </div>
        <div className="legal-window-foot">
          <span>Terms v{TERMS_VERSION}</span>
          <span>Privacy v{PRIVACY_VERSION}</span>
        </div>
      </section>
    </div>
  );
}

function loadActiveTeamWorkspace(): TeamWorkspaceSelection {
  try {
    const stored = window.localStorage.getItem(ACTIVE_TEAM_WORKSPACE_STORAGE_KEY);
    if (!stored) return { type: "personal" };
    const parsed = JSON.parse(stored) as Partial<TeamWorkspaceSelection>;
    if (parsed.type === "team" && typeof parsed.teamId === "string" && typeof parsed.slug === "string" && typeof parsed.name === "string") {
      return { type: "team", teamId: parsed.teamId, slug: parsed.slug, name: parsed.name, role: typeof parsed.role === "string" ? parsed.role : "member" };
    }
  } catch {
    // Use personal workspace when saved selection cannot be read.
  }
  return { type: "personal" };
}

function saveActiveTeamWorkspace(workspace: TeamWorkspaceSelection) {
  window.localStorage.setItem(ACTIVE_TEAM_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

function TelegramSettingsCard({ onNotice }: { onNotice: (message: string) => void }) {
  const [status, setStatus] = useState<TelegramConfigStatus>({ configured: false, botUsername: null, chatId: null, updatedAt: null });
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoading(true);
      try {
        const nextStatus = await fetchTelegramConfig();
        if (!cancelled) {
          setStatus(nextStatus);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveBot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const nextStatus = await saveTelegramConfig({ botToken, chatId });
      setStatus(nextStatus);
      setBotToken("");
      onNotice("Telegram bot connected for this account.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBot = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteTelegramConfig();
      setStatus({ configured: false, botUsername: null, chatId: null, updatedAt: null });
      setBotToken("");
      setChatId("");
      onNotice("Telegram bot removed from this account.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  };

  const sendTest = async () => {
    setIsTesting(true);
    setError(null);
    try {
      await postToTelegram({
        kind: "agent-alert",
        title: "Northwatch Telegram test",
        body: "Your personal Telegram bot is connected and ready for cards, docs, and agent alerts.",
        meta: "Settings test"
      });
      onNotice("Telegram test sent.");
    } catch (testError) {
      setError(getErrorMessage(testError));
    } finally {
      setIsTesting(false);
    }
  };

  const statusText = isLoading
    ? "Checking Telegram connection..."
    : status.configured
      ? `Connected to ${status.botUsername ? `@${status.botUsername}` : "Telegram"}${status.chatId ? ` - ${status.chatId}` : ""}`
      : "No personal Telegram bot connected yet.";

  return (
    <article className="session-token-card telegram-settings-card">
      <div className="telegram-card-head">
        <div>
          <h3>Connect your Telegram bot</h3>
          <p>Each Northwatch user can save their own bot. The token is encrypted on the Express API and never stored in this browser.</p>
        </div>
        <span className={`telegram-status-pill ${status.configured ? "connected" : "idle"}`}>
          <Bot size={14} /> {status.configured ? "Connected" : "Not connected"}
        </span>
      </div>
      <ol className="telegram-steps">
        <li><strong>Step 1</strong><span>Open Telegram and search for <code>@BotFather</code>.</span></li>
        <li><strong>Step 2</strong><span>Send <code>/newbot</code>, choose a name, then choose a username ending in <code>bot</code>.</span></li>
        <li><strong>Step 3</strong><span>Copy the HTTP API token BotFather gives you.</span></li>
        <li><strong>Step 4</strong><span>Open your new bot in Telegram and send it any message. For a group, add the bot to the group and send a message there.</span></li>
        <li><strong>Step 5</strong><span>Visit <code>https://api.telegram.org/bot&lt;token&gt;/getUpdates</code> and copy the <code>chat.id</code> value.</span></li>
        <li><strong>Step 6</strong><span>Paste the token and chat id below, save, then send a test from Northwatch.</span></li>
      </ol>
      <a className="telegram-help-link" href="https://t.me/BotFather" target="_blank" rel="noreferrer">
        <ExternalLink size={14} /> Open BotFather
      </a>
      <p className="telegram-config-status">{statusText}</p>
      {status.updatedAt && <p className="telegram-config-status">Last updated {formatDateTime(status.updatedAt)}.</p>}
      {error && <p className="telegram-config-error">{error}</p>}
      <form className="telegram-config-form" onSubmit={saveBot}>
        <label>
          <span>Telegram bot token</span>
          <input
            aria-label="Telegram bot token"
            autoComplete="off"
            placeholder="123456:ABC-DEF..."
            type="password"
            value={botToken}
            onChange={(event) => setBotToken(event.target.value)}
          />
        </label>
        <label>
          <span>Telegram chat id</span>
          <input
            aria-label="Telegram chat id"
            autoComplete="off"
            placeholder="987654321"
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
          />
        </label>
        <div className="telegram-action-row">
          <button type="submit" disabled={isSaving || !botToken.trim() || !chatId.trim()}>
            <KeyRound size={15} /> {isSaving ? "Saving" : "Save bot"}
          </button>
          <button type="button" disabled={isTesting || !status.configured} onClick={sendTest}>
            <Send size={15} /> {isTesting ? "Sending" : "Send test"}
          </button>
          <button type="button" disabled={isDeleting || !status.configured} onClick={deleteBot}>
            <Trash2 size={15} /> {isDeleting ? "Deleting" : "Delete bot"}
          </button>
        </div>
      </form>
    </article>
  );
}

function getLegalPanelContent(panel: LegalPanel, consentRecord: LegalConsentRecord | null): {
  eyebrow: string;
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string[] }>;
} {
  if (panel === "settings") {
    return {
      eyebrow: "System window",
      title: "Settings",
      summary: "Quick operational state for the command deck, consent record, and local-first storage posture.",
      sections: [
        {
          heading: "Storage",
          body: [
            "Northwatch saves the deck in this browser with a per-user storage key. The Express API scopes protected server data to the signed-in Northwatch user."
          ]
        },
        {
          heading: "Legal status",
          body: [
            consentRecord
              ? `Terms and Privacy were accepted on ${formatDateTime(consentRecord.acceptedAt)} for ${consentRecord.jurisdiction}.`
              : "Terms and Privacy acceptance is still required before the deck can be used."
          ]
        },
        {
          heading: "AI agent",
          body: [
            "Sentinel can use the configured local Ollama endpoint when enabled. Generated planning or intel output should be verified before you act on it."
          ]
        }
      ]
    };
  }

  if (panel === "help") {
    return {
      eyebrow: "Support",
      title: "Help",
      summary: "Use the rail for day-to-day modules and the logo menu for account, customization, settings, and legal documents.",
      sections: [
        {
          heading: "Command flow",
          body: [
            "Use Command search to jump to modules, the rail for core workflows, and Sentinel for autonomous briefs or intel scans."
          ]
        },
        {
          heading: "Customization",
          body: [
            "Open Customize from the logo menu to change density, accent, background, visible modules, the Northwatch mark, and Ollama settings."
          ]
        },
        {
          heading: "Account and teams",
          body: [
            "Open Account from the logo menu to update profile details, review credential-auth status, and manage privacy controls."
          ]
        }
      ]
    };
  }

  if (panel === "privacy") {
    return {
      eyebrow: "Legal",
      title: "Privacy Policy",
      summary: "This policy explains what Northwatch collects, why it is used, and the controls a user keeps under Kenyan and international privacy principles.",
      sections: [
        {
          heading: "Information collected",
          body: [
            "Northwatch may store profile fields such as callsign, avatar URL, age, phone number, organization, command center name, email identity, consent version, and timestamps.",
            "User content may include tasks, routines, projects, calendar items, workouts, books, journal entries, finance entries, watchlist intel, research notes, and autonomous scan summaries."
          ]
        },
        {
          heading: "Purpose and lawful basis",
          body: [
            "Data is used to operate the command deck, keep local state, support signed-in workspaces, run autonomous intel features, and protect account access.",
            "Where consent is the basis, consent must be specific, informed, voluntary, and capable of withdrawal. Some processing may instead be necessary to provide the service, protect the workspace, or comply with legal obligations."
          ]
        },
        {
          heading: "Storage and processors",
          body: [
            "The browser keeps a local copy through localStorage. The Express API and PostgreSQL store protected user data when configured. Vercel hosts the web app. Ollama requests are sent to the configured local endpoint when enabled.",
            "Team sharing should be treated as confidential when it is enabled. Invite links should be protected like access credentials."
          ]
        },
        {
          heading: "Rights and controls",
          body: [
            "Users should be able to access, correct, delete, object to, restrict, or request portability of personal data where applicable. Kenyan users may also raise privacy complaints with the Office of the Data Protection Commissioner where the law applies.",
            "Reset deck removes the local Northwatch deck. Server-side deletion or account deletion depends on the configured Northwatch API and operational controls."
          ]
        },
        {
          heading: "Transfers, security, and retention",
          body: [
            "Personal data should not be transferred outside Kenya unless appropriate safeguards, valid consent, or another lawful transfer basis applies. International users may also have GDPR-style or similar regional rights.",
            "Northwatch keeps data only as long as needed for the stated purposes or until the user deletes it, subject to backups, legal obligations, and team workspace administration."
          ]
        },
        {
          heading: "Children and sensitive data",
          body: [
            "Northwatch is not intended for children without appropriate guardian consent. Avoid entering sensitive personal data unless you have a clear lawful basis and suitable safeguards."
          ]
        }
      ]
    };
  }

  return {
    eyebrow: "Legal",
    title: "Terms and Conditions",
    summary: "These terms govern use of Northwatch and sit alongside the Privacy Policy.",
    sections: [
      {
        heading: "Use of Northwatch",
        body: [
          "Northwatch is a personal and team command deck for tasks, routines, projects, calendar planning, fitness, reading, journal, finances, market intel, and AI-assisted briefings.",
          "You are responsible for the content you enter, the decisions you make from the deck, and ensuring you have a lawful basis to process any personal data you add."
        ]
      },
      {
        heading: "AI and autonomous intel",
        body: [
          "Sentinel, Ollama responses, and autonomous intel scans are assistive outputs. They are not legal, financial, medical, security, or investment advice.",
          "Verify sources, prices, financial information, and legal obligations before acting. Do not rely on generated output as the sole basis for high-stakes decisions."
        ]
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not use Northwatch to violate Kenyan law, international law, platform rules, data protection duties, intellectual property rights, or another person's privacy.",
          "Do not use the app for unauthorized access, unlawful surveillance, harassment, credential sharing abuse, or processing data about others without a valid legal basis."
        ]
      },
      {
        heading: "Account, teams, and security",
        body: [
          "You are responsible for protecting your email account, password, browser session, local device, team invite links, and any connected deployment credentials.",
          "Team workspaces should be used only with people who are authorized to see the shared data. Owners should remove members when access is no longer appropriate."
        ]
      },
      {
        heading: "Privacy and compliance",
        body: [
          "Use of Northwatch includes agreement that data will be handled according to the Privacy Policy. Where consent is required, it can be withdrawn for optional processing, but withdrawal may limit features that require the data.",
          "The app is drafted to support Kenya's Data Protection Act, the Data Protection Regulations, and international privacy principles such as lawful, fair, transparent, limited, secure, and rights-aware processing where they apply."
        ]
      },
      {
        heading: "Availability and changes",
        body: [
          "The app may change, break, or be unavailable. Local browser storage, cloud settings, third-party infrastructure, and network conditions can affect access.",
          "When Terms or Privacy versions change, Northwatch may request fresh acceptance before continued use."
        ]
      }
    ]
  };
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
  settings,
  cloudStatus,
  workspaceLabel,
  activeWorkspace,
  authUser,
  onCommand,
  onWorkspaceChange,
  onSignOut,
  onAuthLogout
}: {
  settings: DeckSettings;
  cloudStatus: CloudStatus;
  workspaceLabel: string;
  activeWorkspace: TeamWorkspaceSelection;
  authUser?: AuthUser | null;
  onCommand: (query: string) => void;
  onWorkspaceChange: (workspace: TeamWorkspaceSelection) => void;
  onSignOut: () => void;
  onAuthLogout?: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const checkedAt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const displayName = getDisplayName(settings);
  const commandCenterName = getCommandCenterName(settings);
  const organizationLabel = settings.organizationName.trim() || "Personal command";
  const profileDetails = [settings.age.trim() ? `Age ${settings.age.trim()}` : "", settings.phoneNumber.trim()]
    .filter(Boolean)
    .join(" / ");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCommand(query);
    setQuery("");
  };

  return (
    <header className="deck-topbar">
      <div className="profile-bar" title={profileDetails || undefined}>
        <ProfileAvatar settings={settings} />
        <div className="profile-copy">
          <span className="micro-label">{organizationLabel}</span>
          <strong>{displayName}</strong>
          <small>{commandCenterName} Tactical Ledger</small>
        </div>
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
        <WorkspaceSwitcher activeWorkspace={activeWorkspace} onWorkspaceChange={onWorkspaceChange as any} />
        <NotificationBell />
        <span className={`cloud-status-pill ${cloudStatus.mode}`} title={cloudStatus.detail}>
          <Cloud size={14} />
          {cloudStatus.label}
        </span>
        {authUser && <AuthUserChip user={authUser} />}
        {(authUser || cloudStatus.userEmail) && (
          <button
            className="topbar-icon-button"
            type="button"
            aria-label="Sign out of Northwatch"
            onClick={() => {
              if (authUser && onAuthLogout) {
                void onAuthLogout();
                return;
              }
              onSignOut();
            }}
          >
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

function AuthUserChip({ user }: { user: AuthUser }) {
  return (
    <span className="auth-user-chip" title={user.email}>
      <span>{getProfileInitials(user.displayName)}</span>
      <strong>{user.displayName}</strong>
    </span>
  );
}

function ProfileAvatar({ settings, compact = false, ariaHidden = false }: { settings: DeckSettings; compact?: boolean; ariaHidden?: boolean }) {
  const displayName = getDisplayName(settings);
  const avatarUrl = settings.avatarUrl.trim();

  return (
    <div className={`profile-avatar ${compact ? "compact" : ""}`} aria-hidden={ariaHidden || undefined}>
      {avatarUrl ? <img src={avatarUrl} alt={ariaHidden ? "" : `${displayName} avatar`} /> : <span>{getProfileInitials(displayName)}</span>}
    </div>
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

function SessionExpiredScreen({ sessionToken, onRotate }: { sessionToken: SessionTokenRecord; onRotate: () => void }) {
  return (
    <main className="auth-screen session-expired-screen">
      <section className="auth-panel">
        <div className="auth-mark">
          <KeyRound size={24} />
        </div>
        <span className="micro-label">Token security</span>
        <h1>Session expired.</h1>
        <p>Your local Northwatch session token was created on {formatDateTime(sessionToken.createdAt)} and is older than the 7 day limit.</p>
        <button type="button" onClick={onRotate}>
          <RotateCcw size={16} /> Rotate token and continue
        </button>
      </section>
    </main>
  );
}

function ActivityFeedBanner({ count, onJump }: { count: number; onJump: () => void }) {
  return (
    <div className="activity-feed-banner" role="status">
      <span>{count} new event{count === 1 ? "" : "s"}</span>
      <button type="button" onClick={onJump}>
        Jump to feed
      </button>
    </div>
  );
}

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["G + K", "Kanban / To Do"],
    ["G + P", "Projects"],
    ["G + D", "Docs / Journal"],
    ["G + C", "Content Queue / Intel"],
    ["N", "New context item"],
    ["?", "Shortcut map"]
  ];

  return (
    <div className="shortcut-overlay" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onMouseDown={onClose}>
      <section className="shortcut-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="legal-window-head">
          <div>
            <span className="micro-label">Keyboard command</span>
            <h2 id="shortcut-title">Shortcuts</h2>
            <p>Fast movement around the Northwatch command deck.</p>
          </div>
          <button type="button" aria-label="Close shortcuts" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="shortcut-map">
          {shortcuts.map(([combo, action]) => (
            <div key={combo}>
              <kbd>{combo}</kbd>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
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
  const topTasks = state.tasks.filter((task) => task.status !== "done").slice(0, 4);

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
          <strong>{state.projects.filter((project) => project.source === "github" && project.repositoryUrl).length} private GitHub repo links</strong>
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
  const [activeTab, setActiveTab] = useState<"all" | "active" | "in_progress" | "completed">("active");
  const [sortBy, setSortBy] = useState<"priority" | "dueDate" | "createdAt" | "assignee">("priority");
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const activeTasks = state.tasks.filter((task) => isActiveTaskStatus(task.status));
  const completedTasks = state.tasks.filter((task) => task.status === "done");
  const visibleTasks = sortTasks(
    state.tasks.filter((task) => {
      if (activeTab === "all") return true;
      if (activeTab === "active") return isActiveTaskStatus(task.status);
      if (activeTab === "in_progress") return task.status === "in_progress";
      if (activeTab === "completed") return task.status === "done";
      return true;
    }),
    sortBy
  );
  const primaryVisibleTasks = activeTab === "completed" ? visibleTasks : visibleTasks.filter((task) => task.status !== "done");

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

  const clearCompleted = () => {
    completedTasks.forEach((task) => dispatch({ type: "task/delete", id: task.id }));
    setNotice("Completed tasks cleared.");
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
      <section className="deck-panel todo-panel">
        <div className="todo-toolbar">
          <div className="segmented-tabs" role="tablist" aria-label="Task status filters">
            {[
              ["all", `All (${state.tasks.length})`, "All"],
              ["active", `Active (${activeTasks.length})`, "Active"],
              ["in_progress", `In Progress (${state.tasks.filter((task) => task.status === "in_progress").length})`, "In Progress"],
              ["completed", `Completed (${completedTasks.length})`, "Completed"]
            ].map(([value, label, ariaLabel]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-label={ariaLabel}
                aria-selected={activeTab === value}
                className={activeTab === value ? "active" : ""}
                onClick={() => setActiveTab(value as typeof activeTab)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="market-sort">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort tasks">
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
              <option value="createdAt">Created Date</option>
              <option value="assignee">Assignee</option>
            </select>
          </label>
        </div>
        {primaryVisibleTasks.length === 0 ? (
          <div className="todo-empty-state">
            <strong>{"\u2713"}</strong>
            <span>You're all caught up.</span>
            <button type="button" onClick={() => (document.querySelector<HTMLInputElement>("[aria-label='Task title']")?.focus())}>
              <Plus size={16} /> Add a task
            </button>
          </div>
        ) : (
          <div className="todo-task-list">
            {primaryVisibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => dispatch({ type: "task/toggle", id: task.id })}
                onEdit={() => startEdit(task)}
                onDelete={() => dispatch({ type: "task/delete", id: task.id })}
                onPriority={(nextPriority) => dispatch({ type: "task/kanban-priority", id: task.id, priority: nextPriority })}
                onNotice={setNotice}
              />
            ))}
          </div>
        )}
      </section>
      <section className="deck-panel completed-task-panel">
        <button className="completed-toggle" type="button" onClick={() => setIsCompletedOpen((open) => !open)}>
          Completed ({completedTasks.length}) {isCompletedOpen ? "\u25B2" : "\u25BC"}
        </button>
        {isCompletedOpen && (
          <>
            {completedTasks.length > 0 && <button type="button" className="clear-completed-button" onClick={clearCompleted}>Clear completed</button>}
            <div className="todo-task-list completed">
              {completedTasks.length === 0 && <EmptyState>No completed tasks.</EmptyState>}
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => dispatch({ type: "task/toggle", id: task.id })}
                  onEdit={() => startEdit(task)}
                  onDelete={() => dispatch({ type: "task/delete", id: task.id })}
                  onPriority={(nextPriority) => dispatch({ type: "task/kanban-priority", id: task.id, priority: nextPriority })}
                  onNotice={setNotice}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </ModuleShell>
  );
}

function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  onPriority,
  onNotice
}: {
  task: CommandDeckState["tasks"][number];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPriority: (priority: KanbanPriority) => void;
  onNotice: (message: string) => void;
}) {
  const dueTone = getDueTone(task.dueDate);
  const statusLabel = task.status === "in_progress" ? "In progress" : task.status === "done" ? "Done" : "Pending";
  return (
    <article className={`ops-row task-card-row task-status-${getTaskStatusClass(task.status)} kanban-priority-${task.kanbanPriority}`}>
      <label className="task-complete-check">
        <input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.status === "done"} onChange={onToggle} />
        <span>{task.status === "done" ? "\u2713" : ""}</span>
      </label>
      <div className="task-card-main">
        <strong className={task.status === "done" ? "task-title-completed" : ""}>{task.title}</strong>
        <div className="task-meta-line">
          <span className={`priority-pill priority-${task.kanbanPriority}`}>{getKanbanPriorityLabel(task.kanbanPriority)}</span>
          <span className="assignee-pill">Me</span>
          {task.dueDate && <span className={`due-pill ${dueTone}`}>{formatDate(task.dueDate)}</span>}
          <span className="status-pill">{statusLabel}</span>
        </div>
      </div>
      <TelegramButton
        payload={{ kind: "kanban-card", title: task.title, body: `Priority: ${getKanbanPriorityLabel(task.kanbanPriority)}`, meta: task.dueDate ? formatDate(task.dueDate) : "No due date" }}
        onNotice={onNotice}
      />
      <details className="task-menu">
        <summary aria-label={`Task menu for ${task.title}`}>...</summary>
        <div>
          <button type="button" onClick={onEdit}><Pencil size={15} /> Modify</button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${task.title}`}><Trash2 size={15} /> Delete</button>
          <button type="button" onClick={() => onPriority("urgent")}>URGENT</button>
          <button type="button" onClick={() => onPriority("normal")}>NORMAL</button>
          <button type="button" onClick={() => onPriority("later")}>LATER</button>
        </div>
      </details>
    </article>
  );
}

function isActiveTaskStatus(status: CommandDeckState["tasks"][number]["status"]): boolean {
  return status === "pending" || status === "in_progress" || status === "todo";
}

function getTaskStatusClass(status: CommandDeckState["tasks"][number]["status"]): string {
  if (status === "in_progress") return "in-progress";
  if (status === "done") return "done";
  return "pending";
}

function getDueTone(dueDate: string | null): string {
  if (!dueDate) return "";
  const today = getTodayInput();
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "";
}

function sortTasks(tasks: CommandDeckState["tasks"], sortBy: "priority" | "dueDate" | "createdAt" | "assignee") {
  const priorityOrder: Record<KanbanPriority, number> = { urgent: 0, normal: 1, later: 2 };
  return [...tasks].sort((left, right) => {
    if (sortBy === "dueDate") return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    if (sortBy === "createdAt") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (sortBy === "assignee") return left.title.localeCompare(right.title);
    return priorityOrder[left.kanbanPriority] - priorityOrder[right.kanbanPriority];
  });
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
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const pending = state.projects.filter((project) => project.status === "pending");
  const done = state.projects.filter((project) => project.status === "done");
  const linkedRepoCount = state.projects.filter((project) => project.source === "github" && project.repositoryUrl).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const cleanedRepositoryUrl = repositoryUrl.trim();
    if (cleanedRepositoryUrl && !isGitHubRepositoryUrl(cleanedRepositoryUrl)) {
      setNotice("Paste a valid GitHub repository URL.");
      return;
    }

    if (editingProjectId) {
      dispatch({
        type: "project/update",
        id: editingProjectId,
        name: name.trim(),
        objective: objective.trim(),
        nextAction: nextAction.trim(),
        dueDate: dueDate || null,
        progress: Number(progress),
        repositoryUrl: cleanedRepositoryUrl,
        defaultBranch: defaultBranch.trim()
      });
      setEditingProjectId(null);
      setNotice("Project updated.");
    } else {
      dispatch({
        type: "project/add",
        name: name.trim(),
        objective: objective.trim(),
        nextAction: nextAction.trim(),
        dueDate: dueDate || null,
        repositoryUrl: cleanedRepositoryUrl,
        defaultBranch: defaultBranch.trim()
      });
      setNotice(cleanedRepositoryUrl ? "Project added and GitHub repo linked." : "Project added to pending.");
    }
    setName("");
    setObjective("");
    setNextAction("");
    setDueDate("");
    setProgress("0");
    setRepositoryUrl("");
    setDefaultBranch("");
  };

  const startEdit = (project: CommandDeckState["projects"][number]) => {
    setEditingProjectId(project.id);
    setName(project.name);
    setObjective(project.objective);
    setNextAction(project.nextAction);
    setDueDate(project.dueDate ?? "");
    setProgress(String(project.progress));
    setRepositoryUrl(project.repositoryUrl ?? "");
    setDefaultBranch(project.defaultBranch ?? "");
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    setName("");
    setObjective("");
    setNextAction("");
    setDueDate("");
    setProgress("0");
    setRepositoryUrl("");
    setDefaultBranch("");
  };

  return (
    <ModuleShell title="Projects" description="Your private projects, optional GitHub repo links, progress, and next action.">
      <section className="github-scan-strip">
        <Github size={18} />
        <div>
          <strong>{linkedRepoCount === 0 ? "No GitHub repos linked yet" : `${linkedRepoCount} linked GitHub repo${linkedRepoCount === 1 ? "" : "s"}`}</strong>
          <span>Paste your own GitHub repository URL when adding or modifying a project.</span>
        </div>
      </section>
      <form className="command-form project-form" onSubmit={submit}>
        <label><span>Name</span><input aria-label="Project name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Objective</span><input aria-label="Project objective" value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
        <label><span>Next action</span><input aria-label="Project next action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label>
        <label><span>Due</span><input aria-label="Project due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label><span>Progress</span><input aria-label="Project progress" type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></label>
        <label><span>GitHub repo URL</span><input aria-label="GitHub repository URL" placeholder="https://github.com/owner/repo" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} /></label>
        <label><span>Branch</span><input aria-label="GitHub default branch" placeholder="main" value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} /></label>
        <button type="submit"><Plus size={16} /> {editingProjectId ? "Save project" : "Add project"}</button>
        {editingProjectId && <button type="button" onClick={cancelEdit}>Cancel</button>}
      </form>
      <TwoColumn titleLeft="Pending Projects" titleRight="Done Projects">
        <ItemList empty="No pending projects.">
          {pending.map((project) => (
            <ProjectRow key={project.id} project={project} onNotice={setNotice}>
              <button onClick={() => startEdit(project)} type="button"><Pencil size={15} /> Modify</button>
              <button onClick={() => dispatch({ type: "project/complete", id: project.id })} type="button">Complete</button>
              <button onClick={() => dispatch({ type: "project/delete", id: project.id })} type="button" aria-label={`Delete ${project.name}`}><Trash2 size={15} /> Delete</button>
            </ProjectRow>
          ))}
        </ItemList>
        <ItemList empty="No done projects.">
          {done.map((project) => (
            <ProjectRow key={project.id} project={project} onNotice={setNotice}>
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
  return <IntelPage onNotice={setNotice} />;

  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<IntelKind>("stock");
  const [signal, setSignal] = useState<IntelSignal>("watching");
  const [thesis, setThesis] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [editingIntelId, setEditingIntelId] = useState<string | null>(null);
  const autoScanRanRef = useRef(false);
  const selected = state.intel.find((item) => item.id === selectedId) ?? state.intel[0] ?? null;
  const signalCounts = intelSignals.map((item) => ({
    signal: item,
    count: state.intel.filter((entry) => entry.signal === item).length
  }));
  const researchQueue = state.intel
    .filter((item) => item.signal === "researching" || item.signal === "high-priority")
    .slice(0, 4);
  const lastAutopilotRun = state.intelAutopilot.lastRunAt ? formatDateTime(state.intelAutopilot.lastRunAt ?? "") : "Not run yet";

  const runAutonomousScan = useCallback((trigger: "auto" | "manual" = "manual") => {
    const scan = buildAutonomousIntelScan(state, getDeckMetrics(state));
    dispatch({ type: "intel/autoscan", findings: scan.findings, summary: scan.summary, scannedAt: scan.scannedAt });
    setNotice(trigger === "auto" ? "Sentinel autopilot refreshed intel." : "Autonomous intel scan complete.");
  }, [state, dispatch, setNotice]);

  useEffect(() => {
    if (selectedId && state.intel.some((item) => item.id === selectedId)) return;
    setSelectedId(state.intel[0]?.id ?? "");
  }, [selectedId, state.intel]);

  useEffect(() => {
    if (!state.intelAutopilot.enabled || autoScanRanRef.current) return;
    const lastRun = state.intelAutopilot.lastRunAt ? new Date(state.intelAutopilot.lastRunAt).getTime() : 0;
    const isStale = !lastRun || Date.now() - lastRun > 30 * 60 * 1000;
    if (!isStale) return;

    autoScanRanRef.current = true;
    const timer = window.setTimeout(() => runAutonomousScan("auto"), 500);
    return () => window.clearTimeout(timer);
  }, [state.intelAutopilot.enabled, state.intelAutopilot.lastRunAt, runAutonomousScan]);

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
    <ModuleShell title="Market Intel" description="Sentinel seeds and refreshes the watchboard from your projects, tasks, cashflow, and tracked topics.">
      <section className="life-layout intel-layout">
        <article className="life-hero intel-hero">
          <div>
            <span className="micro-label">Research command</span>
            <h2>Watchtower</h2>
            <p>{state.intel.length === 0 ? "Autopilot is ready to seed the board before capital or attention moves." : `${state.intel.length} item${state.intel.length === 1 ? "" : "s"} under observation.`}</p>
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
        <section className="deck-panel life-panel autopilot-panel">
          <PanelHead
            title="Sentinel autopilot"
            action={<button type="button" onClick={() => runAutonomousScan("manual")}><Radar size={15} /> Scan now</button>}
          />
          <div className="autopilot-status">
            <span className="source-pill">{state.intelAutopilot.enabled ? "autonomous" : "paused"}</span>
            <strong>{state.intelAutopilot.lastSummary}</strong>
            <p>Last run: {lastAutopilotRun}</p>
          </div>
          <button
            className="autopilot-toggle"
            type="button"
            onClick={() => dispatch({ type: "intel/autopilot/toggle", enabled: !state.intelAutopilot.enabled })}
          >
            <Bot size={15} /> {state.intelAutopilot.enabled ? "Pause autopilot" : "Enable autopilot"}
          </button>
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
            {state.intel.length === 0 && <EmptyState>No intel tracked yet. Sentinel autopilot can seed the first scan.</EmptyState>}
            {state.intel.map((item) => (
              <div className={`intel-row ${selected?.id === item.id ? "active" : ""}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <em>{[item.symbol, item.kind, item.signal].filter(Boolean).join(" - ")}</em>
                  {item.thesis && <p>{item.thesis}</p>}
                </div>
                <div className="row-actions">
                  <TelegramButton
                    payload={{ kind: "agent-alert", title: item.title, body: item.thesis || item.signal, meta: [item.symbol, item.kind].filter(Boolean).join(" / ") }}
                    onNotice={setNotice}
                  />
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
                <TelegramButton
                  payload={{ kind: "agent-alert", title: selected.title, body: selected.thesis || "No thesis recorded.", meta: selected.signal }}
                  onNotice={setNotice}
                />
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
                  <a href={selected.sourceUrl ?? undefined} target="_blank" rel="noreferrer" aria-label={`Open source for ${selected.title}`}>
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
  const visibleMoodOptions = journalMoodOptions.includes(mood) ? journalMoodOptions : [mood, ...journalMoodOptions];
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
        <fieldset className="mood-picker">
          <legend>Mood</legend>
          <div className="mood-option-bar" aria-label="Journal mood">
            {visibleMoodOptions.map((option) => (
              <button
                className={mood === option ? "active" : ""}
                type="button"
                key={option}
                aria-label={`Use ${option} mood`}
                aria-pressed={mood === option}
                onClick={() => setMood(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
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
              <TelegramButton
                payload={{ kind: "doc", title: entry.mood, body: entry.body, meta: formatDate(entry.date) }}
                onNotice={setNotice}
              />
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
          <span>Credential lock</span>
          <p>Northwatch access uses email and password accounts with httpOnly session cookies. Sign up or sign in to open an isolated deck.</p>
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
  authUser,
  workspaceMode,
  teams,
  activeTeam,
  teamMembers,
  teamInviteLink,
  isTeamBusy,
  dispatch,
  onSwitchWorkspace,
  onCreateTeam,
  onJoinTeam,
  onCreateInviteLink,
  onUpdateMemberRole,
  onRemoveMember,
  onRecoverEmailDeck,
  isRecoveringEmailDeck,
  onSignOut
}: {
  state: CommandDeckState;
  cloudStatus: CloudStatus;
  authUser?: AuthUser | null;
  workspaceMode: WorkspaceMode;
  teams: TeamWorkspace[];
  activeTeam: TeamWorkspace | null;
  teamMembers: TeamMember[];
  teamInviteLink: string;
  isTeamBusy: boolean;
  dispatch: React.Dispatch<CommandDeckAction>;
  onSwitchWorkspace: (workspace: WorkspaceMode) => Promise<void>;
  onCreateTeam: (name: string) => Promise<void>;
  onJoinTeam: (teamCode: string) => Promise<void>;
  onCreateInviteLink: () => Promise<void>;
  onUpdateMemberRole: (memberUserId: string, role: TeamRole) => Promise<void>;
  onRemoveMember: (memberUserId: string) => Promise<void>;
  onRecoverEmailDeck: () => Promise<void>;
  isRecoveringEmailDeck: boolean;
  onSignOut: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const lastSync = cloudStatus.lastSyncedAt ? formatDateTime(cloudStatus.lastSyncedAt) : "Not synced yet";
  const userEmail = cloudStatus.userEmail ?? authUser?.email ?? "Local operator";
  const isCloudUser = Boolean(cloudStatus.userEmail || authUser?.email);
  const canManageTeam = activeTeam?.role === "owner";
  const activeTeamName = activeTeam?.name ?? "No team selected";
  const displayName = getDisplayName(state.settings);
  const commandCenterName = getCommandCenterName(state.settings);
  const profileStats = [
    state.settings.age.trim() ? `Age ${state.settings.age.trim()}` : "",
    state.settings.phoneNumber.trim()
  ].filter(Boolean);

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
          <ProfileAvatar settings={state.settings} />
          <div>
            <span className="micro-label">Identity and sync</span>
            <h2>{displayName}</h2>
            <p>{state.settings.organizationName.trim() || userEmail}</p>
            <small>{profileStats.length > 0 ? profileStats.join(" / ") : `${commandCenterName} command profile`}</small>
          </div>
        </article>
        <section className="deck-panel account-panel profile-settings-panel">
          <PanelHead title="Profile bar" />
          <div className="profile-settings-grid">
            <label className="custom-card">
              <span>Name</span>
              <input
                aria-label="Profile name"
                value={state.settings.callsign}
                onChange={(event) => dispatch({ type: "settings/update", payload: { callsign: event.target.value } })}
              />
            </label>
            <label className="custom-card">
              <span>Avatar URL</span>
              <input
                aria-label="Avatar URL"
                value={state.settings.avatarUrl}
                onChange={(event) => dispatch({ type: "settings/update", payload: { avatarUrl: event.target.value } })}
              />
            </label>
            <label className="custom-card">
              <span>Age</span>
              <input
                aria-label="Age"
                inputMode="numeric"
                value={state.settings.age}
                onChange={(event) => dispatch({ type: "settings/update", payload: { age: event.target.value } })}
              />
            </label>
            <label className="custom-card">
              <span>Phone number</span>
              <input
                aria-label="Phone number"
                value={state.settings.phoneNumber}
                onChange={(event) => dispatch({ type: "settings/update", payload: { phoneNumber: event.target.value } })}
              />
            </label>
            <label className="custom-card">
              <span>Organization or company</span>
              <input
                aria-label="Organization or company"
                value={state.settings.organizationName}
                onChange={(event) => dispatch({ type: "settings/update", payload: { organizationName: event.target.value } })}
              />
            </label>
            <label className="custom-card">
              <span>Command centre name</span>
              <input
                aria-label="Command centre name"
                value={state.settings.commandCenterName}
                onChange={(event) => dispatch({ type: "settings/update", payload: { commandCenterName: event.target.value } })}
              />
            </label>
          </div>
        </section>
        <section className="deck-panel account-panel">
          <PanelHead title="Access state" />
          <div className="account-status-grid">
            <div><KeyRound size={16} /><span>Auth</span><strong>Northwatch</strong></div>
            <div><Cloud size={16} /><span>Status</span><strong>{cloudStatus.label.replace("Cloud auth: ", "")}</strong></div>
            <div><Database size={16} /><span>Storage</span><strong>Per-user deck</strong></div>
            <div><CalendarCheck size={16} /><span>Last sync</span><strong>{lastSync}</strong></div>
          </div>
        </section>
        <section className="deck-panel account-panel">
          <PanelHead title="Privacy checklist" />
          <div className="check-list">
            <span><CircleCheck size={16} /> Personal decks are isolated by signed-in user id.</span>
            <span><CircleCheck size={16} /> Team decks require explicit membership before data is shared.</span>
            <span><CircleCheck size={16} /> Local browser cache remains available offline.</span>
            <span><Shield size={16} /> Northwatch credentials protect workspace access.</span>
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
              : "Team mode is paused while Northwatch uses credential auth for personal workspaces."}
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
            <button type="button" onClick={() => void onRecoverEmailDeck()} disabled={!authUser || isRecoveringEmailDeck}>
              <Cloud size={16} /> {isRecoveringEmailDeck ? "Recovering" : "Recover email data"}
            </button>
            <button type="button" onClick={onSignOut} disabled={!authUser && !cloudStatus.userEmail}>
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
  const [agentHealth, setAgentHealth] = useState<AgentHealthRecord[]>(() => createIdleAgentHealth(state.settings));
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

    if (!isOpen) return;

    const pingHealth = async () => {
      const nextHealth = await fetchAgentHealth(state.settings);
      if (!isCancelled) {
        setAgentHealth(nextHealth);
      }
    };

    void pingHealth();
    const timer = window.setInterval(pingHealth, AGENT_HEALTH_POLL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpen, state.settings.ollamaEnabled, state.settings.ollamaEndpoint, state.settings.ollamaModel]);

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

    if (/(scan|refresh|autonomous|research|brief)/i.test(prompt) && /(intel|market|watch|signal)/i.test(prompt)) {
      const scan = buildAutonomousIntelScan(state, metrics);
      dispatch({ type: "intel/autoscan", findings: scan.findings, summary: scan.summary, scannedAt: scan.scannedAt });
      setView("intel");
      setNotice("Sentinel refreshed autonomous intel.");
      setMessages((current) => [
        ...current,
        { id: `operator-${Date.now()}`, role: "operator", body: prompt },
        {
          id: `sentinel-${Date.now()}`,
          role: "agent",
          body: `${scan.summary}\nI moved you to Intel so you can review the generated findings and notes.`
        }
      ]);
      setInput("");
      setIsOpen(true);
      return;
    }

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
          <div className="agent-healthbar" aria-label="Agent API status">
            {agentHealth.map((agent) => (
              <span className={`agent-health-pill ${agent.status}`} key={agent.id} title={agent.detail}>
                <i aria-hidden="true" />
                <strong>{agent.label}</strong>
                <em>{agent.checkedAt ? formatClock(agent.checkedAt) : "not checked"}</em>
              </span>
            ))}
          </div>

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
                {message.role === "agent" && (
                  <TelegramButton
                    payload={{ kind: "agent-alert", title: "Sentinel alert", body: message.body, meta: activeLabel }}
                    onNotice={setNotice}
                  />
                )}
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

function ActionRow({ title, meta, priority, children }: { title: string; meta: string; priority?: KanbanPriority; children?: ReactNode }) {
  return (
    <div className={`ops-row ${priority ? `kanban-priority-${priority}` : ""}`}>
      <span>{title}</span>
      <em>{meta}</em>
      {children && <div className="row-actions">{children}</div>}
    </div>
  );
}

function ProjectRow({
  project,
  onNotice,
  children
}: {
  project: CommandDeckState["projects"][number];
  onNotice: (message: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="ops-row project-row kanban-priority-normal">
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
        <TelegramButton
          payload={{ kind: "kanban-card", title: project.name, body: project.objective || project.nextAction || "Project card", meta: `${project.status} / ${project.progress}%` }}
          onNotice={onNotice}
        />
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

function PriorityTagControls({ value, onChange }: { value: KanbanPriority; onChange: (priority: KanbanPriority) => void }) {
  const options: Array<{ value: KanbanPriority; label: string }> = [
    { value: "urgent", label: "URGENT" },
    { value: "normal", label: "NORMAL" },
    { value: "later", label: "LATER" }
  ];

  return (
    <div className="priority-tag-row" aria-label="Kanban priority">
      {options.map((option) => (
        <button
          className={`priority-tag priority-tag-${option.value} ${value === option.value ? "active" : ""}`}
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TelegramButton({ payload, onNotice }: { payload: TelegramPayload; onNotice: (message: string) => void }) {
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    setIsSending(true);
    try {
      await postToTelegram(payload);
      onNotice("Sent to Telegram.");
    } catch (error) {
      onNotice(`Telegram send failed: ${getErrorMessage(error)}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <button type="button" onClick={send} disabled={isSending}>
      <Send size={15} /> {isSending ? "Sending" : "Send to Telegram"}
    </button>
  );
}

function EmptyState({
  children,
  actionLabel = "New item",
  onAction
}: {
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const handleAction = () => {
    if (onAction) {
      onAction();
      return;
    }
    window.dispatchEvent(new Event("northwatch:new-item"));
  };

  return (
    <div className="empty-state">
      <Sparkles size={20} />
      <strong>Nothing here yet.</strong>
      <span>{children}</span>
      <button type="button" onClick={handleAction}>
        <Plus size={15} /> {actionLabel}
      </button>
    </div>
  );
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

async function fetchLegacyCommandDeck(): Promise<LegacyCommandDeckPayload | null> {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this browser.");
  }

  const response = await fetch(LEGACY_COMMAND_DECK_ENDPOINT, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (response.status === 204 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, `Legacy deck API returned ${response.status}.`));
  }

  const payload = await response.json() as { deck?: Partial<CommandDeckState> | null; updatedAt?: string | null };
  if (!payload.deck) return null;

  return {
    deck: payload.deck,
    updatedAt: payload.updatedAt ?? null
  };
}

async function postToTelegram(payload: TelegramPayload): Promise<void> {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this browser.");
  }

  const response = await fetch(TELEGRAM_SEND_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      source: "northwatch",
      sentAt: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Telegram API returned ${response.status}.`));
  }
}

async function fetchTelegramConfig(): Promise<TelegramConfigStatus> {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this browser.");
  }

  const response = await fetch(TELEGRAM_CONFIG_ENDPOINT, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Telegram settings are unavailable."));
  }

  return normalizeTelegramConfig(await response.json());
}

async function saveTelegramConfig(input: { botToken: string; chatId: string }): Promise<TelegramConfigStatus> {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this browser.");
  }

  const response = await fetch(TELEGRAM_CONFIG_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Telegram bot could not be saved."));
  }

  return normalizeTelegramConfig(await response.json());
}

async function deleteTelegramConfig(): Promise<void> {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this browser.");
  }

  const response = await fetch(TELEGRAM_CONFIG_ENDPOINT, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Telegram bot could not be deleted."));
  }
}

function normalizeTelegramConfig(value: unknown): TelegramConfigStatus {
  const record = value && typeof value === "object" ? value as Partial<TelegramConfigStatus> : {};
  return {
    configured: Boolean(record.configured),
    botUsername: typeof record.botUsername === "string" ? record.botUsername : null,
    chatId: typeof record.chatId === "string" ? record.chatId : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null
  };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const parsed = await response.json() as { error?: string; errors?: string[] };
    return parsed.error ?? parsed.errors?.join(" ") ?? fallback;
  } catch {
    return fallback;
  }
}

function createIdleAgentHealth(settings: DeckSettings): AgentHealthRecord[] {
  const checkedAt = new Date().toISOString();
  return [
    { id: "sentinel", label: "Sentinel", status: "idle", checkedAt, detail: "Waiting for /health." },
    {
      id: "ollama",
      label: "Ollama",
      status: settings.ollamaEnabled ? "idle" : "idle",
      checkedAt,
      detail: settings.ollamaEnabled ? "Local model route is configured." : "Ollama is disabled."
    },
    { id: "telegram", label: "Telegram", status: "idle", checkedAt, detail: "@glizocksamabot bridge waiting for webhook." }
  ];
}

async function fetchAgentHealth(settings: DeckSettings): Promise<AgentHealthRecord[]> {
  const checkedAt = new Date().toISOString();
  const fallback = createIdleAgentHealth(settings).map((agent) => ({ ...agent, checkedAt }));

  if (typeof fetch !== "function") return fallback;

  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) throw new Error(`health returned ${response.status}`);
    const parsed = await response.json() as { agents?: Array<Partial<AgentHealthRecord>> };
    const agents = parsed.agents ?? [];
    return fallback.map((agent) => {
      const reported = agents.find((item) => item.id === agent.id);
      return {
        ...agent,
        status: normalizeAgentHealthStatus(reported?.status) ?? agent.status,
        checkedAt: getOptionalString(reported?.checkedAt) ?? checkedAt,
        detail: getOptionalString(reported?.detail) ?? agent.detail
      };
    });
  } catch (error) {
    return fallback.map((agent) => ({
      ...agent,
      status: agent.id === "sentinel" ? "dead" : agent.status,
      checkedAt,
      detail: agent.id === "sentinel" ? getErrorMessage(error) : agent.detail
    }));
  }
}

function normalizeAgentHealthStatus(value: unknown): AgentHealthStatus | null {
  return value === "alive" || value === "dead" || value === "idle" ? value : null;
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getInitialCloudStatus(): CloudStatus {
  return {
    mode: "local",
    label: "Credential auth: active",
    detail: "Users enter email and password to open their isolated Northwatch deck.",
    lastSyncedAt: null,
    userEmail: null
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected Northwatch error.";
}

function getShortcutView(key: string): DeckView | null {
  if (key === "k") return "todo";
  if (key === "p") return "projects";
  if (key === "d") return "journal";
  if (key === "c") return "intel";
  return null;
}

function getDocumentTitleForView(view: DeckView): string {
  const labels: Record<DeckView, string> = {
    dashboard: "Command",
    todo: "Kanban",
    daily: "Daily",
    projects: "Projects",
    intel: "Content Queue",
    calendar: "Calendar",
    workout: "Workout",
    books: "Books",
    journal: "Docs",
    finances: "Finances",
    customize: "Customize",
    account: "Account"
  };
  return labels[view];
}

function getNewItemLabel(view: DeckView): string {
  const labels: Record<DeckView, string> = {
    dashboard: "a task",
    todo: "a task",
    daily: "a routine",
    projects: "a project",
    intel: "an intel item",
    calendar: "a calendar event",
    workout: "a workout",
    books: "a book",
    journal: "a doc",
    finances: "a finance entry",
    customize: "a setting",
    account: "an account detail"
  };
  return labels[view];
}

function focusNewItemField(view: DeckView) {
  const labels: Partial<Record<DeckView, string>> = {
    todo: "Task title",
    daily: "Routine title",
    projects: "Project name",
    intel: "Intel title",
    calendar: "Calendar event title",
    workout: "Workout name",
    books: "Book title",
    journal: "Journal entry",
    finances: "Finance label",
    customize: "Callsign",
    account: "Profile name"
  };
  const label = labels[view] ?? "Task title";
  const field = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  field?.focus();
}

function buildLocalActivityFeed(state: CommandDeckState): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [
    ...state.tasks.map((task) => ({ id: `task-${task.id}-${task.updatedAt}`, label: task.title, createdAt: task.updatedAt })),
    ...state.projects.map((project) => ({ id: `project-${project.id}-${project.updatedAt}`, label: project.name, createdAt: project.updatedAt })),
    ...state.intel.map((item) => ({ id: `intel-${item.id}-${item.updatedAt}`, label: item.title, createdAt: item.updatedAt })),
    ...state.journal.map((entry) => ({ id: `journal-${entry.id}-${entry.date}`, label: entry.mood, createdAt: `${entry.date}T12:00:00.000Z` }))
  ];

  return items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 12);
}

function getKanbanPriorityLabel(priority: KanbanPriority): string {
  if (priority === "urgent") return "URGENT";
  if (priority === "later") return "LATER";
  return "NORMAL";
}

function maskSessionToken(token: string): string {
  return `${token.slice(0, 7)}...${token.slice(-4)}`;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
  const openTasks = state.tasks.filter((task) => task.status !== "done");
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

function isGitHubRepositoryUrl(value: string): boolean {
  const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(prefixed);
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    return url.hostname.toLowerCase() === "github.com" && Boolean(owner && repo);
  } catch {
    return false;
  }
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

function getDisplayName(settings: DeckSettings): string {
  return settings.callsign.trim() || "Operator";
}

function getCommandCenterName(settings: DeckSettings): string {
  return settings.commandCenterName.trim() || "Northwatch";
}

function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "O";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
  return toKSH(value);
}
