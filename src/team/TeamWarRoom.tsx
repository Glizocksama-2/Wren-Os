import { Activity, ClipboardList, Crown, Gauge, Mail, Radar, Shield, UsersRound, Wallet, Zap } from "lucide-react";
import { canTeamRole } from "../../shared/teamPermissions.js";
import { getDeckMetrics, type CommandDeckState, type DeckView } from "../store/commandDeck";
import type { TeamMember, TeamRole } from "../store/cloudDeck";
import { toKSH } from "../utils/currency";

type TeamWorkspaceLike = {
  teamId?: string;
  id?: string;
  name: string;
  slug?: string;
  role: string;
};

type TeamMemberLike = TeamMember & {
  displayName?: string | null;
};

export type TeamActivityItem = {
  id: string;
  label: string;
  createdAt: string;
};

type TeamMetrics = ReturnType<typeof getDeckMetrics>;

export function TeamWarRoomHero({
  workspace,
  members,
  metrics,
  activityItems,
  onOpenView
}: {
  workspace: TeamWorkspaceLike;
  members: TeamMemberLike[];
  metrics: TeamMetrics;
  activityItems: TeamActivityItem[];
  onOpenView: (view: DeckView) => void;
}) {
  const teammateCount = members.length;
  const canCreateCards = canTeamRole(workspace.role, "create_card");
  const canCreateProjects = canTeamRole(workspace.role, "create_project");
  const inviteHref = canTeamRole(workspace.role, "invite_member") ? `/team/${encodeURIComponent(workspace.slug ?? workspace.teamId ?? workspace.id ?? workspace.name)}/settings#invites` : "";

  return (
    <section className="hero-command team-war-room-hero">
      <div className="hero-copy">
        <span className="system-dot">Team War Room online</span>
        <h1>{workspace.name} War Room</h1>
        <p>
          Shared team workspace for tasks, projects, market intel, calendar, finances, workout, books, and journal records.
        </p>
        <div className="team-war-room-status" aria-label="Team workspace status">
          <span><Shield size={14} /> Role {workspace.role}</span>
          <span><UsersRound size={14} /> {formatCount(teammateCount, "teammate")}</span>
          <span><Activity size={14} /> {formatCount(activityItems.length, "recent move")}</span>
          <span><Zap size={14} /> Shared deck synced</span>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => onOpenView("todo")}>{canCreateCards ? "Add shared task" : "View shared tasks"}</button>
          <button type="button" onClick={() => onOpenView("projects")}>{canCreateProjects ? "Open shared projects" : "Review shared projects"}</button>
          {inviteHref && <a className="team-war-room-action" href={inviteHref}><Mail size={14} /> Invite teammate</a>}
        </div>
        <p className="team-shared-modules">Shared modules: tasks, projects, intel, calendar, finances, workout, books, journal.</p>
      </div>
      <aside className="team-war-room-brief" aria-label="Team war room summary">
        <TeamAvatarStack members={members} />
        <div className="team-war-room-score">
          <Gauge size={20} />
          <strong>{metrics.readiness}%</strong>
          <span>shared readiness</span>
        </div>
        <div className="team-war-room-mini-grid">
          <span><b>{metrics.openTasks}</b> active orders</span>
          <span><b>{metrics.pendingProjects}</b> pending projects</span>
          <span><b>{metrics.intelItems}</b> intel targets</span>
          <span><b>{toKSH(metrics.netCash)}</b> net cash</span>
        </div>
      </aside>
    </section>
  );
}

