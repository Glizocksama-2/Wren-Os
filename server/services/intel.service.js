const DEFAULT_NEWS_SOURCES = [
  { name: "TechCabal", url: "https://techcabal.com/feed/", region: "kenya", priority: 1 },
  { name: "Business Daily Africa", url: "https://www.businessdailyafrica.com/rss", region: "kenya", priority: 2 },
  { name: "Disrupt Africa", url: "https://disruptafrica.com/feed/", region: "africa", priority: 3 },
  { name: "The Star Kenya", url: "https://www.the-star.co.ke/rss", region: "kenya", priority: 4 },
  { name: "Nation Africa", url: "https://nation.africa/rss", region: "africa", priority: 5 },
  { name: "Standard Media Kenya", url: "https://www.standardmedia.co.ke/rss", region: "kenya", priority: 6 },
  { name: "AfricaTech", url: "https://africatechreviews.com/feed/", region: "africa", priority: 7 },
  { name: "Hacker News", url: "https://news.ycombinator.com/rss", region: "global", priority: 8 },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", region: "global", priority: 9 },
  { name: "BBC Africa", url: "http://feeds.bbci.co.uk/news/world/africa/rss.xml", region: "africa", priority: 10 }
];

const COINS = [
  ["bitcoin", "Bitcoin", "BTC", "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"],
  ["ethereum", "Ethereum", "ETH", "https://assets.coingecko.com/coins/images/279/large/ethereum.png"],
  ["solana", "Solana", "SOL", "https://assets.coingecko.com/coins/images/4128/large/solana.png"],
  ["binancecoin", "BNB", "BNB", "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"],
  ["ripple", "XRP", "XRP", "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png"],
  ["cardano", "Cardano", "ADA", "https://assets.coingecko.com/coins/images/975/large/cardano.png"],
  ["toncoin", "Toncoin", "TON", "https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png"],
  ["dogecoin", "Dogecoin", "DOGE", "https://assets.coingecko.com/coins/images/5/large/dogecoin.png"],
  ["polkadot", "Polkadot", "DOT", "https://assets.coingecko.com/coins/images/12171/large/polkadot.png"],
  ["chainlink", "Chainlink", "LINK", "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png"]
];

const KENYA_STOCKS = [
  ["SCOM.NR", "SCOM", "Safaricom"],
  ["EQTY.NR", "EQTY", "Equity Group"],
  ["KCB.NR", "KCB", "KCB Group"],
  ["EABL.NR", "EABL", "East African Breweries"],
  ["BATK.NR", "BATK", "BAT Kenya"],
  ["COOP.NR", "COOP", "Co-operative Bank"],
  ["ABSA.NR", "ABSA", "Absa Bank Kenya"],
  ["NCBA.NR", "NCBA", "NCBA Group"],
  ["BRITAM.NR", "BRITAM", "Britam Holdings"],
  ["JUB.NR", "JUBILEE", "Jubilee Holdings"],
  ["^J200", "JSE40", "JSE Top 40"],
  ["DANGCEM.LG", "DANGCEM", "Dangote Cement"],
  ["MTNN.LG", "MTNN", "MTN Nigeria"],
  ["AIRTELAFRI.LG", "AIRTELAFRI", "Airtel Africa"]
];

const GLOBAL_STOCKS = [
  ["AAPL", "Apple"],
  ["MSFT", "Microsoft"],
  ["GOOGL", "Alphabet"],
  ["AMZN", "Amazon"],
  ["NVDA", "NVIDIA"],
  ["META", "Meta"],
  ["TSLA", "Tesla"],
  ["SPY", "S&P 500 ETF"],
  ["QQQ", "Nasdaq ETF"]
];

