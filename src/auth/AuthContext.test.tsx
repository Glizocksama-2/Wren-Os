import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { COMMAND_DECK_STORAGE_KEY, getCommandDeckStorageKey } from "../store/commandDeck";
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
});

function mockFetch(responses: Array<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
  const fetchMock = vi.fn(async () => {
    const response = responses.shift();
    return response ?? { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
