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

const DEFAULT_SPARKLINE_DATA = [5, 5, 5, 5, 5, 5, 5, 5, 5];
const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 36;
const SPARKLINE_PADDING = 2;

export function Sparkline({ color = "#0f766e", data = DEFAULT_SPARKLINE_DATA }: { color?: string; data?: number[] }) {
  const values = data.length >= 2 ? data : DEFAULT_SPARKLINE_DATA;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const usableWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const usableHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;
  const points = values.map((value, index) => {
    const x = SPARKLINE_PADDING + (values.length === 1 ? 0 : (index / (values.length - 1)) * usableWidth);
    const y = range === 0 ? SPARKLINE_HEIGHT / 2 : SPARKLINE_PADDING + ((max - value) / range) * usableHeight;
    return { x, y };
  });

  return (
    <svg className="sparkline" viewBox="0 0 120 36" role="img" aria-label="Trend">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`).join(" ")}
      />
      {points.map((point, index) => (
        <circle key={`${point.x}-${index}`} cx={formatSvgNumber(point.x)} cy={formatSvgNumber(point.y)} r="2.4" fill={color} />
      ))}
    </svg>
  );
}

function formatSvgNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}
