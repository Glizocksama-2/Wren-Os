import { describe, expect, it } from "vitest";
import { freshCommandDeck, getDeckMetrics, reduceCommandDeck } from "../store/commandDeck";
import { buildAutonomousIntelScan } from "./intelAutopilot";

describe("intel autopilot", () => {
  it("creates autonomous findings from the deck without manual intel input", () => {
    const deck = reduceCommandDeck({
      ...freshCommandDeck,
      tasks: [],
      projects: [],
      finances: [],
      intel: []
    }, {
      type: "project/add",
      name: "Northwatch",
      objective: "Make the command deck feel autonomous.",
      nextAction: "Refresh the intel board",
      dueDate: null
    });

    const scan = buildAutonomousIntelScan(deck, getDeckMetrics(deck), new Date("2026-05-19T09:00:00.000Z"));

    expect(scan.summary).toContain("Autonomous scan produced");
    expect(scan.findings.length).toBeGreaterThan(0);
    expect(scan.findings.some((finding) => finding.title.startsWith("Repo:"))).toBe(true);
    expect(scan.findings.every((finding) => finding.note.includes("Autonomous"))).toBe(true);
  });

  it("applies autonomous findings by upserting intel and recording scan status", () => {
    const deck = reduceCommandDeck({ ...freshCommandDeck, intel: [] }, {
      type: "intel/autoscan",
      scannedAt: "2026-05-19T09:00:00.000Z",
      summary: "Autonomous scan produced 1 finding from projects.",
      findings: [
        {
          title: "Repo: Northwatch",
          symbol: "TS",
          kind: "trend",
          signal: "researching",
          thesis: "Project pressure needs review.",
          sourceUrl: "https://example.com/repo",
          note: "Autonomous scan May 19: review the repo."
        }
      ]
    });

    expect(deck.intelAutopilot).toMatchObject({
      lastRunAt: "2026-05-19T09:00:00.000Z",
      lastFindingCount: 1
    });
    expect(deck.intel[0]).toMatchObject({
      title: "Repo: Northwatch",
      symbol: "TS",
      signal: "researching",
      sourceUrl: "https://example.com/repo"
    });
    expect(deck.intel[0].notes[0].body).toContain("Autonomous scan");

    const refreshed = reduceCommandDeck(deck, {
      type: "intel/autoscan",
      scannedAt: "2026-05-19T10:00:00.000Z",
      summary: "Autonomous scan produced 1 finding from projects.",
      findings: [
        {
          title: "Repo: Northwatch",
          symbol: "TS",
          kind: "trend",
          signal: "high-priority",
          thesis: "Project pressure escalated.",
          sourceUrl: "https://example.com/repo",
          note: "Autonomous scan May 19: project pressure escalated."
        }
      ]
    });

    expect(refreshed.intel).toHaveLength(1);
    expect(refreshed.intel[0]).toMatchObject({ signal: "high-priority", thesis: "Project pressure escalated." });
    expect(refreshed.intel[0].notes).toHaveLength(2);
  });
});
