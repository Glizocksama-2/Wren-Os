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

## Local Ollama Agent

Sentinel can use a local Ollama model from the floating agent panel. The checked-in default is:

- Endpoint: `http://127.0.0.1:11434`
- Model: `qwen2.5:1.5b`

Start Ollama before opening the app, then make sure the default model is available:

```bash
ollama pull qwen2.5:1.5b
ollama serve
```

On Windows, launching the Ollama desktop app also starts the local server. In Northwatch, open `Customize`, confirm the `Sentinel brain` endpoint and model, then use `Test Ollama`. The Sentinel panel will use Ollama when it is reachable and fall back to built-in deck logic if the server or model is unavailable.

If the app is served from a different local origin and the browser blocks Ollama, add that origin to `OLLAMA_ORIGINS`, then restart Ollama. For Vite development, allow the current local app origin such as `http://127.0.0.1:5174`, `http://127.0.0.1:5173`, or the matching `localhost` URL.

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

## Personal And Team Workspaces

Signed-in users start in a private personal vault backed by `public.command_decks`, where RLS only allows the row whose `user_id` matches the active Supabase user. New signed-in users are seeded with a fresh private deck so a previous browser user's local data is not silently copied into their account.

Team mode is opt-in from Account Settings. Creating a team makes a fresh shared deck in `public.team_command_decks`, adds the creator as `owner`, and shows a team code. Members join with that code, then Northwatch can switch between the private vault and any joined team workspace. Team data is visible and writable only to authenticated users with a row in `public.team_memberships` for that team.

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

## Link to Netlify

The Netlify project is `northwatch`, with the production URL `https://northwatch.netlify.app`. Netlify reads `netlify.toml`, runs `npm run build`, and publishes `dist`.

For this project, the public Supabase browser config is included in `netlify.toml` so Netlify builds can lock Northwatch behind Supabase Auth without a manual environment-variable step. Do not add a `service_role` or secret key to Netlify or this repo.

In Supabase Dashboard > Authentication > URL Configuration, set:

```text
Site URL: https://northwatch.netlify.app
Additional Redirect URLs:
https://northwatch.netlify.app/**
https://main--northwatch.netlify.app/**
https://**--northwatch.netlify.app/**
http://localhost:5173/**
http://localhost:5174/**
http://127.0.0.1:5173/**
http://127.0.0.1:5174/**
```

Northwatch sends magic links with `emailRedirectTo: window.location.origin`, so those allowed URLs are what let the same build work on production, branch deploys, and local Vite ports. If you customized Supabase email templates, use `{{ .RedirectTo }}` for the sign-in link target.

After the first Netlify deployment, open the Netlify URL, sign in through Supabase Auth, add a test task, reload on another device, and confirm the same deck loads.

The approved design spec lives at `docs/superpowers/specs/2026-05-08-wren-os-rebuild-design.md`.
