import { createApp } from "../server/app.js";

let app;
let startupError;

function getApp() {
  if (app) {
    return app;
  }

  try {
    app = createApp();
    return app;
  } catch (error) {
    startupError = error;
    return null;
  }
}

function startupErrorDetail(error) {
  const message = error?.message ?? "";
  if (message.includes("DATABASE_URL")) {
    return "Set DATABASE_URL in the Vercel project environment or configure VITE_AUTH_API_BASE_URL to point at the live Express API.";
  }

  if (message.includes("JWT_SECRET")) {
    return "Set JWT_SECRET in the Vercel project environment.";
  }

  return "Check the Vercel function logs for the server startup error.";
}

export default function handler(request, response) {
  const expressApp = getApp();
  if (!expressApp) {
    response.status(503).json({
      error: "Northwatch API is not configured.",
      detail: startupErrorDetail(startupError),
    });
    return;
  }

  expressApp(request, response);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
