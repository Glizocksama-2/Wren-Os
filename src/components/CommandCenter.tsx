import { Calendar, Check, ChevronRight, CircleCheck, Clock3, SlidersHorizontal, Target, TerminalSquare, X } from "lucide-react";
import { useState, type CSSProperties, type Dispatch } from "react";
import {
  formatRelativeTime,
  formatShortDate,
  getCommandCenterMetrics,
  getDailyPlan,
  getProjectName,
  getProjectSummaries,
  getStageCounts,
  isTaskOverdue
} from "../store/workspace";
import type { WorkspaceAction, WorkspaceState } from "../types/workspace";
import type { ViewKey } from "./AppShell";
import { ActionButton, Badge, Panel, ProgressBar, Sparkline } from "./ui";

type ModuleKey =
  | "focus"
  | "health"
  | "progress"
  | "agents"
  | "automations"
  | "risks"
  | "content"
  | "knowledge"
  | "codex"
  | "api";

const moduleOptions: Array<{ key: ModuleKey; label: string }> = [
  { key: "focus", label: "Focus" },
  { key: "health", label: "Project Health" },
  { key: "progress", label: "Progress" },
  { key: "agents", label: "Agents" },
  { key: "automations", label: "Automations" },
  { key: "risks", label: "Risks" },
  { key: "content", label: "Content" },
  { key: "knowledge", label: "Knowledge" },
  { key: "codex", label: "Codex" },
  { key: "api", label: "API" }
];

