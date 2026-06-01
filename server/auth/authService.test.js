import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createAuthService } from "./authService.js";

describe("auth service", () => {
  it("registers a user with bcrypt hashing, a signed session, and no password hash in the response", async () => {
    const db = await createMemoryAuthDb();
    const service = createAuthService({ db, jwtSecret: "test-secret", now: fixedNow });

    const result = await service.register({
      email: "new@northwatch.dev",
      displayName: "New User",
      password: "Watchtower1",
      rememberMe: true,
      ipAddress: "127.0.0.1",
      userAgent: "vitest"
    });

    expect(result.user).toEqual({
      id: expect.any(String),
      email: "new@northwatch.dev",
      displayName: "New User",
      createdAt: fixedNow().toISOString(),
      lastLogin: fixedNow().toISOString(),
      isActive: true
    });
    expect(result.user.passwordHash).toBeUndefined();
    expect(db.users[0].password_hash).not.toBe("Watchtower1");
    expect(await bcrypt.compare("Watchtower1", db.users[0].password_hash)).toBe(true);
    expect(result.cookie.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    expect(db.sessions).toHaveLength(1);
  });

  it("creates a browser-session cookie when remember me is off", async () => {
    const db = await createMemoryAuthDb();
    const service = createAuthService({ db, jwtSecret: "test-secret", now: fixedNow });

    const result = await service.register({
      email: "session@northwatch.dev",
      displayName: "Session User",
      password: "Watchtower1",
      rememberMe: false,
      ipAddress: "127.0.0.1"
    });

    expect(result.cookie.maxAge).toBeUndefined();
    expect(db.sessions[0].remember_me).toBe(false);
  });

  it("locks login after five failed attempts per IP in fifteen minutes", async () => {
    const db = await createMemoryAuthDb([{ email: "user@northwatch.dev", password: "Watchtower1", displayName: "User" }]);
    const service = createAuthService({ db, jwtSecret: "test-secret", now: fixedNow });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({
          email: "user@northwatch.dev",
          password: "Wrongpass1",
          rememberMe: true,
          ipAddress: "10.0.0.1"
        })
      ).rejects.toMatchObject({ status: attempt === 4 ? 429 : 401 });
    }

    await expect(
      service.login({
        email: "user@northwatch.dev",
        password: "Watchtower1",
        rememberMe: true,
        ipAddress: "10.0.0.1"
      })
    ).rejects.toMatchObject({ status: 429 });
  }, 15000);

  it("verifies active JWT sessions, rejects revoked sessions, and refreshes near expiry", async () => {
    const db = await createMemoryAuthDb([{ email: "user@northwatch.dev", password: "Watchtower1", displayName: "User" }]);
    let currentNow = fixedNow();
    const service = createAuthService({ db, jwtSecret: "test-secret", now: () => currentNow });
    const login = await service.login({
      email: "user@northwatch.dev",
      password: "Watchtower1",
      rememberMe: true,
      ipAddress: "127.0.0.1"
    });

    await expect(service.verifyToken(login.token)).resolves.toMatchObject({
      userId: db.users[0].id,
      user: { email: "user@northwatch.dev" }
    });

    currentNow = new Date("2026-05-25T10:00:00.000Z");
    const refresh = await service.refresh(login.token, { ipAddress: "127.0.0.1", userAgent: "vitest" });
    expect(refresh.token).not.toBe(login.token);
    expect(db.sessions.find((session) => session.token_jti === login.session.jti).revoked_at).toBe(currentNow.toISOString());

    await service.logout(refresh.token);
    await expect(service.verifyToken(refresh.token)).rejects.toMatchObject({ status: 401 });
  });
});

function fixedNow() {
  return new Date("2026-05-19T08:00:00.000Z");
}

async function createMemoryAuthDb(seedUsers = []) {
  const db = {
    users: [],
    sessions: [],
    failures: [],
    async findUserByEmail(email) {
      return this.users.find((user) => user.email === email) ?? null;
    },
    async findUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },
    async createUser({ email, passwordHash, displayName, createdAt }) {
      const user = {
        id: `user-${this.users.length + 1}`,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        created_at: createdAt,
        last_login: null,
        is_active: true
      };
      this.users.push(user);
      return user;
    },
    async updateLastLogin(userId, lastLogin) {
      const user = this.users.find((item) => item.id === userId);
      if (user) user.last_login = lastLogin;
    },
    async createSession(session) {
      this.sessions.push(session);
      return session;
    },
    async findSessionByJti(jti) {
      return this.sessions.find((session) => session.token_jti === jti) ?? null;
    },
    async revokeSession(jti, revokedAt) {
      const session = this.sessions.find((item) => item.token_jti === jti);
      if (session) session.revoked_at = revokedAt;
    },
    async findRecentLoginFailures(ipAddress, since) {
      return this.failures.filter((failure) => failure.ip_address === ipAddress && new Date(failure.created_at) >= new Date(since));
    },
    async recordLoginFailure({ ipAddress, email, createdAt }) {
      this.failures.push({ ip_address: ipAddress, email, created_at: createdAt });
    },
    async clearLoginFailures(ipAddress) {
      this.failures = this.failures.filter((failure) => failure.ip_address !== ipAddress);
    }
  };

  for (const user of seedUsers) {
    db.users.push({
      id: `user-${db.users.length + 1}`,
      email: user.email,
      password_hash: await bcrypt.hash(user.password, 12),
      display_name: user.displayName,
      created_at: fixedNow().toISOString(),
      last_login: null,
      is_active: true
    });
  }

  return db;
}
