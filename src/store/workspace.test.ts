import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../data/seed";
import {
  STORAGE_KEY,
  createEmptyWorkspaceStorage,
  createCodexTaskPrompt,
  getDailyPlan,
  getCommandCenterMetrics,
  getProjectSummaries,
  loadWorkspace,
  parseWorkspaceImport,
  reduceWorkspace,
  saveWorkspace,
  serializeWorkspace
} from "./workspace";

describe("workspace state", () => {
  it("summarizes command center metrics from workspace data", () => {
    const metrics = getCommandCenterMetrics(seedWorkspace);

    expect(metrics.activeProjects).toBe(5);
    expect(metrics.pendingAgentActions).toBe(5);
    expect(metrics.overdueTasks).toBe(2);
    expect(metrics.automationWarnings).toBe(1);
    expect(metrics.contentInFlight).toBe(31);
  });

  it("creates tasks with workspace defaults and activity", () => {
    const next = reduceWorkspace(seedWorkspace, {
      type: "task/create",
      payload: {
        title: "Prepare Northwatch launch notes",
        description: "Summarize the rebuild into a customer-facing update.",
        priority: "high",
        dueDate: null,
        projectId: "p-wren",
        tags: ["wren-os", "launch"],
        source: "manual"
      }
    });

    const created = next.tasks.find((task) => task.title === "Prepare Northwatch launch notes");
    expect(created).toMatchObject({
      status: "todo",
      workspaceId: seedWorkspace.workspace.id,
      projectId: "p-wren",
      acceptanceCriteria: [],
      blockedReason: null,
      estimateMinutes: null
    });
    expect(next.activityEvents[0]).toMatchObject({
      entityType: "task",
      entityId: created?.id,
      eventType: "task_created"
    });
  });

  it("moves tasks and logs the status transition", () => {
    const next = reduceWorkspace(seedWorkspace, {
      type: "task/move",
      id: "t-webhook",
      status: "done"
    });

    expect(next.tasks.find((task) => task.id === "t-webhook")?.status).toBe("done");
    expect(next.activityEvents[0]).toMatchObject({
      eventType: "task_status_changed",
      payload: { from: "in_progress", to: "done" }
    });
  });

  it("records agent approvals and denials", () => {
    const approved = reduceWorkspace(seedWorkspace, {
      type: "agent/decide",
      id: "aa-pricing-refactor",
      decision: "approved"
    });
    const denied = reduceWorkspace(approved, {
      type: "agent/decide",
      id: "aa-copy-draft",
      decision: "denied"
    });

    expect(denied.agentActions.find((action) => action.id === "aa-pricing-refactor")?.status).toBe("approved");
    expect(denied.agentActions.find((action) => action.id === "aa-copy-draft")?.status).toBe("denied");
    expect(denied.activityEvents[0]).toMatchObject({
      entityType: "agent_action",
      entityId: "aa-copy-draft",
      eventType: "agent_action_denied"
    });
  });

  it("creates Codex handoffs with a usable task prompt and activity", () => {
    const next = reduceWorkspace(seedWorkspace, {
      type: "codex/handoff_task",
      taskId: "t-wren-local-state"
    });

    expect(next.codexBridge.lastHandoff).toMatchObject({
      taskId: "t-wren-local-state",
      taskTitle: "Add local-first workspace persistence"
    });
    expect(next.codexBridge.lastHandoff?.prompt).toContain("Task: Add local-first workspace persistence");
    expect(next.codexBridge.lastHandoff?.prompt).toContain("C:\\Users\\trapc\\Documents\\New project 3");
    expect(next.activityEvents[0]).toMatchObject({
      entityType: "codex",
      entityId: "t-wren-local-state",
      eventType: "codex_handoff_created"
    });
  });

  it("builds Codex task prompts from project context", () => {
    const task = seedWorkspace.tasks.find((item) => item.id === "t-wren-api-studio");
    expect(task).toBeDefined();

    const prompt = createCodexTaskPrompt(seedWorkspace, task!);

    expect(prompt).toContain("Project: Northwatch");
    expect(prompt).toContain("Priority: medium");
    expect(prompt).toContain("Run the relevant tests");
  });

  it("builds project summaries with progress and risk counts", () => {
    const summaries = getProjectSummaries(seedWorkspace);
    const wren = summaries.find((summary) => summary.id === "p-wren");

    expect(wren).toMatchObject({
      name: "Northwatch",
      totalTasks: 4,
      completedTasks: 1,
      riskCount: 2,
      nextTaskTitle: "Add local-first workspace persistence",
      blockedTaskCount: 0,
      overdueTaskCount: 1,
      reviewTaskCount: 1
    });
    expect(wren?.progress).toBe(25);
  });

  it("builds a daily plan from ready, review, blocked, and overdue work", () => {
    const blockedState = reduceWorkspace(seedWorkspace, {
      type: "task/update",
      id: "t-payments",
      payload: { blockedReason: "Waiting on payment credentials." }
    });

    const plan = getDailyPlan(blockedState);

    expect(plan.topOutcomes.map((task) => task.title)).toContain("Add local-first workspace persistence");
    expect(plan.reviewQueue.some((task) => task.id === "t-wren-api-studio")).toBe(true);
    expect(plan.blockedTasks.some((task) => task.id === "t-payments")).toBe(true);
    expect(plan.readyProjectCount).toBeLessThanOrEqual(plan.activeProjectCount);
  });

  it("updates project command fields and records project activity", () => {
    const next = reduceWorkspace(seedWorkspace, {
      type: "project/update",
      id: "p-wren",
      payload: {
        health: "on_track",
        objective: "Make Northwatch the daily execution system."
      }
    });

    expect(next.projects.find((project) => project.id === "p-wren")).toMatchObject({
      health: "on_track",
      objective: "Make Northwatch the daily execution system."
    });
    expect(next.activityEvents[0]).toMatchObject({
      entityType: "project",
      entityId: "p-wren",
      eventType: "project_updated"
    });
  });

  it("round-trips valid workspace exports and rejects invalid imports", () => {
    const exported = serializeWorkspace(seedWorkspace);

    expect(parseWorkspaceImport(exported).ok).toBe(true);
    expect(parseWorkspaceImport("{ bad json")).toMatchObject({
      ok: false,
      error: "Import file is not valid JSON."
    });
    expect(parseWorkspaceImport(JSON.stringify({ tasks: [] }))).toMatchObject({
      ok: false,
      error: "Import is missing a valid workspace profile."
    });
  });

  it("migrates older workspace exports to the current schema version", () => {
    const oldWorkspace = JSON.parse(serializeWorkspace(seedWorkspace));
    delete oldWorkspace.workspace.schemaVersion;
    delete oldWorkspace.projectSources;
    delete oldWorkspace.linkedProjects;

    const result = parseWorkspaceImport(JSON.stringify(oldWorkspace));

    expect(result.ok).toBe(true);
    expect(result.workspace?.workspace.schemaVersion).toBe(4);
    expect(result.workspace?.obsidianVault.status).toBe("unlinked");
    expect(result.workspace?.projectSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "github", status: "unlinked" }),
        expect.objectContaining({ provider: "vercel", status: "unlinked" })
      ])
    );
    expect(result.workspace?.linkedProjects).toEqual([]);
  });

  it("rejects malformed task data instead of accepting shape-only imports", () => {
    const malformedWorkspace = JSON.parse(serializeWorkspace(seedWorkspace));
    malformedWorkspace.tasks[0].title = 42;

    expect(parseWorkspaceImport(JSON.stringify(malformedWorkspace))).toMatchObject({
      ok: false,
      error: "Import contains invalid task data."
    });
  });

  it("does not provide replacement data when an import cannot be parsed", () => {
    const result = parseWorkspaceImport("{ this is not json");

    expect(result.ok).toBe(false);
    expect(result.workspace).toBeUndefined();
  });

  it("loads seed data when storage is empty and persists workspace changes", () => {
    const storage = createEmptyWorkspaceStorage();

    expect(loadWorkspace(storage).workspace.id).toBe(seedWorkspace.workspace.id);
    saveWorkspace(seedWorkspace, storage);
    expect(storage.getItem(STORAGE_KEY)).toContain(seedWorkspace.workspace.name);
    expect(loadWorkspace(storage).tasks.length).toBe(seedWorkspace.tasks.length);
  });

  it("migrates older local workspace data into the Codex bridge shape", () => {
    const storage = createEmptyWorkspaceStorage();
    const oldWorkspace = { ...seedWorkspace, codexBridge: undefined, apiProviders: seedWorkspace.apiProviders.slice(0, 1) };
    storage.setItem(STORAGE_KEY, JSON.stringify(oldWorkspace));

    const loaded = loadWorkspace(storage);

    expect(loaded.codexBridge.status).toBe("connected");
    expect(loaded.apiProviders.some((provider) => provider.id === "api-codex")).toBe(true);
    expect(loaded.apiEndpoints.some((endpoint) => endpoint.path === "/api/codex/handoff")).toBe(true);
  });
});
