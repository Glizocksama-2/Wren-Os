import { clearAuthCookie } from "../auth/cookies.js";

export function authenticate({ authService }) {
  if (!authService) throw new Error("authenticate middleware requires authService.");

  return async function authenticateRequest(request, response, next) {
    try {
      const verified = await authService.verifyRequest(request);
      if (!verified) {
        throw new Error("Authentication required.");
      }

      request.userId = verified.userId;
      request.user = verified.user;
      request.authSession = verified.session;
      next();
    } catch {
      clearAuthCookie(response);
      response.setHeader("X-Auth-Redirect", "/login");
      response.status(401).json({ error: "Authentication required." });
    }
  };
}
