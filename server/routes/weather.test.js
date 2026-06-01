import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createWeatherRouter } from "./weather.js";

describe("weather routes", () => {
  it("requires auth when mounted behind the authenticate middleware", async () => {
    const app = createTestApp();

    await request(app).get("/api/weather/forecast?latitude=-1&longitude=36").expect(401);
  });

  it("proxies authenticated forecast requests to the weather service", async () => {
    const service = {
      fetchForecast: vi.fn(async () => ({
        current: { location: "Nairobi, KE", description: "clear sky", temperatureC: 23, capturedAt: "2026-05-22T08:00:00.000Z" },
        forecast: []
      }))
    };
    const app = createTestApp(service);

    const response = await request(app)
      .get("/api/weather/forecast?latitude=-1.286389&longitude=36.817223&lang=EN")
      .set("Cookie", "northwatch_session=token")
      .expect(200);

    expect(service.fetchForecast).toHaveBeenCalledWith({
      userId: "user-1",
      latitude: -1.286389,
      longitude: 36.817223,
      lang: "EN"
    });
    expect(response.body.current.description).toBe("clear sky");
  });

  it("rejects invalid coordinates", async () => {
    const app = createTestApp();

    await request(app).get("/api/weather/forecast?latitude=200&longitude=36").set("Cookie", "northwatch_session=token").expect(400);
  });
});

function createTestApp(service = { fetchForecast: vi.fn() }) {
  const app = express();
  const authService = {
    verifyRequest: vi.fn(async (request) => {
      if (!request.headers.cookie) {
        const error = new Error("Missing token");
        error.status = 401;
        throw error;
      }
      return { userId: "user-1" };
    })
  };

  app.use(express.json());
  app.use("/api/weather", authenticate({ authService }), createWeatherRouter({ express, service }));
  return app;
}
