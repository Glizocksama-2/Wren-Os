import {
  Bell,
  BookOpen,
  Bot,
  Check,
  Code2,
  Command,
  Database,
  Folder,
  Inbox,
  Kanban,
  LayoutDashboard,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  TerminalSquare,
  X,
  Zap
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCommandCenterMetrics, getProjectName, getStageCounts } from "../store/workspace";
import type { AgentAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Badge } from "./ui";

export type ViewKey =
  | "command"
  | "board"
  | "projects"
  | "agents"
  | "automations"
  | "content"
  | "knowledge"
  | "codex"
  | "api"
  | "settings";

const navItems = [
  { id: "command", label: "Command Center", icon: LayoutDashboard },
  { id: "board", label: "Mission Board", icon: Kanban },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "agents", label: "Agent Inbox", icon: Inbox },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "content", label: "Content Studio", icon: PenLine },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "codex", label: "Codex Bridge", icon: TerminalSquare },
  { id: "api", label: "API Studio", icon: Code2 },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

export function AppShell({
  state,
  view,
  selectedAction,
  notice,
  children,
  onNavigate,
  onSelectAction,
  onCommandSubmit,
  onCloseInspector,
  onCreateTaskFromStep,
  onDecideAction
}: {
  state: WorkspaceState;
  view: ViewKey;
  selectedAction?: AgentAction;
  notice: string;
  children: ReactNode;
  onNavigate: (view: ViewKey) => void;
  onSelectAction: (id: string) => void;
  onCommandSubmit: (query: string) => void;
  onCloseInspector: () => void;
  onCreateTaskFromStep: (step: string) => void;
  onDecideAction: (id: string, decision: "approved" | "denied") => void;
}) {
  const metrics = getCommandCenterMetrics(state);
  const stageCounts = getStageCounts(state);
  const [commandValue, setCommandValue] = useState("");
  const commandRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
        event.preventDefault();
        commandRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const badgeFor = (id: ViewKey) => {
    if (id === "board") return state.tasks.filter((task) => task.status !== "done").length;
    if (id === "agents") return metrics.pendingAgentActions;
    if (id === "automations") return state.automations.filter((automation) => automation.status !== "healthy").length;
    if (id === "content") return stageCounts.review ?? 0;
    if (id === "codex") return state.codexBridge.lastHandoff ? 1 : 0;
    return 0;
  };

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="brand-name">Northwatch</div>
            <div className="brand-subtitle">Agent Workspace</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const count = badgeFor(item.id);
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                type="button"
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="avatar">AM</div>
            <div>
              <strong>{state.workspace.owner}</strong>
              <span>Solo Operator</span>
            </div>
          </div>
          <div className="workspace-card">
            <span>Workspace</span>
            <strong>{state.workspace.name}</strong>
            <small>Local-first - all systems go</small>
          </div>
          <div className="version-row">Northwatch v{state.workspace.version}</div>
        </div>
      </aside>

      <div className="workspace-shell">
        <header className="topbar">
          <div className="command-search">
            <Command size={16} />
            <Search size={16} />
            <input
              ref={commandRef}
              aria-label="Command search"
              value={commandValue}
              onChange={(event) => setCommandValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const command = commandValue.trim();
                if (!command) return;

                onCommandSubmit(command);
                setCommandValue("");
              }}
              placeholder="Search or run a command..."
            />
            <kbd>/</kbd>
          </div>
          <div className="topbar-actions">
            <div className="local-mode">
              <span className="status-dot" />
              <div>
                <strong>Local Mode</strong>
                <span>All data on this device</span>
              </div>
            </div>
            <button className="top-icon" aria-label="Database status" type="button" onClick={() => onNavigate("settings")}>
              <Database size={18} />
            </button>
            <button className="top-icon notification" aria-label="Notifications" type="button" onClick={() => onNavigate("agents")}>
              <Bell size={18} />
              <span>{metrics.pendingAgentActions}</span>
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Mobile primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const count = badgeFor(item.id);
            return (
              <button
                key={item.id}
                className={`mobile-nav-item ${view === item.id ? "active" : ""}`}
                type="button"
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {count > 0 && <em>{count}</em>}
              </button>
            );
          })}
        </nav>

        <div className="content-with-inspector">
          <main className="main-surface">{children}</main>
          <ActionInspector
            action={selectedAction}
            projectName={selectedAction ? getProjectName(state, selectedAction.projectId) : "No project"}
            onSelectAction={onSelectAction}
            onDecideAction={onDecideAction}
            onCloseInspector={onCloseInspector}
            onCreateTaskFromStep={onCreateTaskFromStep}
            relatedActions={state.agentActions}
          />
        </div>
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function ActionInspector({
  action,
  projectName,
  relatedActions,
  onSelectAction,
  onCloseInspector,
  onCreateTaskFromStep,
  onDecideAction
}: {
  action?: AgentAction;
  projectName: string;
  relatedActions: AgentAction[];
  onSelectAction: (id: string) => void;
  onCloseInspector: () => void;
  onCreateTaskFromStep: (step: string) => void;
  onDecideAction: (id: string, decision: "approved" | "denied") => void;
}) {
  if (!action) {
    return (
      <aside className="inspector">
        <h2>Agent Action Details</h2>
        <p className="muted">No action selected.</p>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <h2>Agent Action Details</h2>
        <button aria-label="Close inspector" type="button" onClick={onCloseInspector}>
          <X size={16} />
        </button>
      </div>

      <div className="action-hero">
        <div className="action-icon">
          <Bot size={24} />
        </div>
        <Badge tone={action.status}>{action.status === "pending" ? "Pending Review" : action.status}</Badge>
      </div>

      <h3>{action.title}</h3>
      <p className="muted strong-line">{action.agent}</p>

      <div className="inspector-section">
        <h4>Context</h4>
        <dl className="meta-grid">
          <dt>Project</dt>
          <dd>
            <Badge tone="teal">{projectName}</Badge>
          </dd>
          <dt>Trigger</dt>
          <dd>{action.trigger}</dd>
          <dt>Files</dt>
          <dd>{action.files.length} files</dd>
          <dt>Confidence</dt>
          <dd>{Math.round(action.confidence * 100)}%</dd>
        </dl>
      </div>

      <div className="inspector-section">
        <h4>Summary</h4>
        <p>{action.summary}</p>
      </div>

      <div className="inspector-section">
        <h4>Files</h4>
        <div className="file-list">
          {action.files.map((file) => (
            <div className="file-row" key={file.path}>
              <Code2 size={14} />
              <span>{file.path}</span>
              <strong>+{file.additions}</strong>
              <em>-{file.deletions}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="decision-row">
        <ActionButton
          tone="success"
          disabled={action.status !== "pending"}
          onClick={() => onDecideAction(action.id, "approved")}
        >
          <Check size={16} /> Approve
        </ActionButton>
        <ActionButton
          tone="danger"
          disabled={action.status !== "pending"}
          onClick={() => onDecideAction(action.id, "denied")}
        >
          <X size={16} /> Deny
        </ActionButton>
      </div>

      <div className="inspector-section">
        <h4>Suggested Next Steps</h4>
        <div className="next-steps">
          {action.suggestedNextSteps.map((step) => (
            <button key={step} type="button" onClick={() => onCreateTaskFromStep(step)}>
              {step}
            </button>
          ))}
        </div>
      </div>

      <div className="inspector-section">
        <h4>Queue</h4>
        <div className="mini-list">
          {relatedActions.slice(0, 4).map((item) => (
            <button key={item.id} type="button" onClick={() => onSelectAction(item.id)}>
              <span>{item.title}</span>
              <Badge tone={item.status}>{item.status}</Badge>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
