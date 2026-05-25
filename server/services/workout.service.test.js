import { describe, expect, it, vi } from "vitest";
import { createWorkoutService } from "./workout.service.js";

describe("workout nutrition service", () => {
  it("posts food plate image URLs to the RapidAPI workout planner without exposing the key", async () => {
    const fetchImpl = vi.fn(async (_url, _init) => ({
      ok: true,
      json: async () => ({
        foodName: "Breakfast plate",
        calories: 520,
        protein: "21g",
        carbs: "64g",
        fat: "18g",
        recommendations: ["Add water", "Keep portions balanced"]
      })
    }));
    const service = createWorkoutService({ apiKey: "server-secret", fetchImpl });

    const result = await service.analyzeFoodPlate({
      imageUrl: "https://example.com/breakfast.jpg",
      lang: "en"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://ai-workout-planner-exercise-fitness-nutrition-guide.p.rapidapi.com/analyzeFoodPlate?imageUrl=https%3A%2F%2Fexample.com%2Fbreakfast.jpg&lang=en&noqueue=1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-rapidapi-key": "server-secret",
          "x-rapidapi-host": "ai-workout-planner-exercise-fitness-nutrition-guide.p.rapidapi.com",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ image: "" })
      })
    );
    expect(result).toMatchObject({
      foodName: "Breakfast plate",
      calories: 520,
      protein: "21g",
      carbs: "64g",
      fat: "18g",
      recommendations: ["Add water", "Keep portions balanced"],
      provider: "rapidapi-workout-planner"
    });
  });

  it("fails closed when the workout API key is missing", async () => {
    const service = createWorkoutService({ apiKey: "", fetchImpl: vi.fn() });

    await expect(service.analyzeFoodPlate({ imageUrl: "https://example.com/meal.jpg", lang: "en" })).rejects.toThrow(
      "Workout nutrition API is not configured."
    );
  });
});
