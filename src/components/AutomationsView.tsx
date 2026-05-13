import { Clock3, Play, Zap } from "lucide-react";
import { formatRelativeTime } from "../store/workspace";
import type { WorkspaceState } from "../types/workspace";
import { Badge, Panel } from "./ui";

export function AutomationsView({ state }: { state: WorkspaceState }) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <h1>Automations</h1>
          <p>Recurring loops, trigger cadence, run health, and next execution windows.</p>
        </div>
      </div>
      <Panel>
        <div className="automation-table">
          {state.automations.map((automation) => (
            <div className="automation-row" key={automation.id}>
              <span className={`automation-glyph run-${automation.status}`}>
                {automation.status === "running" ? <Play size={16} /> : <Zap size={16} />}
              </span>
              <span>
                <strong>{automation.name}</strong>
                <small>{automation.owner}</small>
              </span>
              <span>{automation.cadence}</span>
              <span>
                <Clock3 size={14} /> {formatRelativeTime(automation.lastRunAt)}
              </span>
              <span>{automation.duration}</span>
              <Badge tone={automation.status}>{automation.status}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
