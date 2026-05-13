import { CheckCircle2, Clipboard, Copy, FolderGit2, GitBranch, PlugZap, Send, TerminalSquare } from "lucide-react";
import type { Dispatch } from "react";
import { formatRelativeTime, getProjectName } from "../store/workspace";
import type { WorkspaceAction, WorkspaceState } from "../types/workspace";
import { ActionButton, Badge, EmptyState, Panel } from "./ui";

export function CodexBridge({
  state,
  dispatch,
  onNotice
}: {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  onNotice: (message: string) => void;
}) {
  const bridge = state.codexBridge;
  const handoffTasks = state.tasks.filter((task) => task.status !== "done").slice(0, 6);
  const latestPrompt = bridge.lastHandoff?.prompt ?? "";

  const reconnect = () => {
    dispatch({ type: "codex/connect" });
    onNotice("Codex bridge connected.");
  };

  const handoffTask = (taskId: string) => {
    dispatch({ type: "codex/handoff_task", taskId });
    onNotice("Codex handoff created.");
  };

  const copyPrompt = async () => {
    if (!latestPrompt) return;
    await navigator.clipboard?.writeText(latestPrompt);
    onNotice("Codex prompt copied.");
  };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Codex Bridge</h1>
          <p>Connect Wren OS tasks to Codex with repo-aware handoff prompts and local workspace context.</p>
        </div>
        <div className="title-actions">
          <ActionButton tone="primary" onClick={reconnect}>
            <PlugZap size={16} /> Reconnect
          </ActionButton>
        </div>
      </div>

      <div className="codex-hero-grid">
        <Panel title="Connection">
          <div className="codex-connection">
            <div className="codex-status-mark">
              <TerminalSquare size={24} />
            </div>
            <div>
              <Badge tone={bridge.status === "connected" ? "green" : "coral"}>
                {bridge.status === "connected" ? "Connected to Codex" : "Disconnected"}
              </Badge>
              <h2>{bridge.repo}</h2>
              <p>Local handoffs are aimed at this workspace, branch, and model.</p>
            </div>
          </div>
          <dl className="codex-meta">
            <dt>Workspace</dt>
            <dd>{bridge.workspacePath}</dd>
            <dt>Branch</dt>
            <dd>{bridge.branch}</dd>
            <dt>Model</dt>
            <dd>{bridge.model}</dd>
            <dt>Last sync</dt>
            <dd>{formatRelativeTime(bridge.lastSyncAt)}</dd>
          </dl>
        </Panel>

        <Panel title="Runbook">
          <div className="runbook-list">
            <div>
              <CheckCircle2 size={16} />
              <span>Pick a live task from Wren OS.</span>
            </div>
            <div>
              <FolderGit2 size={16} />
              <span>Attach repo, branch, project, priority, and context.</span>
            </div>
            <div>
              <Clipboard size={16} />
              <span>Copy the generated prompt into this Codex thread.</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="codex-grid">
        <Panel title="Task Handoff Queue">
          <div className="handoff-list">
            {handoffTasks.map((task) => (
              <div className="handoff-row" key={task.id}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{getProjectName(state, task.projectId)}</small>
                </span>
                <Badge tone={task.priority}>{task.priority}</Badge>
                <button type="button" onClick={() => handoffTask(task.id)} aria-label={`Send ${task.title} to Codex`}>
                  <Send size={15} /> Send to Codex
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Latest Codex Prompt"
          action={
            <button className="link-button" type="button" disabled={!latestPrompt} onClick={copyPrompt}>
              Copy prompt <Copy size={15} />
            </button>
          }
        >
          {bridge.lastHandoff ? (
            <div className="prompt-preview">
              <div className="prompt-headline">
                <Badge tone="blue">{bridge.lastHandoff.taskTitle}</Badge>
                <em>{formatRelativeTime(bridge.lastHandoff.createdAt)}</em>
              </div>
              <pre>{latestPrompt}</pre>
            </div>
          ) : (
            <EmptyState>Send a task to Codex to generate the first prompt.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
