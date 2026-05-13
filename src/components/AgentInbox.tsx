import { Bot, Check, X } from "lucide-react";
import type { WorkspaceState } from "../types/workspace";
import { ActionButton, Badge, Panel } from "./ui";

export function AgentInbox({
  state,
  selectedActionId,
  onSelectAction,
  onDecideAction
}: {
  state: WorkspaceState;
  selectedActionId?: string;
  onSelectAction: (id: string) => void;
  onDecideAction: (id: string, decision: "approved" | "denied") => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Agent Inbox</h1>
          <p>Approve, deny, or inspect proposed work before agents touch production paths.</p>
        </div>
      </div>

      <Panel>
        <div className="inbox-list">
          {state.agentActions.map((action) => (
            <article className={`inbox-item ${selectedActionId === action.id ? "selected" : ""}`} key={action.id}>
              <button type="button" className="inbox-main" onClick={() => onSelectAction(action.id)}>
                <span className="action-icon small">
                  <Bot size={17} />
                </span>
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.summary}</small>
                </span>
              </button>
              <Badge tone={action.status}>{action.status}</Badge>
              <strong>{Math.round(action.confidence * 100)}%</strong>
              <div className="decision-mini wide">
                <ActionButton tone="success" disabled={action.status !== "pending"} onClick={() => onDecideAction(action.id, "approved")}>
                  <Check size={14} /> Approve
                </ActionButton>
                <ActionButton tone="danger" disabled={action.status !== "pending"} onClick={() => onDecideAction(action.id, "denied")}>
                  <X size={14} /> Deny
                </ActionButton>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
