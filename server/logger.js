const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

export function createLogger({ level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"), sink = console } = {}) {
  const normalizedLevel = String(level).toLowerCase();
  const threshold = LEVELS[normalizedLevel] ?? LEVELS.info;

  function write(levelName, entry) {
    if ((LEVELS[levelName] ?? LEVELS.info) < threshold) return;
    const payload = normalizeEntry(levelName, entry);
    const writer = sink[levelName] ?? sink.log ?? console.log;
    writer.call(sink, JSON.stringify(payload));
  }

  return {
    debug: (entry) => write("debug", entry),
    info: (entry) => write("info", entry),
    warn: (entry) => write("warn", entry),
    error: (entry) => write("error", entry)
  };
}

function normalizeEntry(level, entry) {
  const body = entry && typeof entry === "object" ? entry : { message: String(entry ?? "") };
  return {
    level,
    service: "northwatch-api",
    timestamp: new Date().toISOString(),
    ...body
  };
}
