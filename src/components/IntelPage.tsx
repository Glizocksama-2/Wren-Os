import { BarChart3, ChevronDown, ExternalLink, Newspaper, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { toKSH, usdToKSH } from "../utils/currency";

type IntelStatus = "live" | "cache" | "stale" | "empty";

interface IntelEnvelope<T> {
  status?: IntelStatus;
  updatedAt?: string;
  errors?: string[];
  items?: T[];
  marketOpen?: boolean;
  base?: string;
  rates?: ForexRate[];
  mpesaRates?: MpesaRate[];
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  category: string;
  publishedAt: string;
  url: string;
}

interface CryptoItem {
  id: string;
  name: string;
  symbol: string;
  image: string;
  priceKes: number;
  priceUsd: number;
  change24h: number;
  change24hCurrency?: string;
  marketCapKes: number;
}

interface StockItem {
  ticker: string;
  company: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
  marketCap?: number;
}

interface ForexRate {
  code: string;
  flag: string;
  oneKesEquals: number;
  kesPerUnit: number;
}

interface IndicatorItem {
  label: string;
  value: string | null;
  unit: string;
  updatedAt?: string;
}

interface MpesaRate {
  range: string;
  fee: number;
}

interface IntelPayload {
  news?: IntelEnvelope<NewsItem>;
  crypto?: IntelEnvelope<CryptoItem>;
  stocksKenya?: IntelEnvelope<StockItem>;
  stocksGlobal?: IntelEnvelope<StockItem>;
  forex?: IntelEnvelope<never>;
  indicators?: IntelEnvelope<IndicatorItem>;
}

const authApiBaseUrl = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");
const NEWS_TABS = ["kenya", "africa", "tech", "business", "crypto", "global"] as const;
const CRYPTO_TABS = ["all", "top10", "gainers", "losers"] as const;
const SORT_LABELS = { marketCap: "Market cap", price: "Price", change: "24h change" };

export function IntelPage({ onNotice }: { onNotice: (message: string) => void }) {
  const { usdKesRate } = useCurrency();
  const [data, setData] = useState<IntelPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoTab, setCryptoTab] = useState<(typeof CRYPTO_TABS)[number]>("all");
  const [cryptoSort, setCryptoSort] = useState<"marketCap" | "price" | "change">("marketCap");
  const [newsTab, setNewsTab] = useState<(typeof NEWS_TABS)[number]>("kenya");
  const [newsPage, setNewsPage] = useState(1);
  const [newArticleCount, setNewArticleCount] = useState(0);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [moreForexOpen, setMoreForexOpen] = useState(false);
  const firstNewsUrlRef = useRef<string | null>(null);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      const payload = await getIntel<IntelPayload>("/api/intel/all");
      setData(payload);
      firstNewsUrlRef.current = payload.news?.items?.[0]?.url ?? null;
      onNotice("Live intel refreshed.");
    } catch (error) {
      onNotice(`Live intel unavailable: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSection = async (type: "crypto" | "news" | "forex" | "stocks-kenya" | "stocks-global" | "indicators") => {
    try {
      const payload = await getIntel(`/api/intel/refresh/${type}`, { method: "POST" });
      setData((current) => mergeSectionPayload(current, type, payload));
      onNotice(`${type.replace("-", " ")} refreshed.`);
    } catch (error) {
      onNotice(`Refresh failed: ${getErrorMessage(error)}`);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    const cryptoTimer = window.setInterval(() => void refreshSection("crypto"), 60 * 1000);
    const newsTimer = window.setInterval(async () => {
      try {
        const payload = await getIntel<IntelEnvelope<NewsItem>>("/api/intel/news?limit=10");
        const firstUrl = payload.items?.[0]?.url ?? null;
        if (firstNewsUrlRef.current && firstUrl && firstUrl !== firstNewsUrlRef.current) {
          setNewArticleCount((count) => count + 1);
        }
        setData((current) => ({ ...(current ?? {}), news: payload }));
      } catch {
        // Keep the existing feed visible if one poll fails.
      }
    }, 10 * 60 * 1000);
    const forexTimer = window.setInterval(() => void refreshSection("forex"), 15 * 60 * 1000);
    const stockTimer = window.setInterval(() => void refreshSection("stocks-kenya"), isMarketOpen(data?.stocksKenya) ? 5 * 60 * 1000 : 30 * 60 * 1000);
    return () => {
      window.clearInterval(cryptoTimer);
      window.clearInterval(newsTimer);
      window.clearInterval(forexTimer);
      window.clearInterval(stockTimer);
    };
  }, [data?.stocksKenya?.marketOpen]);

  const cryptoItems = useMemo(() => {
    let items = [...(data?.crypto?.items ?? [])];
    if (cryptoTab === "top10") items = items.slice(0, 10);
    if (cryptoTab === "gainers") items = items.filter((item) => item.change24h > 0);
    if (cryptoTab === "losers") items = items.filter((item) => item.change24h < 0);
    return items.sort((left, right) => {
      if (cryptoSort === "price") return right.priceKes - left.priceKes;
      if (cryptoSort === "change") return right.change24h - left.change24h;
      return right.marketCapKes - left.marketCapKes;
    });
  }, [cryptoSort, cryptoTab, data?.crypto?.items]);

  const newsItems = useMemo(() => filterNews(data?.news?.items ?? [], newsTab), [data?.news?.items, newsTab]);
  const visibleNews = newsItems.slice(0, newsPage * 10);
  const usdRate = data?.forex?.rates?.find((rate) => rate.code === "USD")?.kesPerUnit ?? usdKesRate;
  const primaryForex = (data?.forex?.rates ?? []).filter((rate) => ["USD", "EUR", "GBP"].includes(rate.code));
  const secondaryForex = (data?.forex?.rates ?? []).filter((rate) => !["USD", "EUR", "GBP"].includes(rate.code));
  const indicators = data?.indicators?.items ?? [];
  const cbk = indicators.find((item) => /CBK/i.test(item.label));
  const inflation = indicators.find((item) => /Inflation/i.test(item.label));
  const nse20 = indicators.find((item) => /NSE 20/i.test(item.label));

  return (
    <ModuleFrame title="Market Intel" description="Live Kenyan, African, crypto, forex, and global market signals.">
      <section className="market-pulse-bar" aria-label="Kenya market pulse">
        <div>
          {buildPulseItems(data, usdRate).map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="intel-section-grid economic-snapshot">
        <SnapshotCard label="CBK Rate" value={formatIndicator(cbk)} updatedAt={cbk?.updatedAt ?? data?.indicators?.updatedAt} />
        <SnapshotCard label="Inflation" value={formatIndicator(inflation)} updatedAt={inflation?.updatedAt ?? data?.indicators?.updatedAt} />
        <SnapshotCard label="NSE 20 Index" value={formatIndicator(nse20)} updatedAt={nse20?.updatedAt ?? data?.indicators?.updatedAt} />
        <SnapshotCard label="KSH/USD" value={usdRate ? toKSH(usdRate, 2) : "Data unavailable"} updatedAt={data?.forex?.updatedAt} />
      </section>

      <section className="deck-panel live-intel-panel">
        <PanelTitle title="Crypto Prices" status={data?.crypto} onRefresh={() => void refreshSection("crypto")} isLoading={isLoading} />
        <div className="intel-toolbar">
          <div className="segmented-tabs" role="tablist" aria-label="Crypto tabs">
            {CRYPTO_TABS.map((tab) => (
              <button type="button" role="tab" aria-selected={cryptoTab === tab} className={cryptoTab === tab ? "active" : ""} key={tab} onClick={() => setCryptoTab(tab)}>
                {tab === "top10" ? "Top 10" : titleCase(tab)}
              </button>
            ))}
          </div>
          <label className="market-sort">
            <span>Sort</span>
            <select value={cryptoSort} onChange={(event) => setCryptoSort(event.target.value as typeof cryptoSort)}>
              {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {cryptoItems.length === 0 ? <DataUnavailable updatedAt={data?.crypto?.updatedAt} /> : (
          <div className="crypto-grid">
            {cryptoItems.map((coin) => <CryptoCard key={coin.id} coin={coin} />)}
          </div>
        )}
      </section>

      <section className="deck-panel live-intel-panel">
        <PanelTitle title="NSE Stocks" status={data?.stocksKenya} onRefresh={() => void refreshSection("stocks-kenya")} />
        <div className="market-hours"><span className={isMarketOpen(data?.stocksKenya) ? "alive" : ""} /> {isMarketOpen(data?.stocksKenya) ? "OPEN" : "CLOSED"}</div>
        <StockTable stocks={data?.stocksKenya?.items ?? []} usdKesRate={usdRate} />
      </section>

      <section className="deck-panel live-intel-panel">
        <PanelTitle title="News Feed" status={data?.news} onRefresh={() => void refreshSection("news")} />
        {newArticleCount > 0 && (
          <button className="new-events-banner" type="button" onClick={() => { setNewsPage(1); setNewArticleCount(0); }}>
            {newArticleCount} new articles
          </button>
        )}
        <div className="segmented-tabs" role="tablist" aria-label="News tabs">
          {NEWS_TABS.map((tab) => (
            <button type="button" role="tab" aria-selected={newsTab === tab} className={newsTab === tab ? "active" : ""} key={tab} onClick={() => { setNewsTab(tab); setNewsPage(1); }}>
              {titleCase(tab)}
            </button>
          ))}
        </div>
        {visibleNews.length === 0 ? <DataUnavailable updatedAt={data?.news?.updatedAt} /> : (
          <div className="news-feed-list">
            {visibleNews.map((article) => <NewsCard article={article} key={article.id} />)}
          </div>
        )}
        {visibleNews.length < newsItems.length && <button className="load-more-button" type="button" onClick={() => setNewsPage((page) => page + 1)}>Load more</button>}
      </section>

      <section className="deck-panel live-intel-panel">
        <PanelTitle title="Forex Rates" status={data?.forex} onRefresh={() => void refreshSection("forex")} />
        <ForexTable rates={primaryForex} />
        {secondaryForex.length > 0 && (
          <>
            <button className="collapse-toggle" type="button" onClick={() => setMoreForexOpen((open) => !open)}>
              More currencies <ChevronDown size={16} />
            </button>
            {moreForexOpen && <ForexTable rates={secondaryForex} />}
          </>
        )}
      </section>

      <section className="deck-panel live-intel-panel">
        <PanelTitle title="Kenya Economic Indicators" status={data?.indicators} onRefresh={() => void refreshSection("indicators")} />
        <div className="indicator-grid">
          {indicators.map((item) => <SnapshotCard key={item.label} label={item.label} value={formatIndicator(item)} updatedAt={item.updatedAt ?? data?.indicators?.updatedAt} />)}
        </div>
        <div className="mpesa-rate-grid">
          {(data?.indicators?.mpesaRates ?? []).slice(0, 6).map((rate) => (
            <span key={rate.range}><strong>{rate.range}</strong><em>{toKSH(rate.fee, 0)}</em></span>
          ))}
        </div>
      </section>

      <section className="deck-panel live-intel-panel">
        <button className="global-market-toggle" type="button" onClick={() => setGlobalOpen((open) => !open)}>
          <BarChart3 size={17} /> Global Markets <ChevronDown size={16} />
        </button>
        {globalOpen && <StockTable stocks={data?.stocksGlobal?.items ?? []} usdKesRate={usdRate} />}
      </section>
    </ModuleFrame>
  );
}

function ModuleFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="module-shell intel-live-page">
      <header className="module-head">
        <span className="micro-label">Live engine</span>
        <div><h1>{title}</h1><p>{description}</p></div>
      </header>
      {children}
    </div>
  );
}

function PanelTitle({ title, status, onRefresh, isLoading = false }: { title: string; status?: IntelEnvelope<unknown>; onRefresh: () => void; isLoading?: boolean }) {
  return (
    <div className="panel-headline">
      <div>
        <h2>{title}</h2>
        <small>{status?.updatedAt ? `Last updated ${timeAgo(status.updatedAt)}` : "Waiting for live data"}</small>
      </div>
      <button type="button" onClick={onRefresh} disabled={isLoading}><RefreshCcw size={15} /> Refresh</button>
    </div>
  );
}

function SnapshotCard({ label, value, updatedAt }: { label: string; value: string; updatedAt?: string }) {
  return <article className="snapshot-card"><span>{label}</span><strong>{value}</strong><small>{updatedAt ? timeAgo(updatedAt) : "Data unavailable"}</small></article>;
}

function CryptoCard({ coin }: { coin: CryptoItem }) {
  return (
    <article className="crypto-card">
      <div className="crypto-card-head"><img src={coin.image} alt="" /><div><strong>{coin.name}</strong><span>{coin.symbol}</span></div></div>
      <strong className="market-price">{toKSH(coin.priceKes, coin.priceKes > 10 ? 2 : 4)}</strong>
      <small>{formatUsd(coin.priceUsd)}</small>
      <span className={`change-badge ${coin.change24h >= 0 ? "up" : "down"}`} title={`24h change is ${coin.change24hCurrency ?? "USD"}-denominated`}>
        {coin.change24h >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {formatPercent(coin.change24h)} <small>({coin.change24hCurrency ?? "USD"})</small>
      </span>
      <em>Cap {toKSH(coin.marketCapKes, 0)}</em>
    </article>
  );
}

function StockTable({ stocks, usdKesRate }: { stocks: StockItem[]; usdKesRate: number }) {
  if (stocks.length === 0) return <DataUnavailable />;
  return (
    <div className="responsive-table">
      <table className="market-table">
        <thead><tr><th>Ticker</th><th>Company</th><th>Price</th><th>Change</th><th>Change %</th><th>Volume</th><th>52W</th></tr></thead>
        <tbody>
          {stocks.map((stock) => (
            <tr className={stock.change >= 0 ? "market-row-up" : "market-row-down"} key={`${stock.ticker}-${stock.company}`}>
              <td>{stock.ticker}</td>
              <td>{stock.company}</td>
              <td>{stock.currency === "USD" ? <><strong>{formatUsd(stock.price)}</strong><small>{usdToKSH(stock.price, usdKesRate)}</small></> : toKSH(stock.price)}</td>
              <td>{stock.currency === "USD" ? formatUsd(stock.change) : toKSH(stock.change)}</td>
              <td>{formatPercent(stock.changePercent)}</td>
              <td>{formatNumber(stock.volume, 0)}</td>
              <td>{stock.weekHigh52 || stock.weekLow52 ? `${formatNumber(stock.weekLow52)} / ${formatNumber(stock.weekHigh52)}` : "Data unavailable"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewsCard({ article }: { article: NewsItem }) {
  return (
    <article className="news-card">
      <div><span className="source-pill">{article.source}</span><span className="source-pill muted">{article.category}</span></div>
      <h3>{article.title}</h3>
      <p>{article.summary || "No summary supplied by source."}</p>
      <footer><small>{timeAgo(article.publishedAt)}</small><a href={article.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a></footer>
    </article>
  );
}

function ForexTable({ rates }: { rates: ForexRate[] }) {
  if (rates.length === 0) return <DataUnavailable />;
  return (
    <div className="responsive-table">
      <table className="market-table forex-table">
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.code}>
              <td>{rate.flag} {rate.code}</td>
              <td>1 KSH = {formatNumber(rate.oneKesEquals, 5)} {rate.code}</td>
              <td>1 {rate.code} = {toKSH(rate.kesPerUnit, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataUnavailable({ updatedAt }: { updatedAt?: string }) {
  return <div className="data-unavailable"><Newspaper size={24} /><strong>Data unavailable</strong><span>{updatedAt ? `last updated ${timeAgo(updatedAt)}` : "waiting for the next live fetch"}</span></div>;
}

async function getIntel<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${authApiBaseUrl}${path}`, { credentials: "include", cache: "no-store", ...init });
  if (!response.ok) throw new Error(`Intel API returned ${response.status}`);
  return response.json();
}

