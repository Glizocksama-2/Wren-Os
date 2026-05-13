import type {
  KnowledgeDocument,
  LinkedProjectSource,
  Project,
  ProjectSourceConnection,
  ProjectSourceInput,
  ProjectSourceProvider,
  ProjectSourceSyncPayload,
  WorkspaceState
} from "../types/workspace";

export interface ProjectSourceImportResult {
  ok: boolean;
  payloads?: ProjectSourceSyncPayload[];
  error?: string;
}

const providerNames: Record<ProjectSourceProvider, string> = {
  github: "GitHub",
  vercel: "Vercel"
};

const providerAccents: Record<ProjectSourceProvider, string> = {
  github: "#475569",
  vercel: "#0f766e"
};

export function createDefaultProjectSources(): ProjectSourceConnection[] {
  return (["github", "vercel"] as const).map((provider) => ({
    provider,
    status: "unlinked",
    name: providerNames[provider],
    projectCount: 0,
    issueCount: 0,
    deploymentCount: 0,
    lastSyncedAt: null,
    lastError: null
  }));
}

export function syncProjectSources(state: WorkspaceState, payload: ProjectSourceSyncPayload): WorkspaceState {
  const syncedAt = payload.syncedAt ?? new Date().toISOString();
  const linkedProjects = payload.projects
    .map((project) => toLinkedProjectSource(state, payload.provider, project, syncedAt))
    .filter((project): project is LinkedProjectSource => Boolean(project));

  const retainedProjects = state.projects.filter((project) => !project.id.startsWith(`source-project-${payload.provider}-`));
  const projectIds = new Map<string, string | null>();
  const createdProjects = linkedProjects
    .filter((source) => !findExistingProject(retainedProjects, source))
    .map((source) => createProjectFromSource(state, source, syncedAt));

  linkedProjects.forEach((source) => {
    const existing = findExistingProject([...retainedProjects, ...createdProjects], source);
    projectIds.set(source.id, existing?.id ?? null);
  });

  const linkedWithProjectIds = linkedProjects.map((source) => ({
    ...source,
    projectId: projectIds.get(source.id) ?? null
  }));
  const sourceDocuments = linkedWithProjectIds.map((source) => createDocumentFromSource(state, source, syncedAt));
  const previousSources = state.projectSources?.length ? state.projectSources : createDefaultProjectSources();
  const nextConnections = createDefaultProjectSources().map((fallback) => {
    const previous = previousSources.find((source) => source.provider === fallback.provider) ?? fallback;
    if (fallback.provider !== payload.provider) return previous;

    const status: ProjectSourceConnection["status"] = linkedWithProjectIds.length ? "linked" : "unlinked";

    return {
      ...previous,
      status,
      projectCount: linkedWithProjectIds.length,
      issueCount: linkedWithProjectIds.reduce((sum, source) => sum + source.openIssues, 0),
      deploymentCount: linkedWithProjectIds.reduce((sum, source) => sum + source.deploymentCount, 0),
      lastSyncedAt: syncedAt,
      lastError: null
    };
  });

  return {
    ...state,
    projectSources: nextConnections,
    linkedProjects: [
      ...(state.linkedProjects ?? []).filter((source) => source.provider !== payload.provider),
      ...linkedWithProjectIds
    ],
    projects: [...retainedProjects, ...createdProjects],
    documents: [
      ...state.documents.filter((document) => !document.id.startsWith(`source-doc-${payload.provider}-`)),
      ...sourceDocuments
    ]
  };
}

export function parseProjectSourceImport(raw: string): ProjectSourceImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Project source import is not valid JSON." };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "Project source import needs a JSON object." };
  }

  const githubProjects = asProjectArray(parsed.github ?? parsed.repositories ?? parsed.repos);
  const vercelProjects = asProjectArray(parsed.vercel ?? parsed.projects);
  const payloads: ProjectSourceSyncPayload[] = [];

  if (githubProjects.length) payloads.push({ provider: "github", projects: githubProjects });
  if (vercelProjects.length) payloads.push({ provider: "vercel", projects: vercelProjects });

  if (!payloads.length || payloads.every((payload) => payload.projects.every((project) => !getInputName(payload.provider, project)))) {
    return { ok: false, error: "Project source import needs at least one GitHub or Vercel project with a name." };
  }

  return { ok: true, payloads };
}

export function mapGitHubApiRepository(value: unknown): ProjectSourceInput {
  if (!isRecord(value)) return {};

  return {
    name: getString(value.name),
    fullName: getString(value.full_name ?? value.nameWithOwner),
    description: getString(value.description),
    url: getString(value.html_url ?? value.url),
    branch: getString(value.default_branch ?? value.defaultBranch),
    openIssues: getNumber(value.open_issues_count ?? value.openIssuesCount ?? value.openIssues),
    updatedAt: getString(value.pushed_at ?? value.pushedAt ?? value.updated_at ?? value.updatedAt),
    tags: getStringArray(value.topics ?? value.repositoryTopics),
    language: getString(value.language ?? (isRecord(value.primaryLanguage) ? value.primaryLanguage.name : undefined))
  };
}

