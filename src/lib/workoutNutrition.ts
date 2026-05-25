const AUTH_API_BASE_URL = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");
const WORKOUT_ANALYZE_ENDPOINT = `${AUTH_API_BASE_URL}/api/workout/analyze-food`;

export interface FoodPlateAnalysis {
  foodName: string;
  summary: string;
  calories: number | string | null;
  protein: string;
  carbs: string;
  fat: string;
  recommendations: string[];
  provider: string;
}

export async function analyzeFoodPlate({
  imageUrl,
  lang,
  fetchImpl = fetch
}: {
  imageUrl: string;
  lang: string;
  fetchImpl?: typeof fetch;
}): Promise<FoodPlateAnalysis> {
  const response = await fetchImpl(WORKOUT_ANALYZE_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, lang })
  });
  const payload = await response.json().catch(() => ({})) as Partial<FoodPlateAnalysis> & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Food plate analysis returned HTTP ${response.status}.`);
  return {
    foodName: normalizeText(payload.foodName) || "Analyzed plate",
    summary: normalizeText(payload.summary),
    calories: typeof payload.calories === "number" || typeof payload.calories === "string" ? payload.calories : null,
    protein: normalizeText(payload.protein),
    carbs: normalizeText(payload.carbs),
    fat: normalizeText(payload.fat),
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
    provider: normalizeText(payload.provider) || "rapidapi-workout-planner"
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