function mergeSectionPayload(current: IntelPayload | null, type: string, payload: unknown): IntelPayload {
  const keyByType: Record<string, keyof IntelPayload> = {
    news: "news",
    crypto: "crypto",
    forex: "forex",
    indicators: "indicators",
    "stocks-kenya": "stocksKenya",
    "stocks-global": "stocksGlobal"
  };
  const key = keyByType[type];
  return key ? { ...(current ?? {}), [key]: payload } : current ?? {};
}

function filterNews(items: NewsItem[], tab: (typeof NEWS_TABS)[number]) {
  if (tab === "kenya") return items.filter((item) => item.region === "kenya");
  if (tab === "africa") return items.filter((item) => item.region === "africa");
  if (tab === "global") return items.filter((item) => item.region === "global");
  return items.filter((item) => item.category === tab);
}

function buildPulseItems(data: IntelPayload | null, usdKesRate: number) {
  const stock = data?.stocksKenya?.items?.[0];
  const btc = data?.crypto?.items?.find((item) => item.id === "bitcoin");
  const cbk = data?.indicators?.items?.find((item) => /CBK/i.test(item.label));
  return [
    stock ? `${stock.ticker} ${toKSH(stock.price)} ${formatPercent(stock.changePercent)}` : "NSE data unavailable",
    `USD/KSH ${toKSH(usdKesRate, 2)}`,
    cbk ? `CBK ${formatIndicator(cbk)}` : "CBK rate unavailable",
    btc ? `BTC ${toKSH(btc.priceKes, 0)}` : "BTC/KSH unavailable"
  ];
}

function formatIndicator(item?: IndicatorItem) {
  if (!item?.value) return "Data unavailable";
  return `${item.value}${item.unit ?? ""}`;
}

function isMarketOpen(payload?: IntelEnvelope<unknown>) {
  return Boolean(payload?.marketOpen);
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "recently";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hr ago`;
  return `${Math.round(diff / 86_400_000)} d ago`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 2)}%`;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatNumber(value: number, decimals = 2) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(Number(value) || 0);
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown intel error";
}
