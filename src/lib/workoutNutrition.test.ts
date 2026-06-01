import { describe, expect, it, vi } from "vitest";
import { analyzeFoodPlate } from "./workoutNutrition";

describe("workout nutrition client", () => {
  it("sends food image URLs to the protected backend workout route with cookies", async () => {
    const fetchImpl = vi.fn(async (_url, _init) => {
      return new Response(
        JSON.stringify({
          foodName: "Breakfast plate",
          calories: 520,
          protein: "21g",
          carbs: "64g",
          fat: "18g",
          recommendations: ["Add water"],
          provider: "rapidapi-workout-planner"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await analyzeFoodPlate({ imageUrl: "https://example.com/breakfast.jpg", lang: "en", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/workout\/analyze-food$/),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ imageUrl: "https://example.com/breakfast.jpg", lang: "en" })
      })
    );
    expect(result).toMatchObject({ foodName: "Breakfast plate", calories: 520, recommendations: ["Add water"] });
  });
});
