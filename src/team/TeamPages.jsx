import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Crown,
  FileText,
  KeyRound,
  LayoutDashboard,
  Mail,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UsersRound
} from "lucide-react";
import { canTeamRole, TEAM_PERMISSIONS } from "../../shared/teamPermissions.js";
import {
  acceptInvite,
  createTeam,
  deleteTeam,
  extractInviteToken,
  getTeam,
  listInvites,
  listMyTeams,
  listNotifications,
  markNotificationsRead,
  previewInvite,
  removeMember,
  revokeInvite,
  sendInvite,
  slugifyTeamName,
  updateMemberRole,
  updateTeam
} from "./teamApi.js";

const TEAM_ROLES = ["admin", "member", "viewer"];

export function WorkspaceSwitcher({ activeWorkspace = { type: "personal" }, onWorkspaceChange = () => {} }) {
  const [teams, setTeams] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const activeLabel = activeWorkspace.type === "team" ? activeWorkspace.name : "Personal";

  useEffect(() => {
    let isMounted = true;
    listMyTeams()
      .then((nextTeams) => {
        if (isMounted) setTeams(nextTeams);
      })
      .catch(() => {
        if (isMounted) setTeams([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="workspace-switcher">
      <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label={`Workspace ${activeLabel}`} onClick={() => setIsOpen((value) => !value)}>
        <LayoutDashboard size={15} />
        <span>{activeLabel}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="workspace-switcher-menu" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={activeWorkspace.type === "personal"}
            onClick={() => {
              onWorkspaceChange({ type: "personal" });
              setIsOpen(false);
            }}
          >
            <Shield size={14} /> Personal private
          </button>
          {teams.map((team) => (
            <button
              type="button"
              role="option"
              aria-selected={activeWorkspace.type === "team" && activeWorkspace.teamId === team.id}
              key={team.id}
              onClick={() => {
                onWorkspaceChange({ type: "team", teamId: team.id, slug: team.slug, name: team.name, role: team.role });
                setIsOpen(false);
              }}
            >
              <UsersRound size={14} /> {team.name} {team.role}
            </button>
          ))}
          <a href="/team/create">
            <Plus size={14} /> Create or Join Team
          </a>
        </div>
      )}
    </div>
  );
}

export function TeamCreatePage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [memberLimit, setMemberLimit] = useState(10);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const team = await createTeam({ name, slug, memberLimit });
      navigate(`/team/${team.slug}`);
    } catch (teamError) {
      setError(teamError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitJoin = async (event) => {
    event.preventDefault();
    const token = extractInviteToken(inviteLink);
    if (!token) {
      setError("Paste a valid team invite link.");
      return;
    }
    setError("");
    setIsJoining(true);
    try {
      const accepted = await acceptInvite(token);
      navigate(`/team/${accepted.team.slug}`);
    } catch (teamError) {
      setError(teamError.message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <main className="team-page">
      <section className="team-panel team-form-panel">
        <span className="micro-label">Team workspace</span>
        <h1>Create or join a team</h1>
        <form className="team-form" onSubmit={submit}>
          <label>
            Team name
            <input
              aria-label="Team name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(slugifyTeamName(event.target.value));
              }}
              required
            />
          </label>
          <label>
            Team slug
            <input aria-label="Team slug" value={slug} onChange={(event) => setSlug(slugifyTeamName(event.target.value))} required />
          </label>
          <label>
            Member limit
            <input aria-label="Member limit" type="number" min="1" max="100" value={memberLimit} onChange={(event) => setMemberLimit(Number(event.target.value))} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            <UsersRound size={16} /> {isSubmitting ? "Creating" : "Create Team"}
          </button>
        </form>
        <form className="team-form" onSubmit={submitJoin}>
          <label>
            Invite link
            <input
              aria-label="Invite link"
              value={inviteLink}
              onChange={(event) => setInviteLink(event.target.value)}
              placeholder="https://northwatch.app/invite/..."
              required
            />
          </label>
          <button type="submit" disabled={isJoining || !inviteLink.trim()}>
            <KeyRound size={16} /> {isJoining ? "Joining" : "Join Team"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function TeamDashboardPage({ slug }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    getTeam(slug)
      .then((teamDetails) => {
        if (isMounted) setDetails(teamDetails);
      })
      .catch((teamError) => {
        if (isMounted) setError(teamError.message);
      });
    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (error) return <TeamError message={error} />;
  if (!details) return <TeamLoading label="Loading team workspace" />;

  return (
    <main className="team-page">
      <section className="team-hero">
        <span className="micro-label">Team workspace</span>
        <h1>{details.team.name}</h1>
        <p>{details.members.length} member{details.members.length === 1 ? "" : "s"} in this shared Northwatch workspace.</p>
        <div className="team-shortcuts">
          <a href={`/?workspace=team&team=${details.team.slug}&section=kanban`}>
            <ClipboardList size={16} /> Open Kanban
          </a>
          <a href={`/?workspace=team&team=${details.team.slug}&section=projects`}>
            <LayoutDashboard size={16} /> Open Projects
          </a>
          <a href={`/team/${details.team.slug}/settings`}>
            <Settings size={16} /> Team Settings
          </a>
        </div>
      </section>
      <section className="team-grid">
        <MemberList team={details.team} members={details.members} />
        <TeamActivityFeed events={details.activity ?? []} members={details.members} />
      </section>
    </main>
  );
}

export function TeamSettingsPage({ slug }) {
  const [details, setDetails] = useState(null);
  const [invites, setInvites] = useState([]);
  const [confirmName, setConfirmName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    const [teamDetails, pendingInvites] = await Promise.all([getTeam(slug), listInvites(slug)]);
    setDetails(teamDetails);
    setInvites(pendingInvites);
  };

  useEffect(() => {
    let isMounted = true;
    reload().catch((teamError) => {
      if (isMounted) setError(teamError.message);
    });
    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (error) return <TeamError message={error} />;
  if (!details) return <TeamLoading label="Loading team settings" />;

  const canEdit = canTeamRole(details.team.role, "edit_team_settings");
  const canDelete = details.team.role === "owner" && confirmName === details.team.name;

  const submitGeneral = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = await updateTeam(slug, {
      name: String(form.get("teamName") ?? details.team.name),
      slug: String(form.get("teamSlug") ?? details.team.slug),
      memberLimit: Number(form.get("memberLimit") ?? details.team.memberLimit)
    });
    setMessage("Team settings updated.");
    navigate(`/team/${updated.slug}/settings`);
  };

  const submitDelete = async () => {
    await deleteTeam(slug);
    navigate("/");
  };

  return (
    <main className="team-page">
      <section className="team-panel">
        <span className="micro-label">Admin</span>
        <h1>Team settings</h1>
        {message && <p role="status">{message}</p>}
        <form className="team-form team-form-inline" onSubmit={submitGeneral}>
          <label>
            Team name
            <input name="teamName" defaultValue={details.team.name} disabled={!canEdit} />
          </label>
          <label>
            Slug
            <input name="teamSlug" defaultValue={details.team.slug} disabled={!canEdit} />
            <small>Changing this breaks old invite and dashboard links.</small>
          </label>
          <label>
            Member limit
            <input name="memberLimit" type="number" min="1" max="100" defaultValue={details.team.memberLimit ?? 10} disabled={!canEdit} />
          </label>
          {canEdit && <button type="submit"><Check size={16} /> Save settings</button>}
        </form>
      </section>
      <section className="team-grid">
        <MemberList team={details.team} members={details.members} onRoleChange={async (userId, role) => {
          await updateMemberRole(slug, userId, role);
          await reload();
        }} onRemove={async (userId) => {
          await removeMember(slug, userId);
          await reload();
        }} />
        <InvitePanel team={details.team} invites={invites} onInvite={async (input) => {
          await sendInvite(slug, input);
          await reload();
        }} onRevoke={async (inviteId) => {
          await revokeInvite(slug, inviteId);
          await reload();
        }} />
      </section>
      <section className="team-panel danger-zone">
        <span className="micro-label">Danger Zone</span>
        <h2>Delete team</h2>
        <p>This permanently removes the shared team workspace, members, invites, and team-scoped records.</p>
        <label>
          Confirm team name
          <input aria-label="Confirm team name" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} />
        </label>
        <button type="button" disabled={!canDelete} onClick={submitDelete}>
          <Trash2 size={16} /> Delete Team
        </button>
      </section>
    </main>
  );
}

export function MemberList({ team = {}, members = [], onRoleChange, onRemove }) {
  const canManage = canTeamRole(team.role, "change_role");

  return (
    <section className="team-panel">
      <div className="team-panel-head">
        <h2>Members</h2>
        <span>{members.length}</span>
      </div>
      <div className="member-list">
        {members.map((member) => (
          <article className="member-row" key={member.userId}>
            <AvatarInitial name={member.displayName ?? member.email ?? "Member"} />
            <div>
              <strong>{member.displayName ?? member.email ?? "Member"}</strong>
              <small>{member.email ?? formatDate(member.joinedAt)}</small>
            </div>
            <span className={`role-badge role-${member.role}`}>{member.role}</span>
            {canManage && member.role !== "owner" && onRoleChange && (
              <select aria-label={`Change role for ${member.displayName ?? member.email}`} value={member.role} onChange={(event) => onRoleChange(member.userId, event.target.value)}>
                {TEAM_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            )}
            {canManage && member.role !== "owner" && onRemove && (
              <button type="button" aria-label={`Remove ${member.displayName ?? member.email}`} onClick={() => onRemove(member.userId)}>
                <UserMinus size={15} />
              </button>
            )}
            {member.role === "owner" && <Crown size={15} aria-label="Owner protected" />}
          </article>
        ))}
      </div>
    </section>
  );
}

export function InvitePanel({ team = {}, invites = [], onInvite = async () => {}, onRevoke = async () => {} }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const canInvite = canTeamRole(team.role, "invite_member");

  const submit = async (event) => {
    event.preventDefault();
    await onInvite({ email, role });
    setEmail("");
    setRole("member");
  };

  return (
    <section className="team-panel">
      <div className="team-panel-head">
        <h2>Invites</h2>
        <span>{invites.length} pending</span>
      </div>
      {canInvite && (
        <form className="invite-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {TEAM_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="submit"><Mail size={16} /> Send Invite</button>
        </form>
      )}
      <div className="invite-list">
        {invites.length === 0 ? <EmptyTeamState label="No pending invites." /> : invites.map((invite) => (
          <article key={invite.id} className="invite-row">
            <div>
              <strong>{invite.email}</strong>
              <small>{invite.role} - expires {formatDate(invite.expiresAt)}</small>
            </div>
            {invite.acceptUrl && (
              <button type="button" aria-label={`Copy invite for ${invite.email}`} onClick={() => copyText(invite.acceptUrl)}>
                <Copy size={15} />
              </button>
            )}
            {canInvite && <button type="button" onClick={() => onRevoke(invite.id)}>Revoke</button>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function AssigneeSelector({ members = [], value = "", onChange = () => {}, disabled = false }) {
  return (
    <label className="assignee-selector">
      Assignee
      <select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>{member.displayName ?? member.email}</option>
        ))}
      </select>
    </label>
  );
}

export function TeamActivityFeed({ events = [], members = [] }) {
  const [memberFilter, setMemberFilter] = useState("all");
  const filteredEvents = useMemo(() => events.filter((event) => memberFilter === "all" || event.actorUserId === memberFilter), [events, memberFilter]);

  return (
    <section className="team-panel">
      <div className="team-panel-head">
        <h2>Activity</h2>
        <select aria-label="Filter activity by member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
          <option value="all">All members</option>
          {members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName ?? member.email}</option>)}
        </select>
      </div>
      <div className="team-activity-list">
        {filteredEvents.length === 0 ? <EmptyTeamState label="No activity yet." /> : filteredEvents.map((event) => (
          <article key={event.id} className="team-activity-item">
            <AvatarInitial name={event.actorName} />
            <span>{event.actorName} {event.action} {event.itemName} <small>{timeAgo(event.createdAt)}</small></span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function InviteAcceptPage({ token, isAuthenticated = false }) {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    previewInvite(token)
      .then((nextInvite) => {
        if (isMounted) setInvite(nextInvite);
      })
      .catch((inviteError) => {
        if (isMounted) setError(inviteError.message);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!invite || !isAuthenticated) return;
    let isMounted = true;
    setIsAccepting(true);
    acceptInvite(token)
      .then((accepted) => {
        if (isMounted) navigate(`/team/${accepted.team.slug}`);
      })
      .catch((inviteError) => {
        if (isMounted) setError(inviteError.message);
      })
      .finally(() => {
        if (isMounted) setIsAccepting(false);
      });
    return () => {
      isMounted = false;
    };
  }, [invite, isAuthenticated, token]);

  const redirect = encodeURIComponent(`/invite/${token}`);
  const accept = async () => {
    setIsAccepting(true);
    try {
      const accepted = await acceptInvite(token);
      navigate(`/team/${accepted.team.slug}`);
    } catch (inviteError) {
      setError(inviteError.message);
    } finally {
      setIsAccepting(false);
    }
  };

  if (error) return <TeamError message={error} />;
  if (!invite) return <TeamLoading label="Loading invite" />;

  const loginHref = `/login?redirect=${redirect}`;
  const registerHref = `/register?redirect=${redirect}`;
  const inviteIsForNewAccount = invite.recipientExists === false;

  return (
    <main className="team-page">
      <section className="team-panel invite-accept-panel">
        <span className="micro-label">Team invite</span>
        <h1>{invite.teamName}</h1>
        <p>
          {invite.inviterName} invited you to join {invite.teamName} as {invite.role}.{" "}
          {inviteIsForNewAccount
            ? `Create an account to join ${invite.teamName}; Northwatch will keep your personal workspace and add this team workspace after sign up.`
            : "Sign in with the invited email, or create an account if this is your first time here."}
        </p>
        {!isAuthenticated ? (
          <div className="auth-choice-actions">
            {inviteIsForNewAccount ? (
              <>
                <a href={registerHref}>Sign up to join</a>
                <a href={loginHref}>Already have an account? Sign in</a>
              </>
            ) : (
              <>
                <a href={loginHref}>Sign in to join</a>
                <a href={registerHref}>Need an account? Sign up</a>
              </>
            )}
          </div>
        ) : (
          <button type="button" onClick={accept} disabled={isAccepting}>
            <Check size={16} /> {isAccepting ? "Accepting" : "Accept Invite"}
          </button>
        )}
      </section>
    </main>
  );
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const reload = async () => {
    const next = await listNotifications();
    setNotifications(next.notifications ?? []);
    setUnreadCount(next.unreadCount ?? 0);
  };

  useEffect(() => {
    void reload().catch(() => {
      setNotifications([]);
      setUnreadCount(0);
    });
  }, []);

  const markRead = async () => {
    await markNotificationsRead();
    await reload();
  };

  return (
    <div className="notification-bell">
      <button type="button" aria-label={`Notifications ${unreadCount} unread`} onClick={() => setIsOpen((value) => !value)}>
        <Bell size={16} />
        {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="notification-menu">
          <div className="notification-menu-head">
            <strong>Notifications</strong>
            {notifications.length > 0 && <button type="button" onClick={markRead}>Mark all as read</button>}
          </div>
          {notifications.length === 0 ? <EmptyTeamState label="Nothing new." /> : notifications.map((notification) => (
            <a className={notification.isRead ? "read" : "unread"} href={notification.link ?? "#"} key={notification.id}>
              <span>{notification.message}</span>
              <small>{timeAgo(notification.createdAt)}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamPermissionsHelp() {
  return (
    <div className="team-permissions-list">
      {Object.entries(TEAM_PERMISSIONS).map(([permission, roles]) => (
        <span key={permission}>{permission}: {roles.join(", ")}</span>
      ))}
    </div>
  );
}

function TeamLoading({ label }) {
  return (
    <main className="team-page">
      <section className="team-panel"><p>{label}</p></section>
    </main>
  );
}

function TeamError({ message }) {
  return (
    <main className="team-page">
      <section className="team-panel" role="alert"><p>{message}</p></section>
    </main>
  );
}

function EmptyTeamState({ label }) {
  return (
    <div className="team-empty-state">
      <FileText size={22} />
      <span>{label}</span>
    </div>
  );
}

function AvatarInitial({ name }) {
  const initial = String(name ?? "N").trim().slice(0, 1).toUpperCase() || "N";
  return <span className="team-avatar">{initial}</span>;
}

function navigate(path) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function timeAgo(value) {
  if (!value) return "";
  const deltaMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function copyText(value) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value);
  }
}
