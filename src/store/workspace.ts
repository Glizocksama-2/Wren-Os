import { seedWorkspace } from "../data/seed";
import { createDefaultObsidianVault, syncObsidianVault } from "./obsidian";
import { createDefaultProjectSources, syncProjectSources } from "./projectSources";
import type {
  ActivityEvent,
  ApiEndpoint,
  ApiProvider,
  CodexBridge,
  CommandCenterMetrics,
  DailyPlan,
  LinkedProjectSource,
  ObsidianVaultConnection,
  ProjectSourceConnection,
  ProjectSummary,
  Task,
  WorkspaceAction,
  WorkspaceState
} from "../types/workspace";

export const STORAGE_KEY = "wren-os.workspace.v1";
export const CURRENT_WORKSPACE_SCHEMA_VERSION = 4;

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ImportResult {
  ok: boolean;
  workspace?: WorkspaceState;
  error?: string;
}

type WorkspaceImportProfile = Omit<WorkspaceState["workspace"], "schemaVersion"> & { schemaVersion?: number };
type WorkspaceWithOptionalCodex = Omit<
  WorkspaceState,
  "codexBridge" | "workspace" | "obsidianVault" | "projectSources" | "linkedProjects"
> & {
  workspace: WorkspaceImportProfile;
  codexBridge?: CodexBridge | null;
  obsidianVault?: ObsidianVaultConnection | null;
  projectSources?: ProjectSourceConnection[] | null;
  linkedProjects?: LinkedProjectSource[] | null;
};

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneWorkspace = (workspace: WorkspaceState): WorkspaceState => cloneValue(workspace);

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isOverdue = (dueDate: string | null) => Boolean(dueDate && new Date(dueDate).getTime() < Date.now());

const touchWorkspace = (state: WorkspaceState, updatedAt = nowIso()): WorkspaceState => ({
  ...state,
  workspace: { ...state.workspace, updatedAt }
});

const prependActivity = (state: WorkspaceState, event: ActivityEvent): WorkspaceState => ({
  ...state,
  activityEvents: [event, ...state.activityEvents]
});

const createActivity = (
  state: WorkspaceState,
  event: Omit<ActivityEvent, "id" | "workspaceId" | "createdAt">
): ActivityEvent => ({
  ...event,
  id: makeId("act"),
  workspaceId: state.workspace.id,
  createdAt: nowIso()
});

export function normalizeWorkspace(workspace: WorkspaceState | WorkspaceWithOptionalCodex): WorkspaceState {
  const next = cloneValue(workspace) as WorkspaceWithOptionalCodex;
  const seedCodexProvider = seedWorkspace.apiProviders.find((provider) => provider.id === "api-codex") as ApiProvider;
  const seedCodexEndpoint = seedWorkspace.apiEndpoints.find((endpoint) => endpoint.id === "endpoint-codex-handoff") as ApiEndpoint;
  const codexProvider = { ...cloneValue(seedCodexProvider), workspaceId: next.workspace.id };

  next.workspace = {
    ...next.workspace,
    mode: "local-first",
    schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION
  };

  next.codexBridge = {
    ...seedWorkspace.codexBridge,
    ...(next.codexBridge ?? {}),
    lastHandoff: next.codexBridge?.lastHandoff ?? null
  };
  next.obsidianVault = {
    ...createDefaultObsidianVault(),
    ...(next.obsidianVault ?? {}),
    lastError: next.obsidianVault?.lastError ?? null
  };
  next.projectSources = createDefaultProjectSources().map((fallback) => ({
    ...fallback,
    ...((next.projectSources ?? []).find((source) => source.provider === fallback.provider) ?? {})
  }));
  next.linkedProjects = next.linkedProjects ?? [];
  next.tasks = next.tasks.map((task) => ({
    ...task,
    externalLinks: task.externalLinks ?? [],
    estimateMinutes: task.estimateMinutes ?? null,
    blockedReason: task.blockedReason ?? null,
    acceptanceCriteria: task.acceptanceCriteria ?? []
  }));

  if (!next.apiProviders.some((provider) => provider.id === seedCodexProvider.id)) {
    next.apiProviders = [...next.apiProviders, codexProvider];
  }

  if (!next.apiEndpoints.some((endpoint) => endpoint.id === seedCodexEndpoint.id)) {
    next.apiEndpoints = [...next.apiEndpoints, cloneValue(seedCodexEndpoint)];
  }

  return next as WorkspaceState;
}

