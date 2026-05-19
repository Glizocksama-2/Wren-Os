import { createApp } from "../server/app.js";

let app = null;
let appError = null;

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(request, response) {
  if (!app && !appError) {
    try {
      app = createApp();
    } catch (error) {
      appError = error;
    }
  }

  if (appError) {
    response.status(503).json({
      error: "Northwatch API is not configured.",
      detail: getConfigurationDetail(appError)
    });
    return;
  }

  return app(request, response);
}

function getConfigurationDetail(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) return "Set DATABASE_URL on the API host before using credential auth.";
  if (message.includes("JWT_SECRET")) return "Set JWT_SECRET on the API host before using credential auth.";
  return "Check the Express API environment variables.";
}
