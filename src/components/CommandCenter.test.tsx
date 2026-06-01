import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedWorkspace } from "../data/seed";
import type { WorkspaceState } from "../types/workspace";
import { CommandCenter } from "./CommandCenter";

const MODULES_STORAGE_KEY = "northwatch.command-modules.v1";

function cloneState(): WorkspaceState {
  return JSON.parse(JSON.stringify(seedWorkspace)) as WorkspaceState;
}

function renderCenter(state: WorkspaceState = cloneState()) {
  const dispatch = vi.fn();
  const onNotice = vi.fn();
  const rendered = render(
    <CommandCenter
      state={state}
      dispatch={dispatch}
      selectedActionId={undefined}
      onSelectAction={vi.fn()}
      onNavigate={vi.fn()}
      onNotice={onNotice}
      onDecideAction={vi.fn()}
    />
  );
  return { ...rendered, dispatch, onNotice };
}

function getHealthSparklinePoints() {
  const cards = [...document.querySelectorAll(".health-card")] as HTMLElement[];
  const card = cards.find((item) => item.textContent?.includes("Dynamic Project")) as HTMLElement;
  expect(card).toBeInTheDocument();
  const polyline = card.querySelector("polyline");
  expect(polyline).toBeInTheDocument();
  return polyline?.getAttribute("points") ?? "";
}

describe("CommandCenter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("feeds project completion history into project sparklines", () => {
    const state = cloneState();
    state.projects = [
      {
        ...state.projects[0],
        id: "p-dynamic",
        name: "Dynamic Project",
        createdAt: "2026-05-12T00:00:00.000Z",
        updatedAt: "2026-05-20T09:00:00.000Z"
      }
    ];
    state.tasks = [
      { ...state.tasks[0], id: "done-1", projectId: "p-dynamic", status: "done", updatedAt: "2026-05-18T09:00:00.000Z" },
      { ...state.tasks[0], id: "done-2", projectId: "p-dynamic", status: "done", updatedAt: "2026-05-19T09:00:00.000Z" },
      { ...state.tasks[0], id: "done-3", projectId: "p-dynamic", status: "done", updatedAt: "2026-05-19T15:00:00.000Z" },
      { ...state.tasks[1], id: "open-1", projectId: "p-dynamic", status: "todo", updatedAt: "2026-05-20T09:00:00.000Z" }
    ];

    renderCenter(state);

    expect(getHealthSparklinePoints()).not.toBe("2,27 16,17 31,22 45,16 59,20 74,8 88,13 103,10 118,5");
    expect(new Set(getHealthSparklinePoints().split(" ").map((point) => point.split(",")[1])).size).toBeGreaterThan(1);
  });

  it("shows the next scheduled content item instead of a hardcoded footer", () => {
    const state = cloneState();
    state.contentItems = [
      { ...state.contentItems[0], id: "idea", title: "Loose idea", stage: "idea", scheduledFor: null },
      { ...state.contentItems[0], id: "later", title: "Later scheduled post", stage: "scheduled", scheduledFor: "2026-05-25T08:00:00.000Z" },
      { ...state.contentItems[0], id: "next", title: "Earliest scheduled post", stage: "scheduled", scheduledFor: "2026-05-21T08:00:00.000Z" }
    ];

    renderCenter(state);

    expect(screen.getByText(/Next: Earliest scheduled post/)).toBeInTheDocument();
    expect(screen.queryByText(/Northwatch launch snippets scheduled this week/)).not.toBeInTheDocument();
  });

  it("persists module visibility and keeps hidden modules hidden when Today is pressed", () => {
    renderCenter();

    fireEvent.click(screen.getByRole("button", { name: /customize/i }));
    fireEvent.click(screen.getByLabelText("Agents"));

    expect(JSON.parse(window.localStorage.getItem(MODULES_STORAGE_KEY) ?? "{}")).toMatchObject({ agents: false });

    cleanup();
    renderCenter();

    expect(screen.queryByRole("heading", { name: "Agent Action Queue" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /today/i }));
    expect(screen.queryByRole("heading", { name: "Agent Action Queue" })).not.toBeInTheDocument();
  });

  it("deduplicates tasks that are both blocked and overdue in the risk panel", () => {
    const state = cloneState();
    state.tasks = [
      {
        ...state.tasks[0],
        id: "risk-1",
        title: "Blocked overdue task",
        status: "todo",
        dueDate: "2026-05-18T08:00:00.000Z",
        blockedReason: "Waiting on client credentials."
      }
    ];

    renderCenter(state);

    expect(screen.getAllByText("Blocked overdue task")).toHaveLength(1);
    expect(screen.getByText("Waiting on client credentials.")).toBeInTheDocument();
  });

  it("shows empty states for agent actions and automation runs", () => {
    const state = cloneState();
    state.agentActions = [];
    state.automations = [];

    renderCenter(state);

    expect(screen.getByText("No pending agent actions. All clear.")).toBeInTheDocument();
    expect(screen.getByText("No automation runs logged yet.")).toBeInTheDocument();
  });

  it("shows the three most recently updated knowledge documents", () => {
    const state = cloneState();
    state.documents = [
      { ...state.documents[0], id: "old", title: "Old Doc", updatedAt: "2026-05-01T08:00:00.000Z" },
      { ...state.documents[0], id: "recent", title: "Recent Doc", updatedAt: "2026-05-19T08:00:00.000Z" },
      { ...state.documents[0], id: "newest", title: "Newest Doc", updatedAt: "2026-05-20T08:00:00.000Z" },
      { ...state.documents[0], id: "middle", title: "Middle Doc", updatedAt: "2026-05-18T08:00:00.000Z" }
    ];
    const { container } = renderCenter(state);

    const snippets = [...container.querySelectorAll(".doc-snippet strong")].map((node) => node.textContent);
    expect(snippets).toEqual(["Newest Doc", "Recent Doc", "Middle Doc"]);
  });

  it("can dispatch a Codex bridge reconnect from the panel", () => {
    const state = cloneState();
    state.codexBridge = { ...state.codexBridge, status: "disconnected" };

    const { dispatch, onNotice } = renderCenter(state);

    fireEvent.click(screen.getByRole("button", { name: /reconnect codex bridge/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "codex/connect" });
    expect(onNotice).toHaveBeenCalledWith("Codex bridge reconnecting.");
  });

  it("uses an empty footer message when there is no scheduled content", () => {
    const state = cloneState();
    state.contentItems = state.contentItems.map((item) => ({ ...item, stage: "idea", scheduledFor: null }));

    renderCenter(state);

    expect(screen.getByText("No content scheduled. Add to pipeline.")).toBeInTheDocument();
  });
});
