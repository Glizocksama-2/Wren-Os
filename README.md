# Northwatch

Northwatch is a local-first AI agent command center for a solo operator. It brings projects, tasks, agent approvals, automations, content, knowledge, and API contracts into one serious operational dashboard.

## What Is Included

- Command Center dashboard with project health, focus work, risks, agent queue, automation runs, content pipeline, knowledge snippets, and API status.
- Mission Board with draggable task columns and task creation.
- Project portfolio with progress, risk counts, objectives, and linked work.
- Agent Inbox for approving or denying proposed agent actions.
- Automation, Content Studio, Knowledge Base, API Studio, and Settings/Data screens.
- Local-first persistence through versioned `localStorage` workspace data.
- JSON export/import preview, validation, reset guard, and backup controls.
- Obsidian vault folder linking through browser-approved local file access.
- GitHub/Vercel project source snapshots that turn local repo/deploy metadata into workspace memory.
- Vitest coverage for workspace state and the app shell navigation.

## Run Locally

```bash
npm install
npm run dev
```

Run the Express auth API in a second terminal when using cookie-based multi-user auth:

```bash
npm run dev:api
```

## Local Ollama Agent

Sentinel can use a local Ollama model from the floating agent panel. The checked-in default is:

- Endpoint: `http://127.0.0.1:11434`
- Model: `qwen2.5:1.5b`

Start Ollama before opening the app, then make sure the default model is available:

```bash
ollama pull qwen2.5:1.5b
ollama serve
```

On Windows, launching the Ollama desktop app also starts the local server. The Sentinel panel uses the checked-in default endpoint and model when Ollama is reachable, and falls back to built-in deck logic if the server or model is unavailable.

Open the logo button > Customize to change the Sentinel endpoint or model after the app is running.

If the app is served from a different local origin and the browser blocks Ollama, add that origin to `OLLAMA_ORIGINS`, then restart Ollama. For Vite development, allow the current local app origin such as `http://127.0.0.1:5174`, `http://127.0.0.1:5173`, or the matching `localhost` URL.

## Telegram Bot Setup

Every signed-in Northwatch user can connect their own Telegram bot from the logo button > Settings. Bot tokens are saved only on the Express API, encrypted with `TELEGRAM_SECRET_KEY`, and scoped to the authenticated user through the `agent_configs` table.

Required server env for personal bots:

```bash
TELEGRAM_SECRET_KEY=use-at-least-32-random-characters
```

User setup steps:

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, choose a display name, then choose a username ending in `bot`.
3. Copy the HTTP API token BotFather gives you.
4. Open your new bot in Telegram and send it any message. For a group, add the bot to the group and send a message there.
5. Visit `https://api.telegram.org/bot<token>/getUpdates` and copy the `chat.id` value.
6. Paste the token and chat id into Northwatch Settings, save, then send a test.

The authenticated Express routes are `/api/telegram/config` and `/api/telegram/send`. The older Vercel serverless bridge at `/api/telegram/glizocksamabot` can still be configured as a global fallback with `TELEGRAM_WEBHOOK_URL` or `TELEGRAM_BOT_TOKEN` plus `TELEGRAM_CHAT_ID`, and `/health` reports whether that legacy bridge is configured.

To refresh GitHub/Vercel project sources from authenticated local CLIs:

```bash
npm run sources:snapshot
```

Paste the JSON output through the logo button > Settings flow when source import controls are enabled. Browser GitHub sync uses the public repo API for the configured Codex repo; private repo and Vercel project reads should come from the local CLI snapshot so secrets stay out of the static app.

By default the snapshot reads up to 50 repos from `Glizocksama-2` plus the Vercel projects visible to the logged-in Vercel CLI. Set `WREN_GITHUB_OWNER`, `WREN_GITHUB_LIMIT`, or `WREN_GITHUB_REPO` before running the command to narrow or expand the GitHub source.

## Verify

```bash
npm test -- --run
npm run build
```

## Express Password Auth

Northwatch uses an Express auth API for email/password accounts. Signed-out users choose either Sign in or Sign up, then enter credentials. Sessions use httpOnly JWT cookies, seven-day expiry, silent refresh, server-side logout revocation, and per-user PostgreSQL isolation.

Required server env vars:

```bash
DATABASE_URL=postgres://user:password@host:5432/northwatch
JWT_SECRET=use-a-long-random-secret
TELEGRAM_SECRET_KEY=use-at-least-32-random-characters
NORTHWATCH_APP_URL=https://northwatch.app
CORS_ORIGIN=http://127.0.0.1:5173,http://127.0.0.1:5174
PORT=4000
```

