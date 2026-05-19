import type {
  AutonomousIntelFinding,
  CommandDeckState,
  CommandProject,
  CommandTask,
  FinanceEntry,
  IntelItem,
  IntelSignal
} from "../store/commandDeck";
import { toKSH } from "../utils/currency";

interface DeckMetricsSnapshot {
  openTasks: number;
  pendingProjects: number;
  intelItems: number;
  intelResearching: number;
  netCash: number;
  readiness: number;
  projectProgress: number;
}

export interface AutonomousIntelScan {
  scannedAt: string;
  summary: string;
  findings: AutonomousIntelFinding[];
}

const MAX_FINDINGS = 6;

export function buildAutonomousIntelScan(
  state: CommandDeckState,
  metrics: DeckMetricsSnapshot,
  now: Date = new Date()
): AutonomousIntelScan {
  const scannedAt = now.toISOString();
  const findings: AutonomousIntelFinding[] = [];

  for (const project of getProjectTargets(state.projects).slice(0, 4)) {
    findings.push(buildProjectFinding(project, now));
  }

  const pressureFinding = buildExecutionPressureFinding(state.tasks, metrics, now);
  if (pressureFinding) findings.push(pressureFinding);

  const financeFinding = buildFinanceFinding(state.finances, metrics, now);
  if (financeFinding) findings.push(financeFinding);

  for (const item of state.intel.filter((entry) => entry.signal !== "on-hold").slice(0, 2)) {
    findings.push(buildExistingIntelRefresh(item, now));
  }

  const uniqueFindings = dedupeFindings(findings).slice(0, MAX_FINDINGS);
  const finalFindings = uniqueFindings.length > 0 ? uniqueFindings : [buildReadinessFinding(metrics, now)];

  return {
    scannedAt,
    summary: summarizeFindings(finalFindings, metrics),
    findings: finalFindings
  };
}

function getProjectTargets(projects: CommandProject[]): CommandProject[] {
  return projects
    .filter((project) => project.status === "pending")
    .slice()
    .sort((left, right) => getProjectPressure(right) - getProjectPressure(left));
}

function getProjectPressure(project: CommandProject): number {
  const staleDays = project.lastPushedAt
    ? Math.max(0, Math.round((Date.now() - new Date(project.lastPushedAt).getTime()) / 86_400_000))
    : 90;
  return (100 - project.progress) + project.openPullRequests * 18 + project.openIssues * 9 + Math.min(40, staleDays);
}

function buildProjectFinding(project: CommandProject, now: Date): AutonomousIntelFinding {
  const signal = getProjectSignal(project);
  const issuePressure = project.openIssues + project.openPullRequests;
  const source = project.repositoryUrl ?? "";
  const thesis = project.objective || project.nextAction || `${project.name} needs a current delivery read.`;
  const noteParts = [
    `Autonomous scan ${formatScanTime(now)}: ${project.name} is at ${project.progress}% progress.`,
    project.nextAction ? `Next action: ${project.nextAction}` : "",
    issuePressure > 0 ? `Open pressure: ${project.openPullRequests} PR, ${project.openIssues} issue.` : "No open PR or issue pressure recorded.",
    project.lastPushedAt ? `Last pushed: ${formatDate(project.lastPushedAt)}.` : "No push timestamp recorded."
  ].filter(Boolean);

  return {
    title: `Repo: ${project.name}`,
    symbol: project.language && project.language !== "Unknown" ? project.language : "CODE",
    kind: "trend",
    signal,
    thesis,
    sourceUrl: source,
    note: noteParts.join(" ")
  };
}

function getProjectSignal(project: CommandProject): IntelSignal {
  if (project.openPullRequests > 0 || project.openIssues > 1 || project.progress < 45) return "high-priority";
  if (project.progress < 80 || project.openIssues > 0) return "researching";
  return "watching";
}

