import { clearAuthCookie, setAuthCookie } from "../auth/cookies.js";
import { validateLoginInput, validateRegistrationInput } from "../auth/validation.js";

export function createAuthRouter({ express, authService }) {
  const router = express.Router();

  router.post("/register", async (request, response) => {
    const validation = validateRegistrationInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ errors: validation.errors });
      return;
    }

    try {
      const result = await authService.register({
        ...validation.value,
        rememberMe: Boolean(request.body?.rememberMe),
        ipAddress: getClientIp(request),
        userAgent: request.get("user-agent") ?? ""
      });
      setAuthCookie(response, result.token, { rememberMe: Boolean(request.body?.rememberMe) });
      response.status(201).json({ user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.post("/login", async (request, response) => {
    const validation = validateLoginInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ errors: validation.errors });
      return;
    }

    try {
      const result = await authService.login({
        ...validation.value,
        ipAddress: getClientIp(request),
        userAgent: request.get("user-agent") ?? ""
      });
      setAuthCookie(response, result.token, { rememberMe: validation.value.rememberMe });
      response.status(200).json({ user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      response.status(error.status ?? 500).json({ error: error.message });
    }
  });

  router.post("/logout", async (request, response) => {
    const token = request.cookies?.northwatch_session ?? getBearerToken(request.headers.authorization);
    await authService.logout(token);
    clearAuthCookie(response);
    response.status(200).json({ ok: true });
  });

  router.post("/refresh", async (request, response) => {
    const token = request.cookies?.northwatch_session ?? getBearerToken(request.headers.authorization);
    try {
      const result = await authService.refresh(token, {
        ipAddress: getClientIp(request),
        userAgent: request.get("user-agent") ?? ""
      });
      if (result.rotated) {
        setAuthCookie(response, result.token, { rememberMe: result.rememberMe });
      }
      response.status(200).json({ user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      clearAuthCookie(response);
      response.setHeader("X-Auth-Redirect", "/login");
      response.status(error.status ?? 401).json({ error: "Authentication required." });
    }
  });

  router.get("/me", async (request, response) => {
    try {
      const result = await authService.verifyRequest(request);
      if (!result) throw new Error("Authentication required.");
      response.status(200).json({ user: result.user, expiresAt: result.expiresAt });
    } catch {
      clearAuthCookie(response);
      response.setHeader("X-Auth-Redirect", "/login");
      response.status(401).json({ error: "Authentication required." });
    }
  });

  return router;
}

function getClientIp(request) {
  return request.ip || request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}

function getBearerToken(value) {
  if (typeof value !== "string") return null;
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}
