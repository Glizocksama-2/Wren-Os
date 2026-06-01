import { randomUUID } from "node:crypto";

export function createRequestContextMiddleware({ logger, requestIdFactory = defaultRequestIdFactory } = {}) {
  return function requestContext(request, response, next) {
    const requestId = getIncomingRequestId(request) ?? requestIdFactory();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    response.on("finish", () => {
      logger?.info?.({
        event: "http_request",
        requestId,
        method: request.method,
        path: request.path ?? request.url,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ip: getClientIp(request)
      });
    });

    next();
  };
}

function defaultRequestIdFactory() {
  return `req-${randomUUID()}`;
}

function getIncomingRequestId(request) {
  const value = request.get?.("x-request-id") ?? request.headers?.["x-request-id"];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.:-]{6,96}$/.test(trimmed) ? trimmed : null;
}

function getClientIp(request) {
  return request.ip || request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}
