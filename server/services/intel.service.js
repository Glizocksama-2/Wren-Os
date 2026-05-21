import { XMLParser } from "fast-xml-parser";

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
  { name: "BBC Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", region: "africa", priority: 10 }
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
const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";
const NSE_RAPIDAPI_HOST = "nairobi-stock-exchange-nse.p.rapidapi.com";
const NSE_RAPIDAPI_STOCKS_URL = `https://${NSE_RAPIDAPI_HOST}/stocks`;
const SEEKING_ALPHA_RAPIDAPI_HOST = "seeking-alpha.p.rapidapi.com";
const SEEKING_ALPHA_NEWS_URL = `https://${SEEKING_ALPHA_RAPIDAPI_HOST}/news/v2/list`;
const REAL_TIME_NEWS_RAPIDAPI_HOST = "real-time-news-data.p.rapidapi.com";
const REAL_TIME_NEWS_SEARCH_URL = `https://${REAL_TIME_NEWS_RAPIDAPI_HOST}/search`;
const REAL_TIME_NEWS_FULL_STORY_URL = `https://${REAL_TIME_NEWS_RAPIDAPI_HOST}/full-story-coverage`;
const DEFAULT_WORLD_BANK_INDICATORS = [
  { code: "FP.CPI.TOTL.ZG", label: "World Bank Inflation", unit: "%", decimals: 2 },
  { code: "NY.GDP.MKTP.CD", label: "Kenya GDP", unit: "", scale: "usd", decimals: 1 },
  { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth", unit: "%", decimals: 2 },
  { code: "SP.POP.TOTL", label: "Population", unit: "", scale: "compact", decimals: 1 },
  { code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%", decimals: 2 }
];
const TTL = {
  news: 10 * 60 * 1000,
  crypto: 60 * 1000,
  nseStocksOpen: 5 * 60 * 1000,
  nseStocksClosed: 30 * 60 * 1000,
  globalStocks: 5 * 60 * 1000,
  forex: 15 * 60 * 1000,
  indicators: 60 * 60 * 1000
};
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

export function createIntelService(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const newsSources = options.newsSources ?? DEFAULT_NEWS_SOURCES;
  const cryptoCoins = options.cryptoCoins ?? COINS;
  const globalStocks = options.globalStocks ?? GLOBAL_STOCKS;
  const forexCodes = options.forexCodes ?? FOREX_CODES;
  const worldBankIndicators = options.worldBankIndicators ?? DEFAULT_WORLD_BANK_INDICATORS;
  const genericRapidApiKey = normalizeSecret(options.rapidApiKey ?? process.env.RAPIDAPI_KEY ?? "");
  const rapidApiNseKey = normalizeSecret(options.rapidApiNseKey ?? process.env.RAPIDAPI_NSE_KEY ?? process.env.NSE_RAPIDAPI_KEY ?? "") || genericRapidApiKey;
  const rapidApiSeekingAlphaKey = normalizeSecret(
    options.rapidApiSeekingAlphaKey ?? process.env.RAPIDAPI_SEEKING_ALPHA_KEY ?? process.env.SEEKING_ALPHA_RAPIDAPI_KEY ?? ""
  ) || genericRapidApiKey || rapidApiNseKey;
  const rapidApiRealTimeNewsKey = normalizeSecret(
    options.rapidApiRealTimeNewsKey ?? process.env.RAPIDAPI_REAL_TIME_NEWS_KEY ?? process.env.REAL_TIME_NEWS_RAPIDAPI_KEY ?? ""
  ) || genericRapidApiKey || rapidApiNseKey;
  const realTimeNewsQueries = normalizeStringList(
    options.realTimeNewsQueries ?? process.env.RAPIDAPI_REAL_TIME_NEWS_QUERIES ?? "Kenya business,Africa technology,Africa crypto"
  );
  const realTimeNewsStoryId = normalizeSecret(options.realTimeNewsStoryId ?? process.env.RAPIDAPI_REAL_TIME_NEWS_STORY_ID ?? "");
  const realTimeNewsCountry = normalizeSecret(options.realTimeNewsCountry ?? process.env.RAPIDAPI_REAL_TIME_NEWS_COUNTRY ?? "KE");
  const realTimeNewsLang = normalizeSecret(options.realTimeNewsLang ?? process.env.RAPIDAPI_REAL_TIME_NEWS_LANG ?? "en");
  const realTimeNewsLimit = Math.max(1, Math.min(50, Number(options.realTimeNewsLimit ?? process.env.RAPIDAPI_REAL_TIME_NEWS_LIMIT ?? 20) || 20));
  const alphaVantageApiKey = normalizeSecret(
    options.alphaVantageApiKey ?? process.env.ALPHA_VANTAGE_API_KEY ?? process.env.ALPHAVANTAGE_API_KEY ?? ""
  );
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
      const loaders = newsSources.map((source) => fetchNewsSource(source));
      if (rapidApiSeekingAlphaKey) loaders.push(fetchSeekingAlphaNews());
      if (rapidApiRealTimeNewsKey) {
        realTimeNewsQueries.forEach((query) => loaders.push(fetchRealTimeNewsSearch(query)));
        if (realTimeNewsStoryId) loaders.push(fetchRealTimeNewsCoverage(realTimeNewsStoryId));
      }
      const settled = await Promise.allSettled(loaders);
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
    return fetchWithCache("crypto", TTL.crypto, async () => fetchCryptoPrices(), options);
  }

  async function fetchNSEStocks(options = {}) {
    const ttl = isNairobiMarketOpen(now()) ? TTL.nseStocksOpen : TTL.nseStocksClosed;
    return fetchWithCache("stocksKenya", ttl, async () => fetchKenyaStocks(), options);
  }

  async function fetchGlobalStocks(options = {}) {
    return fetchWithCache("stocksGlobal", TTL.globalStocks, async () => ({
      type: "stocksGlobal",
      updatedAt: now().toISOString(),
      items: await fetchStockList(globalStocks, "USD", { preferAlphaVantage: Boolean(alphaVantageApiKey) })
    }), options);
  }

  async function fetchForex(options = {}) {
    return fetchWithCache("forex", TTL.forex, async () => fetchForexRates(), options);
  }

  async function fetchIndicators(options = {}) {
    return fetchWithCache("indicators", TTL.indicators, async () => {
      const [cbk, inflation, nse20, mpesa, worldBank] = await Promise.allSettled([
        fetchIndicatorFromPage("https://www.centralbank.go.ke/", /Central Bank Rate[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*%/i, "CBK Rate", "%"),
        fetchIndicatorFromPage("https://www.knbs.or.ke/", /inflation[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*%/i, "Inflation", "%"),
        fetchIndicatorFromPage("https://www.nse.co.ke/market-statistics/", /NSE\s*20[\s\S]{0,240}?(\d{2,}(?:,\d{3})*(?:\.\d+)?)/i, "NSE 20 Index", ""),
        fetchMpesaRates(),
        fetchWorldBankIndicators()
      ]);
      const pageIndicators = [unwrapIndicator(cbk, "CBK Rate"), unwrapIndicator(inflation, "Inflation"), unwrapIndicator(nse20, "NSE 20 Index")];
      const macro = worldBank.status === "fulfilled" ? worldBank.value : { items: [], errors: [getErrorMessage(worldBank.reason)] };
      return {
        type: "indicators",
        updatedAt: now().toISOString(),
        items: [...macro.items, ...pageIndicators],
        mpesaRates: mpesa.status === "fulfilled" ? mpesa.value : [],
        errors: [
          ...[cbk, inflation, nse20, mpesa].filter((item) => item.status === "rejected").map((item) => getErrorMessage(item.reason)),
          ...macro.errors
        ]
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
    const entries = parseFeed(xml);
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

  async function fetchSeekingAlphaNews() {
    const url = new URL(SEEKING_ALPHA_NEWS_URL);
    url.searchParams.set("category", "market-news::financials");
    url.searchParams.set("size", "40");
    const payload = await fetchJson(url.toString(), 8000, {
      "x-rapidapi-key": rapidApiSeekingAlphaKey,
      "x-rapidapi-host": SEEKING_ALPHA_RAPIDAPI_HOST
    });
    return extractArrayPayload(payload)
      .map((row) => normalizeSeekingAlphaNewsItem(row, now()))
      .filter(Boolean);
  }

  async function fetchRealTimeNewsSearch(query) {
    const url = new URL(REAL_TIME_NEWS_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(realTimeNewsLimit));
    url.searchParams.set("time_published", "anytime");
    url.searchParams.set("country", realTimeNewsCountry);
    url.searchParams.set("lang", realTimeNewsLang);
    const payload = await fetchJson(url.toString(), 8000, {
      "x-rapidapi-key": rapidApiRealTimeNewsKey,
      "x-rapidapi-host": REAL_TIME_NEWS_RAPIDAPI_HOST
    });
    return normalizeRealTimeNewsRows(payload, now(), newsRegionFromCountry(realTimeNewsCountry));
  }

  async function fetchRealTimeNewsCoverage(storyId) {
    const url = new URL(REAL_TIME_NEWS_FULL_STORY_URL);
    url.searchParams.set("story", storyId);
    url.searchParams.set("sort", "RELEVANCE");
    url.searchParams.set("country", realTimeNewsCountry);
    url.searchParams.set("lang", realTimeNewsLang);
    const payload = await fetchJson(url.toString(), 8000, {
      "x-rapidapi-key": rapidApiRealTimeNewsKey,
      "x-rapidapi-host": REAL_TIME_NEWS_RAPIDAPI_HOST
    });
    return normalizeRealTimeNewsRows(payload, now(), newsRegionFromCountry(realTimeNewsCountry));
  }

  async function fetchCryptoPrices() {
    try {
      return await fetchCoinGeckoCrypto();
    } catch (error) {
      if (!alphaVantageApiKey) throw error;
      const fallback = await fetchAlphaVantageCrypto();
      return { ...fallback, errors: [getErrorMessage(error), ...(fallback.errors ?? [])] };
    }
  }

  async function fetchCoinGeckoCrypto() {
    const ids = cryptoCoins.map(([id]) => id).join(",");
    const response = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,kes&include_24hr_change=true&include_market_cap=true`);
    const items = cryptoCoins.map(([id, name, symbol, image]) => {
      const coin = response[id] ?? {};
      return {
        id,
        name,
        symbol,
        image,
        priceKes: Number(coin.kes ?? 0),
        priceUsd: Number(coin.usd ?? 0),
        change24h: Number(coin.usd_24h_change ?? 0),
        change24hCurrency: "USD",
        marketCapKes: Number(coin.kes_market_cap ?? 0),
        marketCapUsd: Number(coin.usd_market_cap ?? 0),
        source: "CoinGecko"
      };
    }).sort((left, right) => right.marketCapKes - left.marketCapKes);
    return { type: "crypto", updatedAt: now().toISOString(), source: "CoinGecko", items };
  }

  async function fetchAlphaVantageCrypto() {
    const settled = await Promise.allSettled(cryptoCoins.map((coin) => fetchAlphaVantageCryptoCoin(coin)));
    const items = [];
    const errors = [];
    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        items.push(result.value);
      } else {
        errors.push(getErrorMessage(result.reason));
      }
    });
    if (items.length === 0) throw new Error(errors[0] ?? "Alpha Vantage crypto returned no prices");
    return {
      type: "crypto",
      updatedAt: now().toISOString(),
      source: "Alpha Vantage",
      items: items.sort((left, right) => right.marketCapKes - left.marketCapKes),
      errors
    };
  }

  async function fetchAlphaVantageCryptoCoin([id, name, symbol, image]) {
    const [usd, kes] = await Promise.all([
      fetchAlphaVantageExchangeRate(symbol, "USD"),
      fetchAlphaVantageExchangeRate(symbol, "KES")
    ]);
    return {
      id,
      name,
      symbol,
      image,
      priceKes: kes.rate,
      priceUsd: usd.rate,
      change24h: 0,
      change24hCurrency: "USD",
      marketCapKes: 0,
      marketCapUsd: 0,
      source: "Alpha Vantage",
      updatedAt: usd.updatedAt ?? kes.updatedAt ?? now().toISOString()
    };
  }

  async function fetchKenyaStocks() {
    const marketOpen = isNairobiMarketOpen(now());
    const fallback = async (errors = []) => ({
      type: "stocksKenya",
      marketOpen,
      updatedAt: now().toISOString(),
      source: "Yahoo Finance",
      items: await fetchStockList(KENYA_STOCKS, "KES"),
      errors
    });

    if (!rapidApiNseKey) return fallback();
    try {
      const items = await fetchRapidApiNseStocks();
      return {
        type: "stocksKenya",
        marketOpen,
        updatedAt: now().toISOString(),
        source: "RapidAPI NSE",
        items,
        errors: []
      };
    } catch (error) {
      return fallback([getErrorMessage(error)]);
    }
  }

  async function fetchRapidApiNseStocks() {
    const payload = await fetchJson(NSE_RAPIDAPI_STOCKS_URL, 8000, {
      "x-rapidapi-key": rapidApiNseKey,
      "x-rapidapi-host": NSE_RAPIDAPI_HOST,
      "Content-Type": "application/json"
    });
    const rows = extractArrayPayload(payload);
    const timestamp = now().toISOString();
    const items = rows.map((row) => normalizeRapidApiNseStock(row, timestamp)).filter(Boolean);
    if (items.length === 0) throw new Error("RapidAPI NSE returned no stock rows");
    return sortKenyaStocks(items);
  }

  async function fetchStockList(symbols, currency, options = {}) {
    const settled = await Promise.allSettled(symbols.map((symbol) => {
      const normalized = normalizeStockSymbol(symbol);
      return options.preferAlphaVantage
        ? fetchAlphaVantageOrYahooStock(normalized.querySymbol, normalized.ticker, normalized.company, currency)
        : fetchYahooStock(normalized.querySymbol, normalized.ticker, normalized.company, currency);
    }));
    return settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  }

  async function fetchAlphaVantageOrYahooStock(querySymbol, ticker, company, currency) {
    try {
      return await fetchAlphaVantageGlobalQuote(querySymbol, ticker, company, currency);
    } catch {
      return fetchYahooStock(querySymbol, ticker, company, currency);
    }
  }

  async function fetchAlphaVantageGlobalQuote(querySymbol, ticker, company, currency) {
    const payload = await fetchAlphaVantageJson({ function: "GLOBAL_QUOTE", symbol: querySymbol });
    assertAlphaVantagePayload(payload, `quote for ${ticker}`);
    const quote = payload["Global Quote"];
    if (!quote || typeof quote !== "object") throw new Error(`No Alpha Vantage global quote for ${ticker}`);
    return {
      ticker,
      querySymbol,
      company,
      currency,
      price: Number(quote["05. price"] ?? 0),
      change: Number(quote["09. change"] ?? 0),
      changePercent: Number(String(quote["10. change percent"] ?? "0").replace("%", "")),
      volume: Number(quote["06. volume"] ?? 0),
      weekHigh52: 0,
      weekLow52: 0,
      marketCap: 0,
      source: "Alpha Vantage",
      updatedAt: now().toISOString()
    };
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
      source: "Yahoo Finance",
      updatedAt: now().toISOString()
    };
  }

  async function fetchForexRates() {
    if (!alphaVantageApiKey) return fetchOpenExchangeForex();
    try {
      return await fetchAlphaVantageForex();
    } catch (error) {
      if (isTimeoutError(error)) throw error;
      const fallback = await fetchOpenExchangeForex();
      return { ...fallback, errors: [getErrorMessage(error), ...(fallback.errors ?? [])] };
    }
  }

  async function fetchAlphaVantageForex() {
    const settled = await Promise.allSettled(forexCodes.map((code) => fetchAlphaVantageForexRate(code)));
    const rates = [];
    const errors = [];
    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        rates.push(result.value);
      } else {
        errors.push(getErrorMessage(result.reason));
      }
    });
    if (rates.length < forexCodes.length) {
      throw new Error(errors[0] ?? "Alpha Vantage forex returned incomplete rates");
    }
    return {
      type: "forex",
      base: "KES",
      updatedAt: now().toISOString(),
      usdKes: rates.find((rate) => rate.code === "USD")?.kesPerUnit ?? 0,
      source: "Alpha Vantage",
      rates,
      errors
    };
  }

  async function fetchAlphaVantageForexRate(code) {
    const exchangeRate = await fetchAlphaVantageExchangeRate("KES", code);
    const oneKesEquals = exchangeRate.rate;
    if (!Number.isFinite(oneKesEquals) || oneKesEquals <= 0) {
      throw new Error(`No Alpha Vantage KES/${code} exchange rate`);
    }
    return {
      code,
      flag: FLAGS[code],
      oneKesEquals,
      kesPerUnit: 1 / oneKesEquals,
      source: "Alpha Vantage",
      updatedAt: exchangeRate.updatedAt
    };
  }

  async function fetchAlphaVantageExchangeRate(fromCurrency, toCurrency) {
    const payload = await fetchAlphaVantageJson({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: fromCurrency,
      to_currency: toCurrency
    });
    assertAlphaVantagePayload(payload, `${fromCurrency}/${toCurrency} exchange rate`);
    const rate = payload["Realtime Currency Exchange Rate"];
    const value = Number(rate?.["5. Exchange Rate"] ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`No Alpha Vantage ${fromCurrency}/${toCurrency} exchange rate`);
    }
    return {
      rate: value,
      updatedAt: normalizeDate(rate?.["6. Last Refreshed"], now())
    };
  }

  async function fetchOpenExchangeForex() {
    const payload = await fetchJson("https://open.er-api.com/v6/latest/KES");
    const rates = forexCodes.map((code) => {
      const oneKesEquals = Number(payload.rates?.[code] ?? 0);
      return {
        code,
        flag: FLAGS[code],
        oneKesEquals,
        kesPerUnit: oneKesEquals > 0 ? 1 / oneKesEquals : 0,
        source: "open.er-api"
      };
    });
    return {
      type: "forex",
      base: "KES",
      updatedAt: payload.time_last_update_utc ?? now().toISOString(),
      usdKes: rates.find((rate) => rate.code === "USD")?.kesPerUnit ?? 0,
      source: "open.er-api",
      rates,
      errors: []
    };
  }

  async function fetchWorldBankIndicators() {
    const settled = await Promise.allSettled(worldBankIndicators.map((indicator) => fetchWorldBankIndicator(indicator)));
    return {
      items: settled.filter((result) => result.status === "fulfilled").map((result) => result.value),
      errors: settled.filter((result) => result.status === "rejected").map((result) => getErrorMessage(result.reason))
    };
  }

  async function fetchWorldBankIndicator(indicator) {
    const primaryUrl = buildWorldBankIndicatorUrl(indicator.code, "KE");
    let sourceUrl = primaryUrl;
    let payload;
    try {
      payload = await fetchJson(primaryUrl);
    } catch {
      sourceUrl = buildWorldBankIndicatorUrl(indicator.code, "all", 20000);
      payload = await fetchJson(sourceUrl);
    }
    const allRows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
    const rows = sourceUrl.includes("/country/all/")
      ? allRows.filter((row) => row?.countryiso3code === "KEN" || row?.country?.id === "KEN")
      : allRows;
    const latest = rows.find((row) => row?.value !== null && row?.value !== undefined && Number.isFinite(Number(row.value)));
    if (!latest) throw new Error(`World Bank indicator ${indicator.code} returned no Kenya data`);
    return {
      label: indicator.label,
      value: formatWorldBankValue(Number(latest.value), indicator),
      unit: indicator.scale ? "" : indicator.unit ?? "",
      source: "World Bank",
      sourceUrl,
      referenceYear: String(latest.date ?? ""),
      updatedAt: now().toISOString()
    };
  }

  function buildWorldBankIndicatorUrl(code, country, perPage = 8) {
    const url = new URL(`https://api.worldbank.org/v2/country/${country}/indicator/${encodeURIComponent(code)}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("per_page", String(perPage));
    return url.toString();
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

  async function fetchJson(url, timeoutMs = 8000, headers = {}) {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json", "User-Agent": "Northwatch Intel/1.0", ...headers } }, timeoutMs);
    if (!response.ok) throw new Error(`${redactUrlSecrets(url)} returned HTTP ${response.status}`);
    return response.json();
  }

  async function fetchText(url, timeoutMs = 8000) {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml, text/html", "User-Agent": "Northwatch Intel/1.0" } }, timeoutMs);
    if (!response.ok) throw new Error(`${redactUrlSecrets(url)} returned HTTP ${response.status}`);
    return response.text();
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new Error(`Request to ${redactUrlSecrets(url)} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchAlphaVantageJson(params, timeoutMs = 8000) {
    return fetchJson(buildAlphaVantageUrl(params), timeoutMs);
  }

  function buildAlphaVantageUrl(params) {
    const url = new URL(ALPHA_VANTAGE_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    url.searchParams.set("apikey", alphaVantageApiKey);
    return url.toString();
  }

  return { fetchNews, fetchCrypto, fetchNSEStocks, fetchGlobalStocks, fetchForex, fetchIndicators, fetchAll };
}

function getEmptyPayload(type) {
  if (type === "forex") return { base: "KES", usdKes: 130, rates: [] };
  if (type === "stocksKenya") return { marketOpen: false, items: [] };
  if (type === "indicators") return { items: [], mpesaRates: [] };
  return { items: [] };
}

function parseFeed(xml) {
  try {
    const parsed = xmlParser.parse(xml);
    const channelItems = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    return toArray(channelItems).map((item) => ({
      title: readText(item.title),
      summary: readText(item.description ?? item.summary ?? item.content),
      url: readText(item.link?.href ?? item.link ?? item.guid),
      publishedAt: readText(item.pubDate ?? item.published ?? item.updated)
    }));
  } catch {
    return parseFeedFallback(xml);
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

function formatWorldBankValue(value, indicator) {
  if (indicator.scale === "usd") return `USD ${formatCompactNumber(value, indicator.decimals ?? 1)}`;
  if (indicator.scale === "compact") return formatCompactNumber(value, indicator.decimals ?? 1);
  return formatPlainNumber(value, indicator.decimals ?? 2);
}

function formatCompactNumber(value, decimals) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${formatPlainNumber(value / 1_000_000_000_000, decimals)}T`;
  if (absolute >= 1_000_000_000) return `${formatPlainNumber(value / 1_000_000_000, decimals)}B`;
  if (absolute >= 1_000_000) return `${formatPlainNumber(value / 1_000_000, decimals)}M`;
  if (absolute >= 1_000) return `${formatPlainNumber(value / 1_000, decimals)}K`;
  return formatPlainNumber(value, decimals);
}

function formatPlainNumber(value, decimals) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function stableId(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `intel-${hash.toString(36)}`;
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeSecret(item)).filter(Boolean);
  return String(value ?? "").split(",").map((item) => normalizeSecret(item)).filter(Boolean);
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data", "stocks", "results", "result", "items"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return Object.values(payload).find(Array.isArray) ?? [];
}

function normalizeRapidApiNseStock(row, updatedAt) {
  if (!row || typeof row !== "object") return null;
  const ticker = cleanTicker(readObjectValue(row, ["symbol", "ticker", "code", "stockCode", "securityCode", "instrument"]));
  const price = parseNumeric(readObjectValue(row, ["price", "currentPrice", "lastPrice", "lastTradedPrice", "closingPrice", "last", "value"]));
  if (!ticker || !Number.isFinite(price)) return null;
  const company = cleanText(readObjectValue(row, ["company", "companyName", "name", "security", "stock", "instrumentName"]) ?? ticker);
  const change = parseNumeric(readObjectValue(row, ["change", "priceChange", "changeAmount", "dailyChange", "movement"])) ?? 0;
  const changePercent = parseNumeric(readObjectValue(row, ["changePercent", "percentageChange", "percentChange", "changePercentage", "change_percentage", "percent"])) ?? 0;
  return {
    ticker,
    querySymbol: `${ticker}.NR`,
    company,
    currency: "KES",
    price,
    change,
    changePercent,
    volume: parseNumeric(readObjectValue(row, ["volume", "shares", "volumeTraded", "tradedVolume", "turnoverVolume"])) ?? 0,
    weekHigh52: parseNumeric(readObjectValue(row, ["weekHigh52", "52WeekHigh", "high52", "fiftyTwoWeekHigh", "yearHigh"])) ?? 0,
    weekLow52: parseNumeric(readObjectValue(row, ["weekLow52", "52WeekLow", "low52", "fiftyTwoWeekLow", "yearLow"])) ?? 0,
    marketCap: parseNumeric(readObjectValue(row, ["marketCap", "capitalization", "marketCapitalization"])) ?? 0,
    source: "RapidAPI NSE",
    updatedAt
  };
}

function normalizeSeekingAlphaNewsItem(row, fallbackDate) {
  if (!row || typeof row !== "object") return null;
  const attributes = row.attributes && typeof row.attributes === "object" ? row.attributes : {};
  const title = cleanText(
    readObjectValue(attributes, ["title", "headline", "name"]) ??
    readObjectValue(row, ["title", "headline", "name"])
  );
  const summary = cleanText(
    readObjectValue(attributes, ["summary", "description", "content", "teaser"]) ??
    readObjectValue(row, ["summary", "description", "content", "teaser"])
  );
  const url = normalizeSeekingAlphaUrl(
    readObjectValue(attributes, ["url", "canonicalUrl", "uri"]) ??
    row.links?.self ??
    readObjectValue(row, ["url", "link", "uri"]),
    row.id
  );
  if (!title || !url) return null;
  const publishedAt = normalizeDate(
    readObjectValue(attributes, ["publishOn", "publishedAt", "published", "createdAt", "lastModified"]) ??
    readObjectValue(row, ["publishOn", "publishedAt", "published", "createdAt", "lastModified"]),
    fallbackDate
  );
  return {
    id: stableId(url),
    title,
    summary,
    source: "Seeking Alpha",
    sourcePriority: 11,
    region: "global",
    publishedAt,
    url,
    category: detectCategory(`${title} ${summary}`)
  };
}

function normalizeSeekingAlphaUrl(value, id) {
  const text = cleanText(value);
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text.replace("http://", "https://").replace("https://seekingalpha.com/api/v3", "https://seekingalpha.com");
  }
  if (text.startsWith("/")) {
    return `https://seekingalpha.com${text.replace(/^\/api\/v3/, "")}`;
  }
  if (text) return `https://seekingalpha.com/${text.replace(/^\/+/, "")}`;
  return id ? `https://seekingalpha.com/news/${encodeURIComponent(String(id))}` : "";
}

function normalizeRealTimeNewsRows(payload, fallbackDate, region) {
  return extractRealTimeNewsRows(payload)
    .map((row) => normalizeRealTimeNewsItem(row, fallbackDate, region))
    .filter(Boolean);
}

function extractRealTimeNewsRows(payload) {
  const directRows = extractArrayPayload(payload);
  const roots = directRows.length
    ? directRows
    : payload?.data && typeof payload.data === "object"
      ? [payload.data]
      : [];
  return roots.flatMap((row) => [
    row,
    ...toArray(row?.sub_articles),
    ...toArray(row?.subArticles),
    ...toArray(row?.articles),
    ...toArray(row?.related_articles),
    ...toArray(row?.relatedArticles)
  ]);
}

function normalizeRealTimeNewsItem(row, fallbackDate, region) {
  if (!row || typeof row !== "object") return null;
  const title = cleanText(readObjectValue(row, ["title", "headline", "name"]));
  const url = cleanText(readObjectValue(row, ["link", "url", "articleUrl", "article_url"]));
  if (!title || !url) return null;
  const summary = cleanText(readObjectValue(row, ["snippet", "summary", "description", "content", "text"]));
  const publisher = cleanText(readObjectValue(row, ["source_name", "sourceName", "publisher", "source"]));
  const publishedAt = normalizeDate(readObjectValue(row, ["published_datetime_utc", "publishedAt", "published", "pubDate", "date"]), fallbackDate);
  return {
    id: stableId(url || readObjectValue(row, ["article_id", "id"])),
    title,
    summary,
    source: "Real-Time News Data",
    publisher,
    sourcePriority: 12,
    region,
    publishedAt,
    url,
    category: detectCategory(`${title} ${summary}`)
  };
}

function newsRegionFromCountry(country) {
  const value = String(country ?? "").trim().toUpperCase();
  if (value === "KE") return "kenya";
  if (["DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG", "CD", "DJ", "EG", "GQ", "ER", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "SZ", "TZ", "TG", "TN", "UG", "ZM", "ZW"].includes(value)) {
    return "africa";
  }
  return "global";
}

function sortKenyaStocks(items) {
  const priority = new Map(KENYA_STOCKS.map(([, ticker], index) => [ticker, index]));
  return [...items].sort((left, right) => {
    const leftRank = priority.get(left.ticker) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = priority.get(right.ticker) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.ticker.localeCompare(right.ticker);
  });
}

function readObjectValue(row, candidates) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeKey(key), value]);
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    const match = normalizedEntries.find(([key]) => key === normalized);
    if (match) return match[1];
  }
  return undefined;
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanTicker(value) {
  return cleanText(value).toUpperCase().replace(/\.(NR|NSE|NAIROBI)$/i, "").replace(/[^A-Z0-9]/g, "");
}

function parseNumeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cleanText(value);
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeStockSymbol(symbol) {
  const [querySymbol, tickerOrCompany, company] = symbol;
  if (company === undefined) {
    return {
      querySymbol,
      ticker: querySymbol,
      company: tickerOrCompany ?? querySymbol
    };
  }
  return {
    querySymbol,
    ticker: tickerOrCompany ?? querySymbol,
    company: company ?? tickerOrCompany ?? querySymbol
  };
}

function assertAlphaVantagePayload(payload, label) {
  const message = payload?.["Error Message"] ?? payload?.Note ?? payload?.Information;
  if (message) throw new Error(`Alpha Vantage ${label} did not return live data: ${String(message).slice(0, 200)}`);
}

function isTimeoutError(error) {
  return getErrorMessage(error).includes("timed out after");
}

function getErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactUrlSecrets(message);
}

function redactUrlSecrets(value) {
  const text = String(value);
  return text.replace(/https?:\/\/[^\s)]+/g, (match) => {
    try {
      const url = new URL(match);
      ["apikey", "api_key", "token", "access_token"].forEach((key) => {
        if (url.searchParams.has(key)) url.searchParams.set(key, "redacted");
      });
      return url.toString();
    } catch {
      return match.replace(/((?:apikey|api_key|token|access_token)=)[^&\s)]+/gi, "$1redacted");
    }
  }).replace(/((?:apikey|api_key|token|access_token)=)[^&\s)]+/gi, "$1redacted");
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
