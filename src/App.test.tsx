import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, {
  AuthGate,
  LEGAL_CONSENT_STORAGE_KEY,
  PRIVACY_VERSION,
  SESSION_TOKEN_STORAGE_KEY,
  TERMS_VERSION
} from "./App";
import { COMMAND_DECK_STORAGE_KEY } from "./store/commandDeck";

describe("Northwatch command deck", () => {
  beforeEach(() => {
    window.localStorage.clear();
    acceptLegalTermsForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        agents: [
          { id: "sentinel", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ok" },
          { id: "ollama", status: "idle", checkedAt: "2026-05-19T08:00:00.000Z", detail: "idle" },
          { id: "telegram", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ok" }
        ]
      })
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires explicit terms and privacy agreement before opening the deck", () => {
    window.localStorage.removeItem(LEGAL_CONSENT_STORAGE_KEY);

    render(<App />);

    expect(screen.getByRole("heading", { name: /review and accept the legal terms/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to northwatch/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("I agree to the Terms and Conditions"));
    expect(screen.getByRole("button", { name: /continue to northwatch/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("I acknowledge the Privacy Policy"));
    fireEvent.click(screen.getByRole("button", { name: /continue to northwatch/i }));

    expect(window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY)).toContain(TERMS_VERSION);
    expect(window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY)).toContain(PRIVACY_VERSION);
    expect(screen.queryByRole("heading", { name: /review and accept the legal terms/i })).not.toBeInTheDocument();
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

  it("adds daily and selected-day repetitive routines", () => {
    render(<App />);

    clickNav("Daily");
    fireEvent.change(screen.getByLabelText("Routine title"), { target: { value: "Morning reset" } });
    fireEvent.click(screen.getByRole("button", { name: /add routine/i }));

    expect(screen.getByText("Morning reset")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("0 completed today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done today" }));
    expect(screen.getByText("1 completed today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen today" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Routine title"), { target: { value: "Strength work" } });
    fireEvent.change(screen.getByLabelText("Routine cadence"), { target: { value: "weekly" } });
    fireEvent.click(screen.getByLabelText("Monday"));
    fireEvent.click(screen.getByLabelText("Wednesday"));
    fireEvent.click(screen.getByLabelText("Friday"));
    fireEvent.click(screen.getByRole("button", { name: /add routine/i }));

    expect(screen.getByText("Strength work")).toBeInTheDocument();
    expect(screen.getByText("Mon Wed Fri")).toBeInTheDocument();
  });

  it("modifies and deletes visible task and finance records", () => {
    render(<App />);

    clickNav("To Do");
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Draft plan" } });
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    let taskRow = screen.getByText("Draft plan").closest(".ops-row") as HTMLElement;
    fireEvent.click(within(taskRow).getByRole("button", { name: /modify/i }));
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Draft revised plan" } });
    fireEvent.change(screen.getByLabelText("Task priority"), { target: { value: "critical" } });
    fireEvent.click(screen.getByRole("button", { name: /save task/i }));

    taskRow = screen.getByText("Draft revised plan").closest(".ops-row") as HTMLElement;
    expect(within(taskRow).getAllByText(/urgent/i).length).toBeGreaterThan(0);
    fireEvent.click(within(taskRow).getByRole("button", { name: /delete draft revised plan/i }));
    expect(screen.queryByText("Draft revised plan")).not.toBeInTheDocument();

    clickNav("Finances");
    fireEvent.change(screen.getByLabelText("Finance label"), { target: { value: "Client payment" } });
    fireEvent.change(screen.getByLabelText("Finance type"), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("Finance amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /add finance/i }));

    let financeRow = screen.getByText("Client payment").closest(".ops-row") as HTMLElement;
    fireEvent.click(within(financeRow).getByRole("button", { name: /modify/i }));
    fireEvent.change(screen.getByLabelText("Finance label"), { target: { value: "Client retainer" } });
    fireEvent.change(screen.getByLabelText("Finance amount"), { target: { value: "750" } });
    fireEvent.click(screen.getByRole("button", { name: /save finance/i }));

    financeRow = screen.getByText("Client retainer").closest(".ops-row") as HTMLElement;
    expect(within(financeRow).getByText(/750/)).toBeInTheDocument();
    fireEvent.click(within(financeRow).getByRole("button", { name: /delete client retainer/i }));
    expect(screen.queryByText("Client retainer")).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Current chapter"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Total chapters"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Current page"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Total pages"), { target: { value: "320" } });
    fireEvent.click(screen.getByRole("button", { name: /add book/i }));
    expect(screen.getByText("Deep Work")).toBeInTheDocument();
    expect(screen.getByText("Chapter 3 / 12")).toBeInTheDocument();
    expect(screen.getByText("Page 80 / 320")).toBeInTheDocument();
    expect(screen.getByText("Progress 25%")).toBeInTheDocument();

    clickNav("Journal");
    expect(screen.getByRole("button", { name: "Use Focused mood" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Use Locked in mood" }));
    expect(screen.getByRole("button", { name: "Use Locked in mood" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Journal entry"), { target: { value: "Built the new operating base." } });
    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));
    const journalCard = screen.getByText("Built the new operating base.").closest(".journal-card") as HTMLElement;
    expect(within(journalCard).getByRole("heading", { name: "Locked in" })).toBeInTheDocument();

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

  it("runs an autonomous intel scan from deck state", async () => {
    render(<App />);

    clickNav("Intel");
    expect(screen.getByText("Sentinel autopilot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /scan now/i }));

    expect(await screen.findByText(/Autonomous scan produced/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Repo:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Autonomous scan/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /pause autopilot/i }));
    expect(screen.getByRole("button", { name: /enable autopilot/i })).toBeInTheDocument();
  });

  it("shows agent health and can send a kanban card to Telegram", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open sentinel agent/i }));
    expect(await screen.findByLabelText("Agent API status")).toBeInTheDocument();
    expect(screen.getByText("Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();

    clickNav("To Do");
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Ship ops panel" } });
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    const taskRow = screen
      .getAllByText("Ship ops panel")
      .find((item) => item.closest(".ops-row"))
      ?.closest(".ops-row") as HTMLElement;
    fireEvent.click(within(taskRow).getByRole("button", { name: "URGENT" }));
    expect(taskRow).toHaveClass("kanban-priority-urgent");

    fireEvent.click(within(taskRow).getByRole("button", { name: /send to telegram/i }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/telegram/glizocksamabot",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("handles session expiry, keyboard shortcuts, and dynamic document titles", () => {
    window.localStorage.setItem(
      SESSION_TOKEN_STORAGE_KEY,
      JSON.stringify({
        token: "nw_expired_token",
        createdAt: "2026-05-01T08:00:00.000Z",
        rotatedAt: "2026-05-01T08:00:00.000Z"
      })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "Session expired." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rotate token and continue/i }));
    expect(screen.getByRole("heading", { name: /your command deck, live/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "k" });
    expect(screen.getByRole("heading", { name: "To Do List" })).toBeInTheDocument();
    expect(document.title).toBe("Kanban · Northwatch");

    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("heading", { name: "Shortcuts" })).toBeInTheDocument();
  });

  it("keeps account, customize, and legal windows under the logo menu", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Account" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    const logoMenu = screen.getByRole("menu", { name: "Northwatch menu" });
    expect(within(logoMenu).getByRole("menuitem", { name: "Account" })).toBeInTheDocument();
    expect(within(logoMenu).getByRole("menuitem", { name: "Customize" })).toBeInTheDocument();
    expect(within(logoMenu).getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(within(logoMenu).getByRole("menuitem", { name: "Help" })).toBeInTheDocument();
    expect(within(logoMenu).getByRole("menuitem", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(within(logoMenu).getByRole("menuitem", { name: "Terms and Conditions" })).toBeInTheDocument();

    fireEvent.click(within(logoMenu).getByRole("menuitem", { name: "Customize" }));
    expect(screen.getByRole("heading", { name: "Customize Options" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interface Presets" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));
    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Privacy Policy" }));
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
  });

  it("renders richer life modules while account and customize stay out of the rail", () => {
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

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Account" })).not.toBeInTheDocument();
  });

  it("prefills remembered auth accounts and can forget one", async () => {
    const requestMagicLink = vi.fn().mockResolvedValue(undefined);
    const forgetRememberedAccount = vi.fn();

    render(
      <AuthGate
        status={{
          mode: "signed-out",
          label: "Cloud auth: sign in required",
          detail: "Use your Supabase magic link to unlock cross-device sync.",
          lastSyncedAt: null,
          userEmail: null
        }}
        rememberedAccounts={[
          { email: "operator@northwatch.dev", userId: "user-1", lastUsedAt: "2026-05-19T08:00:00.000Z" },
          { email: "backup@northwatch.dev", userId: null, lastUsedAt: "2026-05-18T08:00:00.000Z" }
        ]}
        onRequestMagicLink={requestMagicLink}
        onForgetRememberedAccount={forgetRememberedAccount}
      />
    );

    expect(screen.getByDisplayValue("operator@northwatch.dev")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue as backup@northwatch.dev/i }));
    await waitFor(() => expect(requestMagicLink).toHaveBeenCalledWith("backup@northwatch.dev"));
    expect(screen.getByText(/magic link sent/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /forget operator@northwatch.dev/i }));
    expect(forgetRememberedAccount).toHaveBeenCalledWith("operator@northwatch.dev");
  });
});

function clickNav(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", { name }));
}

function acceptLegalTermsForTests() {
  window.localStorage.setItem(
    LEGAL_CONSENT_STORAGE_KEY,
    JSON.stringify({
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      acceptedAt: "2026-05-19T08:00:00.000Z",
      jurisdiction: "Kenyan data protection law and applicable international privacy principles"
    })
  );
}
