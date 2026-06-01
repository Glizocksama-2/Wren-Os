import { describe, expect, it, vi } from "vitest";
import { freshCommandDeck, getDeckMetrics } from "../store/commandDeck";
import { requestSystemAiAgentReply } from "./systemAi";

describe("system AI client", () => {
  it("sends deck-aware Sentinel prompts to the protected system AI route", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(String(_url)).toMatch(/\/api\/system-ai\/chat$/);
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("include");
      const body = JSON.parse(String(init?.body));
      expect(body.message).toBe("Brief me");
      expect(body.context).toContain("Northwatch deck snapshot");
      expect(body.context).toContain("Active module: dashboard");
      expect(body.conversationId).toBe("conv-0");
      return new Response(JSON.stringify({ reply: "Copilot says focus.", conversationId: "conv-1", provider: "copilot5" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const result = await requestSystemAiAgentReply({
      state: freshCommandDeck,
      metrics: getDeckMetrics(freshCommandDeck),
      activeView: "dashboard",
      prompt: "Brief me",
      history: [{ role: "operator", body: "Morning check" }],
      conversationId: "conv-0",
      fetchImpl: fetchImpl as never
    });

    expect(result).toEqual({ reply: "Copilot says focus.", conversationId: "conv-1", provider: "copilot5" });
  });
});
