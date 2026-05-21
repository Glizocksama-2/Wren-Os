import { describe, expect, it, vi } from "vitest";
import { createIntelService } from "./intel.service.js";

describe("intel service", () => {
  it("fetches, tags, dedupes, and caches live RSS news", async () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title>Kenya fintech funding rises</title><description>Business funding update</description><link>https://techcabal.com/a</link><pubDate>Tue, 19 May 2026 08:00:00 GMT</pubDate></item><item><title>Kenya fintech funding rises</title><description>Duplicate</description><link>https://techcabal.com/a</link><pubDate>Tue, 19 May 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => rss }));
    const service = createIntelService({
      fetchImpl,
      now: () => new Date("2026-05-19T08:10:00.000Z"),
      newsSources: [{ name: "TechCabal", url: "https://techcabal.com/feed/", region: "kenya" }]
    });

    const first = await service.fetchNews();
    const second = await service.fetchNews();

    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({
      title: "Kenya fintech funding rises",
      source: "TechCabal",
      category: "business",
      region: "kenya",
      url: "https://techcabal.com/a"
    });
    expect(first.status).toBe("live");
    expect(second.status).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("normalizes crypto prices in KSH and keeps cached data when a refresh fails", async () => {
    const payload = {
      bitcoin: {
        usd: 100000,
        kes: 13000000,
        usd_24h_change: 2.5,
        kes_24h_change: 99,
        kes_market_cap: 250000000000000
      }
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const service = createIntelService({ fetchImpl, now: () => new Date("2026-05-19T08:10:00.000Z") });

    const first = await service.fetchCrypto({ force: true });
    const second = await service.fetchCrypto({ force: true });

    expect(first.items[0]).toMatchObject({
      id: "bitcoin",
      symbol: "BTC",
      priceKes: 13000000,
      priceUsd: 100000,
      change24h: 2.5,
      change24hCurrency: "USD",
      marketCapKes: 250000000000000
    });
    expect(second.status).toBe("stale");
    expect(second.items[0].id).toBe("bitcoin");
  });

  it("falls back to Alpha Vantage crypto exchange rates when CoinGecko is unavailable", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("api.coingecko.com")) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      if (requestUrl.includes("to_currency=USD")) {
        return {
          ok: true,
          json: async () => ({
            "Realtime Currency Exchange Rate": {
              "5. Exchange Rate": "100000.0000",
              "6. Last Refreshed": "2026-05-19 08:00:00"
            }
          })
        };
      }
      if (requestUrl.includes("to_currency=KES")) {
        return {
          ok: true,
          json: async () => ({
            "Realtime Currency Exchange Rate": {
              "5. Exchange Rate": "13000000.0000",
              "6. Last Refreshed": "2026-05-19 08:00:00"
            }
          })
        };
      }
      throw new Error(`Unexpected URL ${requestUrl}`);
    });
    const service = createIntelService({
      fetchImpl,
      alphaVantageApiKey: "server-secret",
      cryptoCoins: [["bitcoin", "Bitcoin", "BTC", "bitcoin.png"]],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchCrypto({ force: true });

    expect(result).toMatchObject({
      type: "crypto",
      source: "Alpha Vantage",
      errors: [expect.stringContaining("api.coingecko.com")]
    });
    expect(result.items[0]).toMatchObject({
      id: "bitcoin",
      symbol: "BTC",
      priceKes: 13000000,
      priceUsd: 100000,
      change24hCurrency: "USD",
      source: "Alpha Vantage"
    });
  });

  it("aborts external intel fetches that exceed the request timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );
    const service = createIntelService({ fetchImpl, now: () => new Date("2026-05-19T08:10:00.000Z") });

    const pending = service.fetchCrypto({ force: true });
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;

    expect(result.status).toBe("empty");
    expect(result.errors[0]).toMatch(/Request to https:\/\/api\.coingecko\.com\/api\/v3\/simple\/price.*timed out after 8000ms/);
    vi.useRealTimers();
  });

  it("adds Kenya macro indicators from the World Bank V2 indicators API", async () => {
    const requestedUrls = [];
    const fetchImpl = vi.fn(async (url) => {
      const requestUrl = String(url);
      requestedUrls.push(requestUrl);
      if (requestUrl.includes("api.worldbank.org/v2/country/KE/indicator/FP.CPI.TOTL.ZG")) {
        return {
          ok: true,
          json: async () => [
            { page: 1, pages: 1 },
            [
              { date: "2025", value: null },
              { date: "2024", value: 4.51 }
            ]
          ]
        };
      }
      if (requestUrl.includes("api.worldbank.org/v2/country/KE/indicator/NY.GDP.MKTP.CD")) {
        return {
          ok: true,
          json: async () => [
            { page: 1, pages: 1 },
            [{ date: "2024", value: 113420008000 }]
          ]
        };
      }
      return {
        ok: true,
        text: async () => "<html>Central Bank Rate 10.5% inflation 4.5% NSE 20 1,800 <tr><td>1 - 100</td><td>6</td></tr></html>"
      };
    });
    const service = createIntelService({
      fetchImpl,
      worldBankIndicators: [
        { code: "FP.CPI.TOTL.ZG", label: "World Bank Inflation", unit: "%", decimals: 2 },
        { code: "NY.GDP.MKTP.CD", label: "Kenya GDP", unit: "", scale: "usd", decimals: 1 }
      ],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchIndicators({ force: true });

    expect(requestedUrls).toEqual(expect.arrayContaining([
      expect.stringContaining("https://api.worldbank.org/v2/country/KE/indicator/FP.CPI.TOTL.ZG"),
      expect.stringContaining("https://api.worldbank.org/v2/country/KE/indicator/NY.GDP.MKTP.CD")
    ]));
    expect(requestedUrls.some((url) => url.includes("/v1/"))).toBe(false);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "World Bank Inflation",
        value: "4.51",
        unit: "%",
        referenceYear: "2024",
        source: "World Bank"
      }),
      expect.objectContaining({
        label: "Kenya GDP",
        value: "USD 113.4B",
        unit: "",
        referenceYear: "2024",
        source: "World Bank"
      })
    ]));
  });

  it("falls back to World Bank V2 country-all data when Kenya indicator calls fail", async () => {
    const requestedUrls = [];
    const fetchImpl = vi.fn(async (url) => {
      const requestUrl = String(url);
      requestedUrls.push(requestUrl);
      if (requestUrl.includes("api.worldbank.org/v2/country/KE/indicator/SP.POP.TOTL")) {
        return { ok: false, status: 502, json: async () => ({}) };
      }
      if (requestUrl.includes("api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL")) {
        return {
          ok: true,
          json: async () => [
            { page: 1, pages: 1 },
            [
              { countryiso3code: "UGA", date: "2024", value: 50000000 },
              { countryiso3code: "KEN", date: "2025", value: null },
              { countryiso3code: "KEN", date: "2024", value: 56000000 }
            ]
          ]
        };
      }
      return {
        ok: true,
        text: async () => "<html>Central Bank Rate 10.5% inflation 4.5% NSE 20 1,800 <tr><td>1 - 100</td><td>6</td></tr></html>"
      };
    });
    const service = createIntelService({
      fetchImpl,
      worldBankIndicators: [{ code: "SP.POP.TOTL", label: "Population", unit: "", scale: "compact", decimals: 1 }],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchIndicators({ force: true });

    expect(requestedUrls).toEqual(expect.arrayContaining([
      expect.stringContaining("https://api.worldbank.org/v2/country/KE/indicator/SP.POP.TOTL"),
      expect.stringContaining("https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL")
    ]));
    expect(requestedUrls.find((url) => url.includes("/country/all/indicator/SP.POP.TOTL"))).toContain("per_page=20000");
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Population",
        value: "56.0M",
        referenceYear: "2024",
        source: "World Bank"
      })
    ]));
  });

  it("uses Alpha Vantage global quotes when a server-side key is configured", async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toContain("function=GLOBAL_QUOTE");
      expect(String(url)).toContain("apikey=server-secret");
      return {
        ok: true,
        json: async () => ({
          "Global Quote": {
            "01. symbol": "IBM",
            "05. price": "189.2000",
            "09. change": "-1.2300",
            "10. change percent": "-0.6460%",
            "06. volume": "123456"
          }
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      alphaVantageApiKey: "server-secret",
      globalStocks: [["IBM", "IBM"]],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchGlobalStocks({ force: true });

    expect(result.items).toEqual([
      expect.objectContaining({
        ticker: "IBM",
        company: "IBM",
        currency: "USD",
        price: 189.2,
        change: -1.23,
        changePercent: -0.646,
        volume: 123456,
        source: "Alpha Vantage"
      })
    ]);
  });

  it("uses Alpha Vantage forex rates without leaking the server key in timeout errors", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );
    const service = createIntelService({
      fetchImpl,
      alphaVantageApiKey: "server-secret",
      forexCodes: ["USD"],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const pending = service.fetchForex({ force: true });
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;

    expect(result.status).toBe("empty");
    expect(result.errors[0]).toContain("alphavantage.co/query");
    expect(result.errors[0]).not.toContain("server-secret");
    expect(result.errors[0]).toContain("apikey=redacted");
    vi.useRealTimers();
  });

  it("uses Alpha Vantage exchange rates when a server-side key is configured", async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toContain("function=CURRENCY_EXCHANGE_RATE");
      expect(String(url)).toContain("from_currency=KES");
      expect(String(url)).toContain("to_currency=USD");
      return {
        ok: true,
        json: async () => ({
          "Realtime Currency Exchange Rate": {
            "5. Exchange Rate": "0.00770000",
            "6. Last Refreshed": "2026-05-19 08:00:00"
          }
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      alphaVantageApiKey: "server-secret",
      forexCodes: ["USD"],
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchForex({ force: true });

    expect(result).toMatchObject({
      type: "forex",
      base: "KES",
      source: "Alpha Vantage",
      usdKes: expect.closeTo(129.8701, 4)
    });
    expect(result.rates[0]).toMatchObject({
      code: "USD",
      oneKesEquals: 0.0077,
      kesPerUnit: expect.closeTo(129.8701, 4),
      source: "Alpha Vantage"
    });
  });

  it("uses the RapidAPI Nairobi Stock Exchange feed when a server-side key is configured", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(String(url)).toBe("https://nairobi-stock-exchange-nse.p.rapidapi.com/stocks");
      expect(init.headers["x-rapidapi-key"]).toBe("server-secret");
      expect(init.headers["x-rapidapi-host"]).toBe("nairobi-stock-exchange-nse.p.rapidapi.com");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              symbol: "SCOM",
              company: "Safaricom PLC",
              price: "28.75",
              change: "0.25",
              percentChange: "0.88%",
              volume: "1,234,500",
              weekHigh52: "35.00",
              weekLow52: "20.00"
            }
          ]
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      rapidApiNseKey: "server-secret",
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchNSEStocks({ force: true });

    expect(result).toMatchObject({
      type: "stocksKenya",
      source: "RapidAPI NSE",
      items: [
        expect.objectContaining({
          ticker: "SCOM",
          company: "Safaricom PLC",
          currency: "KES",
          price: 28.75,
          change: 0.25,
          changePercent: 0.88,
          volume: 1234500,
          weekHigh52: 35,
          weekLow52: 20,
          source: "RapidAPI NSE"
        })
      ]
    });
  });

  it("adds Seeking Alpha market news when a server-side RapidAPI key is configured", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(String(url)).toBe("https://seeking-alpha.p.rapidapi.com/news/v2/list?category=market-news%3A%3Afinancials&size=40");
      expect(init.headers["x-rapidapi-key"]).toBe("server-secret");
      expect(init.headers["x-rapidapi-host"]).toBe("seeking-alpha.p.rapidapi.com");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: "531181",
              attributes: {
                title: "Banks rally after rate decision",
                content: "Financial stocks moved higher after the latest market update.",
                publishOn: "2026-05-19T08:00:00.000Z"
              },
              links: {
                self: "/news/531181-banks-rally-after-rate-decision"
              }
            }
          ]
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      newsSources: [],
      rapidApiSeekingAlphaKey: "server-secret",
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchNews({ force: true });

    expect(result.items).toEqual([
      expect.objectContaining({
        title: "Banks rally after rate decision",
        summary: "Financial stocks moved higher after the latest market update.",
        source: "Seeking Alpha",
        sourcePriority: 11,
        region: "global",
        category: "business",
        publishedAt: "2026-05-19T08:00:00.000Z",
        url: "https://seekingalpha.com/news/531181-banks-rally-after-rate-decision"
      })
    ]);
  });

  it("adds Real-Time News Data search results when a server-side RapidAPI key is configured", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(String(url)).toBe("https://real-time-news-data.p.rapidapi.com/search?query=Kenya+business&limit=20&time_published=anytime&country=KE&lang=en");
      expect(init.headers["x-rapidapi-key"]).toBe("server-secret");
      expect(init.headers["x-rapidapi-host"]).toBe("real-time-news-data.p.rapidapi.com");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              article_id: "rt-news-1",
              title: "Kenya banks lift market sentiment",
              link: "https://example.com/kenya-banks",
              snippet: "Nairobi investors tracked bank shares after a new market update.",
              published_datetime_utc: "2026-05-19T07:30:00.000Z",
              source_name: "Example Markets"
            }
          ]
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      newsSources: [],
      rapidApiRealTimeNewsKey: "server-secret",
      realTimeNewsQueries: ["Kenya business"],
      realTimeNewsCountry: "KE",
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchNews({ force: true });

    expect(result.items).toEqual([
      expect.objectContaining({
        title: "Kenya banks lift market sentiment",
        summary: "Nairobi investors tracked bank shares after a new market update.",
        source: "Real-Time News Data",
        publisher: "Example Markets",
        sourcePriority: 12,
        region: "kenya",
        category: "business",
        publishedAt: "2026-05-19T07:30:00.000Z",
        url: "https://example.com/kenya-banks"
      })
    ]);
  });

  it("adds Real-Time News Data full-story coverage when a story id is configured", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(String(url)).toBe("https://real-time-news-data.p.rapidapi.com/full-story-coverage?story=story-123&sort=RELEVANCE&country=US&lang=en");
      expect(init.headers["x-rapidapi-key"]).toBe("server-secret");
      expect(init.headers["x-rapidapi-host"]).toBe("real-time-news-data.p.rapidapi.com");
      return {
        ok: true,
        json: async () => ({
          data: {
            article_id: "story-123",
            title: "Markets react to central bank decision",
            link: "https://example.com/markets-main",
            snippet: "Coverage of the latest monetary policy decision.",
            published_datetime_utc: "2026-05-19T07:00:00.000Z",
            source_name: "Example Wire",
            sub_articles: [
              {
                article_id: "story-123-related",
                title: "Analysts watch banking counters",
                link: "https://example.com/markets-related",
                snippet: "Banking stocks drew attention after the decision.",
                published_datetime_utc: "2026-05-19T07:05:00.000Z",
                source_name: "Example Finance"
              }
            ]
          }
        })
      };
    });
    const service = createIntelService({
      fetchImpl,
      newsSources: [],
      rapidApiRealTimeNewsKey: "server-secret",
      realTimeNewsQueries: [],
      realTimeNewsStoryId: "story-123",
      realTimeNewsCountry: "US",
      now: () => new Date("2026-05-19T08:10:00.000Z")
    });

    const result = await service.fetchNews({ force: true });

    expect(result.items).toEqual([
      expect.objectContaining({
        title: "Analysts watch banking counters",
        url: "https://example.com/markets-related",
        publisher: "Example Finance",
        category: "business"
      }),
      expect.objectContaining({
        title: "Markets react to central bank decision",
        url: "https://example.com/markets-main",
        publisher: "Example Wire",
        category: "business"
      })
    ]);
  });
});
