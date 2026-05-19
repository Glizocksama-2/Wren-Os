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
      marketCapKes: 250000000000000
    });
    expect(second.status).toBe("stale");
    expect(second.items[0].id).toBe("bitcoin");
  });
});