function toLinkedProjectSource(
  state: WorkspaceState,
  provider: ProjectSourceProvider,
  input: ProjectSourceInput,
  syncedAt: string
): LinkedProjectSource | null {
  const name = getInputName(provider, input);
  if (!name) return null;

  const repository = getString(input.repository ?? input.fullName ?? input.nameWithOwner);
  const sourceKey = repository ?? name;
  const owner = getString(input.owner) ?? (repository?.includes("/") ? repository.split("/")[0] : null);
  const productionUrl = getString(input.productionUrl ?? input.latestProductionUrl);
  const url = getString(input.url ?? input.htmlUrl ?? input.html_url) ?? productionUrl ?? "";
  const branch = getString(input.branch ?? input.defaultBranch ?? input.default_branch);
  const tags = uniqueStrings([
    provider,
    ...getStringArray(input.tags ?? input.topics),
    ...(input.language ? [String(input.language).toLowerCase()] : [])
  ]);
  const deploymentCount =
    getNumber(input.deploymentCount) ??
    (Array.isArray(input.deployments) ? input.deployments.length : getNumber(input.deployments)) ??
    (productionUrl ? 1 : 0);
  const openIssues = getNumber(input.openIssues ?? input.openIssuesCount ?? input.open_issues_count) ?? 0;
  const status = getString(input.status) ?? (provider === "github" ? "repository" : productionUrl ? "production" : "linked");
  const updatedAt = getString(input.updatedAt ?? input.pushedAt ?? input.pushed_at) ?? syncedAt;

  return {
    id: `source-${provider}-${slugify(sourceKey)}`,
    provider,
    name,
    owner,
    description: getString(input.description) ?? "",
    url,
    repository: provider === "github" ? repository ?? sourceKey : repository,
    productionUrl,
    framework: getString(input.framework ?? input.language),
    branch,
    status,
    openIssues,
    deploymentCount,
    updatedAt,
    tags,
    projectId: findExistingProject(state.projects, {
      id: "",
      provider,
      name,
      repository: repository ?? sourceKey
    } as LinkedProjectSource)?.id ?? null
  };
}

function createDocumentFromSource(
  state: WorkspaceState,
  source: LinkedProjectSource,
  syncedAt: string
): KnowledgeDocument {
  const label = providerNames[source.provider];
  const identifier = source.repository ?? source.name;
  const details = [
    `${label} project source synced into Wren OS.`,
    source.description ? `Description: ${source.description}` : "",
    source.url ? `Source: ${source.url}` : "",
    source.productionUrl ? `Production: ${source.productionUrl}` : "",
    source.branch ? `Branch: ${source.branch}` : "",
    `Status: ${source.status}`,
    `Open issues: ${source.openIssues}`,
    `Deployments tracked: ${source.deploymentCount}`
  ].filter(Boolean);

  return {
    id: `source-doc-${source.provider}-${slugify(identifier)}`,
    workspaceId: state.workspace.id,
    title: `${label}: ${identifier}`,
    kind: "link",
    url: source.url || source.productionUrl || "",
    body: details.join("\n"),
    tags: source.tags,
    projectId: source.projectId,
    updatedAt: syncedAt
  };
}

function createProjectFromSource(state: WorkspaceState, source: LinkedProjectSource, syncedAt: string): Project {
  return {
    id: `source-project-${source.provider}-${slugify(source.repository ?? source.name)}`,
    workspaceId: state.workspace.id,
    name: source.name,
    description: source.description || `${providerNames[source.provider]} project imported from your local project source snapshot.`,
    status: "active",
    health: source.status.toLowerCase().includes("fail") ? "at_risk" : "on_track",
    accent: providerAccents[source.provider],
    owner: source.owner ?? state.workspace.owner,
    objective: source.productionUrl ? `Keep ${source.productionUrl} healthy and connected to Wren OS.` : `Track ${source.name} from ${providerNames[source.provider]}.`,
    tags: source.tags,
    risks: source.openIssues > 0 ? [`${source.openIssues} open GitHub issues need triage.`] : [],
    createdAt: syncedAt,
    updatedAt: syncedAt
  };
}

function findExistingProject(projects: Project[], source: Pick<LinkedProjectSource, "name" | "repository" | "provider">): Project | undefined {
  const sourceName = slugify(source.name);
  const repoName = source.repository ? slugify(source.repository.split("/").at(-1) ?? source.repository) : "";
  return projects.find((project) => {
    const projectName = slugify(project.name);
    return projectName === sourceName || Boolean(repoName && projectName === repoName);
  });
}

function getInputName(provider: ProjectSourceProvider, input: ProjectSourceInput): string | null {
  const repository = getString(input.repository ?? input.fullName ?? input.nameWithOwner);
  const name = getString(input.name);
  if (provider === "github" && repository) return repository;
  return name ?? repository ?? null;
}

function asProjectArray(value: unknown): ProjectSourceInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord) as ProjectSourceInput[];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean)));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