export function createCodexTaskPrompt(state: WorkspaceState, task: Task): string {
  const bridge = state.codexBridge ?? seedWorkspace.codexBridge;
  const projectName = getProjectName(state, task.projectId);
  const tags = task.tags.length ? task.tags.join(", ") : "none";

  return [
    `You are Codex working in ${bridge.workspacePath}.`,
    `Repository: ${bridge.repo}`,
    `Branch: ${bridge.branch}`,
    "",
    `Task: ${task.title}`,
    `Project: ${projectName}`,
    `Priority: ${task.priority}`,
    `Status: ${task.status.replace("_", " ")}`,
    `Due: ${formatShortDate(task.dueDate)}`,
    `Tags: ${tags}`,
    "",
    `Context: ${task.description}`,
    "",
    "Do this end to end:",
    "1. Read the relevant repo files before changing anything.",
    "2. Implement the task in the existing code style.",
    "3. Run the relevant tests and build checks.",
    "4. Report changed files, verification, and any remaining risk."
  ].join("\n");
}

export function reduceWorkspace(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "task/create": {
      const timestamp = nowIso();
      const task: Task = {
        id: makeId("task"),
        workspaceId: state.workspace.id,
        status: "todo",
        externalLinks: [],
        estimateMinutes: null,
        blockedReason: null,
        acceptanceCriteria: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        ...action.payload
      };
      const next = touchWorkspace({
        ...state,
        tasks: [...state.tasks, task]
      }, timestamp);
      return prependActivity(
        next,
        createActivity(next, {
          entityType: "task",
          entityId: task.id,
          eventType: "task_created",
          message: `Task created: ${task.title}`,
          payload: { source: task.source }
        })
      );
    }

    case "task/move": {
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task || task.status === action.status) return state;

      const timestamp = nowIso();
      const next = touchWorkspace({
        ...state,
        tasks: state.tasks.map((item) =>
          item.id === action.id ? { ...item, status: action.status, updatedAt: timestamp } : item
        )
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "task",
          entityId: task.id,
          eventType: "task_status_changed",
          message: `${task.title} moved from ${task.status.replace("_", " ")} to ${action.status.replace("_", " ")}.`,
          payload: { from: task.status, to: action.status }
        })
      );
    }

    case "task/update": {
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task) return state;

      const timestamp = nowIso();
      const next = touchWorkspace({
        ...state,
        tasks: state.tasks.map((item) =>
          item.id === action.id ? { ...item, ...action.payload, updatedAt: timestamp } : item
        )
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "task",
          entityId: task.id,
          eventType: "task_updated",
          message: `Task updated: ${task.title}`,
          payload: {}
        })
      );
    }

    case "project/update": {
      const project = state.projects.find((item) => item.id === action.id);
      if (!project) return state;

      const timestamp = nowIso();
      const next = touchWorkspace({
        ...state,
        projects: state.projects.map((item) =>
          item.id === action.id ? { ...item, ...action.payload, updatedAt: timestamp } : item
        )
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "project",
          entityId: project.id,
          eventType: "project_updated",
          message: `Project updated: ${project.name}`,
          payload: {}
        })
      );
    }

    case "agent/decide": {
      const agentAction = state.agentActions.find((item) => item.id === action.id);
      if (!agentAction || agentAction.status === action.decision) return state;

      const timestamp = nowIso();
      const next = touchWorkspace({
        ...state,
        agentActions: state.agentActions.map((item) =>
          item.id === action.id ? { ...item, status: action.decision, updatedAt: timestamp } : item
        )
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "agent_action",
          entityId: action.id,
          eventType: action.decision === "approved" ? "agent_action_approved" : "agent_action_denied",
          message: `${agentAction.title} ${action.decision}.`,
          payload: { decision: action.decision }
        })
      );
    }

    case "codex/connect": {
      const timestamp = nowIso();
      const normalized = normalizeWorkspace(state);
      const next = touchWorkspace({
        ...normalized,
        codexBridge: {
          ...normalized.codexBridge,
          ...action.payload,
          status: "connected",
          lastSyncAt: timestamp
        }
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "codex",
          entityId: "codex-bridge",
          eventType: "codex_connected",
          message: "Codex bridge connected.",
          payload: { branch: next.codexBridge.branch, repo: next.codexBridge.repo }
        })
      );
    }

    case "codex/disconnect": {
      const timestamp = nowIso();
      const normalized = normalizeWorkspace(state);
      return touchWorkspace({
        ...normalized,
        codexBridge: {
          ...normalized.codexBridge,
          status: "disconnected",
          lastSyncAt: timestamp
        }
      }, timestamp);
    }

    case "codex/handoff_task": {
      const normalized = normalizeWorkspace(state);
      const task = normalized.tasks.find((item) => item.id === action.taskId);
      if (!task) return normalized;

      const timestamp = nowIso();
      const handoff = {
        id: makeId("codex"),
        taskId: task.id,
        taskTitle: task.title,
        prompt: createCodexTaskPrompt(normalized, task),
        createdAt: timestamp
      };
      const next = touchWorkspace({
        ...normalized,
        codexBridge: {
          ...normalized.codexBridge,
          status: "connected",
          lastSyncAt: timestamp,
          lastHandoff: handoff
        }
      }, timestamp);

      return prependActivity(
        next,
        createActivity(next, {
          entityType: "codex",
          entityId: task.id,
          eventType: "codex_handoff_created",
          message: `Codex handoff created for ${task.title}.`,
          payload: { handoffId: handoff.id, projectId: task.projectId }
        })
      );
    }

    case "obsidian/sync": {
      const timestamp = action.payload.syncedAt ?? nowIso();
      const synced = touchWorkspace(syncObsidianVault(normalizeWorkspace(state), { ...action.payload, syncedAt: timestamp }), timestamp);
      return prependActivity(
        synced,
        createActivity(synced, {
          entityType: "obsidian",
          entityId: "obsidian-vault",
          eventType: "obsidian_vault_synced",
          message: `Obsidian vault synced: ${action.payload.vaultName}.`,
          payload: {
            noteCount: synced.obsidianVault.noteCount,
            projectCount: synced.obsidianVault.projectCount,
            taskCount: synced.obsidianVault.taskCount
          }
        })
      );
    }

    case "obsidian/configure": {
      const normalized = normalizeWorkspace(state);
      return touchWorkspace({
        ...normalized,
        obsidianVault: {
          ...normalized.obsidianVault,
          ...action.payload
        }
      });
    }

    case "obsidian/unlink": {
      const unlinked = touchWorkspace({
        ...normalizeWorkspace(state),
        obsidianVault: createDefaultObsidianVault(),
        projects: state.projects.filter((project) => !project.id.startsWith("obsidian-project-")),
        documents: state.documents.filter((document) => !document.id.startsWith("obsidian-doc-")),
        tasks: state.tasks.filter((task) => !task.id.startsWith("obsidian-task-"))
      });
      return prependActivity(
        unlinked,
        createActivity(unlinked, {
          entityType: "obsidian",
          entityId: "obsidian-vault",
          eventType: "obsidian_vault_unlinked",
          message: "Obsidian vault unlinked.",
          payload: {}
        })
      );
    }

    case "obsidian/error": {
      const normalized = normalizeWorkspace(state);
      const errored = touchWorkspace({
        ...normalized,
        obsidianVault: {
          ...normalized.obsidianVault,
          status: "error",
          lastError: action.error
        }
      });
      return prependActivity(
        errored,
        createActivity(errored, {
          entityType: "obsidian",
          entityId: "obsidian-vault",
          eventType: "obsidian_vault_error",
          message: action.error,
          payload: {}
        })
      );
    }

    case "project_sources/sync": {
      const timestamp = action.payload.syncedAt ?? nowIso();
      const synced = touchWorkspace(syncProjectSources(normalizeWorkspace(state), { ...action.payload, syncedAt: timestamp }), timestamp);
      const providerName = action.payload.provider === "github" ? "GitHub" : "Vercel";
      return prependActivity(
        synced,
        createActivity(synced, {
          entityType: "project_source",
          entityId: action.payload.provider,
          eventType: "project_source_synced",
          message: `${providerName} project source synced.`,
          payload: {
            provider: action.payload.provider,
            projectCount: action.payload.projects.length
          }
        })
      );
    }

    case "project_sources/error": {
      const normalized = normalizeWorkspace(state);
      const fallbackSources = createDefaultProjectSources();
      const errored = touchWorkspace({
        ...normalized,
        projectSources: fallbackSources.map((fallback) => {
          const current = normalized.projectSources.find((source) => source.provider === fallback.provider) ?? fallback;
          return current.provider === action.provider
            ? {
                ...current,
                status: "error",
                lastError: action.error
              }
            : current;
        })
      });
      return prependActivity(
        errored,
        createActivity(errored, {
          entityType: "project_source",
          entityId: action.provider,
          eventType: "project_source_error",
          message: action.error,
          payload: { provider: action.provider }
        })
      );
    }

    case "workspace/import": {
      const imported = normalizeWorkspace(action.payload);
      const next = touchWorkspace(imported);
      return prependActivity(
        next,
        createActivity(next, {
          entityType: "workspace",
          entityId: action.payload.workspace.id,
          eventType: "workspace_imported",
          message: "Workspace data imported.",
          payload: {}
        })
      );
    }

    case "workspace/reset": {
      const reset = touchWorkspace(normalizeWorkspace(seedWorkspace));
      return prependActivity(
        reset,
        createActivity(reset, {
          entityType: "workspace",
          entityId: reset.workspace.id,
          eventType: "workspace_reset",
          message: "Workspace reset to seed data.",
          payload: {}
        })
      );
    }

    default:
      return state;
  }
}

