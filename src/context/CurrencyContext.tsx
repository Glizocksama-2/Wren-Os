import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface CurrencyContextValue {
  usdKesRate: number;
  lastUpdated: string | null;
  isLoading: boolean;
}

const DEFAULT_USD_KES_RATE = 130;
const CurrencyContext = createContext<CurrencyContextValue>({
  usdKesRate: DEFAULT_USD_KES_RATE,
  lastUpdated: null,
  isLoading: false
});

const authApiBaseUrl = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [usdKesRate, setUsdKesRate] = useState(DEFAULT_USD_KES_RATE);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function refreshRate() {
      setIsLoading(true);
      try {
        const response = await fetch(`${authApiBaseUrl}/api/intel/forex`, {
          credentials: "include",
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { rates?: Array<{ code: string; kesPerUnit?: number }>; updatedAt?: string };
        const usd = payload.rates?.find((rate) => rate.code === "USD");
        if (!isCancelled && usd?.kesPerUnit && Number.isFinite(usd.kesPerUnit)) {
          setUsdKesRate(usd.kesPerUnit);
          setLastUpdated(payload.updatedAt ?? new Date().toISOString());
        }
      } catch {
        // Keep the last usable rate; KSH formatting should never block the app.
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void refreshRate();
    const timer = window.setInterval(refreshRate, 15 * 60 * 1000);
    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const value = useMemo(() => ({ usdKesRate, lastUpdated, isLoading }), [usdKesRate, lastUpdated, isLoading]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
