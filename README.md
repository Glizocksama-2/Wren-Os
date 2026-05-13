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

To refresh GitHub/Vercel project sources from authenticated local CLIs:

```bash
npm run sources:snapshot
```

Paste the JSON output into Settings under `GitHub & Vercel Sources`. Browser GitHub sync uses the public repo API for the configured Codex repo; private repo and Vercel project reads should come from the local CLI snapshot so secrets stay out of the static app.

By default the snapshot reads up to 50 repos from `Glizocksama-2` plus the Vercel projects visible to the logged-in Vercel CLI. Set `WREN_GITHUB_OWNER`, `WREN_GITHUB_LIMIT`, or `WREN_GITHUB_REPO` before running the command to narrow or expand the GitHub source.

## Verify

```bash
npm test -- --run
npm run build
```

## Private Cloud Auth

Northwatch can now run in two modes:

- Without Supabase env vars, it stays local-only and shows `Cloud auth: local fallback`.
- With Supabase env vars, the app locks behind Supabase magic-link auth and syncs one private `command_decks` row per signed-in user.

Create a Supabase project, run the SQL in `supabase/migrations/20260512000000_create_command_decks.sql`, and set:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use the legacy `VITE_SUPABASE_ANON_KEY` only if your project has not moved to publishable keys yet. Never put a `service_role` or secret key in this Vite app.

## Local-first Data Warning

Northwatch still stores an offline copy in the current browser's `localStorage`. With Supabase configured, that local copy is loaded into or replaced by the authenticated cloud row after sign-in. Export JSON before clearing browser data, switching profiles, using another device for the first time, or resetting the seed workspace.

The Codex Bridge is local-first handoff generation only. `/api/codex/handoff` is documented as a future/local contract, not a live hosted server endpoint.

Obsidian vault sync also stays local. Northwatch can read Markdown only after you approve a folder picker prompt in the browser, and auto-sync runs only while the app tab is open.

GitHub and Vercel linking is still metadata-only. Northwatch stores imported project metadata in the command deck; it does not store GitHub tokens, Vercel tokens, API secrets, or service keys.

## Pre-Vercel Checklist

- Run `npm test -- --run`.
- Run `npm run build`.
- Open the app locally and export a workspace backup from Settings.
- Reload and confirm the workspace persists.
- Import the exported JSON through the preview/confirm flow.
- Confirm the reset guard requires `RESET NORTHWATCH`.
- Run `npm run sources:snapshot`, import the snapshot in Settings, and confirm GitHub/Vercel source counts update.
- Keep the first Vercel version private-use only.

## Link to Vercel

Import the GitHub repo into Vercel as a Vite app. Use `npm run build` as the build command and `dist` as the output directory.

Add the Supabase variables above to Vercel for Production and Preview before publishing a private cross-device build. Supabase Auth protects Northwatch data. To make the hosted URL itself private, also enable Vercel Deployment Protection for the project in Vercel settings.

After the first deployment, open the Vercel URL, sign in through Supabase Auth, add a test task, reload on another device, and confirm the same deck loads.

The approved design spec lives at `docs/superpowers/specs/2026-05-08-wren-os-rebuild-design.md`.
