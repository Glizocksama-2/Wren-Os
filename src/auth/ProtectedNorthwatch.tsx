import { useEffect, useState } from "react";
import App from "../App";
import { AuthProvider, useAuth } from "./AuthContext";
import { AuthChoicePage, LoginPage, RegisterPage } from "./AuthPages";
import { ProtectedRoute } from "./ProtectedRoute";

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

  if (!isAuthenticated && path === "/register") return <RegisterPage />;
  if (!isAuthenticated && path === "/login") return <LoginPage />;
  if (!isAuthenticated) return <AuthChoicePage />;

  return (
    <ProtectedRoute>
      <App key={user?.id ?? "anonymous"} authUser={user} onAuthLogout={logout} />
    </ProtectedRoute>
  );
}
