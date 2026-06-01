# Northwatch Express Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cookie-based multi-user registration, login, logout, refresh, and protected-user isolation for Northwatch.

**Architecture:** Add a focused Express backend under `server/` with injectable services for auth and user-scoped data routes. Add React auth context/pages under `src/auth/`, then render the current dashboard behind a protected wrapper while leaving the existing app modules intact. PostgreSQL RLS is supplied through a migration that uses `app.current_user_id` plus backend queries that always filter by `user_id`.

**Tech Stack:** React + Vite, Express, PostgreSQL via `pg`, JWT, bcrypt-compatible hashing with 12 rounds, httpOnly cookies, Vitest, Testing Library, Supertest.

---

### Task 1: Backend Auth Tests

**Files:**
- Create: `server/auth/validation.test.js`
- Create: `server/auth/authService.test.js`
- Create: `server/middleware/authenticate.test.js`

- [ ] **Step 1: Write validation tests**

```js
import { describe, expect, it } from "vitest";
import { validateLoginInput, validateRegistrationInput } from "./validation.js";

describe("auth validation", () => {
  it("accepts a normalized registration payload", () => {
    expect(validateRegistrationInput({ email: " User@Example.COM ", displayName: " Sam ", password: "Watch123", confirmPassword: "Watch123" })).toEqual({
      ok: true,
      value: { email: "user@example.com", displayName: "Sam", password: "Watch123" }
    });
  });

  it("rejects weak passwords and mismatched confirmation", () => {
    expect(validateRegistrationInput({ email: "bad", displayName: "", password: "weak", confirmPassword: "other" }).ok).toBe(false);
  });

  it("validates login input without returning unsafe fields", () => {
    expect(validateLoginInput({ email: " User@Example.COM ", password: "Watch123", rememberMe: true })).toEqual({
      ok: true,
      value: { email: "user@example.com", password: "Watch123", rememberMe: true }
    });
  });
});
```

- [ ] **Step 2: Run validation test to verify RED**

Run: `npm test -- --run server/auth/validation.test.js`

Expected: FAIL because `server/auth/validation.js` does not exist.

- [ ] **Step 3: Write auth service tests**

```js
import { describe, expect, it } from "vitest";
import { createAuthService } from "./authService.js";

describe("auth service", () => {
  it("registers a user with a hashed password and returns a cookie session", async () => {
    const db = createMemoryAuthDb();
    const service = createAuthService({ db, jwtSecret: "test-secret", now: () => new Date("2026-05-19T08:00:00.000Z") });
    const result = await service.register({ email: "new@northwatch.dev", displayName: "New User", password: "Watch123", rememberMe: true, ipAddress: "127.0.0.1" });
    expect(result.user).toMatchObject({ email: "new@northwatch.dev", displayName: "New User" });
    expect(result.user.passwordHash).toBeUndefined();
    expect(db.users[0].password_hash).not.toBe("Watch123");
    expect(result.cookie.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("locks login after five failed attempts per IP in fifteen minutes", async () => {
    const db = createMemoryAuthDb([{ email: "user@northwatch.dev", password: "Watch123", displayName: "User" }]);
    const service = createAuthService({ db, jwtSecret: "test-secret", now: () => new Date("2026-05-19T08:00:00.000Z") });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.login({ email: "user@northwatch.dev", password: "Wrong123", rememberMe: true, ipAddress: "10.0.0.1" })).rejects.toMatchObject({ status: attempt === 4 ? 429 : 401 });
    }
    await expect(service.login({ email: "user@northwatch.dev", password: "Watch123", rememberMe: true, ipAddress: "10.0.0.1" })).rejects.toMatchObject({ status: 429 });
  });
});
```

- [ ] **Step 4: Run auth service test to verify RED**

Run: `npm test -- --run server/auth/authService.test.js`

Expected: FAIL because `server/auth/authService.js` does not exist.

- [ ] **Step 5: Write authenticate middleware tests**

```js
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate } from "./authenticate.js";

describe("authenticate middleware", () => {
  it("returns 401 and clears cookie for missing tokens", async () => {
    const app = express();
    app.get("/private", authenticate({ authService: { verifyRequest: async () => null } }), (_req, res) => res.json({ ok: true }));
    const response = await request(app).get("/private").expect(401);
    expect(response.headers["set-cookie"].join(";")).toContain("northwatch_session=;");
  });
});
```