export function getCommandCenterMetrics(state: WorkspaceState): CommandCenterMetrics {
  const completedTodayTasks = state.tasks.filter((task) => task.status === "done" && daysBetween(task.updatedAt, nowIso()) === 0);

  return {
    activeProjects: state.projects.filter((project) => project.status === "active").length,
    pendingAgentActions: state.agentActions.filter((action) => action.status === "pending").length,
    overdueTasks: state.tasks.filter((task) => task.status !== "done" && isOverdue(task.dueDate)).length,
    automationWarnings: state.automations.filter((automation) => automation.status === "warning").length,
    contentInFlight: state.contentItems.filter((item) => item.stage !== "published").length,
    completedToday: completedTodayTasks.length,
    focusMinutes: completedTodayTasks.reduce((total, task) => total + getTaskEstimateMinutes(task), 0)
  };
}

export function getProjectSummaries(state: WorkspaceState): ProjectSummary[] {
  return state.projects.map((project) => {
    const projectTasks = state.tasks.filter((task) => task.projectId === project.id);
    const completedTasks = projectTasks.filter((task) => task.status === "done").length;
    const totalTasks = projectTasks.length;
    const nextTask = getProjectNextTask(state, project.id);
    const blockedTaskCount = projectTasks.filter((task) => task.status !== "done" && Boolean(task.blockedReason)).length;
    const overdueTaskCount = projectTasks.filter((task) => isTaskOverdue(task)).length;
    const reviewTaskCount = projectTasks.filter((task) => task.status === "review").length;

    return {
      id: project.id,
      name: project.name,
      health: project.health,
      accent: project.accent,
      progress: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
      totalTasks,
      completedTasks,
      riskCount: project.risks.length + blockedTaskCount + overdueTaskCount,
      objective: project.objective,
      nextTaskId: nextTask?.id ?? null,
      nextTaskTitle: nextTask?.title ?? null,
      blockedTaskCount,
      overdueTaskCount,
      reviewTaskCount
    };
  });
}

