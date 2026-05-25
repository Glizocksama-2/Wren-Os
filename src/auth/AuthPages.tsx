import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { AuthApiError } from "./api";
import { useAuth } from "./AuthContext";

export function AuthChoicePage() {
  return (
    <main className="auth-screen">
      <section className="auth-panel auth-panel-wide">
        <div className="auth-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="micro-label">Northwatch secure access</span>
        <h1>Choose how to enter Northwatch.</h1>
        <p>Sign in with your existing account or create a new one with email and password. Credentials only.</p>
        <div className="auth-choice-actions">
          <a href="/login">
            <LockKeyhole size={16} /> Sign in
          </a>
          <a href="/register">
            <UserRound size={16} /> Sign up
          </a>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      await login({ email, password, rememberMe });
    } catch (error) {
      setMessage(getAuthMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel auth-panel-wide">
        <div className="auth-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="micro-label">Northwatch secure access</span>
        <h1>Log in to Northwatch.</h1>
        <p>Use your operator account to open your isolated command deck.</p>
        <form className="auth-stack-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <label className="auth-check">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <button type="submit" disabled={isSubmitting}>
            <Mail size={16} /> {isSubmitting ? "Logging in" : "Log in"}
          </button>
        </form>
        {message && <p className="auth-error">{message}</p>}
        <a className="auth-switch-link" href={buildAuthPath("/register")}>Don't have an account? Register</a>
      </section>
    </main>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, displayName, password, confirmPassword, rememberMe: true });
    } catch (error) {
      setMessage(getAuthMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-panel auth-panel-wide">
        <div className="auth-mark">
          <UserRound size={24} />
        </div>
        <span className="micro-label">New Northwatch account</span>
        <h1>Create your account.</h1>
        <p>Every card, project, document, agent setting, and token is created under your user id.</p>
        <form className="auth-stack-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            <span>Display name</span>
            <input aria-label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
          </label>
          <label>
            <span>Password</span>
            <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label>
            <span>Confirm password</span>
            <input aria-label="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <button type="submit" disabled={isSubmitting}>
            <UserRound size={16} /> {isSubmitting ? "Creating" : "Create account"}
          </button>
        </form>
        {message && <p className="auth-error">{message}</p>}
        <a className="auth-switch-link" href={buildAuthPath("/login")}>Already have an account? Log in</a>
      </section>
    </main>
  );
}

export function AuthLoadingScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-mark auth-spinner" aria-hidden="true" />
        <span className="micro-label">Northwatch secure boot</span>
        <h1>Checking private access.</h1>
        <p>Verifying your httpOnly session cookie.</p>
      </section>
    </main>
  );
}

function getAuthMessage(error: unknown) {
  if (error instanceof AuthApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Northwatch auth failed.";
}

function buildAuthPath(path: "/login" | "/register") {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  return redirect?.startsWith("/") ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
