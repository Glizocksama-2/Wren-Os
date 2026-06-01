import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";
import { createWorkoutRouter } from "./workout.js";

describe("workout routes", () => {
  it("requires an authenticated cookie before analyzing food plates", async () => {
    const service = createService();
    const app = createProtectedApp({ service, verified: null });

    await request(app).post("/api/workout/analyze-food").send({ imageUrl: "https://example.com/meal.jpg" }).expect(401);

    expect(service.analyzeFoodPlate).not.toHaveBeenCalled();
  });

  it("proxies authenticated plate analysis requests to the workout service", async () => {
    const service = createService();
    const app = createProtectedApp({
      service,
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    const response = await request(app)
      .post("/api/workout/analyze-food")
      .set("Cookie", "northwatch_session=token")
      .send({ imageUrl: "https://example.com/meal.jpg", lang: "sw" })
      .expect(200);

    expect(response.body).toMatchObject({ foodName: "Balanced plate", calories: 480 });
    expect(service.analyzeFoodPlate).toHaveBeenCalledWith({
      userId: "user-1",
      imageUrl: "https://example.com/meal.jpg",
      lang: "sw"
    });
  });

  it("rejects missing or invalid food image URLs", async () => {
    const app = createProtectedApp({
      service: createService(),
      verified: { userId: "user-1", user: { id: "user-1" }, session: { id: "session-1" } }
    });

    await request(app).post("/api/workout/analyze-food").set("Cookie", "northwatch_session=token").send({ imageUrl: "" }).expect(400);
    await request(app).post("/api/workout/analyze-food").set("Cookie", "northwatch_session=token").send({ imageUrl: "file:///meal.jpg" }).expect(400);
  });
});

function createProtectedApp({ service, verified }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/workout",
    authenticate({
      authService: {
        verifyRequest: async (request) => (request.cookies?.northwatch_session ? verified : null)
      }
    }),
    createWorkoutRouter({ express, service })
  );
  return app;
}

function createService() {
  return {
    analyzeFoodPlate: vi.fn(async () => ({
      foodName: "Balanced plate",
      calories: 480,
      protein: "24g",
      carbs: "52g",
      fat: "14g",
      recommendations: ["Good post-workout balance"],
      provider: "rapidapi-workout-planner"
    }))
  };
}