export function getDailyPlan(state: WorkspaceState): DailyPlan {
  const readyTasks = sortTasksForExecution(
    state.tasks.filter((task) => task.status !== "done" && !task.blockedReason)
  );
  const completedToday = state.tasks.filter((task) => task.status === "done" && daysBetween(task.updatedAt, nowIso()) === 0).length;
  const topOutcomes = readyTasks.slice(0, 3);
  const activeProjects = state.projects.filter((project) => project.status === "active");
  const readyProjectCount = activeProjects.filter((project) => Boolean(getProjectNextTask(state, project.id))).length;
  const dailyTaskCount = topOutcomes.length + completedToday;

  return {
    topOutcomes,
    reviewQueue: sortTasksForExecution(state.tasks.filter((task) => task.status === "review")).slice(0, 5),
    blockedTasks: sortTasksForExecution(state.tasks.filter((task) => task.status !== "done" && Boolean(task.blockedReason))).slice(0, 5),
    overdueTasks: sortTasksForExecution(state.tasks.filter((task) => isTaskOverdue(task))).slice(0, 5),
    activeProjectCount: activeProjects.length,
    readyProjectCount,
    completionPercent: dailyTaskCount === 0 ? 0 : Math.round((completedToday / dailyTaskCount) * 100)
  };
}

