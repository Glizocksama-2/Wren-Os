import { describe, expect, it } from "vitest";
import { validateLoginInput, validateRegistrationInput } from "./validation.js";

describe("auth validation", () => {
  it("accepts and normalizes a valid registration payload", () => {
    expect(
      validateRegistrationInput({
        email: " Operator@Northwatch.Dev ",
        displayName: " Sam Operator ",
        password: "Watchtower1",
        confirmPassword: "Watchtower1"
      })
    ).toEqual({
      ok: true,
      value: {
        email: "operator@northwatch.dev",
        displayName: "Sam Operator",
        password: "Watchtower1"
      }
    });
  });

  it("rejects invalid email, blank display name, weak password, and mismatched confirmation", () => {
    const result = validateRegistrationInput({
      email: "not-email",
      displayName: "  ",
      password: "weak",
      confirmPassword: "different"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Enter a valid email address.",
        "Display name is required.",
        "Password must be at least 8 characters and include 1 uppercase letter and 1 number.",
        "Password confirmation does not match."
      ])
    );
  });

  it("accepts and normalizes login input with remember me", () => {
    expect(validateLoginInput({ email: " User@Example.COM ", password: "Watchtower1", rememberMe: true })).toEqual({
      ok: true,
      value: {
        email: "user@example.com",
        password: "Watchtower1",
        rememberMe: true
      }
    });
  });

  it("rejects missing login credentials", () => {
    const result = validateLoginInput({ email: "bad", password: "" });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(["Enter a valid email address.", "Password is required."]));
  });
});
