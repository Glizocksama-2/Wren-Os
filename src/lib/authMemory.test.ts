import { describe, expect, it } from "vitest";
import {
  AUTH_ACCOUNTS_STORAGE_KEY,
  forgetRememberedAccount,
  loadRememberedAccounts,
  rememberAuthAccount
} from "./authMemory";

describe("auth account memory", () => {
  it("remembers normalized account emails with newest accounts first", () => {
    const storage = window.localStorage;
    storage.clear();

    rememberAuthAccount(" Operator@Northwatch.dev ", "user-1", storage);
    rememberAuthAccount("second@northwatch.dev", null, storage);
    rememberAuthAccount("operator@northwatch.dev", "user-1b", storage);

    expect(loadRememberedAccounts(storage)).toMatchObject([
      { email: "operator@northwatch.dev", userId: "user-1b" },
      { email: "second@northwatch.dev", userId: null }
    ]);
  });

  it("ignores invalid storage and preserves the app instead of crashing auth boot", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(AUTH_ACCOUNTS_STORAGE_KEY, "{bad json");

    expect(loadRememberedAccounts(storage)).toEqual([]);
  });

  it("forgets one remembered account without touching the others", () => {
    const storage = window.localStorage;
    storage.clear();

    rememberAuthAccount("first@northwatch.dev", "first-id", storage);
    rememberAuthAccount("second@northwatch.dev", "second-id", storage);

    expect(forgetRememberedAccount("first@northwatch.dev", storage)).toMatchObject([
      { email: "second@northwatch.dev", userId: "second-id" }
    ]);
  });
});
