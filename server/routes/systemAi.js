import { createCopilotService } from "../services/copilot.service.js";

export function createSystemAiRouter({ express, service = createCopilotService() }) {
  const router = express.Router();

  router.get("/health", (_request, response) => {
    response.json({
      provider: "copilot5",
      configured: typeof service.isConfigured === "function" ? service.isConfigured() : true
    });
  });

  router.post("/chat", async (request, response) => {
    const message = normalizeText(request.body?.message);
    if (!message) {
      response.status(400).json({ error: "Message is required." });
      return;
    }

    try {
      const result = await service.chat({
        userId: request.userId,
        message,
        context: normalizeText(request.body?.context).slice(0, 16000),
        conversationId: normalizeNullableText(request.body?.conversationId)
      });
      response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "System AI request failed.";
      response.status(message.includes("not configured") ? 503 : 502).json({ error: message });
    }
  });

  return router;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}
