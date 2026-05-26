import pg from "pg";

const { Pool } = pg;
const TELEGRAM_CONFIG_TITLE = "telegram_bot";

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
}

export function createPostgresAuthDb(pool) {
  return {
    async findUserByEmail(email) {
      const result = await pool.query(
        "select id, email, password_hash, display_name, created_at, last_login, is_active from users where email = $1 limit 1",
        [email]
      );
      return result.rows[0] ?? null;
    },
    async findUserById(userId) {
      const result = await pool.query(
        "select id, email, password_hash, display_name, created_at, last_login, is_active from users where id = $1 limit 1",
        [userId]
      );
      return result.rows[0] ?? null;
    },
    async createUser({ email, passwordHash, displayName, createdAt }) {
      const result = await pool.query(
        `insert into users (email, password_hash, display_name, created_at, is_active)
         values ($1, $2, $3, $4, true)
         returning id, email, password_hash, display_name, created_at, last_login, is_active`,
        [email, passwordHash, displayName, createdAt]
      );
      return result.rows[0];
    },
    async updateLastLogin(userId, lastLogin) {
      await pool.query("update users set last_login = $2 where id = $1", [userId, lastLogin]);
    },
    async createSession(session) {
      await pool.query(
        `insert into user_sessions (id, user_id, token_jti, created_at, expires_at, revoked_at, remember_me, ip_address, user_agent)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.id,
          session.user_id,
          session.token_jti,
          session.created_at,
          session.expires_at,
          session.revoked_at,
          session.remember_me,
          session.ip_address,
          session.user_agent
        ]
      );
      return session;
    },
    async findSessionByJti(jti) {
      const result = await pool.query(
        "select id, user_id, token_jti, created_at, expires_at, revoked_at, remember_me, ip_address, user_agent from user_sessions where token_jti = $1 limit 1",
        [jti]
      );
      return result.rows[0] ?? null;
    },
    async revokeSession(jti, revokedAt) {
      await pool.query("update user_sessions set revoked_at = $2 where token_jti = $1", [jti, revokedAt]);
    },
    async findRecentLoginFailures(ipAddress, since) {
      const result = await pool.query(
        "select id, ip_address, email, created_at from auth_login_failures where ip_address = $1 and created_at >= $2",
        [ipAddress, since]
      );
      return result.rows;
    },
    async recordLoginFailure({ ipAddress, email, createdAt }) {
      await pool.query("insert into auth_login_failures (ip_address, email, created_at) values ($1, $2, $3)", [ipAddress, email, createdAt]);
    },
    async clearLoginFailures(ipAddress) {
      await pool.query("delete from auth_login_failures where ip_address = $1", [ipAddress]);
    }
  };
}

export function createPostgresUserDataDb(pool) {
  async function withUserContext(userId, work) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async list(table, userId, options = {}) {
      return withUserContext(userId, async (client) => {
        const workspace = normalizeWorkspaceScope(options.workspace);
        const result = workspace.type === "team"
          ? await client.query(
              `select id, user_id, workspace_type, team_id, title, payload, created_at, updated_at
               from ${table}
               where workspace_type = 'team' and team_id = $1
               order by updated_at desc, created_at desc`,
              [workspace.teamId]
            )
          : await client.query(
              `select id, user_id, workspace_type, team_id, title, payload, created_at, updated_at
               from ${table}
               where workspace_type = 'personal' and user_id = $1
               order by updated_at desc, created_at desc`,
              [userId]
            );
        return result.rows;
      });
    },
    async create(table, userId, { title, payload, workspace }) {
      return withUserContext(userId, async (client) => {
        const scope = normalizeWorkspaceScope(workspace);
        const result = await client.query(
          `insert into ${table} (user_id, workspace_type, team_id, title, payload)
           values ($1, $2, $3, $4, $5)
           returning id, user_id, workspace_type, team_id, title, payload, created_at, updated_at`,
          [userId, scope.type, scope.type === "team" ? scope.teamId : null, title, payload]
        );
        return result.rows[0];
      });
    },
    async update(table, userId, id, { title, payload, workspace }) {
      return withUserContext(userId, async (client) => {
        const scope = normalizeWorkspaceScope(workspace);
        const result = scope.type === "team"
          ? await client.query(
              `update ${table}
               set title = coalesce($3, title), payload = coalesce($4, payload), updated_at = now()
               where team_id = $1 and id = $2 and workspace_type = 'team'
               returning id, user_id, workspace_type, team_id, title, payload, created_at, updated_at`,
              [scope.teamId, id, title ?? null, payload ?? null]
            )
          : await client.query(
              `update ${table}
               set title = coalesce($3, title), payload = coalesce($4, payload), updated_at = now()
               where user_id = $1 and id = $2 and workspace_type = 'personal'
               returning id, user_id, workspace_type, team_id, title, payload, created_at, updated_at`,
              [userId, id, title ?? null, payload ?? null]
            );
        return result.rows[0] ?? null;
      });
    },
    async delete(table, userId, id, options = {}) {
      return withUserContext(userId, async (client) => {
        const scope = normalizeWorkspaceScope(options.workspace);
        const result = scope.type === "team"
          ? await client.query(`delete from ${table} where team_id = $1 and id = $2 and workspace_type = 'team' returning id`, [scope.teamId, id])
          : await client.query(`delete from ${table} where user_id = $1 and id = $2 and workspace_type = 'personal' returning id`, [userId, id]);
        return result.rowCount > 0;
      });
    },
    async getTelegramConfig(userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `select id, title, payload, created_at, updated_at
           from agent_configs
           where user_id = $1 and title = $2
           limit 1`,
          [userId, TELEGRAM_CONFIG_TITLE]
        );
        return result.rows[0] ?? null;
      });
    },
    async upsertTelegramConfig(userId, payload) {
      return withUserContext(userId, async (client) => {
        const updated = await client.query(
          `update agent_configs
           set payload = $3, updated_at = now()
           where user_id = $1 and title = $2
           returning id, title, payload, created_at, updated_at`,
          [userId, TELEGRAM_CONFIG_TITLE, payload]
        );

        if (updated.rows[0]) {
          return updated.rows[0];
        }

        const inserted = await client.query(
          `insert into agent_configs (user_id, title, payload)
           values ($1, $2, $3)
           returning id, title, payload, created_at, updated_at`,
          [userId, TELEGRAM_CONFIG_TITLE, payload]
        );
        return inserted.rows[0];
      });
    },
    async deleteTelegramConfig(userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query("delete from agent_configs where user_id = $1 and title = $2 returning id", [userId, TELEGRAM_CONFIG_TITLE]);
        return result.rowCount > 0;
      });
    },
    async findLegacyCommandDeckByEmail(email) {
      const result = await pool.query(
        "select deck, updated_at from northwatch_legacy_command_deck_for_email($1) limit 1",
        [email]
      );
      return result.rows[0] ?? null;
    }
  };
}

export function createPostgresTeamDb(pool) {
  async function withUserContext(userId, work, settings = {}) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
      if (settings.inviteToken) {
        await client.query("select set_config('app.current_invite_token', $1, true)", [settings.inviteToken]);
      }
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async function withInviteContext(token, work) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.current_invite_token', $1, true)", [token]);
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async createTeam({ name, slug, ownerId, memberLimit = 10 }) {
      return withUserContext(ownerId, async (client) => {
        const teamResult = await client.query(
          `insert into teams (name, slug, owner_id, member_limit)
           values ($1, $2, $3, $4)
           returning id, name, slug, owner_id, member_limit, created_at, updated_at`,
          [name, slug, ownerId, memberLimit]
        );
        const team = teamResult.rows[0];
        await client.query(
          `insert into team_members (team_id, user_id, role, invited_by)
           values ($1, $2, 'owner', $2)`,
          [team.id, ownerId]
        );
        await insertNotification(client, {
          userId: ownerId,
          type: "team_added",
          message: `You were added to ${team.name}`,
          link: `/team/${team.slug}`
        });
        return { ...mapTeam(team), role: "owner" };
      });
    },

    async listTeamsForUser(userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `select t.id, t.name, t.slug, t.owner_id, t.member_limit, t.created_at, t.updated_at, tm.role
           from team_members tm
           join teams t on t.id = tm.team_id
           where tm.user_id = $1
           order by tm.joined_at desc`,
          [userId]
        );
        return result.rows.map((row) => ({ ...mapTeam(row), role: row.role }));
      });
    },

    async getTeamMembershipBySlug(slug, userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `select t.id, t.name, t.slug, t.owner_id, t.member_limit, t.created_at, t.updated_at,
                  tm.id as membership_id, tm.user_id, tm.role, tm.joined_at, tm.invited_by
           from teams t
           join team_members tm on tm.team_id = t.id
           where t.slug = $1 and tm.user_id = $2
           limit 1`,
          [slug, userId]
        );
        const row = result.rows[0];
        return row ? { team: mapTeam(row), membership: mapMember(row) } : null;
      });
    },

    async getTeamMembershipById(teamId, userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `select t.id, t.name, t.slug, t.owner_id, t.member_limit, t.created_at, t.updated_at,
                  tm.id as membership_id, tm.user_id, tm.role, tm.joined_at, tm.invited_by
           from teams t
           join team_members tm on tm.team_id = t.id
           where t.id = $1 and tm.user_id = $2
           limit 1`,
          [teamId, userId]
        );
        const row = result.rows[0];
        return row ? { team: mapTeam(row), membership: mapMember(row) } : null;
      });
    },

    async getTeamDetailsBySlug(slug, userId) {
      return withUserContext(userId, async (client) => {
        const membership = await client.query(
          `select t.id, t.name, t.slug, t.owner_id, t.member_limit, t.created_at, t.updated_at, tm.role
           from teams t
           join team_members tm on tm.team_id = t.id
           where t.slug = $1 and tm.user_id = $2
           limit 1`,
          [slug, userId]
        );
        const teamRow = membership.rows[0];
        if (!teamRow) return null;
        const members = await listMembers(client, teamRow.id);
        const activityRows = await listOptionalTeamActivity(client, teamRow.id);
        return {
          team: { ...mapTeam(teamRow), role: teamRow.role },
          members,
          activity: activityRows.map(mapTeamActivity)
        };
      });
    },

    async updateTeam(teamId, { name, slug, memberLimit }) {
      const result = await pool.query(
        `update teams
         set name = coalesce(nullif($2, ''), name),
             slug = coalesce(nullif($3, ''), slug),
             member_limit = coalesce($4, member_limit),
             updated_at = now()
         where id = $1
         returning id, name, slug, owner_id, member_limit, created_at, updated_at`,
        [teamId, name ?? "", slug ?? "", memberLimit ?? null]
      );
      return mapTeam(result.rows[0]);
    },

    async deleteTeam(teamId) {
      await pool.query("delete from teams where id = $1", [teamId]);
    },

    async listTeamMembers(teamId) {
      const result = await pool.query(
        `select tm.id as membership_id, tm.team_id, tm.user_id, tm.role, tm.joined_at, tm.invited_by,
                u.email, u.display_name
         from team_members tm
         join users u on u.id = tm.user_id
         where tm.team_id = $1
         order by case tm.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, tm.joined_at`,
        [teamId]
      );
      return result.rows.map(mapMember);
    },

    async updateTeamMemberRole({ teamId, actorUserId, targetUserId, role }) {
      const members = await listMembers(pool, teamId);
      const actor = members.find((member) => member.userId === actorUserId);
      const target = members.find((member) => member.userId === targetUserId);
      if (!actor || !target) throw httpError(404, "Team member not found.");
      if (target.role === "owner" && actor.role !== "owner") throw httpError(403, "Only owners can change an owner role.");
      if (target.role === "owner" && role !== "owner" && members.filter((member) => member.role === "owner").length <= 1) {
        throw httpError(409, "A team must keep at least one owner.");
      }
      const result = await pool.query(
        `update team_members
         set role = $3
         where team_id = $1 and user_id = $2
         returning id as membership_id, team_id, user_id, role, joined_at, invited_by`,
        [teamId, targetUserId, role]
      );
      await insertNotification(pool, {
        userId: targetUserId,
        type: "team_role_changed",
        message: `Your role was changed to ${role}`,
        link: null
      });
      return mapMember(result.rows[0]);
    },

    async removeTeamMember({ teamId, actorUserId, targetUserId }) {
      const members = await listMembers(pool, teamId);
      const target = members.find((member) => member.userId === targetUserId);
      if (!target) throw httpError(404, "Team member not found.");
      if (target.role === "owner") return { removed: false, reason: "owner_protected" };
      await pool.query("delete from team_members where team_id = $1 and user_id = $2", [teamId, targetUserId]);
      if (actorUserId !== targetUserId) {
        await insertNotification(pool, {
          userId: targetUserId,
          type: "team_member_removed",
          message: "You were removed from a Northwatch team",
          link: null
        });
      }
      return { removed: true };
    },

    async createTeamInvite({ teamId, email, role, token, invitedBy, expiresAt }) {
      const result = await pool.query(
        `insert into team_invites (team_id, email, token, role, invited_by, expires_at, status)
         values ($1, $2, $3, $4, $5, $6, 'pending')
         returning id, team_id, email, token, role, invited_by, expires_at, accepted_at, status`,
        [teamId, email, token, role, invitedBy, expiresAt]
      );
      const invite = result.rows[0];
      const context = await pool.query(
        `select t.name as team_name, t.slug as team_slug, u.display_name as invited_by_name
         from teams t
         join users u on u.id = $2
         where t.id = $1`,
        [teamId, invitedBy]
      );
      return mapInvite({ ...invite, ...context.rows[0] });
    },

    async listTeamInvites(teamId) {
      const result = await pool.query(
        `select id, team_id, email, token, role, invited_by, expires_at, accepted_at, status
         from team_invites
         where team_id = $1 and status = 'pending'
         order by expires_at asc`,
        [teamId]
      );
      return result.rows.map(mapInvite);
    },

    async revokeTeamInvite({ teamId, inviteId }) {
      const result = await pool.query(
        `update team_invites set status = 'revoked'
         where team_id = $1 and id = $2 and status = 'pending'
         returning id`,
        [teamId, inviteId]
      );
      return result.rowCount > 0;
    },

    async getTeamInviteByToken(token) {
      return withInviteContext(token, async (client) => {
        const result = await client.query(
          `select ti.id, ti.team_id, ti.email, ti.token, ti.role, ti.invited_by, ti.expires_at, ti.accepted_at, ti.status,
                  t.name as team_name, t.slug as team_slug, t.member_limit,
                  u.display_name as invited_by_name,
                  exists(select 1 from users invitee where lower(invitee.email) = lower(ti.email)) as recipient_exists
           from team_invites ti
           join teams t on t.id = ti.team_id
           join users u on u.id = ti.invited_by
           where ti.token = $1
           limit 1`,
          [token]
        );
        const row = result.rows[0];
        return row ? mapInvitePreview(row) : null;
      });
    },

    async acceptTeamInvite({ token, userId, userEmail }) {
      return withUserContext(userId, async (client) => {
        const inviteResult = await client.query(
          `select ti.id, ti.team_id, ti.email, ti.role, ti.status, ti.expires_at, ti.invited_by,
                  t.name as team_name, t.slug as team_slug, t.member_limit
           from team_invites ti
           join teams t on t.id = ti.team_id
           where ti.token = $1
           limit 1`,
          [token]
        );
        const invite = inviteResult.rows[0];
        if (!invite) throw httpError(404, "Invite not found.");
        if (invite.status !== "pending" || new Date(invite.expires_at).getTime() <= Date.now()) throw httpError(400, "Invite is expired or unavailable.");
        if (userEmail && invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) throw httpError(403, "Invite email does not match this account.");

        const countResult = await client.query("select count(*)::integer as count from team_members where team_id = $1", [invite.team_id]);
        if (countResult.rows[0].count >= invite.member_limit) throw httpError(409, "Team member limit reached.");

        const membershipResult = await client.query(
          `insert into team_members (team_id, user_id, role, invited_by)
           values ($1, $2, $3, $4)
           on conflict (team_id, user_id) do update set role = excluded.role
           returning id as membership_id, team_id, user_id, role, joined_at, invited_by`,
          [invite.team_id, userId, invite.role, invite.invited_by]
        );
        await client.query("update team_invites set status = 'accepted', accepted_at = now() where id = $1", [invite.id]);
        await insertNotification(client, {
          userId,
          type: "team_added",
          message: `You were added to ${invite.team_name}`,
          link: `/team/${invite.team_slug}`
        });
        await insertNotification(client, {
          userId: invite.invited_by,
          type: "team_invite_accepted",
          message: `Your invite to ${invite.email} was accepted`,
          link: `/team/${invite.team_slug}`
        });
        return {
          team: { id: invite.team_id, name: invite.team_name, slug: invite.team_slug },
          membership: mapMember(membershipResult.rows[0])
        };
      }, { inviteToken: token });
    },

    async listNotifications(userId) {
      const result = await pool.query(
        `select id, user_id, type, message, link, is_read, created_at
         from notifications
         where user_id = $1
         order by created_at desc
         limit 50`,
        [userId]
      );
      return result.rows.map(mapNotification);
    },

    async markAllNotificationsRead(userId) {
      const result = await pool.query("update notifications set is_read = true where user_id = $1 and is_read = false", [userId]);
      return result.rowCount;
    },

    async createNotification(notification) {
      return insertNotification(pool, notification);
    }
  };
}

function normalizeWorkspaceScope(workspace) {
  if (workspace?.type === "team" && workspace.teamId) {
    return { type: "team", teamId: workspace.teamId, role: workspace.role };
  }
  return { type: "personal" };
}

async function listMembers(clientOrPool, teamId) {
  const result = await clientOrPool.query(
    `select tm.id as membership_id, tm.team_id, tm.user_id, tm.role, tm.joined_at, tm.invited_by,
            u.email, u.display_name
     from team_members tm
     join users u on u.id = tm.user_id
     where tm.team_id = $1
     order by case tm.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, tm.joined_at`,
    [teamId]
  );
  return result.rows.map(mapMember);
}

async function listOptionalTeamActivity(clientOrPool, teamId) {
  try {
    const result = await clientOrPool.query(
      `select af.id, af.title as item_name, af.payload, af.created_at, u.display_name as actor_name
       from activity_feed af
       left join users u on u.id = af.user_id
       where af.workspace_type = 'team' and af.team_id = $1
       order by af.created_at desc
       limit 20`,
      [teamId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function insertNotification(clientOrPool, { userId, type, message, link }) {
  const result = await clientOrPool.query(
    `insert into notifications (user_id, type, message, link)
     values ($1, $2, $3, $4)
     returning id, user_id, type, message, link, is_read, created_at`,
    [userId, type, message, link]
  );
  return mapNotification(result.rows[0]);
}

function mapTeam(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    memberLimit: row.member_limit,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapMember(row) {
  if (!row) return null;
  return {
    id: row.membership_id ?? row.id,
    teamId: row.team_id,
    userId: row.user_id,
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    role: row.role,
    joinedAt: toIsoString(row.joined_at),
    invitedBy: row.invited_by ?? null
  };
}

function mapInvite(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    teamSlug: row.team_slug,
    email: row.email,
    token: row.token,
    role: row.role,
    invitedBy: row.invited_by,
    invitedByName: row.invited_by_name,
    expiresAt: toIsoString(row.expires_at),
    acceptedAt: row.accepted_at ? toIsoString(row.accepted_at) : null,
    status: row.status
  };
}

function mapInvitePreview(row) {
  return {
    id: row.id,
    email: row.email,
    token: row.token,
    role: row.role,
    status: row.status,
    expiresAt: toIsoString(row.expires_at),
    team: {
      id: row.team_id,
      name: row.team_name,
      slug: row.team_slug,
      memberLimit: row.member_limit
    },
    inviter: {
      displayName: row.invited_by_name
    },
    recipientExists: row.recipient_exists ?? null
  };
}

function mapTeamActivity(row) {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    actorName: row.actor_name ?? payload.actorName ?? "A teammate",
    action: payload.action ?? payload.eventType ?? "updated",
    itemName: payload.itemName ?? row.item_name ?? row.title ?? "workspace item",
    createdAt: toIsoString(row.created_at)
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    link: row.link,
    isRead: Boolean(row.is_read),
    createdAt: toIsoString(row.created_at)
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value;
}