const FOREX_CODES = ["USD", "EUR", "GBP", "ZAR", "NGN", "UGX", "TZS", "ETB", "RWF", "AED", "CNY"];
const FLAGS = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", ZAR: "🇿🇦", NGN: "🇳🇬", UGX: "🇺🇬", TZS: "🇹🇿", ETB: "🇪🇹", RWF: "🇷🇼", AED: "🇦🇪", CNY: "🇨🇳" };
const TTL = {
  news: 10 * 60 * 1000,
  crypto: 60 * 1000,
  nseStocksOpen: 5 * 60 * 1000,
  nseStocksClosed: 30 * 60 * 1000,
  globalStocks: 5 * 60 * 1000,
  forex: 15 * 60 * 1000,
  indicators: 60 * 60 * 1000
};

export function createIntelService(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const newsSources = options.newsSources ?? DEFAULT_NEWS_SOURCES;
  const cache = new Map();

  async function fetchWithCache(type, ttlMs, loader, { force = false } = {}) {
    const cached = cache.get(type);
    const timestamp = now().toISOString();
    if (!force && cached && now().getTime() - cached.fetchedAt < ttlMs) {
      return { ...cached.data, status: "cache", cache: { ttlMs, fetchedAt: cached.updatedAt } };
    }

    try {
      const data = await loader();
      const normalized = { ...data, status: "live", updatedAt: data.updatedAt ?? timestamp, errors: data.errors ?? [] };
      cache.set(type, { data: normalized, fetchedAt: now().getTime(), updatedAt: normalized.updatedAt });
      return normalized;
    } catch (error) {
      if (cached) {
        return {
          ...cached.data,
          status: "stale",
          errors: [...(cached.data.errors ?? []), getErrorMessage(error)]
        };
      }
      return {
        ...getEmptyPayload(type),
        type,
        status: "empty",
        updatedAt: timestamp,
        errors: [getErrorMessage(error)]
      };
    }
  }

  async function fetchNews(options = {}) {
    return fetchWithCache("news", TTL.news, async () => {
      const settled = await Promise.allSettled(newsSources.map((source) => fetchNewsSource(source)));
      const errors = [];
      const byUrl = new Map();
      settled.forEach((result) => {
        if (result.status === "rejected") {
          errors.push(getErrorMessage(result.reason));
          return;
        }
        result.value.forEach((item) => {
          const key = item.url || `${item.source}:${item.title}`;
          if (!byUrl.has(key)) byUrl.set(key, item);
        });
      });
      return {
        type: "news",
        updatedAt: now().toISOString(),
        errors,
        items: [...byUrl.values()].sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      };
    }, options);
  }

  async function fetchCrypto(options = {}) {
    return fetchWithCache("crypto", TTL.crypto, async () => {
      const ids = COINS.map(([id]) => id).join(",");
      const response = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,kes&include_24hr_change=true&include_market_cap=true`);
      const items = COINS.map(([id, name, symbol, image]) => {
        const coin = response[id] ?? {};
        return {
          id,
          name,
          symbol,
          image,
          priceKes: Number(coin.kes ?? 0),
          priceUsd: Number(coin.usd ?? 0),
          change24h: Number(coin.kes_24h_change ?? coin.usd_24h_change ?? 0),
          marketCapKes: Number(coin.kes_market_cap ?? 0),
          marketCapUsd: Number(coin.usd_market_cap ?? 0)
        };
      }).sort((left, right) => right.marketCapKes - left.marketCapKes);
      return { type: "crypto", updatedAt: now().toISOString(), items };
    }, options);
  }

  async function fetchNSEStocks(options = {}) {
    const ttl = isNairobiMarketOpen(now()) ? TTL.nseStocksOpen : TTL.nseStocksClosed;
    return fetchWithCache("stocksKenya", ttl, async () => ({
      type: "stocksKenya",
      marketOpen: isNairobiMarketOpen(now()),
      updatedAt: now().toISOString(),
      items: await fetchStockList(KENYA_STOCKS, "KES")
    }), options);
  }

  async function fetchGlobalStocks(options = {}) {
    return fetchWithCache("stocksGlobal", TTL.globalStocks, async () => ({
      type: "stocksGlobal",
      updatedAt: now().toISOString(),
      items: await fetchStockList(GLOBAL_STOCKS, "USD")
    }), options);
  }

  async function fetchForex(options = {}) {
    return fetchWithCache("forex", TTL.forex, async () => {
      const payload = await fetchJson("https://open.er-api.com/v6/latest/KES");
      const rates = FOREX_CODES.map((code) => {
        const oneKesEquals = Number(payload.rates?.[code] ?? 0);
        return {
          code,
          flag: FLAGS[code],
          oneKesEquals,
          kesPerUnit: oneKesEquals > 0 ? 1 / oneKesEquals : 0
        };
      });
      return {
        type: "forex",
        base: "KES",
        updatedAt: payload.time_last_update_utc ?? now().toISOString(),
        usdKes: rates.find((rate) => rate.code === "USD")?.kesPerUnit ?? 0,
        rates
      };
    }, options);
  }

  async function fetchIndicators(options = {}) {
    return fetchWithCache("indicators", TTL.indicators, async () => {
      const [cbk, inflation, nse20, mpesa] = await Promise.allSettled([
        fetchIndicatorFromPage("https://www.centralbank.go.ke/", /Central Bank Rate[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*%/i, "CBK Rate", "%"),
        fetchIndicatorFromPage("https://www.knbs.or.ke/", /inflation[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*%/i, "Inflation", "%"),
        fetchIndicatorFromPage("https://www.nse.co.ke/market-statistics/", /NSE\s*20[\s\S]{0,240}?(\d{2,}(?:,\d{3})*(?:\.\d+)?)/i, "NSE 20 Index", ""),
        fetchMpesaRates()
      ]);
      const items = [unwrapIndicator(cbk, "CBK Rate"), unwrapIndicator(inflation, "Inflation"), unwrapIndicator(nse20, "NSE 20 Index")];
      return {
        type: "indicators",
        updatedAt: now().toISOString(),
        items,
        mpesaRates: mpesa.status === "fulfilled" ? mpesa.value : [],
        errors: [cbk, inflation, nse20, mpesa].filter((item) => item.status === "rejected").map((item) => getErrorMessage(item.reason))
      };
    }, options);
  }

  async function fetchAll() {
    const [news, crypto, stocksKenya, stocksGlobal, forex, indicators] = await Promise.all([
      fetchNews(),
      fetchCrypto(),
      fetchNSEStocks(),
      fetchGlobalStocks(),
      fetchForex(),
      fetchIndicators()
    ]);
    return { news, crypto, stocksKenya, stocksGlobal, forex, indicators };
  }

  async function fetchNewsSource(source) {
    const xml = await fetchText(source.url);
    const entries = await parseFeed(xml);
    return entries.map((entry) => {
      const title = cleanText(entry.title);
      const summary = cleanText(entry.summary);
      return {
        id: stableId(entry.url || `${source.name}:${title}`),
        title,
        summary,
        source: source.name,
        sourcePriority: source.priority,
        region: source.region,
        publishedAt: normalizeDate(entry.publishedAt, now()),
        url: entry.url,
        category: detectCategory(`${title} ${summary}`)
      };
    }).filter((item) => item.title && item.url);
  }

  async function fetchStockList(symbols, currency) {
    const settled = await Promise.allSettled(symbols.map(([querySymbol, ticker, company]) => fetchYahooStock(querySymbol, ticker, company, currency)));
    return settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  }

  async function fetchYahooStock(querySymbol, ticker, company, currency) {
    const payload = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(querySymbol)}?range=1d&interval=5m`);
    const result = payload.chart?.result?.[0];
    if (!result) throw new Error(`No Yahoo Finance chart for ${ticker}`);
    const meta = result.meta ?? {};
    const price = Number(meta.regularMarketPrice ?? meta.previousClose ?? 0);
    const previous = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
    const change = price - previous;
    const changePercent = previous ? (change / previous) * 100 : 0;
    const volume = lastNumber(result.indicators?.quote?.[0]?.volume) ?? 0;
    return {
      ticker,
      querySymbol,
      company,
      currency,
      price,
      change,
      changePercent,
      volume,
      weekHigh52: Number(meta.fiftyTwoWeekHigh ?? 0),
      weekLow52: Number(meta.fiftyTwoWeekLow ?? 0),
      marketCap: Number(meta.marketCap ?? 0),
      updatedAt: now().toISOString()
    };
  }

  async function fetchIndicatorFromPage(url, pattern, label, unit) {
    const html = await fetchText(url);
    const match = html.replace(/\s+/g, " ").match(pattern);
    return { label, value: match ? match[1].replace(/,/g, "") : null, unit, sourceUrl: url, updatedAt: now().toISOString() };
  }

  async function fetchMpesaRates() {
    const html = await fetchText("https://www.safaricom.co.ke/personal/m-pesa/getting-started/m-pesa-rates");
    const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0, 12);
    return rows.map((row) => cleanText(row[0]).match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*).*?(\d[\d,]*)/)).filter(Boolean).slice(0, 6).map((match) => ({
      range: `${match[1]} - ${match[2]}`,
      fee: Number(match[3].replace(/,/g, ""))
    }));
  }

  async function fetchJson(url) {
    const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "Northwatch Intel/1.0" } });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  }

  async function fetchText(url) {
    const response = await fetchImpl(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml, text/html", "User-Agent": "Northwatch Intel/1.0" } });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.text();
  }

  return { fetchNews, fetchCrypto, fetchNSEStocks, fetchGlobalStocks, fetchForex, fetchIndicators, fetchAll };
}

