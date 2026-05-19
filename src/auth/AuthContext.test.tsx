import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { COMMAND_DECK_STORAGE_KEY, freshCommandDeck, getCommandDeckStorageKey } from "../store/commandDeck";
import { AuthProvider, useAuth, type AuthUser } from "./AuthContext";
import { LoginPage, RegisterPage } from "./AuthPages";
import ProtectedNorthwatch from "./ProtectedNorthwatch";
import { ProtectedRoute } from "./ProtectedRoute";

const authUser: AuthUser = {
  id: "user-1",
  email: "operator@northwatch.dev",
  displayName: "Sam Operator",
  createdAt: "2026-05-19T08:00:00.000Z",
  lastLogin: "2026-05-19T08:00:00.000Z",
  isActive: true
};

describe("Northwatch React auth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/login");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs in with remember me through credentialed cookie requests", async () => {
    const fetchMock = mockFetch([
      { ok: false, status: 401, json: async () => ({ error: "Authentication required." }) },
      { ok: true, status: 200, json: async () => ({ user: authUser, expiresAt: "2026-05-26T08:00:00.000Z" }) }
    ]);

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "operator@northwatch.dev" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Watchtower1" } });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email: "operator@northwatch.dev", password: "Watchtower1", rememberMe: true })
        })
      )
    );
    expect(window.localStorage.getItem("northwatch_session")).toBeNull();
  });

  it("validates registration confirmation before calling the backend", async () => {
    const fetchMock = mockFetch([{ ok: false, status: 401, json: async () => ({ error: "Authentication required." }) }]);

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    );

    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "new@northwatch.dev" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "New Operator" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Watchtower1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Different1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText("Password confirmation does not match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/auth/register", expect.anything());
  });

  it("lets signed-out users choose sign in or sign up without a magic link", async () => {
    mockFetch([{ ok: false, status: 401, json: async () => ({ error: "Authentication required." }) }]);
    window.history.replaceState(null, "", "/");

    render(<ProtectedNorthwatch />);

    expect(await screen.findByRole("heading", { name: "Choose how to enter Northwatch." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
    expect(screen.queryByText(/magic link/i)).not.toBeInTheDocument();
  });

  it("shows a loading state while protected routes verify the httpOnly cookie session", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <AuthProvider>
        <ProtectedRoute>
          <div>Private Northwatch</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    expect(screen.getByText(/checking private access/i)).toBeInTheDocument();
    expect(screen.queryByText("Private Northwatch")).not.toBeInTheDocument();
  });

  it("shows a session expired modal when refresh fails mid-session", async () => {
    mockFetch([
      { ok: true, status: 200, json: async () => ({ user: authUser, expiresAt: "2026-05-26T08:00:00.000Z" }) },
      { ok: false, status: 401, json: async () => ({ error: "Authentication required." }) }
    ]);

    function RefreshButton() {
      const { refresh } = useAuth();
      return <button onClick={() => void refresh()}>Force refresh</button>;
    }

    render(
      <AuthProvider>
        <RefreshButton />
      </AuthProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Force refresh" }));

    expect(await screen.findByText("Session expired. Please log in again.")).toBeInTheDocument();
  });

  it("shows the authenticated display name and adopts the previous browser deck for a new account", () => {
    window.localStorage.setItem(COMMAND_DECK_STORAGE_KEY, JSON.stringify({ settings: { callsign: "Old Browser User" } }));

    render(<App authUser={authUser} onAuthLogout={vi.fn()} />);

    const topbar = screen.getAllByRole("banner").find((element) => element.classList.contains("deck-topbar")) as HTMLElement;
    expect(within(topbar).getByText("Sam Operator")).toBeInTheDocument();
    expect(within(topbar).getByText("SO")).toBeInTheDocument();
    expect(window.localStorage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Old Browser User");
    expect(screen.getByText("Old Browser User")).toBeInTheDocument();
  });

  it("imports the legacy Supabase deck saved under the same email when the account is empty", async () => {
    const legacyTask = {
      id: "legacy-cloud-task",
      title: "Recovered cloud task",
      priority: "critical",
      kanbanPriority: "urgent",
      dueDate: null,
      status: "todo",
      createdAt: "2026-05-19T13:59:20.008Z",
      updatedAt: "2026-05-19T13:59:20.008Z"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/legacy-command-deck") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              deck: {
                ...freshCommandDeck,
                tasks: [legacyTask],
                settings: { ...freshCommandDeck.settings, callsign: "Email Vault" }
              },
              updatedAt: "2026-05-19T13:59:20.008Z"
            })
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      })
    );

    render(<App authUser={authUser} onAuthLogout={vi.fn()} />);

    expect(await screen.findByText("Recovered cloud task")).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Recovered cloud task"));
  });

  it("retries old email recovery after a stale v1 no-data marker and merges with current account data", async () => {
    const currentTask = {
      id: "current-account-task",
      title: "Current account task",
      priority: "medium",
      kanbanPriority: "normal",
      dueDate: null,
      status: "todo",
      createdAt: "2026-05-19T14:00:20.008Z",
      updatedAt: "2026-05-19T14:00:20.008Z"
    };
    const legacyTask = {
      id: "legacy-cloud-task",
      title: "Recovered email task",
      priority: "critical",
      kanbanPriority: "urgent",
      dueDate: null,
      status: "todo",
      createdAt: "2026-05-19T13:59:20.008Z",
      updatedAt: "2026-05-19T13:59:20.008Z"
    };
    window.localStorage.setItem(
      getCommandDeckStorageKey("user-1"),
      JSON.stringify({
        ...freshCommandDeck,
        tasks: [currentTask]
      })
    );
    window.localStorage.setItem("northwatch.legacy-cloud-import.v1:user-1", "none");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/legacy-command-deck") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              deck: {
                ...freshCommandDeck,
                tasks: [legacyTask],
                settings: { ...freshCommandDeck.settings, callsign: "Email Vault" }
              },
              updatedAt: "2026-05-19T13:59:20.008Z"
            })
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      })
    );

    render(<App authUser={authUser} onAuthLogout={vi.fn()} />);

    expect(await screen.findByText("Recovered email task")).toBeInTheDocument();
    expect(screen.getByText("Current account task")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Recovered email task");
      expect(window.localStorage.getItem(getCommandDeckStorageKey("user-1"))).toContain("Current account task");
    });
    expect(window.localStorage.getItem("northwatch.legacy-cloud-import.v2:user-1")).toBe("2026-05-19T13:59:20.008Z");
  });
});

function mockFetch(responses: Array<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
  const fetchMock = vi.fn(async () => {
    const response = responses.shift();
    return response ?? { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
