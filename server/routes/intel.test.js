import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createIntelRouter } from "./intel.js";

describe("intel routes", () => {
  it("serves the combined live intel payload", async () => {
    const service = createService();
    const authService = createAuthService();
    const app = express();
    app.use(express.json());
    app.use("/api/intel", createIntelRouter({ express, service, authService }));

    const response = await request(app).get("/api/intel/all").expect(200);

    expect(response.body.crypto.items[0].symbol).toBe("BTC");
    expect(response.body.forex.base).toBe("KES");
    expect(service.fetchAll).toHaveBeenCalledOnce();
  });

  it("forces a specific cache refresh by type", async () => {
    const service = createService();
    const authService = createAuthService();
    const app = express();
    app.use(express.json());
    app.use("/api/intel", createIntelRouter({ express, service, authService }));

    const response = await request(app).post("/api/intel/refresh/crypto").expect(200);

    expect(response.body.items[0].symbol).toBe("BTC");
    expect(service.fetchCrypto).toHaveBeenCalledWith({ force: true });
    expect(authService.verifyRequest).toHaveBeenCalledOnce();
  });

  it("requires authentication before force-refreshing intel caches", async () => {
    const service = createService();
    const authService = createAuthService(null);
    const app = express();
    app.use(express.json());
    app.use("/api/intel", createIntelRouter({ express, service, authService }));

    await request(app).post("/api/intel/refresh/crypto").expect(401);

    expect(service.fetchCrypto).not.toHaveBeenCalled();
  });
});

function createService() {
  return {
    fetchAll: vi.fn(async () => ({
      news: { items: [] },
      crypto: { items: [{ symbol: "BTC" }] },
      stocksKenya: { items: [] },
      stocksGlobal: { items: [] },
      forex: { base: "KES", rates: [] },
      indicators: { items: [] }
    })),
    fetchNews: vi.fn(async () => ({ items: [] })),
    fetchCrypto: vi.fn(async () => ({ items: [{ symbol: "BTC" }] })),
    fetchNSEStocks: vi.fn(async () => ({ items: [] })),
    fetchGlobalStocks: vi.fn(async () => ({ items: [] })),
    fetchForex: vi.fn(async () => ({ base: "KES", rates: [] })),
    fetchIndicators: vi.fn(async () => ({ items: [] }))
  };
}

function createAuthService(result = { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }) {
  return {
    verifyRequest: vi.fn(async () => result)
  };
}
