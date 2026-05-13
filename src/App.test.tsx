import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { COMMAND_DECK_STORAGE_KEY } from "./store/commandDeck";

describe("Northwatch command deck", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("boots a fresh dark command deck and ignores the old workspace seed", () => {
    window.localStorage.setItem("wren-os.workspace.v1", JSON.stringify({ workspace: { name: "Mercer Ventures" } }));

    render(<App />);

    expect(screen.getByText("Northwatch Tactical Ledger")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /your command deck, live/i })).toBeInTheDocument();
    expect(screen.queryByText("Mercer Ventures")).not.toBeInTheDocument();
    expect(screen.getByText("8 GitHub repos imported from Glizocksama-2")).toBeInTheDocument();
    expect(screen.getByText(/cloud auth: local fallback/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("wren-os.workspace.v1")).not.toBeNull();
    expect(window.localStorage.getItem(COMMAND_DECK_STORAGE_KEY)).toContain("Operator");
    expect(window.localStorage.getItem(COMMAND_DECK_STORAGE_KEY)).toContain("EStarzFc");
  });

  it("adds and completes to do items", () => {
    render(<App />);

    clickNav("To Do");
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Secure morning plan" } });
    fireEvent.change(screen.getByLabelText("Task priority"), { target: { value: "critical" } });
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    expect(screen.getAllByText("Secure morning plan").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(within(screen.getByRole("heading", { name: "Done" }).closest(".deck-panel") as HTMLElement).getByText("Secure morning plan")).toBeInTheDocument();
  });

  it("tracks pending projects and moves them to done projects", () => {
    render(<App />);

    clickNav("Projects");
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Launch black deck" } });
    fireEvent.change(screen.getByLabelText("Project objective"), { target: { value: "Rebuild Northwatch around life command." } });
    fireEvent.change(screen.getByLabelText("Project next action"), { target: { value: "Finish UI pass" } });
    fireEvent.click(screen.getByRole("button", { name: /add project/i }));

    const projectRow = screen
      .getAllByText("Launch black deck")
      .find((item) => item.closest(".project-row"))
      ?.closest(".project-row") as HTMLElement;
    expect(projectRow).toBeInTheDocument();
    fireEvent.click(within(projectRow).getByRole("button", { name: "Complete" }));
    expect(within(screen.getByText("Done Projects").closest(".deck-panel") as HTMLElement).getByText("Launch black deck")).toBeInTheDocument();
    expect(screen.getByText("EStarzFc")).toBeInTheDocument();
    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
  });

  it("adds calendar, workout, book, journal, and finance records", () => {
    render(<App />);

    clickNav("Calendar");
    fireEvent.change(screen.getByLabelText("Calendar event title"), { target: { value: "Strategy block" } });
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(screen.getAllByText("Strategy block").length).toBeGreaterThan(0);

    clickNav("Workout");
    fireEvent.change(screen.getByLabelText("Workout name"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Workout focus"), { target: { value: "Chest and triceps" } });
    fireEvent.click(screen.getByRole("button", { name: /add workout/i }));
    expect(screen.getByText("Push day")).toBeInTheDocument();

    clickNav("Books");
    fireEvent.change(screen.getByLabelText("Book title"), { target: { value: "Deep Work" } });
    fireEvent.change(screen.getByLabelText("Book author"), { target: { value: "Cal Newport" } });
    fireEvent.click(screen.getByRole("button", { name: /add book/i }));
    expect(screen.getByText("Deep Work")).toBeInTheDocument();

    clickNav("Journal");
    fireEvent.change(screen.getByLabelText("Journal mood"), { target: { value: "Locked in" } });
    fireEvent.change(screen.getByLabelText("Journal entry"), { target: { value: "Built the new operating base." } });
    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));
    expect(screen.getByText("Locked in")).toBeInTheDocument();

    clickNav("Finances");
    fireEvent.change(screen.getByLabelText("Finance label"), { target: { value: "Client payment" } });
    fireEvent.change(screen.getByLabelText("Finance type"), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("Finance amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /add finance/i }));
    expect(screen.getByText("Client payment")).toBeInTheDocument();
    expect(screen.getAllByText("$500").length).toBeGreaterThan(0);
  });

  it("tracks market intel watchlist items and research notes", () => {
    render(<App />);

    clickNav("Intel");
    expect(screen.getByRole("heading", { name: "Watchtower" })).toBeInTheDocument();
    expect(screen.getByText("Signal board")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Intel title"), { target: { value: "NVIDIA" } });
    fireEvent.change(screen.getByLabelText("Ticker or topic"), { target: { value: "NVDA" } });
    fireEvent.change(screen.getByLabelText("Intel type"), { target: { value: "stock" } });
    fireEvent.change(screen.getByLabelText("Intel signal"), { target: { value: "researching" } });
    fireEvent.change(screen.getByLabelText("Intel thesis"), { target: { value: "AI chips and data center demand." } });
    fireEvent.change(screen.getByLabelText("Intel source URL"), { target: { value: "https://example.com/nvda" } });
    fireEvent.click(screen.getByRole("button", { name: /add intel/i }));

    const intelRow = screen.getAllByText("NVIDIA").find((item) => item.closest(".intel-row"))?.closest(".intel-row") as HTMLElement;
    expect(intelRow).toBeInTheDocument();
    expect(within(intelRow).getByText(/NVDA - stock - researching/i)).toBeInTheDocument();
    expect(within(intelRow).getByText("AI chips and data center demand.")).toBeInTheDocument();

    fireEvent.click(within(intelRow).getByRole("button", { name: "Focus" }));
    fireEvent.change(screen.getByLabelText("Intel note"), { target: { value: "Check earnings call and margin trend." } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    expect(screen.getByText("Check earnings call and margin trend.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /news search for NVIDIA/i })).toHaveAttribute("href", expect.stringContaining("NVDA"));
  });

  it("customizes callsign, accent, density, and resets the new deck", () => {
    render(<App />);

    clickNav("Customize");
    fireEvent.change(screen.getByLabelText("Callsign"), { target: { value: "Ghost" } });
    fireEvent.click(screen.getByRole("button", { name: "Use Cyan accent" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Orbit Watch logo" }));

    expect(screen.getByDisplayValue("Ghost")).toBeInTheDocument();
    expect(document.querySelector(".deck-app")).toHaveAttribute("data-accent", "cyan");
    expect(document.querySelector(".deck-app")).toHaveAttribute("data-density", "compact");
    expect(window.localStorage.getItem(COMMAND_DECK_STORAGE_KEY)).toContain("\"logoStyle\":\"radar\"");

    fireEvent.click(screen.getByRole("button", { name: /reset deck/i }));
    expect(screen.getByDisplayValue("Operator")).toBeInTheDocument();
  });

  it("renders richer life modules and account settings", () => {
    render(<App />);

    clickNav("Calendar");
    expect(screen.getByRole("heading", { name: "Mission Radar" })).toBeInTheDocument();
    expect(screen.getByText("Next seven days")).toBeInTheDocument();

    clickNav("Workout");
    expect(screen.getByRole("heading", { name: "Training Split" })).toBeInTheDocument();
    expect(screen.getByText("Completion heat")).toBeInTheDocument();

    clickNav("Books");
    expect(screen.getByRole("heading", { name: "Reading Radar" })).toBeInTheDocument();
    expect(screen.getByText("Library lanes")).toBeInTheDocument();

    clickNav("Journal");
    expect(screen.getByRole("heading", { name: "Reflection Brief" })).toBeInTheDocument();
    expect(screen.getByText("Entry archive")).toBeInTheDocument();

    clickNav("Finances");
    expect(screen.getByRole("heading", { name: "Cashflow Command" })).toBeInTheDocument();
    expect(screen.getByText("Ledger stream")).toBeInTheDocument();

    clickNav("Intel");
    expect(screen.getByRole("heading", { name: "Watchtower" })).toBeInTheDocument();
    expect(screen.getByText("Research queue")).toBeInTheDocument();

    clickNav("Customize");
    expect(screen.getByRole("heading", { name: "Interface Presets" })).toBeInTheDocument();
    expect(screen.getByText("Module switches")).toBeInTheDocument();

    clickNav("Account");
    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeInTheDocument();
    expect(screen.getByText("Identity and sync")).toBeInTheDocument();
  });

  it("uses customize switches to hide optional life modules", () => {
    render(<App />);

    clickNav("Customize");
    fireEvent.click(screen.getByLabelText("Calendar module"));

    expect(screen.queryByRole("button", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interface Presets" })).toBeInTheDocument();
  });
});

function clickNav(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", { name }));
}
