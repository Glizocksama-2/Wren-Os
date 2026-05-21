export default function handler(_request, response) {
  const checkedAt = new Date().toISOString();
  response.status(200).json({
    ok: true,
    checkedAt,
    agents: [
      {
        id: "sentinel",
        label: "Sentinel",
        status: "alive",
        checkedAt,
        detail: "Northwatch API health check is responding."
      },
      {
        id: "copilot",
        label: "Copilot",
        status: process.env.RAPIDAPI_COPILOT_KEY || process.env.COPILOT_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY ? "idle" : "dead",
        checkedAt,
        detail: process.env.RAPIDAPI_COPILOT_KEY || process.env.COPILOT_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY
          ? "Copilot system AI is configured."
          : "RAPIDAPI_COPILOT_KEY is not set."
      },
      {
        id: "ollama",
        label: "Ollama",
        status: "idle",
        checkedAt,
        detail: "Local Ollama is checked from the browser because it runs on the operator machine."
      },
      {
        id: "telegram",
        label: "Telegram",
        status: process.env.TELEGRAM_WEBHOOK_URL || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ? "alive" : "idle",
        checkedAt,
        detail: process.env.TELEGRAM_WEBHOOK_URL || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
          ? "@glizocksamabot bridge is configured."
          : "@glizocksamabot bridge needs TELEGRAM_WEBHOOK_URL or bot token env vars."
      }
    ]
  });
}
