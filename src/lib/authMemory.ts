export const AUTH_ACCOUNTS_STORAGE_KEY = "northwatch.auth.accounts.v1";

const MAX_REMEMBERED_ACCOUNTS = 6;

export interface RememberedAuthAccount {
  email: string;
  userId: string | null;
  lastUsedAt: string;
}

type AuthAccountsStorage = Pick<Storage, "getItem" | "setItem">;

interface StoredAuthAccounts {
  version: 1;
  accounts: RememberedAuthAccount[];
}

export function loadRememberedAccounts(storage: AuthAccountsStorage = window.localStorage): RememberedAuthAccount[] {
  const raw = storage.getItem(AUTH_ACCOUNTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthAccounts>;
    if (!Array.isArray(parsed.accounts)) return [];

    return parsed.accounts
      .map(toRememberedAccount)
      .filter((account): account is RememberedAuthAccount => Boolean(account))
      .sort((left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime())
      .slice(0, MAX_REMEMBERED_ACCOUNTS);
  } catch {
    return [];
  }
}

export function rememberAuthAccount(
  email: string,
  userId: string | null = null,
  storage: AuthAccountsStorage = window.localStorage
): RememberedAuthAccount[] {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return loadRememberedAccounts(storage);

  const rememberedAccounts = loadRememberedAccounts(storage);
  const existingAccount = rememberedAccounts.find((account) => account.email === normalizedEmail);
  const nextAccount: RememberedAuthAccount = {
    email: normalizedEmail,
    userId: userId ?? existingAccount?.userId ?? null,
    lastUsedAt: new Date().toISOString()
  };

  return writeRememberedAccounts(
    [nextAccount, ...rememberedAccounts.filter((account) => account.email !== normalizedEmail)].slice(0, MAX_REMEMBERED_ACCOUNTS),
    storage
  );
}

export function forgetRememberedAccount(email: string, storage: AuthAccountsStorage = window.localStorage): RememberedAuthAccount[] {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return loadRememberedAccounts(storage);

  return writeRememberedAccounts(
    loadRememberedAccounts(storage).filter((account) => account.email !== normalizedEmail),
    storage
  );
}

function writeRememberedAccounts(accounts: RememberedAuthAccount[], storage: AuthAccountsStorage): RememberedAuthAccount[] {
  const nextAccounts = accounts
    .map(toRememberedAccount)
    .filter((account): account is RememberedAuthAccount => Boolean(account))
    .slice(0, MAX_REMEMBERED_ACCOUNTS);
  const payload: StoredAuthAccounts = { version: 1, accounts: nextAccounts };
  storage.setItem(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(payload));
  return nextAccounts;
}

function toRememberedAccount(value: unknown): RememberedAuthAccount | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<RememberedAuthAccount>;
  const email = normalizeEmail(candidate.email);
  const lastUsedAt = typeof candidate.lastUsedAt === "string" && !Number.isNaN(Date.parse(candidate.lastUsedAt)) ? candidate.lastUsedAt : "";
  if (!email || !lastUsedAt) return null;

  return {
    email,
    userId: typeof candidate.userId === "string" && candidate.userId.trim() ? candidate.userId : null,
    lastUsedAt
  };
}

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}
