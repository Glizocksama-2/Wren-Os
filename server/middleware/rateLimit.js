export function createDefaultRateLimitRules(env = process.env) {
  return {
    auth: {
      limit: readPositiveInteger(env.RATE_LIMIT_AUTH_MAX, 30),
      windowMs: readPositiveInteger(env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000)
    },
    intel_refresh: {
      limit: readPositiveInteger(env.RATE_LIMIT_INTEL_REFRESH_MAX, 20),
      windowMs: readPositiveInteger(env.RATE_LIMIT_INTEL_REFRESH_WINDOW_MS, 5 * 60 * 1000)
    },
    team_mutation: {
      limit: readPositiveInteger(env.RATE_LIMIT_TEAM_MUTATION_MAX, 60),
      windowMs: readPositiveInteger(env.RATE_LIMIT_TEAM_MUTATION_WINDOW_MS, 5 * 60 * 1000)
    },
    external_api: {
      limit: readPositiveInteger(env.RATE_LIMIT_EXTERNAL_API_MAX, 60),
      windowMs: readPositiveInteger(env.RATE_LIMIT_EXTERNAL_API_WINDOW_MS, 5 * 60 * 1000)
    }
  };
}

export function createRateLimitMiddleware({
  store,
  rules = createDefaultRateLimitRules(),
  resolveRule = resolveDefaultRateLimitRule,
  now = () => new Date(),
  logger
} = {}) {
  if (!store) {
    return (_request, _response, next) => next();
  }

  return async function rateLimit(request, response, next) {
    const routeGroup = resolveRule(request);
    const rule = routeGroup ? rules[routeGroup] : null;
    if (!routeGroup || !rule) {
      next();
      return;
    }

    try {
      const result = await store.hit({
        bucketKey: getBucketKey(request),
        routeGroup,
        limit: rule.limit,
        windowMs: rule.windowMs,
        now: now()
      });
      setRateLimitHeaders(response, result);

      if (result.allowed) {
        next();
        return;
      }

      response.setHeader("Retry-After", String(result.retryAfterSeconds));
      response.status(429).json({
        error: "Too many requests. Please retry shortly.",
        requestId: request.requestId,
        retryAfterSeconds: result.retryAfterSeconds
      });
    } catch (error) {
      logger?.warn?.({
        event: "rate_limit_store_error",
        requestId: request.requestId,
        routeGroup,
        message: error instanceof Error ? error.message : String(error)
      });
      next();
    }
  };
}

export function createMemoryRateLimitStore({ now = () => new Date() } = {}) {
  const buckets = new Map();
  return {
    async hit(input) {
      const current = new Date(input.now ?? now()).getTime();
      const windowStartMs = Math.floor(current / input.windowMs) * input.windowMs;
      const resetAt = new Date(windowStartMs + input.windowMs);
      const key = `${input.routeGroup}:${input.bucketKey}`;
      const existing = buckets.get(key);
      const bucket = existing?.windowStartMs === windowStartMs ? existing : { count: 0, windowStartMs };
      bucket.count += 1;
      buckets.set(key, bucket);
      return buildRateLimitResult({
        count: bucket.count,
        limit: input.limit,
        resetAt,
        nowMs: current
      });
    }
  };
}

export function createPostgresRateLimitStore(pool) {
  return {
    async hit(input) {
      const current = new Date(input.now).getTime();
      const windowStart = new Date(Math.floor(current / input.windowMs) * input.windowMs);
      const resetAt = new Date(windowStart.getTime() + input.windowMs);
      const result = await pool.query(
        `insert into api_rate_limits (bucket_key, route_group, window_start, count, updated_at)
         values ($1, $2, $3, 1, now())
         on conflict (bucket_key, route_group) do update
         set count = case
               when api_rate_limits.window_start < excluded.window_start then 1
               else api_rate_limits.count + 1
             end,
             window_start = greatest(api_rate_limits.window_start, excluded.window_start),
             updated_at = now()
         returning count, window_start`,
        [input.bucketKey, input.routeGroup, windowStart.toISOString()]
      );
      const row = result.rows[0] ?? { count: 1 };
      return buildRateLimitResult({
        count: Number(row.count ?? 1),
        limit: input.limit,
        resetAt,
        nowMs: current
      });
    }
  };
}

export function resolveDefaultRateLimitRule(request) {
  const path = getPathname(request);
  const method = String(request.method ?? "GET").toUpperCase();
  if (method === "POST" && (path === "/auth/login" || path === "/auth/register" || path === "/api/auth/login" || path === "/api/auth/register")) {
    return "auth";
  }
  if (method === "POST" && path.startsWith("/api/intel/refresh")) {
    return "intel_refresh";
  }
  if (["POST", "PATCH", "DELETE"].includes(method) && (path.startsWith("/api/teams") || path.startsWith("/api/invites"))) {
    return "team_mutation";
  }
  if (path.startsWith("/api/system-ai") || path.startsWith("/api/workout") || path.startsWith("/api/weather") || path.startsWith("/api/telegram")) {
    return "external_api";
  }
  return null;
}

function setRateLimitHeaders(response, result) {
  response.setHeader("X-RateLimit-Limit", String(result.limit));
  response.setHeader("X-RateLimit-Remaining", String(result.remaining));
  response.setHeader("X-RateLimit-Reset", result.resetAt);
}

function buildRateLimitResult({ count, limit, resetAt, nowMs }) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - nowMs) / 1000));
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
    resetAt: resetAt.toISOString()
  };
}

function getBucketKey(request) {
  const ip = request.ip || request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.get?.("user-agent") ?? request.headers?.["user-agent"] ?? "unknown";
  return `${ip}:${String(userAgent).slice(0, 120)}`;
}

function getPathname(request) {
  if (request.path) return request.path;
  return new URL(request.url ?? "/", "http://northwatch.local").pathname;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
