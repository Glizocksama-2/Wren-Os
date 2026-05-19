import type { CommandDeckState, DeckView } from "../store/commandDeck";
import type { getDeckMetrics } from "../store/commandDeck";

export interface OllamaConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
}

export interface OllamaConnection {
  ok: boolean;
  models: string[];
  error: string | null;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

export type DeckMetrics = ReturnType<typeof getDeckMetrics>;
const OLLAMA_STATUS_TIMEOUT_MS = 5000;
const OLLAMA_CHAT_TIMEOUT_MS = 45000;
const DEFAULT_OLLAMA_MODEL = "qwen2.5:1.5b";

export function getOllamaApiUrl(endpoint: string, path: "tags" | "chat"): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  const base = trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
  return `${base || "http://127.0.0.1:11434"}/api/${path}`;
}

export async function checkOllamaConnection(config: OllamaConfig, fetchImpl: typeof fetch = fetch): Promise<OllamaConnection> {
  if (!config.enabled) return { ok: false, models: [], error: "Ollama is disabled." };

  try {
    const response = await fetchWithTimeout(fetchImpl, getOllamaApiUrl(config.endpoint, "tags"), {}, OLLAMA_STATUS_TIMEOUT_MS);
    if (!response.ok) return { ok: false, models: [], error: `Ollama returned HTTP ${response.status}.` };

    const data = await response.json() as OllamaTagsResponse;
    const models = (data.models ?? [])
      .map((model) => model.name ?? model.model ?? "")
      .filter(Boolean);

    return { ok: true, models, error: null };
  } catch (error) {
    return { ok: false, models: [], error: getOllamaErrorMessage(error) };
  }
}

export async function requestOllamaAgentReply({
  config,
  state,
  metrics,
  activeView,
  prompt,
  history
}: {
  config: OllamaConfig;
  state: CommandDeckState;
  metrics: DeckMetrics;
  activeView: DeckView;
  prompt: string;
  history: Array<{ role: "agent" | "operator"; body: string }>;
}): Promise<string> {
  if (!config.enabled) throw new Error("Ollama is disabled.");

  const response = await fetchWithTimeout(
    fetch,
    getOllamaApiUrl(config.endpoint, "chat"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model.trim() || DEFAULT_OLLAMA_MODEL,
        stream: false,
        messages: buildOllamaMessages({ state, metrics, activeView, prompt, history }),
        options: {
          temperature: 0.35,
          num_ctx: 4096
        }
      })
    },
    OLLAMA_CHAT_TIMEOUT_MS
  );

  const data = await response.json().catch(() => ({})) as OllamaChatResponse;
  if (!response.ok) throw new Error(data.error || `Ollama returned HTTP ${response.status}.`);

  const reply = data.message?.content?.trim();
  if (!reply) throw new Error("Ollama returned an empty reply.");
  return reply;
}

export function buildOllamaMessages({
  state,
  metrics,
  activeView,
  prompt,
  history
}: {
  state: CommandDeckState;
  metrics: DeckMetrics;
  activeView: DeckView;
  prompt: string;
  history: Array<{ role: "agent" | "operator"; body: string }>;
}) {
  const recentHistory = history.slice(-6).map((message) => ({
    role: message.role === "operator" ? "user" : "assistant",
    content: message.body
  }));

  return [
    {
      role: "system",
      content:
        "You are Sentinel, the local Ollama AI agent inside Northwatch. Use the operator's actual deck data. Be direct, practical, and tactical. Give specific next actions, tradeoffs, and sequence. Do not claim you changed app data unless the prompt explicitly asks for an action and the app reports that action. Keep replies under 8 short lines unless the operator asks for depth."
    },
    ...recentHistory,
    {
      role: "user",
      content: [
        `Operator prompt: ${prompt}`,
        "",
        `Active module: ${activeView}`,
        buildDeckSummary(state, metrics)
      ].join("\n")
    }
  ];
}

export function buildDeckSummary(state: CommandDeckState, metrics: DeckMetrics): string {
  const topTasks = state.tasks
    .filter((task) => task.status !== "done")
    .slice(0, 6)
    .map((task) => `- ${task.title} (${task.priority}${task.dueDate ? `, due ${task.dueDate}` : ""})`)
    .join("\n") || "- No open tasks";
  const projects = state.projects
    .filter((project) => project.status === "pending")
    .slice(0, 6)
    .map((project) => `- ${project.name}: ${project.progress}% | ${project.nextAction || project.objective || "No next action"}`)
    .join("\n") || "- No pending projects";
  const intel = state.intel
    .slice(0, 5)
    .map((item) => `- ${item.title}${item.symbol ? ` (${item.symbol})` : ""}: ${item.signal} | ${item.thesis}`)
    .join("\n") || "- No tracked intel yet";

  return [
    "Northwatch deck snapshot:",
    `Readiness: ${metrics.readiness}%`,
    `Open tasks: ${metrics.openTasks}; pending projects: ${metrics.pendingProjects}; done projects: ${metrics.doneProjects}`,
    `Calendar events: ${metrics.calendarEvents}; workouts done: ${metrics.workoutsDone}; reading: ${metrics.readingCount}; journal entries: ${metrics.journalEntries}`,
    `Intel targets: ${metrics.intelItems}; researching/high-priority: ${metrics.intelResearching}`,
    `Net cash: ${metrics.netCash}`,
    "",
    "Top open tasks:",
    topTasks,
    "",
    "Priority projects:",
    projects,
    "",
    "Intel board:",
    intel
  ].join("\n");
}

function getOllamaErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Ollama request timed out.";
  if (error instanceof Error) return error.message;
  return "Could not reach Ollama.";
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}
