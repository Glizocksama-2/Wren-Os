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

  normalizeProxyRequestUrl(request);
  return app(request, response);
}

export function normalizeProxyRequestUrl(request) {
  const requestUrl = request.url ?? "/";
  const host = request.headers?.host ?? "northwatch.local";
  const url = new URL(requestUrl, `https://${host}`);
  const rewritePath = url.searchParams.get("path");

  if (!rewritePath) {
    return requestUrl;
  }

  url.searchParams.delete("path");
  const normalizedPath = rewritePath
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");

  if (!normalizedPath || normalizedPath.includes("://")) {
    return requestUrl;
  }

  const search = url.searchParams.toString();
  request.url = `/api/${normalizedPath}${search ? `?${search}` : ""}`;
  return request.url;
}

function getConfigurationDetail(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) return "Set DATABASE_URL on the API host before using credential auth.";
  if (message.includes("JWT_SECRET")) return "Set JWT_SECRET on the API host before using credential auth.";
  return "Check the Express API environment variables.";
}