export function CommandCenter({
  state,
  dispatch,
  selectedActionId,
  onSelectAction,
  onNavigate,
  onNotice,
  onDecideAction
}: {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  selectedActionId?: string;
  onSelectAction: (id: string) => void;
  onNavigate: (view: ViewKey) => void;
  onNotice: (message: string) => void;
  onDecideAction: (id: string, decision: "approved" | "denied") => void;
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [visibleModules, setVisibleModules] = useState<Record<ModuleKey, boolean>>({
    focus: true,
    health: true,
    progress: true,
    agents: true,
    automations: true,
    risks: true,
    content: true,
    knowledge: true,
    codex: true,
    api: true
  });
  const metrics = getCommandCenterMetrics(state);
  const summaries = getProjectSummaries(state);
  const stageCounts = getStageCounts(state);
  const dailyPlan = getDailyPlan(state);
  const focusTasks = dailyPlan.topOutcomes;
  const risks = [...dailyPlan.overdueTasks, ...dailyPlan.blockedTasks].slice(0, 5);
  const toggleModule = (key: ModuleKey) => {
    setVisibleModules((modules) => ({ ...modules, [key]: !modules[key] }));
  };

  return (
    <div className="page-stack command-center">
      <div className="page-title-row">
        <div>
          <h1>Command Center</h1>
          <p>Your operational cockpit. Agents, projects, and systems aligned.</p>
        </div>
        <div className="title-actions">
          <button
            className="utility-button"
            type="button"
            onClick={() => {
              setVisibleModules((modules) => ({ ...modules, focus: true, progress: true }));
              onNotice("Today's focus is pinned.");
            }}
          >
            <Calendar size={16} /> Today
          </button>
          <button className="utility-button" type="button" onClick={() => setCustomizeOpen((open) => !open)}>
            <SlidersHorizontal size={16} /> Customize
          </button>
        </div>
      </div>

      {customizeOpen && (
        <Panel title="Command Center Modules" className="customize-panel">
          <div className="module-grid">
            {moduleOptions.map((option) => (
              <label className="module-toggle" key={option.key}>
                <input
                  type="checkbox"
                  aria-label={option.label}
                  checked={visibleModules[option.key]}
                  onChange={() => toggleModule(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </Panel>
      )}

      <div className="dashboard-grid">
        {visibleModules.focus && (
          <Panel
            title="Today Command Plan"
            className="focus-panel"
            action={<Badge tone={dailyPlan.readyProjectCount === dailyPlan.activeProjectCount ? "green" : "amber"}>{dailyPlan.readyProjectCount}/{dailyPlan.activeProjectCount} ready</Badge>}
          >
            <div className="today-brief">
              <Target size={17} />
              <span>Win the day by finishing the clearest outcomes first, then clearing review and blocked work.</span>
            </div>
            <div className="focus-list">
              {focusTasks.map((task) => (
                <label className="focus-row" key={task.id}>
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    onChange={() => {
                      const nextStatus = task.status === "done" ? "todo" : "done";
                      dispatch({ type: "task/move", id: task.id, status: nextStatus });
                      onNotice(nextStatus === "done" ? "Task completed from focus list." : "Task returned to todo.");
                    }}
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>{getProjectName(state, task.projectId)}</small>
                  </span>
                  <em>{task.dueDate ? formatShortDate(task.dueDate) : "open"}</em>
                </label>
              ))}
              {focusTasks.length === 0 && <div className="empty-state">No ready tasks. Unblock a project or add a next action.</div>}
            </div>
          </Panel>
        )}

        {visibleModules.health && (
          <Panel
            title="Project Health Overview"
            action={
              <button className="link-button" type="button" onClick={() => onNavigate("projects")}>
                View all projects <ChevronRight size={15} />
              </button>
            }
            className="health-panel"
          >
            <div className="health-grid">
              {summaries.slice(0, 4).map((project) => (
                <div className="health-card" key={project.id}>
                  <div className="health-name">
                    <span style={{ background: project.accent }} />
                    <strong>{project.name}</strong>
                  </div>
                  <Badge tone={project.health}>{project.health.replace("_", " ")}</Badge>
                  <Sparkline color={project.accent} />
                  <div className="health-metrics">
                    <strong>{project.progress}%</strong>
                    <span>Progress</span>
                    <strong>{project.riskCount}</strong>
                    <span>Risks</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {visibleModules.progress && (
          <Panel title="Daily Progress" className="progress-panel">
              <div className="progress-content">
              <div className="donut" style={{ "--value": String(dailyPlan.completionPercent) } as CSSProperties}>
                <span>{dailyPlan.completionPercent}%</span>
              </div>
              <div className="progress-stats">
                <div>
                  <span>Focus time</span>
                  <strong>{Math.floor(metrics.focusMinutes / 60)}h {metrics.focusMinutes % 60}m</strong>
                </div>
                <div>
                  <span>Tasks done</span>
                  <strong>{metrics.completedToday} today</strong>
                </div>
                <div>
                  <span>Needs review</span>
                  <strong>{dailyPlan.reviewQueue.length}</strong>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {visibleModules.agents && (
          <Panel title="Agent Action Queue" className="agent-queue-panel" action={<Badge tone="slate">{metrics.pendingAgentActions}</Badge>}>
            <div className="action-list">
              {state.agentActions.map((action) => (
                <div
                  key={action.id}
                  className={`action-row ${selectedActionId === action.id ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectAction(action.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelectAction(action.id);
                  }}
                >
                  <span className="queue-icon">{action.agent.slice(0, 1)}</span>
                  <span>
                    <strong>{action.title}</strong>
                    <small>
                      {action.agent} - {getProjectName(state, action.projectId)}
                    </small>
                  </span>
                  <em>{formatRelativeTime(action.createdAt)}</em>
                  <span className="decision-mini">
                    <button
                      type="button"
                      disabled={action.status !== "pending"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDecideAction(action.id, "approved");
                      }}
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={action.status !== "pending"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDecideAction(action.id, "denied");
                      }}
                    >
                      <X size={13} /> Deny
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {visibleModules.automations && (
          <Panel title="Automation Runs" className="automation-panel">
            <div className="run-list">
              {state.automations.map((run) => (
                <div className="run-row" key={run.id}>
                  <span className={`run-status run-${run.status}`}>{run.status === "healthy" ? <CircleCheck size={15} /> : <Clock3 size={15} />}</span>
                  <span>
                    <strong>{run.name}</strong>
                    <small>{run.summary}</small>
                  </span>
                  <em>{formatRelativeTime(run.lastRunAt)}</em>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {visibleModules.risks && (
          <Panel title="Risks & Overdue" className="risk-panel">
            <div className="risk-list">
              {risks.map((task) => (
                <div className="risk-row" key={task.id}>
                  <Badge tone={task.blockedReason ? "coral" : isTaskOverdue(task) ? "coral" : "amber"}>
                    {task.blockedReason ? "Blocked" : isTaskOverdue(task) ? "Overdue" : task.priority}
                  </Badge>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.blockedReason || getProjectName(state, task.projectId)}</small>
                  </span>
                  <em>{formatShortDate(task.dueDate)}</em>
                </div>
              ))}
              {risks.length === 0 && <div className="empty-state">No overdue or blocked work.</div>}
            </div>
          </Panel>
        )}

        {visibleModules.content && (
          <Panel title="Content Pipeline" className="content-panel">
            <div className="pipeline">
              {(["idea", "draft", "review", "scheduled", "published"] as const).map((stage) => (
                <div className={`pipeline-step stage-${stage}`} key={stage}>
                  <span>{stage}</span>
                  <strong>{stageCounts[stage] ?? 0}</strong>
                </div>
              ))}
            </div>
            <div className="panel-footline">Next up: Northwatch launch snippets scheduled this week</div>
          </Panel>
        )}

        {visibleModules.knowledge && (
          <Panel title="Knowledge Snippets" className="knowledge-panel">
            <div className="doc-snippets">
              {state.documents.slice(0, 3).map((doc) => (
                <div className="doc-snippet" key={doc.id}>
                  <strong>{doc.title}</strong>
                  <Badge tone="neutral">{doc.kind}</Badge>
                  <small>{formatRelativeTime(doc.updatedAt)}</small>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {visibleModules.codex && (
          <Panel
            title="Codex Bridge"
            className="codex-panel"
            action={
              <button className="link-button" type="button" onClick={() => onNavigate("codex")}>
                Open bridge <ChevronRight size={15} />
              </button>
            }
          >
            <div className="codex-mini">
              <span className="codex-mini-icon">
                <TerminalSquare size={18} />
              </span>
              <span>
                <strong>{state.codexBridge.status === "connected" ? "Connected to Codex" : "Disconnected"}</strong>
                <small>{state.codexBridge.branch}</small>
              </span>
              <Badge tone={state.codexBridge.status === "connected" ? "green" : "coral"}>
                {state.codexBridge.lastHandoff ? "handoff ready" : "ready"}
              </Badge>
            </div>
          </Panel>
        )}

        {visibleModules.api && (
          <Panel title="API & Webhook Status" className="api-panel">
            <div className="provider-list">
              {state.apiProviders.map((provider) => (
                <div className="provider-row" key={provider.id}>
                  <span>{provider.name}</span>
                  <small>{provider.category}</small>
                  <Badge tone={provider.health}>{provider.health}</Badge>
                  <em>{provider.latencyMs}ms</em>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
