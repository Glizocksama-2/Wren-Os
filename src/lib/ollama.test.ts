import { describe, expect, it } from "vitest";
import { buildOllamaMessages, checkOllamaConnection, getOllamaApiUrl } from "./ollama";
import { freshCommandDeck, getDeckMetrics } from "../store/commandDeck";

describe("Ollama connector", () => {
  it("builds stable Ollama API URLs", () => {
    expect(getOllamaApiUrl("http://127.0.0.1:11434", "chat")).toBe("http://127.0.0.1:11434/api/chat");
    expect(getOllamaApiUrl("http://127.0.0.1:11434/api/", "tags")).toBe("http://127.0.0.1:11434/api/tags");
    expect(getOllamaApiUrl("", "tags")).toBe("http://127.0.0.1:11434/api/tags");
  });

  it("checks the local model list", async () => {
    const result = await checkOllamaConnection(
      { enabled: true, endpoint: "http://ollama.test", model: "llama3.2" },
      async () =>
        new Response(JSON.stringify({ models: [{ name: "llama3.2" }, { model: "mistral" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(["llama3.2", "mistral"]);
  });

  it("builds a deck-aware prompt for Sentinel", () => {
    const messages = buildOllamaMessages({
      state: {
        ...freshCommandDeck,
        tasks: [
          {
            id: "task-1",
            title: "Ship the Ollama agent",
            priority: "critical",
            kanbanPriority: "urgent",
            dueDate: null,
            status: "todo",
            createdAt: "2026-05-14T08:00:00.000Z",
            updatedAt: "2026-05-14T08:00:00.000Z"
          }
        ]
      },
      metrics: getDeckMetrics(freshCommandDeck),
      activeView: "dashboard",
      prompt: "What should I do next?",
      history: [{ role: "operator", body: "Brief me." }]
    });

    expect(messages[0].role).toBe("system");
    expect(messages.at(-1)?.content).toContain("Ship the Ollama agent");
    expect(messages.at(-1)?.content).toContain("Northwatch deck snapshot");
  });
});
