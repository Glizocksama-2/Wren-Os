export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskSource = "manual" | "agent" | "automation";
export type ProjectStatus = "active" | "paused" | "archived";
export type ProjectHealth = "on_track" | "at_risk" | "blocked";
export type AgentActionStatus = "pending" | "approved" | "denied";
export type AutomationStatus = "healthy" | "running" | "warning" | "failed";
export type ContentStage = "idea" | "draft" | "review" | "scheduled" | "published";
export type DocumentKind = "note" | "brief" | "runbook" | "link" | "api";
export type ProviderHealth = "healthy" | "warning" | "down";
export type CodexConnectionStatus = "connected" | "disconnected";
export type ObsidianVaultStatus = "unlinked" | "linked" | "syncing" | "error";
export type ProjectSourceProvider = "github" | "vercel";
export type ProjectSourceStatus = "unlinked" | "linked" | "error";

export interface WorkspaceProfile {
  id: string;
  name: string;
  owner: string;
  mode: "local-first";
  schemaVersion: number;
  version: string;
  agentKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodexHandoff {
  id: string;
  taskId: string;
  taskTitle: string;
  prompt: string;
  createdAt: string;
}

export interface CodexBridge {
  status: CodexConnectionStatus;
  workspacePath: string;
  repo: string;
  branch: string;
  model: string;
  handoffMode: "copy_prompt";
  lastSyncAt: string;
  lastHandoff: CodexHandoff | null;
}

export interface ObsidianVaultConnection {
  status: ObsidianVaultStatus;
  name: string | null;
  noteCount: number;
  projectCount: number;
  taskCount: number;
  documentCount: number;
  lastSyncedAt: string | null;
  autoSync: boolean;
  syncIntervalSeconds: number;
  lastError: string | null;
}

export interface ObsidianMarkdownFile {
  path: string;
  name: string;
  content: string;
  lastModified: string;
}

export interface ProjectSourceConnection {
  provider: ProjectSourceProvider;
  status: ProjectSourceStatus;
  name: string;
  projectCount: number;
  issueCount: number;
  deploymentCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface ProjectSourceInput {
  id?: string | null;
  name?: string | null;
  fullName?: string | null;
  nameWithOwner?: string | null;
  description?: string | null;
  url?: string | null;
  htmlUrl?: string | null;
  html_url?: string | null;
  repository?: string | null;
  productionUrl?: string | null;
  latestProductionUrl?: string | null;
  framework?: string | null;
  branch?: string | null;
  defaultBranch?: string | null;
  default_branch?: string | null;
  status?: string | null;
  openIssues?: number | null;
  openIssuesCount?: number | null;
  open_issues_count?: number | null;
  deploymentCount?: number | null;
  deployments?: number | unknown[] | null;
  updatedAt?: string | null;
  pushedAt?: string | null;
  pushed_at?: string | null;
  owner?: string | null;
  tags?: string[] | null;
  topics?: string[] | null;
  language?: string | null;
}

export interface ProjectSourceSyncPayload {
  provider: ProjectSourceProvider;
  projects: ProjectSourceInput[];
  syncedAt?: string;
}

export interface LinkedProjectSource {
  id: string;
  provider: ProjectSourceProvider;
  name: string;
  owner: string | null;
  description: string;
  url: string;
  repository: string | null;
  productionUrl: string | null;
  framework: string | null;
  branch: string | null;
  status: string;
  openIssues: number;
  deploymentCount: number;
  updatedAt: string;
  tags: string[];
  projectId: string | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  health: ProjectHealth;
  accent: string;
  owner: string;
  objective: string;
  tags: string[];
  risks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  projectId: string | null;
  source: TaskSource;
  externalLinks: string[];
  estimateMinutes?: number | null;
  blockedReason?: string | null;
  acceptanceCriteria?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentActionFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface AgentAction {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  agent: string;
  projectId: string | null;
  status: AgentActionStatus;
  confidence: number;
  trigger: string;
  files: AgentActionFile[];
  suggestedNextSteps: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  workspaceId: string;
  name: string;
  owner: string;
  cadence: string;
  status: AutomationStatus;
  lastRunAt: string;
  nextRunAt: string;
  duration: string;
  summary: string;
}

export interface ContentItem {
  id: string;
  workspaceId: string;
  title: string;
  stage: ContentStage;
  platform: "linkedin" | "x" | "blog" | "newsletter" | "youtube";
  owner: string;
  projectId: string | null;
  scheduledFor: string | null;
  tags: string[];
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  workspaceId: string;
  title: string;
  kind: DocumentKind;
  url: string;
  body: string;
  tags: string[];
  projectId: string | null;
  updatedAt: string;
}

export interface ApiProvider {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  health: ProviderHealth;
  latencyMs: number;
  lastCheckedAt: string;
}

export interface ApiEndpoint {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: "agent_key" | "none";
  example: string;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  entityType:
    | "task"
    | "project"
    | "agent_action"
    | "automation"
    | "content"
    | "document"
    | "workspace"
    | "codex"
    | "obsidian"
    | "project_source";
  entityId: string;
  eventType:
    | "task_created"
    | "task_status_changed"
    | "task_updated"
    | "agent_action_approved"
    | "agent_action_denied"
    | "project_created"
    | "project_updated"
    | "automation_warning"
    | "content_created"
    | "document_created"
    | "workspace_imported"
    | "workspace_reset"
    | "codex_connected"
    | "codex_handoff_created"
    | "obsidian_vault_synced"
    | "obsidian_vault_unlinked"
    | "obsidian_vault_error"
    | "project_source_synced"
    | "project_source_error";
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WorkspaceState {
  workspace: WorkspaceProfile;
  codexBridge: CodexBridge;
  obsidianVault: ObsidianVaultConnection;
  projectSources: ProjectSourceConnection[];
  linkedProjects: LinkedProjectSource[];
  projects: Project[];
  tasks: Task[];
  agentActions: AgentAction[];
  automations: AutomationRun[];
  contentItems: ContentItem[];
  documents: KnowledgeDocument[];
  apiProviders: ApiProvider[];
  apiEndpoints: ApiEndpoint[];
  activityEvents: ActivityEvent[];
}

export interface CommandCenterMetrics {
  activeProjects: number;
  pendingAgentActions: number;
  overdueTasks: number;
  automationWarnings: number;
  contentInFlight: number;
  completedToday: number;
  focusMinutes: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  health: ProjectHealth;
  accent: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  riskCount: number;
  objective: string;
  nextTaskId: string | null;
  nextTaskTitle: string | null;
  blockedTaskCount: number;
  overdueTaskCount: number;
  reviewTaskCount: number;
}

export interface DailyPlan {
  topOutcomes: Task[];
  reviewQueue: Task[];
  blockedTasks: Task[];
  overdueTasks: Task[];
  activeProjectCount: number;
  readyProjectCount: number;
  completionPercent: number;
}

export type WorkspaceAction =
  | {
      type: "task/create";
      payload: {
        title: string;
        description: string;
        priority: Priority;
        dueDate: string | null;
        tags: string[];
        projectId: string | null;
        source: TaskSource;
        externalLinks?: string[];
        estimateMinutes?: number | null;
        blockedReason?: string | null;
        acceptanceCriteria?: string[];
      };
    }
  | { type: "task/move"; id: string; status: TaskStatus }
  | { type: "task/update"; id: string; payload: Partial<Omit<Task, "id" | "workspaceId" | "createdAt">> }
  | { type: "project/update"; id: string; payload: Partial<Omit<Project, "id" | "workspaceId" | "createdAt">> }
  | { type: "agent/decide"; id: string; decision: "approved" | "denied" }
  | { type: "codex/connect"; payload?: Partial<Pick<CodexBridge, "workspacePath" | "repo" | "branch" | "model">> }
  | { type: "codex/disconnect" }
  | { type: "codex/handoff_task"; taskId: string }
  | {
      type: "obsidian/sync";
      payload: {
        vaultName: string;
        files: ObsidianMarkdownFile[];
        syncedAt?: string;
      };
    }
  | { type: "obsidian/configure"; payload: Partial<Pick<ObsidianVaultConnection, "autoSync" | "syncIntervalSeconds">> }
  | { type: "obsidian/unlink" }
  | { type: "obsidian/error"; error: string }
  | { type: "project_sources/sync"; payload: ProjectSourceSyncPayload }
  | { type: "project_sources/error"; provider: ProjectSourceProvider; error: string }
  | { type: "workspace/import"; payload: WorkspaceState }
  | { type: "workspace/reset" };
