# Northwatch Platform Layers

Northwatch is treated as a 13-layer operating platform, not only a React dashboard. This document maps each layer to the code, config, and operational checks that keep the app usable for a real team.

## Layer Map

| Layer | Current anchor | Operational owner note |
| --- | --- | --- |
| 1. Frontend foundations | `src/App.tsx`, `src/auth`, `src/components`, `src/styles` | Keep dashboard, auth, team, and About flows covered by React tests before release. |
| 2. APIs and backend logic | `server/app.js`, `server/routes` | Every API route should return JSON errors with `requestId`; no API route should fall through to the frontend shell. |
| 3. Database and storage | `server/db`, `supabase/migrations` | PostgreSQL is the source of truth for users, sessions, team data, notifications, and rate-limit buckets. |
| 4. Auth and permission | `server/auth`, `server/middleware/authenticate.js`, `shared/teamPermissions.js` | Credential signup remains open; protected routes rely on httpOnly cookies and server-side role checks. |
| 5. Hosting and deployment | `vercel.json`, `api/[...path].js` | Vercel is the canonical production host; Netlify config is legacy fallback only and must not carry secrets. |
| 6. Cloud and compute | Vercel serverless API functions | Keep external API calls timeout-bound; tune Postgres pools with env vars for serverless limits. |
| 7. CI/CD and version control | `.github/workflows/ci.yml` | GitHub Actions runs install, tests, and build on PRs and pushes. |
| 8. Security and low level security | `helmet`, Vercel headers, cookie auth, RLS | Keep secrets in deployment env only; run dependency audits before production releases. |
| 9. Rate limiting | `server/middleware/rateLimit.js`, `api_rate_limits` | Shared Postgres buckets protect auth, team mutations, Intel refresh, and external API-heavy routes. |
| 10. Caching and CDN | Vercel asset cache, Intel cache headers | Static assets are immutable; public Intel GET routes use CDN `s-maxage` and stale revalidation. |
| 11. Load balancing and scaling | Vercel routing, Postgres pool config | Vercel handles routing and serverless fan-out; pool settings prevent database connection spikes. |
| 12. Error tracking and logs | `server/logger.js`, `server/errorTracking.js`, `server/middleware/requestContext.js` | Structured request logs include `requestId`; optional Sentry reporting activates when `SENTRY_DSN` is set. |
| 13. Availability and recovery | `/health`, `/health?deep=1`, Supabase backups | Health checks, rollback, and backup verification are part of the release checklist. |

## Environment Variables

Required production variables remain `DATABASE_URL`, `JWT_SECRET`, `NORTHWATCH_APP_URL`, and the API keys needed by enabled live-data routes. The platform layer adds these optional hardening variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | Controls structured server log verbosity. |
| `PG_POOL_MAX` | `5` | Caps Postgres connections per serverless instance. |
| `PG_IDLE_TIMEOUT_MS` | `10000` | Releases idle Postgres clients quickly. |
| `PG_CONNECTION_TIMEOUT_MS` | `5000` | Fails stalled database connection attempts quickly. |
| `SENTRY_DSN` | unset | Optional Sentry error tracking destination. Structured logs work without it. |
| `RATE_LIMIT_AUTH_MAX` | `30` | Auth requests per bucket/window. |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` | Auth rate-limit window. |
| `RATE_LIMIT_INTEL_REFRESH_MAX` | `20` | Manual Intel refreshes per bucket/window. |
| `RATE_LIMIT_TEAM_MUTATION_MAX` | `60` | Team mutations per bucket/window. |
| `RATE_LIMIT_EXTERNAL_API_MAX` | `60` | AI, weather, workout, Telegram calls per bucket/window. |

## Availability And Recovery Runbook

1. Check `/health` first. It confirms the API process and configured agents without touching the database.
2. Check `/health?deep=1` during incidents. It performs a lightweight `select 1 as ok` against PostgreSQL and returns `503` if the database check fails.
3. If the frontend is live but API calls return HTML, verify `VITE_AUTH_API_BASE_URL`, `vercel.json` rewrites, and the `api/[...path].js` proxy.
4. If teams or invites fail, check the latest Supabase migrations, especially team RLS repairs and `api_rate_limits`.
5. Before a risky deploy, confirm the last successful Vercel deployment and GitHub commit. Roll back through Vercel if production auth, teams, or API routing breaks.
6. Verify Supabase backups from the Supabase dashboard before large schema changes. For manual recovery, export the database, restore into a staging project, then test auth, team creation, invite acceptance, and command deck loading before promoting.

## Release Checklist

- Run `npm run test:run` and `npm run build`.
- Confirm `.env` values are set in Vercel and the backend runtime, not committed to the repo.
- Confirm public Intel GET routes return cache headers and protected refresh routes require auth.
- Confirm one signup, login, logout, team create, invite create, and invite accept flow on staging or local API.
- Confirm logs show request IDs for failed and successful API calls.
