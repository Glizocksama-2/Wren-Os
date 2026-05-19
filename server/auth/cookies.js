export const AUTH_COOKIE_NAME = "northwatch_session";
export const ACCESS_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getAuthCookieOptions({ rememberMe = true } = {}) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  };

  if (rememberMe) {
    options.maxAge = ACCESS_TOKEN_MAX_AGE_MS;
  }

  return options;
}

export function setAuthCookie(response, token, { rememberMe = true } = {}) {
  response.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions({ rememberMe }));
}

export function clearAuthCookie(response) {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