function buildExecutionPressureFinding(
  tasks: CommandTask[],
  metrics: DeckMetricsSnapshot,
  now: Date
): AutonomousIntelFinding | null {
  const pressureTasks = tasks
    .filter((task) => task.status !== "done" && (task.priority === "critical" || task.priority === "high"))
    .slice(0, 4);

  if (pressureTasks.length === 0 && metrics.openTasks < 3) return null;

  const listedTasks = pressureTasks.length > 0
    ? pressureTasks.map((task) => task.title).join("; ")
    : `${metrics.openTasks} open orders need sequencing`;

  return {
    title: "Execution pressure",
    symbol: "OPS",
    kind: "trend",
    signal: pressureTasks.some((task) => task.priority === "critical") ? "high-priority" : "researching",
    thesis: "Open orders can create execution drag if they are not sequenced.",
    sourceUrl: "",
    note: `Autonomous scan ${formatScanTime(now)}: ${listedTasks}. Readiness is ${metrics.readiness}%.`
  };
}

function buildFinanceFinding(finances: FinanceEntry[], metrics: DeckMetricsSnapshot, now: Date): AutonomousIntelFinding | null {
  if (finances.length === 0 && metrics.netCash >= 0) return null;

  const planned = finances.filter((entry) => entry.status === "planned").length;
  return {
    title: "Cashflow watch",
    symbol: "CASH",
    kind: "trend",
    signal: metrics.netCash < 0 ? "high-priority" : "watching",
    thesis: "Tracked cash movement should stay visible beside project and task pressure.",
    sourceUrl: "",
    note: `Autonomous scan ${formatScanTime(now)}: net cash is ${formatCurrency(metrics.netCash)} with ${planned} planned ledger item${planned === 1 ? "" : "s"}.`
  };
}

function buildExistingIntelRefresh(item: IntelItem, now: Date): AutonomousIntelFinding {
  return {
    title: item.title,
    symbol: item.symbol,
    kind: item.kind,
    signal: item.signal === "watching" ? "researching" : item.signal,
    thesis: item.thesis || `${item.title} remains on the watchboard until a stronger thesis is logged.`,
    sourceUrl: item.sourceUrl ?? "",
    note: `Autonomous refresh ${formatScanTime(now)}: revisit catalyst, risk, and next source for ${item.symbol || item.title}.`
  };
}

function buildReadinessFinding(metrics: DeckMetricsSnapshot, now: Date): AutonomousIntelFinding {
  return {
    title: "Northwatch readiness radar",
    symbol: "READY",
    kind: "trend",
    signal: metrics.readiness < 50 ? "researching" : "watching",
    thesis: "Readiness, project load, and cash pressure are enough to seed a daily command brief.",
    sourceUrl: "",
    note: `Autonomous scan ${formatScanTime(now)}: readiness ${metrics.readiness}%, project progress ${metrics.projectProgress}%, ${metrics.pendingProjects} pending projects.`
  };
}

function dedupeFindings(findings: AutonomousIntelFinding[]): AutonomousIntelFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = getFindingIdentity(finding);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getFindingIdentity(finding: AutonomousIntelFinding): string {
  if (finding.title.trim().toLowerCase().startsWith("repo:")) {
    return finding.title.trim().toLowerCase();
  }

  return finding.symbol.trim().toUpperCase() || finding.title.trim().toLowerCase();
}

function summarizeFindings(findings: AutonomousIntelFinding[], metrics: DeckMetricsSnapshot): string {
  const highPriority = findings.filter((finding) => finding.signal === "high-priority").length;
  const sources = [
    metrics.pendingProjects > 0 ? "projects" : "",
    metrics.openTasks > 0 ? "tasks" : "",
    metrics.netCash !== 0 ? "cashflow" : "",
    metrics.intelItems > 0 ? "watchlist" : ""
  ].filter(Boolean);

  return `Autonomous scan produced ${findings.length} finding${findings.length === 1 ? "" : "s"}${highPriority > 0 ? `, ${highPriority} high-priority` : ""} from ${sources.join(", ") || "deck state"}.`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatScanTime(value: Date): string {
  return value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number): string {
  return toKSH(value);
}
