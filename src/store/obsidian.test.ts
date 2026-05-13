import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../data/seed";
import { reduceWorkspace } from "./workspace";

const syncedAt = "2026-05-10T15:00:00.000Z";

const vaultFiles = [
  {
    path: "Projects/Wren OS.md",
    name: "Wren OS.md",
    lastModified: "2026-05-10T14:50:00.000Z",
    content: [
      "---",
      "type: project",
      "status: active",
      "health: on_track",
      "objective: Keep Wren OS tied to the real local workspace.",
      "tags: [wren-os, local]",
      "---",
      "# Wren OS",
      "Project source note from Obsidian.",
      "- [ ] Draft vault launch plan",
      "- [x] Review exported data"
    ].join("\n")
  },
  {
    path: "Runbooks/Codex Bridge.md",
    name: "Codex Bridge.md",
    lastModified: "2026-05-10T14:55:00.000Z",
    content: [
      "---",
      "kind: runbook",
      "project: Wren OS",
      "tags: codex, local",
      "---",
      "# Codex Bridge",
      "Use the local prompt bridge, not hosted secrets."
    ].join("\n")
  }
];

describe("Obsidian vault sync", () => {
  it("syncs markdown notes into documents, projects, and tasks without duplicates", () => {
    const synced = reduceWorkspace(seedWorkspace, {
      type: "obsidian/sync",
      payload: {
        vaultName: "Founder Vault",
        files: vaultFiles,
        syncedAt
      }
    });

    expect(synced.obsidianVault).toMatchObject({
      status: "linked",
      name: "Founder Vault",
      noteCount: 2,
      projectCount: 1,
      taskCount: 2,
      documentCount: 2,
      lastSyncedAt: syncedAt
    });
    expect(synced.projects.find((project) => project.id === "obsidian-project-wren-os")).toMatchObject({
      name: "Wren OS",
      objective: "Keep Wren OS tied to the real local workspace.",
      tags: ["wren-os", "local", "obsidian"]
    });
    expect(synced.documents.find((document) => document.id === "obsidian-doc-projects-wren-os")).toMatchObject({
      title: "Wren OS",
      url: "obsidian://open?vault=Founder%20Vault&file=Projects%2FWren%20OS",
      projectId: "obsidian-project-wren-os"
    });
    expect(synced.documents.find((document) => document.id === "obsidian-doc-runbooks-codex-bridge")).toMatchObject({
      title: "Codex Bridge",
      kind: "runbook",
      projectId: "obsidian-project-wren-os"
    });
    expect(synced.tasks.find((task) => task.title === "Draft vault launch plan")).toMatchObject({
      id: "obsidian-task-projects-wren-os-10",
      projectId: "obsidian-project-wren-os",
      source: "manual",
      status: "todo"
    });
    expect(synced.tasks.find((task) => task.title === "Review exported data")).toMatchObject({
      status: "done"
    });

    const resynced = reduceWorkspace(synced, {
      type: "obsidian/sync",
      payload: {
        vaultName: "Founder Vault",
        files: vaultFiles,
        syncedAt
      }
    });

    expect(resynced.documents.filter((document) => document.id.startsWith("obsidian-doc-"))).toHaveLength(2);
    expect(resynced.tasks.filter((task) => task.id.startsWith("obsidian-task-"))).toHaveLength(2);
    expect(resynced.projects.filter((project) => project.id.startsWith("obsidian-project-"))).toHaveLength(1);
  });
});
