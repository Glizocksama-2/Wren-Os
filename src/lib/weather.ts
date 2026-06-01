const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL ?? "";
const WEATHER_FORECAST_ENDPOINT = `${AUTH_API_BASE_URL}/api/weather/forecast`;

export type LiveWeatherSnapshot = {
  provider: string;
  location: string;
  description: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windKph: number | null;
  latitude: number;
  longitude: number;
  forecastAt: string;
  capturedAt: string;
};

export type LiveWeatherForecast = {
  provider: string;
  checkedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  current: LiveWeatherSnapshot;
  forecast: LiveWeatherSnapshot[];
};

export async function getLiveWeatherForecast({
  latitude,
  longitude,
  lang = "EN"
}: {
  latitude: number;
  longitude: number;
  lang?: string;
}): Promise<LiveWeatherForecast> {
  const url = new URL(WEATHER_FORECAST_ENDPOINT, window.location.origin);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("lang", lang);

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `Weather request failed with HTTP ${response.status}.`);
  }

  return normalizeForecast(payload);
}

function normalizeForecast(payload: unknown): LiveWeatherForecast {
  const source = isRecord(payload) ? payload : {};
  const current = normalizeSnapshot(source.current, source);
  const forecast = Array.isArray(source.forecast) ? source.forecast.map((item) => normalizeSnapshot(item, source)) : [];

  return {
    provider: normalizeText(source.provider) || "rapidapi-open-weather13",
    checkedAt: normalizeText(source.checkedAt) || new Date().toISOString(),
    location: normalizeText(source.location) || current.location || "Selected location",
    latitude: normalizeNumber(source.latitude) ?? current.latitude,
    longitude: normalizeNumber(source.longitude) ?? current.longitude,
    current,
    forecast
  };
}

function normalizeSnapshot(value: unknown, fallback: Record<string, unknown>): LiveWeatherSnapshot {
  const source = isRecord(value) ? value : {};
  return {
    provider: normalizeText(source.provider) || normalizeText(fallback.provider) || "rapidapi-open-weather13",
    location: normalizeText(source.location) || normalizeText(fallback.location) || "Selected location",
    description: normalizeText(source.description) || "Weather data available",
    temperatureC: normalizeNumber(source.temperatureC),
    feelsLikeC: normalizeNumber(source.feelsLikeC),
    humidity: normalizeNumber(source.humidity),
    windKph: normalizeNumber(source.windKph),
    latitude: normalizeNumber(source.latitude) ?? normalizeNumber(fallback.latitude) ?? 0,
    longitude: normalizeNumber(source.longitude) ?? normalizeNumber(fallback.longitude) ?? 0,
    forecastAt: normalizeText(source.forecastAt) || normalizeText(fallback.checkedAt) || new Date().toISOString(),
    capturedAt: normalizeText(source.capturedAt) || normalizeText(fallback.checkedAt) || new Date().toISOString()
  };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
