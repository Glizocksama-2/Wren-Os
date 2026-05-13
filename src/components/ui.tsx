import type { ReactNode } from "react";
import type {
  AgentActionStatus,
  AutomationStatus,
  ContentStage,
  Priority,
  ProjectHealth,
  TaskStatus
} from "../types/workspace";

type Tone =
  | "neutral"
  | "teal"
  | "blue"
  | "green"
  | "amber"
  | "coral"
  | "slate"
  | Priority
  | TaskStatus
  | ProjectHealth
  | AgentActionStatus
  | AutomationStatus
  | ContentStage
  | "down";

export function Panel({
  title,
  action,
  children,
  className = ""
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "neutral",
  disabled = false,
  type = "button",
  ariaLabel
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "neutral" | "primary" | "success" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  return (
    <button className={`action-button action-${tone}`} aria-label={ariaLabel} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function ProgressBar({ value, accent }: { value: number; accent?: string }) {
  return (
    <div className="progress-track" aria-label={`Progress ${value}%`}>
      <div className="progress-fill" style={{ width: `${value}%`, background: accent }} />
    </div>
  );
}

export function Sparkline({ color = "#0f766e" }: { color?: string }) {
  return (
    <svg className="sparkline" viewBox="0 0 120 36" role="img" aria-label="Trend">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="2,27 16,17 31,22 45,16 59,20 74,8 88,13 103,10 118,5"
      />
      {[2, 16, 31, 45, 59, 74, 88, 103, 118].map((x, index) => (
        <circle key={x} cx={x} cy={[27, 17, 22, 16, 20, 8, 13, 10, 5][index]} r="2.4" fill={color} />
      ))}
    </svg>
  );
}
