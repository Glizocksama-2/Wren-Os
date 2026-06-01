import type { CommandDeckState, DeckView } from "../store/commandDeck";
import type { DeckMetrics } from "./ollama";
import { buildDeckSummary } from "./ollama";

const AUTH_API_BASE_URL = (import.meta.env.VITE_AUTH_API_BASE_URL?.trim() ?? "").replace(/\/$/, "");
const SYSTEM_AI_CHAT_ENDPOINT = `${AUTH_API_BASE_URL}/api/system-ai/chat`;

export interface SystemAiReply {
  reply: string;
  conversationId: string | null;
  provider: string;
}

export async function requestSystemAiAgentReply({
  state,
  metrics,
  activeView,
  prompt,
  history,
  conversationId,
  fetchImpl = fetch
}: {
  state: CommandDeckState;
  metrics: DeckMetrics;
  activeView: DeckView;
  prompt: string;
  history: Array<{ role: "agent" | "operator"; body: string }>;
  conversationId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<SystemAiReply> {
  const response = await fetchImpl(SYSTEM_AI_CHAT_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: prompt,
      conversationId: conversationId ?? null,
      context: buildSystemAiContext({ state, metrics, activeView, history })
    })
  });
  const payload = await response.json().catch(() => ({})) as Partial<SystemAiReply> & { error?: string };
  if (!response.ok) throw new Error(payload.error || `System AI returned HTTP ${response.status}.`);
  if (!payload.reply?.trim()) throw new Error("System AI returned an empty reply.");
  return {
    reply: payload.reply.trim(),
    conversationId: typeof payload.conversationId === "string" && payload.conversationId.trim() ? payload.conversationId.trim() : null,
    provider: typeof payload.provider === "string" && payload.provider.trim() ? payload.provider.trim() : "system-ai"
  };
}

function buildSystemAiContext({
  state,
  metrics,
  activeView,
  history
}: {
  state: CommandDeckState;
  metrics: DeckMetrics;
  activeView: DeckView;
  history: Array<{ role: "agent" | "operator"; body: string }>;
}) {
  const recentHistory = history
    .slice(-6)
    .map((message) => `${message.role === "operator" ? "Operator" : "Sentinel"}: ${message.body}`)
    .join("\n");

  return [
    `Active module: ${activeView}`,
    buildDeckSummary(state, metrics),
    recentHistory ? `Recent Sentinel conversation:\n${recentHistory}` : "Recent Sentinel conversation: none"
  ].join("\n\n");
}
