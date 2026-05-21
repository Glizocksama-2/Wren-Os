import { describe, expect, it, vi } from "vitest";
import { createCopilotService } from "./copilot.service.js";

describe("copilot system AI service", () => {
  it("sends system prompts to Copilot5 through RapidAPI without exposing the key to callers", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(_url).toBe("https://copilot5.p.rapidapi.com/copilot");
      expect(init.headers["x-rapidapi-key"]).toBe("server-secret");
      expect(init.headers["x-rapidapi-host"]).toBe("copilot5.p.rapidapi.com");
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        conversation_id: null,
        mode: "CHAT",
        markdown: true
      });
      expect(body.message).toContain("You are Sentinel");
      expect(body.message).toContain("Northwatch deck snapshot");
      expect(body.message).toContain("What should I do next?");
      return jsonResponse({ message: "Prioritize the blocked deployment.", conversation_id: "conv-1" });
    });
    const service = createCopilotService({ fetchImpl, apiKey: "server-secret" });

    const result = await service.chat({
      message: "What should I do next?",
      context: "Northwatch deck snapshot:\nOpen tasks: 4"
    });

    expect(result).toEqual({
      reply: "Prioritize the blocked deployment.",
      conversationId: "conv-1",
      provider: "copilot5"
    });
  });

  it("reports a clear configuration error when no Copilot key is available", async () => {
    const service = createCopilotService({ apiKey: "" });

    await expect(service.chat({ message: "Hello" })).rejects.toThrow("Copilot system AI is not configured.");
  });
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}
