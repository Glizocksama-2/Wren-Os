# Wren OS Rebuild Design

**Goal:** Rebuild Wren OS into a local-first AI agent command center for managing projects, tasks, automations, content, documents, agent approvals, and API operations from one polished workspace.

**Approved Direction:** Local-first operating system. The app should feel like serious founder/operator software today and keep clean seams for a later backend or real agent runtime.

**Visual Concept:** `C:\Users\trapc\.codex\generated_images\019e083b-3458-7041-aa5c-fde022e1f3e0\ig_09ce541fae3825740169fe10e5b9ec8198b98e7fb0c1115b36.png`

## Product Shape

Wren OS is not a landing page. The first screen is the product: a command-center dashboard with a left navigation rail, top command/search bar, dense operational grid, and a right-side inspector for the currently selected agent action.

The primary user is a solo operator running multiple workstreams such as Wren OS, Saka Wera, content production, and freelance/lead operations. The app should help them see what matters now, approve or reject agent actions, track project health, and keep tasks, automations, knowledge, content, and APIs organized.

## Screens

- **Command Center:** Today focus, project health, agent action queue, automation run timeline, daily progress, risks, content pipeline, knowledge snippets, and API/webhook status.
- **Mission Board:** Kanban task board with drag/drop status changes, status filters, task creation, task detail drawer, priority/due-date metadata, and activity logging.
- **Projects:** Portfolio view with health, progress, risk counts, linked tasks, and project profile details.
- **Agent Inbox:** Action approval queue with approve/deny controls, selected action inspector, confidence, trigger, file summary, and next steps.
- **Automations:** Workflow status, trigger cadence, last run, next run, owner, and health.
- **Content Studio:** Pipeline by stage for ideas, drafts, review, scheduled, and published content.
- **Knowledge Base:** Documents, notes, links, tags, updated timestamps, and preview snippets.
- **API Studio:** Agent key display, endpoint documentation, webhook/event model, provider health, and example commands.
- **Settings/Data:** Local-first data controls: export JSON, import JSON, reset seed data, and workspace identity.

## Architecture

Use React + Vite + TypeScript. Split the current single component into focused modules:

- `src/types/workspace.ts`: domain types.
- `src/data/seed.ts`: rich seed workspace data.
- `src/store/workspace.ts`: reducer, selectors, local persistence helpers, import/export helpers.
- `src/components/*`: app shell, command center, boards, drawers, panels, and reusable UI.
- `src/styles/app.css`: design tokens and responsive layout.
- `src/App.tsx`: composition and top-level local state.

State is local-first. The reducer is the source of truth during the session, and `localStorage` persists workspace changes under a versioned key. Import/export uses the same schema.

## Design System

The UI uses an operational product language:

- Background: true soft gray/off-white, not cream.
- Text: charcoal with muted slate for secondary text.
- Accents: teal primary, amber warning, coral risk, green success, slate-blue info.
- Layout: crisp 6-8px radius panels, fine borders, compact rows, no nested cards.
- Typography: system sans stack, compact labels, no viewport-scaled fonts, no negative letter spacing.
- Icons: lucide-style outline icons for nav, commands, status, files, and approvals.
- Controls: icon buttons where icon-only is expected; segmented controls, chips, inputs, drawers, tables, and toolbars for operational workflows.

## Data And Behavior

Seed data must include real-looking Wren OS workstreams:

- Projects: Wren OS, Saka Wera, Content Engine, Freelance Pipeline, Ops Automation.
- Tasks: priority, status, due date, tags, source, project linkage, activity.
- Agent actions: pending, approved, denied, confidence, summary, files, suggested next steps.
- Automations: status, cadence, last run, next run, duration, warnings.
- Content items: stage, platform, scheduled date, owner, tags.
- Knowledge docs: type, tags, preview, updated time.
- API providers/endpoints: health, latency, endpoint docs, webhook events.

Interactions must update visible local state:

- Navigate between screens.
- Search/filter operational data.
- Open and close drawers/inspectors.
- Create tasks.
- Move tasks across the Mission Board.
- Approve or deny agent actions.
- Update activity feed from meaningful changes.
- Export, import, and reset local data.

## Error Handling

If local persistence fails, keep the in-memory state usable and show a non-blocking message. If imported JSON is invalid, reject it and show a clear error. Destructive reset requires user confirmation.

## Testing

Use Vitest for the state layer. Cover selectors, task creation, task movement, agent approval/denial, import validation, and local persistence fallback behavior. Run the production build after implementation.

## Self Review

No placeholders remain. Scope is intentionally local-first and avoids backend/auth/runtime commitments. The design matches the approved direction and the generated concept: a real AI command center, not a simple Kanban clone.
