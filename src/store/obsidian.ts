import type {
  DocumentKind,
  KnowledgeDocument,
  ObsidianMarkdownFile,
  ObsidianVaultConnection,
  Priority,
  Project,
  ProjectHealth,
  ProjectStatus,
  Task,
  WorkspaceState
} from "../types/workspace";

export interface LocalDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): AsyncIterable<[string, LocalDirectoryEntry]>;
}

interface LocalFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<{
    name: string;
    lastModified: number;
    text(): Promise<string>;
  }>;
}

type LocalDirectoryEntry = LocalDirectoryHandle | LocalFileHandle;

interface ParsedNote {
  path: string;
  name: string;
  title: string;
  body: string;
  markdown: string;
  lineOffset: number;
  frontmatter: Record<string, string | string[]>;
  tags: string[];
  lastModified: string;
  isProject: boolean;
}

const projectStatuses = new Set<ProjectStatus>(["active", "paused", "archived"]);
const projectHealthValues = new Set<ProjectHealth>(["on_track", "at_risk", "blocked"]);
const documentKinds = new Set<DocumentKind>(["note", "brief", "runbook", "link", "api"]);
const priorities = new Set<Priority>(["low", "medium", "high", "critical"]);
const ignoredDirectories = new Set([".obsidian", ".trash", ".git", "node_modules"]);
const accentColors = ["#0f766e", "#2563eb", "#d97706", "#475569", "#16a34a", "#7c3aed"];

export function createDefaultObsidianVault(): ObsidianVaultConnection {
  return {
    status: "unlinked",
    name: null,
    noteCount: 0,
    projectCount: 0,
    taskCount: 0,
    documentCount: 0,
    lastSyncedAt: null,
    autoSync: false,
    syncIntervalSeconds: 60,
    lastError: null
  };
}

export function syncObsidianVault(
  state: WorkspaceState,
  payload: { vaultName: string; files: ObsidianMarkdownFile[]; syncedAt?: string }
): WorkspaceState {
  const syncedAt = payload.syncedAt ?? new Date().toISOString();
  const parsedNotes = payload.files.map(parseNote);
  const projectNotes = parsedNotes.filter((note) => note.isProject);
  const projectByName = new Map<string, string>();
  const obsidianProjects = projectNotes.map((note, index) => {
    const projectId = `obsidian-project-${slugify(note.title)}`;
    projectByName.set(normalizeLookup(note.title), projectId);
    return createProject(state, note, projectId, index, syncedAt);
  });

  const existingProjectByName = new Map(state.projects.map((project) => [normalizeLookup(project.name), project.id]));
  const obsidianDocuments = parsedNotes.map((note) =>
    createDocument(state, payload.vaultName, note, projectByName.get(normalizeLookup(note.title)) ?? findProjectId(note, projectByName, existingProjectByName), syncedAt)
  );
  const obsidianTasks = parsedNotes.flatMap((note) =>
    createTasksFromNote(state, note, projectByName.get(normalizeLookup(note.title)) ?? findProjectId(note, projectByName, existingProjectByName), syncedAt)
  );

  return {
    ...state,
    obsidianVault: {
      ...state.obsidianVault,
      status: "linked",
      name: payload.vaultName,
      noteCount: parsedNotes.length,
      projectCount: obsidianProjects.length,
      taskCount: obsidianTasks.length,
      documentCount: obsidianDocuments.length,
      lastSyncedAt: syncedAt,
      lastError: null
    },
    projects: [...state.projects.filter((project) => !project.id.startsWith("obsidian-project-")), ...obsidianProjects],
    documents: [...state.documents.filter((document) => !document.id.startsWith("obsidian-doc-")), ...obsidianDocuments],
    tasks: [...state.tasks.filter((task) => !task.id.startsWith("obsidian-task-")), ...obsidianTasks]
  };
}

export async function readMarkdownFilesFromDirectory(handle: LocalDirectoryHandle): Promise<ObsidianMarkdownFile[]> {
  return readMarkdownFilesRecursive(handle);
}

