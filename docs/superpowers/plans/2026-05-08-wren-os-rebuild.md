# Northwatch Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Northwatch as a real local-first React command center with persistent workspace state and polished operational UI.

**Architecture:** Build a Vite + React + TypeScript app. Keep domain data and reducer logic testable outside React, then compose a dense app shell with feature screens and reusable panels.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, lucide-react, localStorage.

---

### Task 1: Project Scaffold And State Tests

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/test/setup.ts`
- Create: `src/store/workspace.test.ts`

- [ ] Add the React/Vite package scripts and TypeScript/Vitest configuration.
- [ ] Write failing tests for selectors, task creation, task movement, agent action decisions, JSON import validation, and local persistence.
- [ ] Run `npm test -- --run src/store/workspace.test.ts` and confirm it fails because `src/store/workspace.ts` is missing.

### Task 2: Domain Model, Seed Data, And Reducer

**Files:**
- Create: `src/types/workspace.ts`
- Create: `src/data/seed.ts`
- Create: `src/store/workspace.ts`

- [ ] Define workspace domain types for tasks, projects, actions, automations, content, docs, API providers, endpoints, and activity events.
- [ ] Create rich Northwatch seed data for command-center workflows.
- [ ] Implement reducer actions for task creation, task movement, task update, agent decision, import, reset, and activity logging.
- [ ] Implement selectors for command-center metrics and project health.
- [ ] Implement `loadWorkspace`, `saveWorkspace`, `serializeWorkspace`, and `parseWorkspaceImport`.
- [ ] Run the state tests and confirm they pass.

### Task 3: App Shell And Command Center

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/CommandCenter.tsx`
- Create: `src/components/ui.tsx`
- Create: `src/styles/app.css`

- [ ] Compose the left sidebar, top command bar, local mode status, and right inspector.
- [ ] Build the Command Center dashboard matching the generated visual concept.
- [ ] Wire navigation and selected agent action state.

### Task 4: Feature Screens

**Files:**
- Create: `src/components/MissionBoard.tsx`
- Create: `src/components/ProjectsView.tsx`
- Create: `src/components/AgentInbox.tsx`
- Create: `src/components/AutomationsView.tsx`
- Create: `src/components/ContentStudio.tsx`
- Create: `src/components/KnowledgeBase.tsx`
- Create: `src/components/ApiStudio.tsx`
- Create: `src/components/SettingsView.tsx`

- [ ] Add drag/drop task movement and task creation.
- [ ] Add project portfolio and project detail summaries.
- [ ] Add agent inbox approval/denial controls and inspector synchronization.
- [ ] Add automation, content, knowledge, API, and settings/data screens.

### Task 5: Polish And Verification

**Files:**
- Modify: `README.md`
- Delete: `Wren Interface`

- [ ] Replace the old README with install/run/test notes and the product summary.
- [ ] Remove the obsolete single-file prototype.
- [ ] Run `npm test -- --run`, `npm run build`, and browser verification.
- [ ] Compare the generated concept image with the rendered app screenshot and fix visible mismatches.