function getEmptyPayload(type) {
  if (type === "forex") return { base: "KES", usdKes: 130, rates: [] };
  if (type === "stocksKenya") return { marketOpen: false, items: [] };
  if (type === "indicators") return { items: [], mpesaRates: [] };
  return { items: [] };
}

async function parseFeed(xml) {
  const parser = await getFastXmlParser();
  if (parser) {
    const parsed = parser.parse(xml);
    const channelItems = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    return toArray(channelItems).map((item) => ({
      title: readText(item.title),
      summary: readText(item.description ?? item.summary ?? item.content),
      url: readText(item.link?.href ?? item.link ?? item.guid),
      publishedAt: readText(item.pubDate ?? item.published ?? item.updated)
    }));
  }
  return parseFeedFallback(xml);
}

async function getFastXmlParser() {
  try {
    const optionalImport = new Function("specifier", "return import(specifier)");
    const module = await optionalImport("fast-xml-parser");
    return new module.XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  } catch {
    return null;
  }
}

function parseFeedFallback(xml) {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return itemBlocks.map((block) => ({
    title: getTag(block, "title"),
    summary: getTag(block, "description") || getTag(block, "summary") || getTag(block, "content"),
    url: getTag(block, "link") || getTag(block, "guid") || getLinkHref(block),
    publishedAt: getTag(block, "pubDate") || getTag(block, "published") || getTag(block, "updated")
  }));
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
}

