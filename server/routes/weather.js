import { createWeatherService } from "../services/weather.service.js";

export function createWeatherRouter({ express, service = createWeatherService() }) {
  const router = express.Router();

  router.get("/forecast", async (request, response) => {
    const latitude = normalizeCoordinate(request.query?.latitude, -90, 90);
    const longitude = normalizeCoordinate(request.query?.longitude, -180, 180);

    if (latitude === null || longitude === null) {
      response.status(400).json({ error: "Valid latitude and longitude are required." });
      return;
    }

    try {
      const forecast = await service.fetchForecast({
        userId: request.userId,
        latitude,
        longitude,
        lang: normalizeLang(request.query?.lang)
      });
      response.json(forecast);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Weather forecast failed.";
      response.status(message.includes("not configured") ? 503 : 502).json({ error: message });
    }
  });

  return router;
}

function normalizeCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function normalizeLang(value) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2,3}$/.test(text) ? text : "EN";
}
