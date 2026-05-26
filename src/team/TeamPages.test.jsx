import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { freshCommandDeck } from "../store/commandDeck";
import {
  InviteAcceptPage,
  NotificationBell,
  TeamCreatePage,
  TeamDashboardPage,
  TeamSettingsPage,
  WorkspaceSwitcher
} from "./TeamPages.jsx";

describe("Northwatch team UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("lets a user create a team from a name with an editable generated slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "owner" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<TeamCreatePage />);

    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Birunda Farms" } });
    expect(screen.getByLabelText("Team slug")).toHaveValue("birunda-farms");
    fireEvent.click(screen.getByRole("button", { name: /create team/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/teams"), expect.objectContaining({ method: "POST", credentials: "include" })])
    );
    expect(window.location.pathname).toBe("/team/birunda-farms");
  });

  it("lets a signed-in user paste an invite link on the create or join page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        team: { id: "team-2", name: "North Unit", slug: "north-unit" },
        membership: { userId: "user-1", role: "member" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TeamCreatePage />);

    fireEvent.change(screen.getByLabelText("Invite link"), { target: { value: "https://northwatch.app/invite/invite-token" } });
    fireEvent.click(screen.getByRole("button", { name: /join team/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/invites/invite-token/accept"), expect.objectContaining({ method: "POST", credentials: "include" })])
    );
    expect(window.location.pathname).toBe("/team/north-unit");
  });

  it("shows a workspace switcher with personal, team, and create/join options", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ teams: [{ id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "admin" }] })));
    const onWorkspaceChange = vi.fn();

    render(<WorkspaceSwitcher activeWorkspace={{ type: "personal" }} onWorkspaceChange={onWorkspaceChange} />);

    fireEvent.click(await screen.findByRole("button", { name: /workspace personal/i }));
    expect(screen.getByRole("link", { name: /create or join team/i })).toHaveAttribute("href", "/team/create");
    fireEvent.click(screen.getByRole("option", { name: /birunda farms admin/i }));

    expect(onWorkspaceChange).toHaveBeenCalledWith({ type: "team", teamId: "team-1", slug: "birunda-farms", name: "Birunda Farms", role: "admin" });
  });

  it("renders a team dashboard with members, recent activity, and workspace shortcuts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "member" },
          members: [{ userId: "user-1", displayName: "Sam", role: "member", joinedAt: "2026-05-19T12:00:00.000Z" }],
          activity: [{ id: "activity-1", actorName: "Sam", action: "created task", itemName: "Fix n8n node", createdAt: "2026-05-19T12:00:00.000Z" }]
        })
      )
    );

    render(<TeamDashboardPage slug="birunda-farms" />);

    expect(await screen.findByRole("heading", { name: /Birunda Farms War Room/i })).toBeInTheDocument();
    expect(screen.getByText(/Sam created task Fix n8n node/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open kanban/i })).toHaveAttribute("href", "/?workspace=team&team=birunda-farms&section=kanban");
  });

  it("shows a direct invite teammate button for team admins on the dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "owner" },
          members: [{ userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }],
          activity: []
        })
      )
    );

    render(<TeamDashboardPage slug="birunda-farms" />);

    expect(await screen.findByRole("link", { name: /invite teammate/i })).toHaveAttribute("href", "/team/birunda-farms/settings#invites");
  });

  it("loads shared command deck metrics into the team war room dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "owner" },
            members: [
              { userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" },
              { userId: "user-2", displayName: "Brian", role: "member", joinedAt: "2026-05-19T12:10:00.000Z" }
            ],
            activity: [{ id: "activity-1", actorName: "Sam", action: "updated project", itemName: "Client Portal", createdAt: "2026-05-19T12:15:00.000Z" }]
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: "deck-doc-1",
                title: "northwatch-command-deck",
                payload: {
                  kind: "northwatch_command_deck",
                  deck: {
                    ...freshCommandDeck,
                    tasks: [
                      { id: "task-1", title: "Ship shared board", priority: "high", kanbanPriority: "urgent", dueDate: null, status: "pending", createdAt: "2026-05-19T12:00:00.000Z", updatedAt: "2026-05-19T12:00:00.000Z" },
                      { id: "task-2", title: "Review handoff", priority: "medium", kanbanPriority: "normal", dueDate: null, status: "in_progress", createdAt: "2026-05-19T12:05:00.000Z", updatedAt: "2026-05-19T12:05:00.000Z" }
                    ],
                    projects: [
                      { id: "project-1", name: "Client Portal", objective: "Launch", nextAction: "Review sprint", status: "pending", dueDate: null, progress: 42, source: "manual", repositoryUrl: null, language: null, visibility: null, defaultBranch: null, lastPushedAt: null, openIssues: 0, openPullRequests: 0, createdAt: "2026-05-19T12:00:00.000Z", updatedAt: "2026-05-19T12:00:00.000Z" }
                    ],
                    finances: [{ id: "finance-1", label: "Team budget", type: "income", amount: 12000, date: "2026-05-19", status: "cleared" }],
                    intel: [{ id: "intel-1", title: "NSE Watch", symbol: "NSE", kind: "stock", signal: "watching", thesis: "Market pulse", sourceUrl: null, notes: [], createdAt: "2026-05-19T12:00:00.000Z", updatedAt: "2026-05-19T12:00:00.000Z" }]
                  }
                },
                updatedAt: "2026-05-19T12:20:00.000Z"
              }
            ]
          })
        )
    );

    render(<TeamDashboardPage slug="birunda-farms" />);

    expect(await screen.findByRole("heading", { name: /birunda farms war room/i })).toBeInTheDocument();
    expect(screen.getByText(/2 teammates/i)).toBeInTheDocument();
    expect(screen.getByText(/2 active orders/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pending project/i)).toBeInTheDocument();
    expect(screen.getByText(/KSh 12,000.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Sam updated project Client Portal/i)).toBeInTheDocument();
  });

  it("renders team settings with member management, invites, and owner delete confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            team: { id: "team-1", name: "Birunda Farms", slug: "birunda-farms", role: "owner", memberLimit: 10 },
            members: [{ userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }]
          })
        )
        .mockResolvedValueOnce(jsonResponse({ invites: [{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending" }] }))
    );

    render(<TeamSettingsPage slug="birunda-farms" />);

    expect(await screen.findByRole("heading", { name: /team settings/i })).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("brian@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete team/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirm team name"), { target: { value: "Birunda Farms" } });
    expect(screen.getByRole("button", { name: /delete team/i })).not.toBeDisabled();
  });

  it("still loads team settings when pending invites cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            team: { id: "team-1", name: "Gorosei", slug: "gorosei", role: "owner", memberLimit: 10 },
            members: [{ userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }],
            activity: []
          })
        )
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => "<!doctype html><html><body>database route failed</body></html>",
          json: async () => {
            throw new SyntaxError("Unexpected token <");
          }
        })
    );

    render(<TeamSettingsPage slug="gorosei" />);

    expect(await screen.findByRole("heading", { name: /team settings/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gorosei")).toBeInTheDocument();
    expect(screen.getByText(/Pending invites could not be loaded/i)).toBeInTheDocument();
  });

  it("shows a success notification when an invite email is delivered", async () => {
    const teamResponse = {
      team: { id: "team-1", name: "Gorosei", slug: "gorosei", role: "owner", memberLimit: 10 },
      members: [{ userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }],
      activity: []
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [] }))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              invite: {
                id: "invite-1",
                email: "brian@example.com",
                role: "member",
                status: "pending",
                acceptUrl: "https://northwatch.app/invite/invite-token",
                emailDelivery: { delivered: true, logged: false, reason: "sent" }
              }
            },
            201
          )
        )
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending", acceptUrl: "https://northwatch.app/invite/invite-token" }] }))
    );

    render(<TeamSettingsPage slug="gorosei" />);

    expect(await screen.findByRole("heading", { name: /team settings/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveClass("team-invite-notification-success");
    expect(screen.getByText("Invite sent")).toBeInTheDocument();
    expect(screen.getByText(/Email delivered to brian@example.com/i)).toBeInTheDocument();
  });

  it("shows a warning notification when an invite link was created but email delivery is not configured", async () => {
    const teamResponse = {
      team: { id: "team-1", name: "Gorosei", slug: "gorosei", role: "owner", memberLimit: 10 },
      members: [{ userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }],
      activity: []
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [] }))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              invite: {
                id: "invite-1",
                email: "brian@example.com",
                role: "member",
                status: "pending",
                acceptUrl: "https://northwatch.app/invite/invite-token",
                emailDelivery: { delivered: false, logged: true, reason: "not_configured" }
              }
            },
            201
          )
        )
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending", acceptUrl: "https://northwatch.app/invite/invite-token" }] }))
    );

    render(<TeamSettingsPage slug="gorosei" />);

    expect(await screen.findByRole("heading", { name: /team settings/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveClass("team-invite-notification-warning");
    expect(screen.getByText("Invite link created")).toBeInTheDocument();
    expect(screen.getByText(/Email delivery is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy the invite link and send it manually/i)).toBeInTheDocument();
  });

  it("shows a failure notification when invite email delivery fails", async () => {
    const teamResponse = {
      team: { id: "team-1", name: "Gorosei", slug: "gorosei", role: "owner", memberLimit: 10 },
      members: [{ userId: "user-1", displayName: "Sam", role: "owner", joinedAt: "2026-05-19T12:00:00.000Z" }],
      activity: []
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [] }))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              invite: {
                id: "invite-1",
                email: "brian@example.com",
                role: "member",
                status: "pending",
                acceptUrl: "https://northwatch.app/invite/invite-token",
                emailDelivery: { delivered: false, logged: false, reason: "send_failed" }
              }
            },
            201
          )
        )
        .mockResolvedValueOnce(jsonResponse(teamResponse))
        .mockResolvedValueOnce(jsonResponse({ invites: [{ id: "invite-1", email: "brian@example.com", role: "member", status: "pending", acceptUrl: "https://northwatch.app/invite/invite-token" }] }))
    );

    render(<TeamSettingsPage slug="gorosei" />);

    expect(await screen.findByRole("heading", { name: /team settings/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "brian@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveClass("team-invite-notification-error");
    expect(screen.getByText("Invite email failed")).toBeInTheDocument();
    expect(screen.getByText(/The invite link still works/i)).toBeInTheDocument();
  });

  it("previews invites publicly and redirects unauthenticated users to credential auth links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ invite: { teamName: "Birunda Farms", inviterName: "Admin", role: "member", status: "pending" } }))
    );

    render(<InviteAcceptPage token="invite-token" isAuthenticated={false} />);

    expect(await screen.findByText(/Admin invited you to join Birunda Farms/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?redirect=%2Finvite%2Finvite-token");
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/register?redirect=%2Finvite%2Finvite-token");
  });

  it("points new invite recipients to sign up before joining the team", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ invite: { teamName: "Birunda Farms", inviterName: "Admin", role: "member", status: "pending", recipientExists: false } }))
    );

    render(<InviteAcceptPage token="invite-token" isAuthenticated={false} />);

    expect(await screen.findByText(/create an account to join Birunda Farms/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up to join/i })).toHaveAttribute("href", "/register?redirect=%2Finvite%2Finvite-token");
    expect(screen.getByRole("link", { name: /already have an account/i })).toHaveAttribute("href", "/login?redirect=%2Finvite%2Finvite-token");
  });

  it("shows unread notifications in a bell dropdown and can mark them read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ unreadCount: 1, notifications: [{ id: "note-1", message: "You were added to Birunda Farms", link: "/team/birunda-farms", isRead: false, createdAt: "2026-05-19T12:00:00.000Z" }] }))
      .mockResolvedValueOnce(jsonResponse({ updated: 1 }))
      .mockResolvedValueOnce(jsonResponse({ unreadCount: 0, notifications: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);

    fireEvent.click(await screen.findByRole("button", { name: /notifications 1 unread/i }));
    expect(screen.getByText(/You were added/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls).toContainEqual([expectUrlPath("/api/notifications/read-all"), expect.objectContaining({ method: "POST" })])
    );
  });
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function expectUrlPath(path) {
  return expect.stringMatching(new RegExp(`${escapeRegExp(path)}$`));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
