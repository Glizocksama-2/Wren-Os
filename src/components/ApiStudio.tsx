import { Check, Copy, KeyRound, Server } from "lucide-react";
import type { WorkspaceState } from "../types/workspace";
import { Badge, Panel } from "./ui";

export function ApiStudio({ state, onNotice }: { state: WorkspaceState; onNotice: (message: string) => void }) {
  const copy = async (value: string) => {
    await navigator.clipboard?.writeText(value);
    onNotice("Copied to clipboard.");
  };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>API Studio</h1>
          <p>Local contracts for agents, automations, webhooks, and future backend integration.</p>
        </div>
      </div>

      <div className="api-layout">
        <Panel title="Agent Key">
          <div className="key-box">
            <KeyRound size={18} />
            <code>{state.workspace.agentKey}</code>
            <button type="button" onClick={() => copy(state.workspace.agentKey)} aria-label="Copy agent key">
              <Copy size={16} />
            </button>
          </div>
          <p className="muted">Use this key for local automations and prototype agents. Rotate before public hosting.</p>
        </Panel>

        <Panel title="Provider Health">
          <div className="provider-list">
            {state.apiProviders.map((provider) => (
              <div className="provider-row" key={provider.id}>
                <Server size={15} />
                <span>{provider.name}</span>
                <small>{provider.category}</small>
                <Badge tone={provider.health}>{provider.health}</Badge>
                <em>{provider.latencyMs}ms</em>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Endpoints">
        <div className="endpoint-table">
          {state.apiEndpoints.map((endpoint) => (
            <div className="endpoint-row" key={endpoint.id}>
              <Badge tone="blue">{endpoint.method}</Badge>
              <code>{endpoint.path}</code>
              <span>{endpoint.description}</span>
              <button type="button" onClick={() => copy(endpoint.example)} aria-label={`Copy ${endpoint.path} example`}>
                <Copy size={15} />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Response Shape">
        <div className="response-grid">
          <pre>{`{ "ok": true, "data": {}, "meta": {} }`}</pre>
          <pre>{`{ "ok": false, "error": { "code": "", "message": "" } }`}</pre>
          <div className="webhook-note">
            <Check size={16} />
            Webhook events: task.created, task.status_changed, agent_action.approved, automation.warning.
          </div>
        </div>
      </Panel>
    </div>
  );
}
