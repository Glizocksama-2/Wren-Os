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
    async list(table, userId) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `select id, title, payload, created_at, updated_at from ${table} where user_id = $1 order by updated_at desc, created_at desc`,
          [userId]
        );
        return result.rows;
      });
    },
    async create(table, userId, { title, payload }) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `insert into ${table} (user_id, title, payload) values ($1, $2, $3) returning id, title, payload, created_at, updated_at`,
          [userId, title, payload]
        );
        return result.rows[0];
      });
    },
    async update(table, userId, id, { title, payload }) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(
          `update ${table}
           set title = coalesce($3, title), payload = coalesce($4, payload), updated_at = now()
           where user_id = $1 and id = $2
           returning id, title, payload, created_at, updated_at`,
          [userId, id, title ?? null, payload ?? null]
        );
        return result.rows[0] ?? null;
      });
    },
    async delete(table, userId, id) {
      return withUserContext(userId, async (client) => {
        const result = await client.query(`delete from ${table} where user_id = $1 and id = $2 returning id`, [userId, id]);
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
