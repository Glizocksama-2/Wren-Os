const WORKOUT_RAPIDAPI_HOST = "ai-workout-planner-exercise-fitness-nutrition-guide.p.rapidapi.com";
const WORKOUT_PLATE_PATH = "/analyzeFoodPlate";

export function createWorkoutService(options = {}) {
  const apiKey = normalizeSecret(options.apiKey ?? process.env.RAPIDAPI_WORKOUT_KEY ?? process.env.WORKOUT_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY ?? "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    isConfigured() {
      return Boolean(apiKey);
    },
    async analyzeFoodPlate({ imageUrl, lang = "en" }) {
      if (!apiKey) throw new Error("Workout nutrition API is not configured.");

      const url = new URL(`https://${WORKOUT_RAPIDAPI_HOST}${WORKOUT_PLATE_PATH}`);
      url.searchParams.set("imageUrl", imageUrl);
      url.searchParams.set("lang", normalizeLang(lang));
      url.searchParams.set("noqueue", "1");

      const payload = await fetchJson(url.toString(), {
        method: "POST",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": WORKOUT_RAPIDAPI_HOST,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: "" })
      }, fetchImpl);

      return normalizePlateAnalysis(payload);
    }
  };
}

async function fetchJson(url, init, fetchImpl, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload?.message ?? payload?.error ?? `Workout nutrition API returned HTTP ${response.status}.`;
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

function normalizePlateAnalysis(payload) {
  const source = unwrapPayload(payload);
  const nutrition = source.nutrition ?? source.nutrients ?? source.macros ?? {};
  return {
    foodName: readText(source, ["foodName", "food_name", "dish", "dishName", "name", "title"]) || "Analyzed plate",
    summary: readText(source, ["summary", "description", "analysis", "message"]) || "",
    calories: readNumberOrText(source.calories ?? source.kcal ?? nutrition.calories ?? nutrition.kcal),
    protein: readMacro(source.protein ?? nutrition.protein),
    carbs: readMacro(source.carbs ?? source.carbohydrates ?? nutrition.carbs ?? nutrition.carbohydrates),
    fat: readMacro(source.fat ?? source.fats ?? nutrition.fat ?? nutrition.fats),
    recommendations: readList(source.recommendations ?? source.suggestions ?? source.advice ?? source.tips),
    provider: "rapidapi-workout-planner"
  };
}

function unwrapPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.result && typeof payload.result === "object") return unwrapPayload(payload.result);
  if (payload.data && typeof payload.data === "object") return unwrapPayload(payload.data);
  if (payload.response && typeof payload.response === "object") return unwrapPayload(payload.response);
  return payload;
}

function readText(source, keys) {
  for (const key of keys) {
    if (typeof source?.[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return "";
}

function readNumberOrText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) && /\d/.test(value) ? numeric : value.trim();
  }
  return null;
}

function readMacro(value) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}g`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function readList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeLang(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[a-z]{2,3}(-[a-z]{2})?$/i.test(text) ? text : "en";
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}