- [ ] **Step 6: Run middleware test to verify RED**

Run: `npm test -- --run server/middleware/authenticate.test.js`

Expected: FAIL because middleware is missing.

### Task 2: Backend Implementation

**Files:**
- Create: `server/auth/validation.js`
- Create: `server/auth/cookies.js`
- Create: `server/auth/authService.js`
- Create: `server/db/postgres.js`
- Create: `server/middleware/authenticate.js`
- Create: `server/routes/auth.js`
- Create: `server/routes/userData.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Modify: `package.json`

- [ ] **Step 1: Install backend dependencies**

Run: `npm install express pg bcryptjs jsonwebtoken cookie-parser cors helmet supertest`

Expected: dependencies are added to `package.json` and `package-lock.json`.

- [ ] **Step 2: Implement validation and cookie helpers**

Create validation helpers that normalize email, trim display name, require password length 8, one uppercase, one number, and never pass untrusted `user_id`. Cookie helpers set or clear `northwatch_session` with `httpOnly`, `sameSite=lax`, `secure` in production, path `/`, and `maxAge` only when `rememberMe` is true.

- [ ] **Step 3: Implement auth service**

Implement register, login, logout, refresh, me, and verifyRequest. Use bcrypt salt rounds 12, signed JWTs with `sub`, `jti`, `email`, `displayName`, and 7-day expiry, persisted `user_sessions`, DB-backed failed login count, and revoked session checks.

- [ ] **Step 4: Implement middleware and routes**

Expose `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`. Protected user-data routes must call `authenticate`, attach `req.userId`, and use only `req.userId` from the verified JWT.

- [ ] **Step 5: Run backend tests**

Run: `npm test -- --run server/auth/validation.test.js server/auth/authService.test.js server/middleware/authenticate.test.js`

Expected: PASS.

### Task 3: PostgreSQL RLS Migration

**Files:**
- Create: `server/db/northwatch_auth_rls.sql`

- [ ] **Step 1: Write migration**

The migration creates `users`, `user_sessions`, `auth_login_failures`, and ensures `kanban_cards`, `projects`, `content_queue`, `documents`, `activity_feed`, `agent_configs`, and `api_tokens` have `user_id uuid not null references users(id) on delete cascade`. Enable and force RLS on all user-data tables.

- [ ] **Step 2: Add policies**

For each user-data table, create select/insert/update/delete policies using:

```sql
user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
```

- [ ] **Step 3: Add tests for schema text**

Create `server/db/northwatch_auth_rls.test.js` that reads the SQL and asserts the required tables, `enable row level security`, `force row level security`, and each policy exists.

### Task 4: React Auth Shell

**Files:**
- Create: `src/auth/api.ts`
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/AuthPages.tsx`
- Create: `src/auth/ProtectedRoute.tsx`
- Create: `src/auth/ProtectedNorthwatch.tsx`
- Create: `src/auth/AuthContext.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Write React auth tests**

Test that `/login` posts credentials with `rememberMe`, `/register` validates confirmation, protected routes show a spinner during `/auth/me`, authenticated users see their display name and avatar initial, logout calls `/auth/logout`, and mid-session 401 shows “Session expired. Please log in again.”

- [ ] **Step 2: Run React auth tests to verify RED**

Run: `npm test -- --run src/auth/AuthContext.test.tsx`

Expected: FAIL because auth shell files are missing.

- [ ] **Step 3: Implement React auth API/context/pages**

Use `credentials: "include"` for every auth request, never localStorage for JWTs, and expose `{ user, isAuthenticated, isLoading, login, register, logout, refresh, sessionExpired }`.

- [ ] **Step 4: Wire current App behind protected wrapper**

Render `/login`, `/register`, and all other paths as protected. Pass authenticated user into the current top bar so it shows display name and avatar initial, plus a logout button.

- [ ] **Step 5: Run React tests**

Run: `npm test -- --run src/auth/AuthContext.test.tsx src/App.test.tsx`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- Modify as needed from previous tasks only.

- [ ] **Step 1: Run full tests**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Browser check**

Open local Vite app, verify login page, register page, loading state, protected app shell, top-right display name, logout, and session expired modal.
