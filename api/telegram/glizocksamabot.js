function formatTelegramMessage(payload) {
  const title = typeof payload.title === "string" ? payload.title : "Northwatch update";
  const kind = typeof payload.kind === "string" ? payload.kind : "agent-alert";
  const body = typeof payload.body === "string" ? payload.body : "";
  const meta = typeof payload.meta === "string" && payload.meta.trim() ? `\nMeta: ${payload.meta.trim()}` : "";
  return `[Northwatch ${kind}]\n${title}\n${body}${meta}`;
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    response.status(200).json({
      ok: true,
      bridge: "@glizocksamabot",
      configured: Boolean(process.env.TELEGRAM_WEBHOOK_URL || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID))
    });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const payload = typeof request.body === "object" && request.body ? request.body : {};
  const text = formatTelegramMessage(payload);

  try {
    if (process.env.TELEGRAM_WEBHOOK_URL) {
      const upstream = await fetch(process.env.TELEGRAM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, text, bot: "@glizocksamabot" })
      });

      if (!upstream.ok) {
        throw new Error(`Telegram webhook returned ${upstream.status}`);
      }

      response.status(200).json({ ok: true, bridge: "webhook" });
      return;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const upstream = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text
        })
      });

      if (!upstream.ok) {
        throw new Error(`Telegram API returned ${upstream.status}`);
      }

      response.status(200).json({ ok: true, bridge: "telegram-api" });
      return;
    }

    response.status(503).json({
      ok: false,
      error: "Set TELEGRAM_WEBHOOK_URL or TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for @glizocksamabot."
    });
  } catch (error) {
    response.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Telegram bridge failed" });
  }
}
