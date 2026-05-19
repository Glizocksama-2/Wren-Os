import { useEffect, useState } from "react";
import App from "../App";
import { AuthProvider, useAuth } from "./AuthContext";
import { AuthChoicePage, LoginPage, RegisterPage } from "./AuthPages";
import { ProtectedRoute } from "./ProtectedRoute";
import { InviteAcceptPage, TeamCreatePage, TeamDashboardPage, TeamSettingsPage } from "../team/TeamPages.jsx";

export default function ProtectedNorthwatch() {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
}

function AuthRouter() {
  const [path, setPath] = useState(window.location.pathname);
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const inviteToken = getInviteToken(path);
  if (inviteToken) return <InviteAcceptPage token={inviteToken} isAuthenticated={isAuthenticated} />;
  if (!isAuthenticated && path === "/register") return <RegisterPage />;
  if (!isAuthenticated && path === "/login") return <LoginPage />;
  if (!isAuthenticated) return <AuthChoicePage />;

  if (path === "/team/create") {
    return (
      <ProtectedRoute>
        <TeamCreatePage />
      </ProtectedRoute>
    );
  }

  const teamSettingsSlug = getTeamSettingsSlug(path);
  if (teamSettingsSlug) {
    return (
      <ProtectedRoute>
        <TeamSettingsPage slug={teamSettingsSlug} />
      </ProtectedRoute>
    );
  }

  const teamSlug = getTeamSlug(path);
  if (teamSlug) {
    return (
      <ProtectedRoute>
        <TeamDashboardPage slug={teamSlug} />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <App key={user?.id ?? "anonymous"} authUser={user} onAuthLogout={logout} />
    </ProtectedRoute>
  );
}

function getInviteToken(path: string) {
  const match = path.match(/^\/invite\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTeamSettingsSlug(path: string) {
  const match = path.match(/^\/team\/([^/]+)\/settings$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTeamSlug(path: string) {
  const match = path.match(/^\/team\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
