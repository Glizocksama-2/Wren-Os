import { describe, expect, it } from "vitest";
import { freshCommandDeck, reduceCommandDeck, type CommandDeckState } from "./commandDeck";

function makeTask(title: string): CommandDeckState["tasks"][number] {
  const timestamp = "2026-05-12T09:00:00.000Z";
  return {
    id: `task-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    priority: "high",
    dueDate: null,
    status: "todo",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("command deck cloud import", () => {
  it("replaces the local deck with a normalized cloud deck", () => {
    const local = reduceCommandDeck(freshCommandDeck, {
      type: "task/add",
      title: "Keep only local",
      priority: "medium",
      dueDate: null
    });
    const cloudDeck: Partial<CommandDeckState> = {
      ...freshCommandDeck,
      tasks: [makeTask("Synced cloud task")],
      projects: [],
      settings: {
        ...freshCommandDeck.settings,
        callsign: "Cloud"
      }
    };

    const next = reduceCommandDeck(local, { type: "deck/import", deck: cloudDeck });

    expect(next.settings.callsign).toBe("Cloud");
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].title).toBe("Synced cloud task");
    expect(next.projects.some((project) => project.source === "github")).toBe(true);
  });
});