export function getProjectNextTask(state: WorkspaceState, projectId: string | null): Task | null {
  return sortTasksForExecution(
    state.tasks.filter((task) => task.projectId === projectId && task.status !== "done" && !task.blockedReason)
  )[0] ?? null;
}

export function sortTasksForExecution(tasks: Task[]): Task[] {
  const statusWeight = { in_progress: 0, review: 1, todo: 2, done: 3 };
  const priorityWeight = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...tasks].sort((left, right) => {
    const overdueDelta = Number(isTaskOverdue(right)) - Number(isTaskOverdue(left));
    if (overdueDelta !== 0) return overdueDelta;

    const statusDelta = statusWeight[left.status] - statusWeight[right.status];
    if (statusDelta !== 0) return statusDelta;

    const priorityDelta = priorityWeight[left.priority] - priorityWeight[right.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;

    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  });
}

export function serializeWorkspace(workspace: WorkspaceState): string {
  return JSON.stringify(workspace, null, 2);
}

export function parseWorkspaceImport(raw: string): ImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Import file is not valid JSON." };
  }

  const validationError = getWorkspaceValidationError(parsed);
  if (validationError) return { ok: false, error: validationError };

  return { ok: true, workspace: normalizeWorkspace(parsed as WorkspaceWithOptionalCodex) };
}

export function loadWorkspace(storage: WorkspaceStorage = window.localStorage): WorkspaceState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return normalizeWorkspace(seedWorkspace);

  const result = parseWorkspaceImport(raw);
  return result.ok && result.workspace ? result.workspace : normalizeWorkspace(seedWorkspace);
}

export function saveWorkspace(workspace: WorkspaceState, storage: WorkspaceStorage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, serializeWorkspace(workspace));
}

export function createEmptyWorkspaceStorage(): WorkspaceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

export function getProjectName(state: WorkspaceState, projectId: string | null): string {
  if (!projectId) return "No project";
  return state.projects.find((project) => project.id === projectId)?.name ?? "Unknown project";
}

export function getStageCounts(state: WorkspaceState): Record<string, number> {
  return state.contentItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.stage] = (counts[item.stage] ?? 0) + 1;
    return counts;
  }, {});
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function isTaskOverdue(task: Task): boolean {
  return task.status !== "done" && isOverdue(task.dueDate);
}

const priorities = new Set(["low", "medium", "high", "critical"]);
const taskStatuses = new Set(["todo", "in_progress", "review", "done"]);
const taskSources = new Set(["manual", "agent", "automation"]);
const projectStatuses = new Set(["active", "paused", "archived"]);
const projectHealthValues = new Set(["on_track", "at_risk", "blocked"]);
const agentActionStatuses = new Set(["pending", "approved", "denied"]);
const automationStatuses = new Set(["healthy", "running", "warning", "failed"]);
const contentStages = new Set(["idea", "draft", "review", "scheduled", "published"]);
const contentPlatforms = new Set(["linkedin", "x", "blog", "newsletter", "youtube"]);
const documentKinds = new Set(["note", "brief", "runbook", "link", "api"]);
const providerHealthValues = new Set(["healthy", "warning", "down"]);
const endpointMethods = new Set(["GET", "POST", "PATCH", "DELETE"]);
const endpointAuthModes = new Set(["agent_key", "none"]);
const codexStatuses = new Set(["connected", "disconnected"]);
const obsidianStatuses = new Set(["unlinked", "linked", "syncing", "error"]);
const projectSourceProviders = new Set(["github", "vercel"]);
const projectSourceStatuses = new Set(["unlinked", "linked", "error"]);
const entityTypes = new Set([
  "task",
  "project",
  "agent_action",
  "automation",
  "content",
  "document",
  "workspace",
  "codex",
  "obsidian",
  "project_source"
]);
const eventTypes = new Set([
  "task_created",
  "task_status_changed",
  "task_updated",
  "agent_action_approved",
  "agent_action_denied",
  "project_created",
  "project_updated",
  "automation_warning",
  "content_created",
  "document_created",
  "workspace_imported",
  "workspace_reset",
  "codex_connected",
  "codex_handoff_created",
  "obsidian_vault_synced",
  "obsidian_vault_unlinked",
  "obsidian_vault_error",
  "project_source_synced",
  "project_source_error"
]);

