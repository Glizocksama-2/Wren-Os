const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validateRegistrationInput(input) {
  const email = normalizeEmail(input?.email);
  const displayName = normalizeDisplayName(input?.displayName);
  const password = typeof input?.password === "string" ? input.password : "";
  const confirmPassword = typeof input?.confirmPassword === "string" ? input.confirmPassword : "";
  const errors = [];

  if (!EMAIL_PATTERN.test(email)) {
    errors.push("Enter a valid email address.");
  }

  if (!displayName) {
    errors.push("Display name is required.");
  }

  if (!STRONG_PASSWORD_PATTERN.test(password)) {
    errors.push("Password must be at least 8 characters and include 1 uppercase letter and 1 number.");
  }

  if (password !== confirmPassword) {
    errors.push("Password confirmation does not match.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email,
      displayName,
      password
    }
  };
}

export function validateLoginInput(input) {
  const email = normalizeEmail(input?.email);
  const password = typeof input?.password === "string" ? input.password : "";
  const errors = [];

  if (!EMAIL_PATTERN.test(email)) {
    errors.push("Enter a valid email address.");
  }

  if (!password) {
    errors.push("Password is required.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email,
      password,
      rememberMe: Boolean(input?.rememberMe)
    }
  };
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeDisplayName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
