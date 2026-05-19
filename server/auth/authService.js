import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_MAX_AGE_MS } from "./cookies.js";

const BCRYPT_SALT_ROUNDS = 12;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createAuthService({ db, jwtSecret = process.env.JWT_SECRET, now = () => new Date() }) {
  if (!db) throw new Error("Auth service requires a database adapter.");
  if (!jwtSecret) throw new Error("JWT_SECRET is required.");

  const currentDate = () => now();

  async function register({ email, displayName, password, rememberMe = true, ipAddress = "", userAgent = "" }) {
    const existing = await db.findUserByEmail(email);
    if (existing) {
      throw httpError(409, "An account already exists for this email.");
    }

    const createdAt = currentDate().toISOString();
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await db.createUser({ email, displayName, passwordHash, createdAt });
    await db.updateLastLogin(user.id, createdAt);
    const session = await createSessionForUser(user, { rememberMe, ipAddress, userAgent });
    await db.clearLoginFailures(ipAddress);

    return {
      user: sanitizeUser({ ...user, last_login: createdAt }),
      token: session.token,
      session,
      cookie: rememberMe ? { maxAge: ACCESS_TOKEN_MAX_AGE_MS } : {},
      expiresAt: session.expiresAt
    };
  }

  async function login({ email, password, rememberMe = true, ipAddress = "", userAgent = "" }) {
    await assertLoginAllowed(ipAddress);

    const user = await db.findUserByEmail(email);
    const passwordMatches = user?.is_active ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !passwordMatches) {
      await db.recordLoginFailure({ ipAddress, email, createdAt: currentDate().toISOString() });
      const recentFailures = await getRecentFailures(ipAddress);
      if (recentFailures.length >= LOGIN_FAILURE_LIMIT) {
        throw httpError(429, "Too many failed login attempts. Try again in 15 minutes.");
      }
      throw httpError(401, "Invalid email or password.");
    }

    const lastLogin = currentDate().toISOString();
    await db.updateLastLogin(user.id, lastLogin);
    await db.clearLoginFailures(ipAddress);
    const session = await createSessionForUser({ ...user, last_login: lastLogin }, { rememberMe, ipAddress, userAgent });

    return {
      user: sanitizeUser({ ...user, last_login: lastLogin }),
      token: session.token,
      session,
      cookie: rememberMe ? { maxAge: ACCESS_TOKEN_MAX_AGE_MS } : {},
      expiresAt: session.expiresAt
    };
  }

  async function logout(token) {
    const decoded = decodeToken(token);
    if (decoded?.jti) {
      await db.revokeSession(decoded.jti, currentDate().toISOString());
    }
  }

  async function refresh(token, { ipAddress = "", userAgent = "" } = {}) {
    const verified = await verifyToken(token);
    const remainingMs = new Date(verified.expiresAt).getTime() - currentDate().getTime();
    if (remainingMs > REFRESH_WINDOW_MS) {
      return {
        ...verified,
        token,
        rotated: false,
        cookie: verified.rememberMe ? { maxAge: ACCESS_TOKEN_MAX_AGE_MS } : {}
      };
    }

    await db.revokeSession(verified.session.jti, currentDate().toISOString());
    const nextSession = await createSessionForUser(
      {
        id: verified.userId,
        email: verified.user.email,
        display_name: verified.user.displayName,
        created_at: verified.user.createdAt,
        last_login: verified.user.lastLogin,
        is_active: true
      },
      { rememberMe: verified.rememberMe, ipAddress, userAgent }
    );

    return {
      userId: verified.userId,
      user: verified.user,
      session: nextSession,
      token: nextSession.token,
      expiresAt: nextSession.expiresAt,
      rememberMe: verified.rememberMe,
      rotated: true,
      cookie: verified.rememberMe ? { maxAge: ACCESS_TOKEN_MAX_AGE_MS } : {}
    };
  }

  async function verifyRequest(request) {
    const token = request.cookies?.northwatch_session ?? getBearerToken(request.headers?.authorization);
    if (!token) return null;
    return verifyToken(token);
  }

  async function verifyToken(token) {
    if (!token) throw httpError(401, "Authentication required.");

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret, { clockTimestamp: toUnixSeconds(currentDate()) });
    } catch {
      throw httpError(401, "Session expired.");
    }

    const session = await db.findSessionByJti(payload.jti);
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= currentDate().getTime()) {
      throw httpError(401, "Session expired.");
    }

    const user = await db.findUserById(payload.sub);
    if (!user?.is_active) {
      throw httpError(401, "Account is inactive.");
    }

    return {
      userId: user.id,
      user: sanitizeUser(user),
      session: {
        id: session.id,
        jti: session.token_jti
      },
      expiresAt: session.expires_at,
      rememberMe: Boolean(session.remember_me),
      payload
    };
  }

  async function assertLoginAllowed(ipAddress) {
    const recentFailures = await getRecentFailures(ipAddress);
    if (recentFailures.length >= LOGIN_FAILURE_LIMIT) {
      throw httpError(429, "Too many failed login attempts. Try again in 15 minutes.");
    }
  }

  async function getRecentFailures(ipAddress) {
    const since = new Date(currentDate().getTime() - LOGIN_FAILURE_WINDOW_MS).toISOString();
    return db.findRecentLoginFailures(ipAddress, since);
  }

  async function createSessionForUser(user, { rememberMe, ipAddress, userAgent }) {
    const issuedAt = currentDate();
    const expiresAt = new Date(issuedAt.getTime() + ACCESS_TOKEN_MAX_AGE_MS).toISOString();
    const jti = randomUUID();
    const token = jwt.sign(
      {
        sub: user.id,
        jti,
        email: user.email,
        displayName: user.display_name,
        iat: toUnixSeconds(issuedAt),
        exp: toUnixSeconds(new Date(expiresAt))
      },
      jwtSecret,
      { noTimestamp: true }
    );
    const session = {
      id: randomUUID(),
      user_id: user.id,
      token_jti: jti,
      created_at: issuedAt.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      remember_me: Boolean(rememberMe),
      ip_address: ipAddress || null,
      user_agent: userAgent || null
    };
    await db.createSession(session);
    return {
      ...session,
      jti,
      token,
      expiresAt
    };
  }

  return {
    register,
    login,
    logout,
    refresh,
    verifyRequest,
    verifyToken
  };
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: toIsoString(user.created_at),
    lastLogin: user.last_login ? toIsoString(user.last_login) : null,
    isActive: Boolean(user.is_active)
  };
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeToken(token) {
  if (!token) return null;
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

function getBearerToken(value) {
  if (typeof value !== "string") return null;
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value;
}
