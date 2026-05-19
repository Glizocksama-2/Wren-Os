import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TELEGRAM_CONFIG_TITLE = "telegram_bot";
const TELEGRAM_BOT_TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{10,}$/;

export function createTelegramRouter({ express, db, fetchImpl = globalThis.fetch, secretKey = process.env.TELEGRAM_SECRET_KEY }) {
  if (!db) throw new Error("Telegram router requires a database adapter.");

  const router = express.Router();

  router.get("/config", async (request, response) => {
    try {
      const config = await db.getTelegramConfig(request.userId);
      response.json(toPublicTelegramConfig(config));
    } catch (error) {
      respondWithError(response, error);
    }
  });

  router.post("/config", async (request, response) => {
    try {
      const input = validateTelegramConfigInput(request.body);
      const botProfile = await verifyTelegramBot(input.botToken, fetchImpl);
      const encryptedToken = encryptSecret(input.botToken, secretKey);
      const updatedAt = new Date().toISOString();
      const config = await db.upsertTelegramConfig(request.userId, {
        provider: "telegram",
        title: TELEGRAM_CONFIG_TITLE,
        botToken: encryptedToken,
        botUsername: botProfile.username ?? null,
        chatId: input.chatId,
        updatedAt
      });

      response.json(toPublicTelegramConfig(config));
    } catch (error) {
      respondWithError(response, error);
    }
  });

  router.delete("/config", async (request, response) => {
    try {
      await db.deleteTelegramConfig(request.userId);
      response.status(204).end();
    } catch (error) {
      respondWithError(response, error);
    }
  });

  router.post("/send", async (request, response) => {
    try {
      const config = await db.getTelegramConfig(request.userId);
      if (!config?.payload?.botToken || !config.payload.chatId) {
        throw httpError(409, "Connect your Telegram bot in Settings before sending.");
      }

      const botToken = decryptSecret(config.payload.botToken, secretKey);
      const text = formatTelegramMessage(request.body);
      await sendTelegramMessage({
        botToken,
        chatId: config.payload.chatId,
        text,
        fetchImpl
      });

      response.json({ ok: true });
    } catch (error) {
      respondWithError(response, error);
    }
  });

  return router;
}

export { TELEGRAM_CONFIG_TITLE };

function validateTelegramConfigInput(body) {
  const botToken = getString(body?.botToken).trim();
  const chatId = getString(body?.chatId).trim();

  if (!TELEGRAM_BOT_TOKEN_PATTERN.test(botToken)) {
    throw httpError(400, "Enter a valid Telegram bot token from BotFather.");
  }

  if (!/^-?\d{5,20}$|^@[A-Za-z0-9_]{5,32}$/.test(chatId)) {
    throw httpError(400, "Enter a numeric Telegram chat id or a channel username.");
  }

  return { botToken, chatId };
}

async function verifyTelegramBot(botToken, fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw httpError(500, "Server fetch is unavailable.");
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/getMe`);
  const parsed = await safeJson(response);
  if (!response.ok || parsed?.ok !== true) {
    throw httpError(400, parsed?.description ?? "Telegram rejected this bot token.");
  }

  return parsed.result ?? {};
}

async function sendTelegramMessage({ botToken, chatId, text, fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    throw httpError(500, "Server fetch is unavailable.");
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
  const parsed = await safeJson(response);
  if (!response.ok || parsed?.ok === false) {
    throw httpError(502, parsed?.description ?? `Telegram API returned ${response.status}.`);
  }
}

function encryptSecret(value, secretKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(secretKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    algorithm: "aes-256-gcm",
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

function decryptSecret(payload, secretKey) {
  if (!payload?.encrypted || !payload?.iv || !payload?.tag) {
    throw httpError(500, "Telegram bot token is missing or invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(secretKey), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.encrypted, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

function getEncryptionKey(secretKey) {
  const source = getString(secretKey).trim();
  if (source.length < 32) {
    throw httpError(500, "TELEGRAM_SECRET_KEY must be set to at least 32 characters.");
  }

  return createHash("sha256").update(source).digest();
}

function formatTelegramMessage(payload) {
  const title = getString(payload?.title).trim().slice(0, 180) || "Northwatch alert";
  const body = getString(payload?.body).trim().slice(0, 2600);
  const meta = getString(payload?.meta).trim().slice(0, 600);
  const kind = getString(payload?.kind).trim().slice(0, 60) || "alert";
  return [`Northwatch ${kind}`, title, body, meta].filter(Boolean).join("\n\n");
}

function toPublicTelegramConfig(config) {
  if (!config?.payload) {
    return { configured: false };
  }

  return {
    configured: true,
    botUsername: config.payload.botUsername ?? null,
    chatId: maskChatId(config.payload.chatId),
    updatedAt: config.payload.updatedAt ?? toIsoString(config.updated_at) ?? toIsoString(config.updatedAt) ?? null
  };
}

function maskChatId(chatId) {
  const value = getString(chatId);
  if (!value) return null;
  if (value.startsWith("@")) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  if (value.length <= 3) return "***";
  return `${"*".repeat(value.length - 3)}${value.slice(-3)}`;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function respondWithError(response, error) {
  response.status(error.status ?? 500).json({ error: error.message ?? "Telegram request failed." });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getString(value) {
  return typeof value === "string" ? value : "";
}

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
