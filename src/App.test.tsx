import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, {
  LEGAL_CONSENT_STORAGE_KEY,
  PRIVACY_VERSION,
  TERMS_VERSION
} from "./App";
import { COMMAND_DECK_STORAGE_KEY, freshCommandDeck, getCommandDeckStorageKey } from "./store/commandDeck";

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
    expect(screen.getByText("0 private GitHub repo links")).toBeInTheDocument();
    expect(screen.getByText(/credential auth: active/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("wren-os.workspace.v1")).not.toBeNull();
    expect(window.localStorage.getItem(COMMAND_DECK_STORAGE_KEY)).toContain("Operator");
    expect(window.localStorage.getItem(COMMAND_DECK_STORAGE_KEY)).not.toContain("EStarzFc");
    expect(screen.queryByText(/war room/i)).not.toBeInTheDocument();
  });

  it("adds and completes to do items", () => {
    render(<App />);

    clickNav("To Do");
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Secure morning plan" } });
    fireEvent.change(screen.getByLabelText("Task priority"), { target: { value: "critical" } });
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    expect(screen.getAllByText("Secure morning plan").length).toBeGreaterThan(0);
    expect(screen.getByText("Me")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Complete Secure morning plan"));
    expect(screen.queryByText("Secure morning plan")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /completed \(1\)/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /completed \(1\)/i }));
    expect(screen.getByText("Secure morning plan")).toHaveClass("task-title-completed");
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
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/client-org/launch-black-deck" } });
    fireEvent.change(screen.getByLabelText("GitHub default branch"), { target: { value: "main" } });
    fireEvent.click(screen.getByRole("button", { name: /add project/i }));

    const projectRow = screen
      .getAllByText("Launch black deck")
      .find((item) => item.closest(".project-row"))
      ?.closest(".project-row") as HTMLElement;
    expect(projectRow).toBeInTheDocument();
    expect(within(projectRow).getByText("GitHub")).toBeInTheDocument();
    expect(within(projectRow).getByRole("link", { name: /open launch black deck on github/i })).toHaveAttribute(
      "href",
      "https://github.com/client-org/launch-black-deck"
    );
    fireEvent.click(within(projectRow).getByRole("button", { name: "Complete" }));
    expect(within(screen.getByText("Done Projects").closest(".deck-panel") as HTMLElement).getByText("Launch black deck")).toBeInTheDocument();
    expect(screen.queryByText("EStarzFc")).not.toBeInTheDocument();
    expect(screen.getByText("1 linked GitHub repo")).toBeInTheDocument();
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
    expect(screen.getAllByText(/KSh 500.00/).length).toBeGreaterThan(0);
  }, 15000);

  it("attaches live weather snapshots to journal entries", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (getPathname(url) === "/api/weather/forecast") {
        return jsonResponse({
          provider: "rapidapi-open-weather13",
          checkedAt: "2026-05-22T08:00:00.000Z",
          location: "Nairobi, KE",
          latitude: -1.286389,
          longitude: 36.817223,
          current: {
            provider: "rapidapi-open-weather13",
            location: "Nairobi, KE",
            description: "light rain",
            temperatureC: 21.5,
            feelsLikeC: 22,
            humidity: 68,
            windKph: 14,
            latitude: -1.286389,
            longitude: 36.817223,
            forecastAt: "2026-05-22T09:00:00.000Z",
            capturedAt: "2026-05-22T08:00:00.000Z"
          },
          forecast: []
        });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    clickNav("Journal");
    expect(await screen.findAllByText(/Nairobi, KE \/ light rain \/ 21.5 C/)).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Journal entry"), { target: { value: "Rain shaped the afternoon sprint." } });
    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    const journalCard = screen.getByText("Rain shaped the afternoon sprint.").closest(".journal-card") as HTMLElement;
    expect(within(journalCard).getByText(/Nairobi, KE \/ light rain \/ 21.5 C/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/weather/forecast?latitude=-1.286389&longitude=36.817223&lang=EN"),
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
  });

  it("analyzes food plates from the workout page through the protected backend route", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      if (getPathname(url) === "/api/workout/analyze-food") {
        return jsonResponse({
          foodName: "Breakfast plate",
          calories: 520,
          protein: "21g",
          carbs: "64g",
          fat: "18g",
          recommendations: ["Add water", "Pair with a light walk"],
          provider: "rapidapi-workout-planner"
        });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    clickNav("Workout");
    fireEvent.change(screen.getByLabelText("Food image URL"), { target: { value: "https://example.com/breakfast.jpg" } });
    fireEvent.change(screen.getByLabelText("Nutrition language"), { target: { value: "en" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze plate/i }));

    expect(await screen.findByText("Breakfast plate")).toBeInTheDocument();
    expect(screen.getByText("520 kcal")).toBeInTheDocument();
    expect(screen.getByText("Protein 21g")).toBeInTheDocument();
    expect(screen.getByText("Add water")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Food image URL"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /analyze plate/i }));
    expect(screen.queryByText("Breakfast plate")).not.toBeInTheDocument();
    expect(screen.getByText(/Food analysis failed: Add a public food image URL first./i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expectUrlPath("/api/workout/analyze-food"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ imageUrl: "https://example.com/breakfast.jpg", lang: "en" })
      })
    );
  });

  it("renders the live intel market engine", async () => {
    mockLiveIntelFetch();
    render(<App />);

    clickNav("Intel");

    expect(screen.getByRole("heading", { name: "Market Intel" })).toBeInTheDocument();
    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/KSh 13,000,000.00/)).toBeInTheDocument();
    expect(screen.getByText("(USD)")).toBeInTheDocument();
    expect(screen.getByText("Safaricom")).toBeInTheDocument();
    expect(screen.getByText("Kenya fintech funding rises")).toBeInTheDocument();
    expect(screen.getByText(/1 USD = KSh 130.00/)).toBeInTheDocument();
  });

  it("can manually refresh live crypto intel", async () => {
    const fetchMock = mockLiveIntelFetch();
    render(<App />);

    clickNav("Intel");
    await screen.findByText("Bitcoin");

    const cryptoPanel = screen.getByRole("heading", { name: "Crypto Prices" }).closest(".deck-panel") as HTMLElement;
    fireEvent.click(within(cryptoPanel).getByRole("button", { name: /refresh/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/intel/refresh/crypto"), expect.objectContaining({ method: "POST" })])
    );
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
      expect(vi.mocked(fetch).mock.calls).toContainEqual([
        expectUrlPath("/api/telegram/send"),
        expect.objectContaining({ method: "POST", credentials: "include" })
      ])
    );
  });

  it("uses Copilot system AI for Sentinel replies through the protected backend route", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/health") {
        return jsonResponse({
          agents: [
            { id: "sentinel", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ok" },
            { id: "copilot", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ready" }
          ]
        });
      }
      if (pathname === "/api/system-ai/chat") {
        return jsonResponse({ reply: "Copilot says ship the deployment first.", conversationId: "conv-1", provider: "copilot5" });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open sentinel agent/i }));
    fireEvent.change(screen.getByLabelText("Ask Sentinel"), { target: { value: "Brief me" } });
    fireEvent.click(screen.getByRole("button", { name: /send to sentinel/i }));

    expect(await screen.findByText("Copilot says ship the deployment first.")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([
        expectUrlPath("/api/system-ai/chat"),
        expect.objectContaining({ method: "POST", credentials: "include" })
      ])
    );
    const [, init] = fetchMock.mock.calls.find(([url]) => getPathname(url) === "/api/system-ai/chat") ?? [];
    expect(String(init?.body)).toContain("Northwatch deck snapshot");
  });

  it("can read Copilot replies aloud with selected voice and language", async () => {
    const spoken: Array<{ text: string; lang: string; voice: string | null }> = [];
    const voices = [
      { name: "Amina English", lang: "en-KE", voiceURI: "amina-en-ke" },
      { name: "Sofia Espanol", lang: "es-ES", voiceURI: "sofia-es" }
    ];

    class MockUtterance {
      text: string;
      lang = "";
      voice: { name: string; lang: string; voiceURI: string } | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", {
      getVoices: vi.fn(() => voices),
      cancel: vi.fn(),
      speak: vi.fn((utterance: MockUtterance) => spoken.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice?.voiceURI ?? null }))
    });
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const pathname = getPathname(url);
      if (pathname === "/api/system-ai/chat") {
        return jsonResponse({ reply: "Open [Northwatch](https://northwatch.app) for the briefing.", conversationId: "voice-1", provider: "copilot5" });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open sentinel agent/i }));
    expect(screen.getByRole("heading", { name: /ask, act, or listen/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /turn voice on/i }));
    fireEvent.change(screen.getByLabelText("Speech language"), { target: { value: "en-KE" } });
    fireEvent.change(screen.getByLabelText("Speech voice"), { target: { value: "amina-en-ke" } });
    fireEvent.change(screen.getByLabelText("Ask Sentinel"), { target: { value: "Read my brief" } });
    fireEvent.click(screen.getByRole("button", { name: /send to sentinel/i }));

    expect(await screen.findByText("Open [Northwatch](https://northwatch.app) for the briefing.")).toBeInTheDocument();
    await waitFor(() =>
      expect(spoken).toContainEqual({
        text: "Open Northwatch for the briefing.",
        lang: "en-KE",
        voice: "amina-en-ke"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /turn voice off/i }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("keeps JWTs out of localStorage while keyboard shortcuts and dynamic document titles work", () => {
    render(<App />);

    expect(window.localStorage.getItem("northwatch.session-token.v1")).toBeNull();
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

  it("creates and joins teams from the account workspace controls", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [] });
      }
      if (pathname === "/api/teams" && init?.method === "POST") {
        return jsonResponse({ team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" } }, 201);
      }
      if (pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "owner" }]
        });
      }
      if (pathname === "/api/invites/invite-token/accept") {
        return jsonResponse({
          team: { id: "team-2", name: "Invited Ops", slug: "invited-ops" },
          membership: { userId: "user-1", role: "member" }
        });
      }
      if (pathname === "/api/teams/invited-ops") {
        return jsonResponse({
          team: { id: "team-2", name: "Invited Ops", slug: "invited-ops", role: "member" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "member" }]
        });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));

    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "North Unit" } });
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await waitFor(() => expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/teams"), expect.objectContaining({ method: "POST" })]));
    expect((await screen.findAllByText("North Unit")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Invite link"), { target: { value: "https://northwatch.app/invite/invite-token" } });
    fireEvent.click(screen.getByRole("button", { name: /join team/i }));

    await waitFor(() => expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/invites/invite-token/accept"), expect.objectContaining({ method: "POST" })]));
    expect(await screen.findByText("Team: Invited Ops")).toBeInTheDocument();
  });

  it("creates a visible invite teammate link from the active team workspace", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [] });
      }
      if (pathname === "/api/teams" && init?.method === "POST") {
        return jsonResponse({ team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" } }, 201);
      }
      if (pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "owner" }]
        });
      }
      if (pathname === "/api/teams/north-unit/invites" && init?.method === "POST") {
        return jsonResponse({
          invite: {
            id: "invite-1",
            email: "brian@example.com",
            role: "member",
            status: "pending",
            acceptUrl: "https://northwatch.app/invite/invite-token",
            emailDelivery: { delivered: true, logged: false, reason: "sent" }
          }
        }, 201);
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));

    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "North Unit" } });
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await screen.findByText("Team: North Unit");
    expect(screen.getByRole("link", { name: /invite teammate/i })).toHaveAttribute("href", "/team/north-unit/settings#invites");
    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /invite teammate/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([
        expectUrlPath("/api/teams/north-unit/invites"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "brian@example.com", role: "member" })
        })
      ])
    );
    expect(screen.getByLabelText("Team invite link")).toHaveValue("https://northwatch.app/invite/invite-token");
    const notice = screen.getByText("Invite sent").closest(".team-invite-notification");
    expect(notice).toHaveClass("team-invite-notification-success");
    expect(screen.getByText("Email delivered to brian@example.com.")).toBeInTheDocument();
  });

  it("shows a persistent dashboard invite warning when email delivery is not configured", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [] });
      }
      if (pathname === "/api/teams" && init?.method === "POST") {
        return jsonResponse({ team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" } }, 201);
      }
      if (pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "owner" }]
        });
      }
      if (pathname === "/api/teams/north-unit/invites" && init?.method === "POST") {
        return jsonResponse({
          invite: {
            id: "invite-1",
            email: "brian@example.com",
            role: "member",
            status: "pending",
            acceptUrl: "https://northwatch.app/invite/invite-token",
            emailDelivery: { delivered: false, logged: true, reason: "not_configured" }
          }
        }, 201);
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "North Unit" } });
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await screen.findByText("Team: North Unit");
    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /invite teammate/i }));

    await waitFor(() => expect(screen.getByLabelText("Team invite link")).toHaveValue("https://northwatch.app/invite/invite-token"));
    const notice = screen.getByText("Invite link created").closest(".team-invite-notification");
    expect(notice).toHaveClass("team-invite-notification-warning");
    expect(screen.getByText("Email delivery is not configured. Copy the invite link and send it manually.")).toBeInTheDocument();
  });

  it("shows a persistent dashboard invite failure when email delivery fails", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [] });
      }
      if (pathname === "/api/teams" && init?.method === "POST") {
        return jsonResponse({ team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" } }, 201);
      }
      if (pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "owner" }]
        });
      }
      if (pathname === "/api/teams/north-unit/invites" && init?.method === "POST") {
        return jsonResponse({
          invite: {
            id: "invite-1",
            email: "brian@example.com",
            role: "member",
            status: "pending",
            acceptUrl: "https://northwatch.app/invite/invite-token",
            emailDelivery: { delivered: false, logged: false, reason: "send_failed" }
          }
        }, 201);
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "North Unit" } });
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await screen.findByText("Team: North Unit");
    fireEvent.change(screen.getByLabelText("Teammate email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /invite teammate/i }));

    await waitFor(() => expect(screen.getByLabelText("Team invite link")).toHaveValue("https://northwatch.app/invite/invite-token"));
    const notice = screen.getByText("Invite email failed").closest(".team-invite-notification");
    expect(notice).toHaveClass("team-invite-notification-error");
    expect(screen.getByText("The invite link still works. Copy the invite link and send it manually.")).toBeInTheDocument();
  });

  it("renders an active team workspace as a cooperative war room dashboard", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getPathname(url);
      if (pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [] });
      }
      if (pathname === "/api/teams" && init?.method === "POST") {
        return jsonResponse({ team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" } }, 201);
      }
      if (pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [
            { teamId: "team-1", userId: "user-1", email: "sam@example.com", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" },
            { teamId: "team-1", userId: "user-2", email: "brian@example.com", role: "member", joinedAt: "2026-05-19T12:10:00.000Z" }
          ],
          activity: []
        });
      }
      if (pathname === "/api/documents") {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Account" }));
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "North Unit" } });
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await screen.findByText("Team: North Unit");
    clickNav("Command");

    expect(await screen.findByRole("heading", { name: /north unit war room/i })).toBeInTheDocument();
    expect(screen.getByText(/shared team workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/role owner/i)).toBeInTheDocument();
    expect(screen.getByText(/2 teammates/i)).toBeInTheDocument();
    expect(screen.getByText(/shared modules: tasks, projects, intel, calendar, finances, workout, books, journal/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /invite teammate/i }).map((link) => link.getAttribute("href"))).toContain("/team/north-unit/settings#invites");
  });

  it("opens a team as an isolated shared deck instead of showing personal tasks", async () => {
    window.localStorage.setItem(
      getCommandDeckStorageKey("user-1"),
      JSON.stringify({
        ...freshCommandDeck,
        tasks: [
          {
            id: "task-personal",
            title: "Private personal task",
            priority: "critical",
            kanbanPriority: "urgent",
            dueDate: null,
            status: "pending",
            createdAt: "2026-05-25T08:00:00.000Z",
            updatedAt: "2026-05-25T08:00:00.000Z"
          }
        ],
        settings: { ...freshCommandDeck.settings, callsign: "Sam Personal" }
      })
    );

    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(url), "http://127.0.0.1:5173");
      if (requestUrl.pathname === "/api/teams/mine") {
        return jsonResponse({ teams: [{ id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" }] });
      }
      if (requestUrl.pathname === "/api/teams/north-unit") {
        return jsonResponse({
          team: { id: "team-1", name: "North Unit", slug: "north-unit", role: "owner" },
          members: [{ userId: "user-1", email: "sam@example.com", role: "owner" }],
          activity: []
        });
      }
      if (requestUrl.pathname === "/api/documents" && requestUrl.searchParams.get("workspace_type") === "team") {
        if (init?.method === "POST") return jsonResponse({ data: { id: "team-deck-doc", title: "northwatch-command-deck" } }, 201);
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ agents: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App authUser={{ id: "user-1", email: "sam@example.com", displayName: "Sam", createdAt: "2026-05-19T12:00:00.000Z", lastLogin: null, isActive: true }} />);

    clickNav("To Do");
    expect(screen.getByText("Private personal task")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /workspace personal/i }));
    fireEvent.click(await screen.findByRole("option", { name: /north unit owner/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => {
        const requestUrl = new URL(String(url), "http://127.0.0.1:5173");
        return requestUrl.pathname === "/api/documents" && requestUrl.searchParams.get("workspace_type") === "team" && requestUrl.searchParams.get("team_id") === "team-1";
      })).toBe(true)
    );
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByText("Private personal task")).not.toBeInTheDocument();
    expect(screen.getByText("Team: North Unit")).toBeInTheDocument();
  });

  it("shows per-user Telegram setup instructions in Settings", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open northwatch menu/i }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Northwatch menu" })).getByRole("menuitem", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Connect your Telegram bot" })).toBeInTheDocument();
    expect(screen.queryByText("Session token")).not.toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByText(/@BotFather/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Telegram bot token")).toBeInTheDocument();
    expect(screen.getByLabelText("Telegram chat id")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /save bot/i })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Market Intel" })).toBeInTheDocument();
    expect(screen.getByText("News Feed")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Account" })).not.toBeInTheDocument();
  });

});

