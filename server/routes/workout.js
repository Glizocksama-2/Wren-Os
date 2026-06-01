import { createWorkoutService } from "../services/workout.service.js";

export function createWorkoutRouter({ express, service = createWorkoutService() }) {
  const router = express.Router();

  router.post("/analyze-food", async (request, response) => {
    const imageUrl = normalizeUrl(request.body?.imageUrl);
    if (!imageUrl) {
      response.status(400).json({ error: "A valid http(s) food image URL is required." });
      return;
    }

    try {
      const result = await service.analyzeFoodPlate({
        userId: request.userId,
        imageUrl,
        lang: normalizeLang(request.body?.lang)
      });
      response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Food plate analysis failed.";
      response.status(message.includes("not configured") ? 503 : 502).json({ error: message });
    }
  });

  return router;
}

function normalizeUrl(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeLang(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[a-z]{2,3}(-[a-z]{2})?$/i.test(text) ? text : "en";
}