function getWorkspaceValidationError(value: unknown): string | null {
  if (!isRecord(value) || !isValidWorkspaceProfile(value.workspace)) {
    return "Import is missing a valid workspace profile.";
  }

  if (
    !Array.isArray(value.projects) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.agentActions) ||
    !Array.isArray(value.automations) ||
    !Array.isArray(value.contentItems) ||
    !Array.isArray(value.documents) ||
    !Array.isArray(value.apiProviders) ||
    !Array.isArray(value.apiEndpoints) ||
    !Array.isArray(value.activityEvents)
  ) {
    return "Import is missing a valid workspace profile.";
  }

  if (value.codexBridge !== undefined && value.codexBridge !== null && !isValidCodexBridge(value.codexBridge)) {
    return "Import contains invalid Codex bridge data.";
  }
  if (value.obsidianVault !== undefined && value.obsidianVault !== null && !isValidObsidianVault(value.obsidianVault)) {
    return "Import contains invalid Obsidian vault data.";
  }
  if (value.projectSources !== undefined && value.projectSources !== null) {
    if (!Array.isArray(value.projectSources) || !value.projectSources.every(isValidProjectSource)) {
      return "Import contains invalid project source data.";
    }
  }
  if (value.linkedProjects !== undefined && value.linkedProjects !== null) {
    if (!Array.isArray(value.linkedProjects) || !value.linkedProjects.every(isValidLinkedProjectSource)) {
      return "Import contains invalid linked project source data.";
    }
  }
  if (!value.projects.every(isValidProject)) return "Import contains invalid project data.";
  if (!value.tasks.every(isValidTask)) return "Import contains invalid task data.";
  if (!value.agentActions.every(isValidAgentAction)) return "Import contains invalid agent action data.";
  if (!value.automations.every(isValidAutomation)) return "Import contains invalid automation data.";
  if (!value.contentItems.every(isValidContentItem)) return "Import contains invalid content data.";
  if (!value.documents.every(isValidDocument)) return "Import contains invalid document data.";
  if (!value.apiProviders.every(isValidApiProvider)) return "Import contains invalid API provider data.";
  if (!value.apiEndpoints.every(isValidApiEndpoint)) return "Import contains invalid API endpoint data.";
  if (!value.activityEvents.every(isValidActivityEvent)) return "Import contains invalid activity data.";

  return null;
}

function isValidWorkspaceProfile(value: unknown): value is WorkspaceImportProfile {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.owner) &&
    value.mode === "local-first" &&
    (value.schemaVersion === undefined || isFiniteNumber(value.schemaVersion)) &&
    isString(value.version) &&
    isString(value.agentKey) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isValidProject(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.name) &&
    isString(value.description) &&
    isEnum(value.status, projectStatuses) &&
    isEnum(value.health, projectHealthValues) &&
    isString(value.accent) &&
    isString(value.owner) &&
    isString(value.objective) &&
    isStringArray(value.tags) &&
    isStringArray(value.risks) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isValidTask(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.title) &&
    isString(value.description) &&
    isEnum(value.status, taskStatuses) &&
    isEnum(value.priority, priorities) &&
    isNullableString(value.dueDate) &&
    isStringArray(value.tags) &&
    isNullableString(value.projectId) &&
    isEnum(value.source, taskSources) &&
    isStringArray(value.externalLinks) &&
    (value.estimateMinutes === undefined || value.estimateMinutes === null || isFiniteNumber(value.estimateMinutes)) &&
    (value.blockedReason === undefined || isNullableString(value.blockedReason)) &&
    (value.acceptanceCriteria === undefined || isStringArray(value.acceptanceCriteria)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isValidAgentAction(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.title) &&
    isString(value.summary) &&
    isString(value.agent) &&
    isNullableString(value.projectId) &&
    isEnum(value.status, agentActionStatuses) &&
    isFiniteNumber(value.confidence) &&
    isString(value.trigger) &&
    Array.isArray(value.files) &&
    value.files.every(isValidAgentActionFile) &&
    isStringArray(value.suggestedNextSteps) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isValidAgentActionFile(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.path) &&
    isFiniteNumber(value.additions) &&
    isFiniteNumber(value.deletions)
  );
}

function isValidAutomation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.name) &&
    isString(value.owner) &&
    isString(value.cadence) &&
    isEnum(value.status, automationStatuses) &&
    isString(value.lastRunAt) &&
    isString(value.nextRunAt) &&
    isString(value.duration) &&
    isString(value.summary)
  );
}

function isValidContentItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.title) &&
    isEnum(value.stage, contentStages) &&
    isEnum(value.platform, contentPlatforms) &&
    isString(value.owner) &&
    isNullableString(value.projectId) &&
    isNullableString(value.scheduledFor) &&
    isStringArray(value.tags) &&
    isString(value.updatedAt)
  );
}

function isValidDocument(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.title) &&
    isEnum(value.kind, documentKinds) &&
    isString(value.url) &&
    isString(value.body) &&
    isStringArray(value.tags) &&
    isNullableString(value.projectId) &&
    isString(value.updatedAt)
  );
}

function isValidApiProvider(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.name) &&
    isString(value.category) &&
    isEnum(value.health, providerHealthValues) &&
    isFiniteNumber(value.latencyMs) &&
    isString(value.lastCheckedAt)
  );
}

function isValidApiEndpoint(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isEnum(value.method, endpointMethods) &&
    isString(value.path) &&
    isString(value.description) &&
    isEnum(value.auth, endpointAuthModes) &&
    isString(value.example)
  );
}

function isValidActivityEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isEnum(value.entityType, entityTypes) &&
    isString(value.entityId) &&
    isEnum(value.eventType, eventTypes) &&
    isString(value.message) &&
    isRecord(value.payload) &&
    isString(value.createdAt)
  );
}

function isValidCodexBridge(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    isEnum(value.status, codexStatuses) &&
    isString(value.workspacePath) &&
    isString(value.repo) &&
    isString(value.branch) &&
    isString(value.model) &&
    value.handoffMode === "copy_prompt" &&
    isString(value.lastSyncAt) &&
    (value.lastHandoff === null || isValidCodexHandoff(value.lastHandoff))
  );
}

function isValidCodexHandoff(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.taskId) &&
    isString(value.taskTitle) &&
    isString(value.prompt) &&
    isString(value.createdAt)
  );
}

function isValidObsidianVault(value: unknown): boolean {
  return (
    isRecord(value) &&
    isEnum(value.status, obsidianStatuses) &&
    isNullableString(value.name) &&
    isFiniteNumber(value.noteCount) &&
    isFiniteNumber(value.projectCount) &&
    isFiniteNumber(value.taskCount) &&
    isFiniteNumber(value.documentCount) &&
    isNullableString(value.lastSyncedAt) &&
    typeof value.autoSync === "boolean" &&
    isFiniteNumber(value.syncIntervalSeconds) &&
    isNullableString(value.lastError)
  );
}

function isValidProjectSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    isEnum(value.provider, projectSourceProviders) &&
    isEnum(value.status, projectSourceStatuses) &&
    isString(value.name) &&
    isFiniteNumber(value.projectCount) &&
    isFiniteNumber(value.issueCount) &&
    isFiniteNumber(value.deploymentCount) &&
    isNullableString(value.lastSyncedAt) &&
    isNullableString(value.lastError)
  );
}

function isValidLinkedProjectSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isEnum(value.provider, projectSourceProviders) &&
    isString(value.name) &&
    isNullableString(value.owner) &&
    isString(value.description) &&
    isString(value.url) &&
    isNullableString(value.repository) &&
    isNullableString(value.productionUrl) &&
    isNullableString(value.framework) &&
    isNullableString(value.branch) &&
    isString(value.status) &&
    isFiniteNumber(value.openIssues) &&
    isFiniteNumber(value.deploymentCount) &&
    isString(value.updatedAt) &&
    isStringArray(value.tags) &&
    isNullableString(value.projectId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEnum(value: unknown, values: Set<string>): boolean {
  return typeof value === "string" && values.has(value);
}

function daysBetween(leftIso: string, rightIso: string): number {
  const left = new Date(leftIso);
  const right = new Date(rightIso);
  left.setHours(0, 0, 0, 0);
  right.setHours(0, 0, 0, 0);
  return Math.abs(Math.round((right.getTime() - left.getTime()) / 86_400_000));
}

function getTaskEstimateMinutes(task: Task): number {
  if (task.estimateMinutes && task.estimateMinutes > 0) return task.estimateMinutes;
  if (task.priority === "critical") return 90;
  if (task.priority === "high") return 60;
  if (task.priority === "medium") return 35;
  return 20;
}
