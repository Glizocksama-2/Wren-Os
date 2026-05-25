const WEATHER_RAPIDAPI_HOST = "open-weather13.p.rapidapi.com";
const FIVE_DAY_FORECAST_PATH = "/fivedaysforcast";

export function createWeatherService(options = {}) {
  const apiKey = normalizeSecret(options.apiKey ?? process.env.RAPIDAPI_WEATHER_KEY ?? process.env.WEATHER_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY ?? "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    isConfigured() {
      return true;
    },
    async fetchForecast({ latitude, longitude, lang = "EN" }) {
      let rapidApiError = null;

      if (apiKey) {
        try {
          const url = new URL(`https://${WEATHER_RAPIDAPI_HOST}${FIVE_DAY_FORECAST_PATH}`);
          url.searchParams.set("latitude", String(latitude));
          url.searchParams.set("longitude", String(longitude));
          url.searchParams.set("lang", normalizeLang(lang));
          url.searchParams.set("units", "metric");

          const payload = await fetchJson(url.toString(), {
            method: "GET",
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": WEATHER_RAPIDAPI_HOST,
              "Content-Type": "application/json"
            }
          }, fetchImpl);

          return normalizeRapidApiForecast(payload, { latitude, longitude });
        } catch (error) {
          rapidApiError = error;
        }
      }

      try {
        return await fetchOpenMeteoForecast({ latitude, longitude, fetchImpl });
      } catch (error) {
        if (rapidApiError instanceof Error && error instanceof Error) {
          throw new Error(`RapidAPI weather failed (${rapidApiError.message}); Open-Meteo fallback failed (${error.message}).`);
        }
        throw error;
      }
    }
  };
}

async function fetchJson(url, init, fetchImpl, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload?.message ?? payload?.error ?? `Weather API returned HTTP ${response.status}.`;
      throw new Error(error);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenMeteoForecast({ latitude, longitude, fetchImpl }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "5");
  url.searchParams.set("wind_speed_unit", "kmh");

  const payload = await fetchJson(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  }, fetchImpl);

  return normalizeOpenMeteoForecast(payload, { latitude, longitude });
}

function normalizeRapidApiForecast(payload, coordinates) {
  const checkedAt = new Date().toISOString();
  const list = readForecastItems(payload);
  const city = payload?.city ?? payload?.location ?? {};
  const locationName = readLocationName(city, payload);
  const currentSource = payload?.current ?? payload?.weather ?? list[0] ?? {};
  const current = normalizeWeatherPoint(currentSource, {
    checkedAt,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    location: locationName
  });

  return {
    provider: "rapidapi-open-weather13",
    checkedAt,
    location: locationName,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    current,
    forecast: list.slice(0, 16).map((item) => normalizeWeatherPoint(item, {
      checkedAt,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      location: locationName
    }))
  };
}

function normalizeOpenMeteoForecast(payload, coordinates) {
  const checkedAt = new Date().toISOString();
  const location = "Selected location";
  const current = payload?.current ?? {};
  const currentPoint = {
    provider: "open-meteo",
    location,
    description: describeWeatherCode(current.weather_code),
    temperatureC: normalizeTemperature(readNumber(current.temperature_2m)),
    feelsLikeC: normalizeTemperature(readNumber(current.apparent_temperature)),
    humidity: readNumber(current.relative_humidity_2m),
    windKph: readNumber(current.wind_speed_10m),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    forecastAt: readDate(current.time) ?? checkedAt,
    capturedAt: checkedAt
  };

  return {
    provider: "open-meteo",
    checkedAt,
    location,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    current: currentPoint,
    forecast: readOpenMeteoHourly(payload?.hourly, coordinates, checkedAt, location)
  };
}

function readOpenMeteoHourly(hourly, coordinates, checkedAt, location) {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  return hourly.time.slice(0, 16).map((time, index) => ({
    provider: "open-meteo",
    location,
    description: describeWeatherCode(readArrayValue(hourly.weather_code, index)),
    temperatureC: normalizeTemperature(readNumber(readArrayValue(hourly.temperature_2m, index))),
    feelsLikeC: normalizeTemperature(readNumber(readArrayValue(hourly.apparent_temperature, index))),
    humidity: readNumber(readArrayValue(hourly.relative_humidity_2m, index)),
    windKph: readNumber(readArrayValue(hourly.wind_speed_10m, index)),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    forecastAt: readDate(time) ?? checkedAt,
    capturedAt: checkedAt
  }));
}

function readArrayValue(values, index) {
  return Array.isArray(values) ? values[index] : null;
}

function describeWeatherCode(value) {
  const code = readNumber(value);
  if (code === 0) return "clear sky";
  if (code === 1 || code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code === 51 || code === 53 || code === 55) return "drizzle";
  if (code === 56 || code === 57) return "freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "rain";
  if (code === 66 || code === 67) return "freezing rain";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "snow";
  if (code === 80 || code === 81 || code === 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code === 95 || code === 96 || code === 99) return "thunderstorm";
  return "Weather data available";
}

function readForecastItems(payload) {
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.forecast)) return payload.forecast;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeWeatherPoint(source, defaults) {
  const main = source?.main ?? source?.temperature ?? source?.temp ?? {};
  const wind = source?.wind ?? {};
  const weather = Array.isArray(source?.weather) ? source.weather[0] ?? {} : source?.weather ?? {};
  const forecastAt = readDate(source?.dt_txt ?? source?.datetime ?? source?.date_time ?? source?.time ?? source?.date ?? source?.dt);
  const temperatureC = normalizeTemperature(readNumber(source?.temp ?? source?.temperature ?? main.temp ?? main.value));
  const feelsLikeC = normalizeTemperature(readNumber(source?.feels_like ?? source?.feelsLike ?? main.feels_like ?? main.feelsLike));

  return {
    provider: "rapidapi-open-weather13",
    location: defaults.location,
    description: readText(weather.description ?? weather.main ?? source?.description ?? source?.condition) || "Weather data available",
    temperatureC,
    feelsLikeC,
    humidity: readNumber(source?.humidity ?? main.humidity),
    windKph: normalizeWindKph(readNumber(wind.speed ?? source?.windSpeed ?? source?.wind_kph)),
    latitude: defaults.latitude,
    longitude: defaults.longitude,
    forecastAt: forecastAt ?? defaults.checkedAt,
    capturedAt: defaults.checkedAt
  };
}

function readLocationName(city, payload) {
  const cityName = readText(city?.name ?? payload?.name ?? payload?.cityName ?? payload?.locationName);
  const country = readText(city?.country ?? payload?.country);
  if (cityName && country) return `${cityName}, ${country}`;
  return cityName || "Selected location";
}

function normalizeTemperature(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value > 170) return roundOne(value - 273.15);
  if (value > 60) return roundOne((value - 32) * (5 / 9));
  return roundOne(value);
}

function normalizeWindKph(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return roundOne(value * 3.6);
}

function readDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function readNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function readText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeLang(value) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2,3}$/.test(text) ? text : "EN";
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
