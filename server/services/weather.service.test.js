import { describe, expect, it, vi } from "vitest";
import { createWeatherService } from "./weather.service.js";

describe("weather service", () => {
  it("fetches five-day forecasts through RapidAPI without exposing the key", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        city: { name: "Nairobi", country: "KE" },
        list: [
          {
            dt_txt: "2026-05-22 09:00:00",
            main: { temp: 21.4, feels_like: 22.1, humidity: 67 },
            weather: [{ description: "light rain" }],
            wind: { speed: 4 }
          }
        ]
      })
    }));
    const service = createWeatherService({ apiKey: "server-secret", fetchImpl });

    const forecast = await service.fetchForecast({ latitude: -1.286389, longitude: 36.817223, lang: "EN" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://open-weather13.p.rapidapi.com/fivedaysforcast?latitude=-1.286389&longitude=36.817223&lang=EN&units=metric",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-rapidapi-key": "server-secret",
          "x-rapidapi-host": "open-weather13.p.rapidapi.com"
        })
      })
    );
    expect(forecast.current).toMatchObject({
      location: "Nairobi, KE",
      description: "light rain",
      temperatureC: 21.4,
      humidity: 67,
      windKph: 14.4
    });
    expect(forecast.provider).toBe("rapidapi-open-weather13");
  });

  it("uses Open-Meteo as a live fallback when the RapidAPI key is missing", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        current: {
          time: "2026-05-22T09:00",
          temperature_2m: 22.3,
          apparent_temperature: 23.1,
          relative_humidity_2m: 70,
          weather_code: 61,
          wind_speed_10m: 12.4
        },
        hourly: {
          time: ["2026-05-22T09:00"],
          temperature_2m: [22.3],
          apparent_temperature: [23.1],
          relative_humidity_2m: [70],
          weather_code: [61],
          wind_speed_10m: [12.4]
        }
      })
    }));
    const service = createWeatherService({ apiKey: "", fetchImpl });

    const forecast = await service.fetchForecast({ latitude: -1.286389, longitude: 36.817223 });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("https://api.open-meteo.com/v1/forecast?"),
      expect.objectContaining({ method: "GET" })
    );
    expect(forecast.provider).toBe("open-meteo");
    expect(forecast.current).toMatchObject({
      description: "rain",
      temperatureC: 22.3,
      humidity: 70,
      windKph: 12.4
    });
  });

  it("falls back to Open-Meteo when RapidAPI is not subscribed", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("open-weather13.p.rapidapi.com")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: "You are not subscribed to this API." })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          current: {
            time: "2026-05-22T09:00",
            temperature_2m: 24,
            apparent_temperature: 24.5,
            relative_humidity_2m: 64,
            weather_code: 2,
            wind_speed_10m: 9
          },
          hourly: { time: [] }
        })
      };
    });
    const service = createWeatherService({ apiKey: "server-secret", fetchImpl });

    const forecast = await service.fetchForecast({ latitude: -1.286389, longitude: 36.817223, lang: "EN" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(forecast.provider).toBe("open-meteo");
    expect(forecast.current.description).toBe("partly cloudy");
  });
});