function getLinkHref(block) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]) : "";
}

function readText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value["#text"] ?? value.href ?? "";
  return "";
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function detectCategory(text) {
  const value = text.toLowerCase();
  if (/\b(bitcoin|crypto|ethereum|blockchain|token|web3)\b/.test(value)) return "crypto";
  if (/\b(business|funding|market|bank|profit|revenue|shares|trade|economy)\b/.test(value)) return "business";
  if (/\b(tech|startup|software|ai|fintech|mobile|app|digital)\b/.test(value)) return "tech";
  if (/\b(farm|agri|crop|food|tea|coffee|maize)\b/.test(value)) return "agriculture";
  if (/\b(election|government|parliament|policy|president|minister)\b/.test(value)) return "politics";
  return "business";
}

function normalizeDate(value, fallbackDate) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallbackDate.toISOString() : date.toISOString();
}

function unwrapIndicator(result, label) {
  if (result.status === "fulfilled") return result.value;
  return { label, value: null, unit: "", updatedAt: new Date().toISOString(), error: getErrorMessage(result.reason) };
}

function stableId(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `intel-${hash.toString(36)}`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function lastNumber(values) {
  if (!Array.isArray(values)) return null;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function isNairobiMarketOpen(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  return !["Sat", "Sun"].includes(weekday) && minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}
