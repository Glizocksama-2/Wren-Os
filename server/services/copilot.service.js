const COPILOT_RAPIDAPI_HOST = "copilot5.p.rapidapi.com";
const COPILOT_RAPIDAPI_URL = `https://${COPILOT_RAPIDAPI_HOST}/copilot`;
const COPILOT_TIMEOUT_MS = 45000;

export function createCopilotService(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiKey = normalizeSecret(
    options.apiKey ?? process.env.RAPIDAPI_COPILOT_KEY ?? process.env.COPILOT_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY ?? ""
  );

  async function chat({ message, context = "", conversationId = null }) {
    if (!apiKey) throw new Error("Copilot system AI is not configured.");
    const prompt = buildCopilotPrompt({ message, context });
    const response = await fetchWithTimeout(
      fetchImpl,
      COPILOT_RAPIDAPI_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": COPILOT_RAPIDAPI_HOST
        },
        body: JSON.stringify({
          message: prompt,
          conversation_id: conversationId ?? null,
          mode: "CHAT",
          markdown: true
        })
      },
      COPILOT_TIMEOUT_MS
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getCopilotError(payload) || `Copilot system AI returned HTTP ${response.status}.`);
    const reply = extractCopilotReply(payload);
    if (!reply) throw new Error("Copilot system AI returned an empty reply.");
    return {
      reply,
      conversationId: extractConversationId(payload) ?? conversationId ?? null,
      provider: "copilot5"
    };
  }

  function isConfigured() {
    return Boolean(apiKey);
  }

  return { chat, isConfigured };
}

function buildCopilotPrompt({ message, context }) {
  return [
    "You are Sentinel, the system AI inside Northwatch.",
    "Use the operator's real Northwatch context. Be direct, practical, and tactical.",
    "Give specific next actions, tradeoffs, and sequence. Do not claim you changed app data unless Northwatch reports that action.",
    "Keep replies under 8 short lines unless the operator asks for depth.",
    "",
    context ? `Northwatch context:\n${context}` : "Northwatch context: unavailable.",
    "",
    `Operator prompt: ${String(message ?? "").trim()}`
  ].join("\n");
}

function extractCopilotReply(payload) {
  const candidates = [
    payload?.message,
    payload?.response,
    payload?.answer,
    payload?.text,
    payload?.content,
    payload?.data?.message,
    payload?.data?.response,
    payload?.data?.answer,
    payload?.data?.text,
    payload?.result?.message,
    payload?.result?.response,
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.text
  ];
  return candidates.map((item) => (typeof item === "string" ? item.trim() : "")).find(Boolean) ?? "";
}

function extractConversationId(payload) {
  const value = payload?.conversation_id ?? payload?.conversationId ?? payload?.data?.conversation_id ?? payload?.data?.conversationId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCopilotError(payload) {
  const value = payload?.error ?? payload?.message ?? payload?.detail;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new Error(`Copilot system AI request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}