function clickNav(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", { name }));
}

function mockLiveIntelFetch() {
  const payload = {
    crypto: {
      status: "live",
      updatedAt: "2026-05-19T08:00:00.000Z",
      items: [
        {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          image: "https://example.com/btc.png",
          priceKes: 13000000,
          priceUsd: 100000,
          change24h: 2.5,
          change24hCurrency: "USD",
          marketCapKes: 250000000000000
        }
      ]
    },
    stocksKenya: {
      status: "live",
      marketOpen: true,
      updatedAt: "2026-05-19T08:00:00.000Z",
      items: [
        {
          ticker: "SCOM",
          company: "Safaricom",
          currency: "KES",
          price: 28.5,
          change: 0.5,
          changePercent: 1.7,
          volume: 1200000,
          weekHigh52: 31,
          weekLow52: 20
        }
      ]
    },
    stocksGlobal: { status: "live", updatedAt: "2026-05-19T08:00:00.000Z", items: [] },
    news: {
      status: "live",
      updatedAt: "2026-05-19T08:00:00.000Z",
      items: [
        {
          id: "news-1",
          title: "Kenya fintech funding rises",
          summary: "Funding moved higher across Kenyan fintech.",
          source: "TechCabal",
          region: "kenya",
          category: "business",
          publishedAt: "2026-05-19T08:00:00.000Z",
          url: "https://techcabal.com/a"
        }
      ]
    },
    forex: {
      status: "live",
      base: "KES",
      updatedAt: "2026-05-19T08:00:00.000Z",
      rates: [
        { code: "USD", flag: "US", oneKesEquals: 0.0076923, kesPerUnit: 130 },
        { code: "EUR", flag: "EU", oneKesEquals: 0.0071, kesPerUnit: 140.84 },
        { code: "GBP", flag: "GB", oneKesEquals: 0.006, kesPerUnit: 166.67 }
      ]
    },
    indicators: {
      status: "live",
      updatedAt: "2026-05-19T08:00:00.000Z",
      items: [
        { label: "CBK Rate", value: "10.00", unit: "%", updatedAt: "2026-05-19T08:00:00.000Z" },
        { label: "Inflation", value: "4.10", unit: "%", updatedAt: "2026-05-19T08:00:00.000Z" },
        { label: "NSE 20 Index", value: "1800", unit: "", updatedAt: "2026-05-19T08:00:00.000Z" }
      ],
      mpesaRates: [{ range: "1 - 100", fee: 0 }]
    }
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/intel/all")) return { ok: true, status: 200, json: async () => payload };
    if (url.includes("/api/intel/refresh/crypto")) return { ok: true, status: 200, json: async () => payload.crypto };
    if (url.includes("/api/intel/forex")) return { ok: true, status: 200, json: async () => payload.forex };
    if (url.includes("/health")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          agents: [
            { id: "sentinel", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ok" },
            { id: "ollama", status: "idle", checkedAt: "2026-05-19T08:00:00.000Z", detail: "idle" },
            { id: "telegram", status: "alive", checkedAt: "2026-05-19T08:00:00.000Z", detail: "ok" }
          ]
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

function expectUrlPath(path: string) {
  return expect.stringMatching(new RegExp(`${escapeRegExp(path)}$`));
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function getPathname(url: RequestInfo | URL) {
  return new URL(String(url), "http://127.0.0.1:5173").pathname;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