export function TeamWarRoomPanels({
  state,
  members,
  activityItems,
  onOpenView
}: {
  state: CommandDeckState;
  members: TeamMemberLike[];
  activityItems: TeamActivityItem[];
  onOpenView: (view: DeckView) => void;
}) {
  const activeTasks = state.tasks.filter((task) => task.status !== "done").slice(0, 4);
  const pendingProjects = state.projects.filter((project) => project.status === "pending").slice(0, 3);

  return (
    <>
      <section className="deck-panel team-war-room-panel">
        <div className="team-war-room-panel-head">
          <div>
            <span className="micro-label">Shared priorities</span>
            <h2>Team handoffs</h2>
          </div>
          <button type="button" onClick={() => onOpenView("todo")}>Open board</button>
        </div>
        <div className="team-handoff-list">
          {activeTasks.length === 0 && pendingProjects.length === 0 && <span className="team-empty-state">No shared handoffs yet.</span>}
          {activeTasks.map((task) => (
            <article className="team-handoff-row" key={task.id}>
              <ClipboardList size={16} />
              <div>
                <strong>{task.title}</strong>
                <span>{task.status.replace("_", " ")} / {task.priority}</span>
              </div>
            </article>
          ))}
          {pendingProjects.map((project) => (
            <article className="team-handoff-row" key={project.id}>
              <Radar size={16} />
              <div>
                <strong>{project.name}</strong>
                <span>{project.progress}% / {project.nextAction || "next action needed"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="deck-panel team-war-room-panel">
        <div className="team-war-room-panel-head">
          <div>
            <span className="micro-label">Roster</span>
            <h2>People in the room</h2>
          </div>
          <UsersRound size={18} />
        </div>
        <div className="team-room-roster">
          {members.length === 0 && <span className="team-empty-state">No teammates loaded yet.</span>}
          {members.slice(0, 6).map((member) => (
            <article key={`${member.teamId ?? "team"}-${member.userId}`} className="team-room-member">
              <TeamAvatar name={getMemberName(member)} />
              <div>
                <strong>{getMemberName(member)}</strong>
                <span>{member.role}</span>
              </div>
              {member.role === "owner" && <Crown size={15} />}
            </article>
          ))}
        </div>
      </section>
      <section className="deck-panel team-war-room-panel">
        <div className="team-war-room-panel-head">
          <div>
            <span className="micro-label">Movement</span>
            <h2>Recent shared changes</h2>
          </div>
          <Activity size={18} />
        </div>
        <div className="team-movement-list">
          {activityItems.length === 0 && <span className="team-empty-state">No shared movement yet.</span>}
          {activityItems.slice(0, 5).map((item) => (
            <article key={item.id}>
              <span>{item.label}</span>
              <small>{formatShortDateTime(item.createdAt)}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function TeamWarRoomSnapshot({
  team,
  members,
  deck,
  updatedAt,
  isLoading = false
}: {
  team: TeamWorkspaceLike;
  members: TeamMemberLike[];
  deck: CommandDeckState | null;
  updatedAt?: string | null;
  isLoading?: boolean;
}) {
  const metrics = deck ? getDeckMetrics(deck) : null;

  return (
    <section className="team-war-room-snapshot" aria-label="Team shared workspace summary">
      <div className="team-war-room-snapshot-head">
        <TeamAvatarStack members={members} />
        <div>
          <strong>{team.name} shared deck</strong>
          <span>{isLoading ? "Loading shared deck" : updatedAt ? `Updated ${formatShortDateTime(updatedAt)}` : "Ready for the first shared save"}</span>
        </div>
        <TeamRoleBadge role={team.role as TeamRole} />
      </div>
      <div className="team-war-room-metrics">
        <span><Zap size={15} /> {metrics?.openTasks ?? 0} active orders</span>
        <span><Radar size={15} /> {metrics?.pendingProjects ?? 0} pending project{(metrics?.pendingProjects ?? 0) === 1 ? "" : "s"}</span>
        <span><Activity size={15} /> {metrics?.intelItems ?? 0} intel target{(metrics?.intelItems ?? 0) === 1 ? "" : "s"}</span>
        <span><Wallet size={15} /> {toKSH(metrics?.netCash ?? 0)}</span>
      </div>
    </section>
  );
}

export function TeamAvatarStack({ members }: { members: TeamMemberLike[] }) {
  const visibleMembers = members.slice(0, 4);
  const extra = Math.max(0, members.length - visibleMembers.length);

  return (
    <div className="team-avatar-stack" aria-label={`${formatCount(members.length, "teammate")} in this workspace`}>
      {visibleMembers.map((member) => (
        <TeamAvatar key={`${member.teamId ?? "team"}-${member.userId}`} name={getMemberName(member)} />
      ))}
      {extra > 0 && <span className="team-avatar-more">+{extra}</span>}
    </div>
  );
}

export function TeamRoleBadge({ role }: { role: string }) {
  return <span className={`team-role-chip role-${role}`}>{role}</span>;
}

function TeamAvatar({ name }: { name: string }) {
  return <span className="team-avatar">{getInitials(name)}</span>;
}

function getMemberName(member: TeamMemberLike): string {
  return member.displayName ?? member.email ?? "Member";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatShortDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
