export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  expiresAt: string;
}

export class AuthApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const authApiBaseUrl = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");

export async function getMe(): Promise<AuthResponse> {
  return authRequest("/auth/me", { method: "GET" });
}

export async function login(input: { email: string; password: string; rememberMe: boolean }): Promise<AuthResponse> {
  return authRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function register(input: { email: string; displayName: string; password: string; confirmPassword: string; rememberMe: boolean }): Promise<AuthResponse> {
  return authRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function logout(): Promise<void> {
  await authRequest("/auth/logout", { method: "POST" });
}

export async function refresh(): Promise<AuthResponse> {
  return authRequest("/auth/refresh", { method: "POST" });
}

async function authRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${authApiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    let message = "Authentication request failed.";
    try {
      const parsed = await response.json() as { error?: string; errors?: string[] };
      message = parsed.error ?? parsed.errors?.join(" ") ?? message;
    } catch {
      // Preserve the generic message when the response has no JSON body.
    }
    throw new AuthApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