Optional frontend env var when the API is on a separate origin:

```bash
VITE_AUTH_API_BASE_URL=http://127.0.0.1:4000
```

Apply the PostgreSQL schema and RLS policies from:

```bash
server/db/northwatch_auth_rls.sql
server/db/northwatch_team_feature.sql
```

Protected API data routes live under `/api/:resource` for `kanban-cards`, `projects`, `content-queue`, `documents`, `activity-feed`, `agent-configs`, and `api-tokens`. The backend ignores any `user_id` sent by the client. Personal queries scope by `req.userId`; team queries require membership and scope by `team_id`.

Optional invite email delivery with Vercel/Resend:

```bash
NORTHWATCH_APP_URL=https://northwatch.app
INVITE_EMAIL_FROM="Northwatch <no-reply@northwatch.app>"
RESEND_API_KEY=server-side-resend-key
```

Optional invite email delivery with SMTP:

```bash
INVITE_EMAIL_FROM="Northwatch <no-reply@northwatch.app>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=provider-password
```

When neither `RESEND_API_KEY` nor `SMTP_HOST` is set, the Express API logs invite links for development. Never prefix mail provider secrets with `VITE_`.

## Local-first Data Warning

Northwatch still stores an offline copy in the current browser's `localStorage`, keyed per signed-in user. Export JSON before clearing browser data, switching profiles, using another device for the first time, or resetting the seed workspace.

## Legal Consent

First use is gated by two explicit checkboxes: agreement to the Terms and Conditions and acknowledgement of the Privacy Policy. The accepted versions are saved in `northwatch.legal-consent.v1` so updated legal copy can request fresh acceptance later. The logo button keeps Account, Customize, Settings, Help, Privacy Policy, and Terms and Conditions in one compact menu instead of exposing Account or Customize on the main rail.

## Personal And Team Workspaces

Signed-in users start in a private personal vault scoped to their Northwatch user id. New signed-in users are seeded with a fresh private deck so a previous browser user's local data is not silently copied into their account.

Team workspaces are handled by the Express API and PostgreSQL RLS. Owners create teams at `/team/create`, admins invite members from `/team/:slug/settings`, and invite recipients complete `/invite/:token` after signing in or registering. Team roles are `owner`, `admin`, `member`, and `viewer`.

The header includes a workspace switcher for Personal plus each team the user belongs to, and a notification bell for team events such as being added, task assignment, and accepted invites.

Migration steps for existing deployments are in `docs/team-migration-guide.md`.

The Codex Bridge is local-first handoff generation only. `/api/codex/handoff` is documented as a future/local contract, not a live hosted server endpoint.

Obsidian vault sync also stays local. Northwatch can read Markdown only after you approve a folder picker prompt in the browser, and auto-sync runs only while the app tab is open.

GitHub and Vercel linking is still metadata-only. Northwatch stores imported project metadata in the command deck; it does not store GitHub tokens, Vercel tokens, API secrets, or service keys.

## Pre-Vercel Checklist

- Run `npm test -- --run`.
- Run `npm run build`.
- Open the app locally and confirm the Terms and Privacy gate appears for a fresh browser profile.
- Confirm Account, Customize, Settings, Help, Privacy Policy, and Terms and Conditions open from the logo button.
- Open the app locally and export a workspace backup from the logo button > Settings flow when source import/export controls are enabled.
- Reload and confirm the workspace persists.
- Import the exported JSON through the preview/confirm flow.
- Confirm the reset guard requires `RESET NORTHWATCH`.
- Run `npm run sources:snapshot`, import the snapshot in Settings, and confirm GitHub/Vercel source counts update.
- Keep the first Vercel version private-use only.

## Link to Netlify

The Netlify project is `northwatch`, with the production URL `https://northwatch.netlify.app`. Netlify reads `netlify.toml`, runs `npm run build`, and publishes `dist`.

For this project, password auth is handled by the Express API. Configure the API origin with `VITE_AUTH_API_BASE_URL` and keep server secrets such as `DATABASE_URL`, `JWT_SECRET`, and `TELEGRAM_SECRET_KEY` out of the Vite client bundle.

After deployment, open the hosted URL, choose Sign up, create a test account, add a test task, sign out, then sign back in with the same email and password.

The approved design spec lives at `docs/superpowers/specs/2026-05-08-wren-os-rebuild-design.md`.
