import { describe, expect, it, vi } from "vitest";
import { getLiveWeatherForecast } from "./weather";

describe("weather client", () => {
  it("fetches forecast data through the protected backend weather route", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        provider: "rapidapi-open-weather13",
        checkedAt: "2026-05-22T08:00:00.000Z",
        location: "Nairobi, KE",
        latitude: -1.286389,
        longitude: 36.817223,
        current: {
          location: "Nairobi, KE",
          description: "light rain",
          temperatureC: 21.5,
          feelsLikeC: 22,
          humidity: 68,
          windKph: 14,
          latitude: -1.286389,
          longitude: 36.817223,
          forecastAt: "2026-05-22T09:00:00.000Z",
          capturedAt: "2026-05-22T08:00:00.000Z"
        },
        forecast: []
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const forecast = await getLiveWeatherForecast({ latitude: -1.286389, longitude: 36.817223 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/weather\/forecast\?latitude=-1.286389&longitude=36.817223&lang=EN$/),
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(forecast.current.description).toBe("light rain");
    expect(forecast.current.temperatureC).toBe(21.5);
  });
});