async function readMarkdownFilesRecursive(handle: LocalDirectoryHandle, prefix = ""): Promise<ObsidianMarkdownFile[]> {
  const files: ObsidianMarkdownFile[] = [];

  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === "directory") {
      if (!ignoredDirectories.has(name)) {
        files.push(...(await readMarkdownFilesRecursive(entry, `${prefix}${name}/`)));
      }
      continue;
    }

    if (!name.toLowerCase().endsWith(".md") && !name.toLowerCase().endsWith(".markdown")) continue;

    const file = await entry.getFile();
    files.push({
      path: `${prefix}${name}`,
      name: file.name,
      content: await file.text(),
      lastModified: new Date(file.lastModified).toISOString()
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function parseNote(file: ObsidianMarkdownFile): ParsedNote {
  const { frontmatter, markdown, lineOffset } = splitFrontmatter(file.content);
  const title = getTitle(file, frontmatter, markdown);
  const body = summarizeMarkdown(markdown);
  const tags = uniqueStrings([...parseTags(frontmatter.tags), "obsidian"]);
  const type = getScalar(frontmatter.type) ?? getScalar(frontmatter.kind);

  return {
    path: file.path,
    name: file.name,
    title,
    body,
    markdown,
    lineOffset,
    frontmatter,
    tags,
    lastModified: file.lastModified,
    isProject: type === "project" || file.path.toLowerCase().startsWith("projects/")
  };
}

function createProject(state: WorkspaceState, note: ParsedNote, id: string, index: number, syncedAt: string): Project {
  const status = getEnum(getScalar(note.frontmatter.status), projectStatuses, "active");
  const health = getEnum(getScalar(note.frontmatter.health), projectHealthValues, "on_track");

  return {
    id,
    workspaceId: state.workspace.id,
    name: note.title,
    description: note.body,
    status,
    health,
    accent: accentColors[index % accentColors.length],
    owner: getScalar(note.frontmatter.owner) ?? state.workspace.owner,
    objective: getScalar(note.frontmatter.objective) ?? note.body,
    tags: note.tags,
    risks: parseTags(note.frontmatter.risks),
    createdAt: note.lastModified,
    updatedAt: syncedAt
  };
}

function createDocument(
  state: WorkspaceState,
  vaultName: string,
  note: ParsedNote,
  projectId: string | null,
  syncedAt: string
): KnowledgeDocument {
  const kind = getEnum(getScalar(note.frontmatter.kind), documentKinds, "note");
  const obsidianFile = note.path.replace(/\.(md|markdown)$/i, "");

  return {
    id: `obsidian-doc-${slugify(note.path.replace(/\.(md|markdown)$/i, ""))}`,
    workspaceId: state.workspace.id,
    title: note.title,
    kind,
    url: `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(obsidianFile)}`,
    body: note.body,
    tags: note.tags,
    projectId,
    updatedAt: syncedAt
  };
}

function createTasksFromNote(state: WorkspaceState, note: ParsedNote, projectId: string | null, syncedAt: string): Task[] {
  return note.markdown.split("\n").flatMap((line, index) => {
        const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (!match) return [];

        const lineNumber = note.lineOffset + index + 1;
        const title = cleanTaskTitle(match[2]);
        const priority = getEnum(getScalar(note.frontmatter.priority), priorities, "medium");
        const dueDate = match[2].match(/\bdue::\s*(\d{4}-\d{2}-\d{2})\b/i)?.[1] ?? null;

        return [
          {
            id: `obsidian-task-${slugify(note.path.replace(/\.(md|markdown)$/i, ""))}-${lineNumber}`,
            workspaceId: state.workspace.id,
            title,
            description: `Synced from ${note.path}`,
            status: match[1].toLowerCase() === "x" ? "done" : "todo",
            priority,
            dueDate,
            tags: note.tags,
            projectId,
            source: "manual",
            externalLinks: [],
            createdAt: note.lastModified,
            updatedAt: syncedAt
          } satisfies Task
        ];
      });
}

function splitFrontmatter(content: string): { frontmatter: Record<string, string | string[]>; markdown: string; lineOffset: number } {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: {}, markdown: normalized, lineOffset: 0 };

  const endIndex = normalized.indexOf("\n---", 4);
  if (endIndex === -1) return { frontmatter: {}, markdown: normalized, lineOffset: 0 };

  const raw = normalized.slice(4, endIndex).trim();
  const markdown = normalized.slice(endIndex + 4).replace(/^\n/, "");
  const lineOffset = normalized.slice(0, endIndex + 4).split("\n").length;
  return { frontmatter: parseFrontmatter(raw), markdown, lineOffset };
}

function parseFrontmatter(raw: string): Record<string, string | string[]> {
  return raw.split("\n").reduce<Record<string, string | string[]>>((accumulator, line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return accumulator;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) return accumulator;

    accumulator[key] = parseFrontmatterValue(value);
    return accumulator;
  }, {});
}

function parseFrontmatterValue(value: string): string | string[] {
  const unquoted = value.replace(/^["']|["']$/g, "");
  if (!unquoted.startsWith("[") || !unquoted.endsWith("]")) return unquoted;

  return unquoted
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function getTitle(file: ObsidianMarkdownFile, frontmatter: Record<string, string | string[]>, markdown: string): string {
  const frontmatterTitle = getScalar(frontmatter.title);
  if (frontmatterTitle) return frontmatterTitle;

  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  return file.name.replace(/\.(md|markdown)$/i, "");
}

function summarizeMarkdown(markdown: string): string {
  return (
    markdown
      .replace(/^#\s+.+$/m, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.match(/^[-*]\s+\[[ xX]\]/))
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 420) || "Synced from Obsidian."
  );
}

function findProjectId(
  note: ParsedNote,
  projectByName: Map<string, string>,
  existingProjectByName: Map<string, string>
): string | null {
  const projectName = getScalar(note.frontmatter.project);
  if (!projectName) return null;

  return projectByName.get(normalizeLookup(projectName)) ?? existingProjectByName.get(normalizeLookup(projectName)) ?? null;
}

function parseTags(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return uniqueStrings(value.map(cleanTag));
  if (!value) return [];

  return uniqueStrings(value.split(",").map(cleanTag));
}

function cleanTag(value: string): string {
  return value.trim().replace(/^#/, "").toLowerCase();
}

function cleanTaskTitle(value: string): string {
  return value
    .replace(/\bdue::\s*\d{4}-\d{2}-\d{2}\b/gi, "")
    .replace(/\s+#\w[\w-]*/g, "")
    .trim();
}

function getScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getEnum<T extends string>(value: string | undefined, values: Set<T>, fallback: T): T {
  return value && values.has(value as T) ? (value as T) : fallback;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
