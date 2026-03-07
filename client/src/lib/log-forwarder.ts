/**
 * Patches window.console to forward all logs to /api/logs for file storage.
 * Call `initLogForwarder()` once at app startup.
 */

type LogEntry = { level: string; args: unknown[]; ts: string };

let initialized = false;
let buffer: LogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL = 1000; // ms
const MAX_BUFFER = 50;

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  // Fire-and-forget — don't block or recurse on failure
  fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => {});
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_INTERVAL);
}

function capture(level: string, args: unknown[]) {
  // Serialize safely — drop non-cloneable values
  const safe = args.map((a) => {
    if (a instanceof Error) return { name: a.name, message: a.message, stack: a.stack };
    try {
      JSON.stringify(a);
      return a;
    } catch {
      return String(a);
    }
  });

  buffer.push({ level, args: safe, ts: new Date().toISOString() });

  if (buffer.length >= MAX_BUFFER) flush();
  else scheduleFlush();
}

export function initLogForwarder() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const original = {
    log: console.log.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  for (const level of ["log", "debug", "info", "warn", "error"] as const) {
    console[level] = (...args: unknown[]) => {
      original[level](...args); // keep original behavior
      capture(level, args);
    };
  }

  // Flush remaining logs on page unload
  window.addEventListener("beforeunload", flush);
}
