/**
 * Structured logger with optional batched forwarding to /api/logs.
 *
 * Usage:
 *   import { createLogger, enableForwarding } from "@/lib/logger";
 *
 *   enableForwarding();                    // call once at app startup
 *   const log = createLogger("MyModule");
 *   log.info("hello", { count: 42 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  module: string;
  msg: string;
  [key: string]: unknown;
}

// ---------- forwarding internals ----------

let forwardingEnabled = false;
let buffer: LogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL = 1_000; // ms
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

function forward(entry: LogEntry) {
  if (!forwardingEnabled) return;

  buffer.push(entry);

  if (buffer.length >= MAX_BUFFER) flush();
  else scheduleFlush();
}

// ---------- public API ----------

/**
 * Enable batched log forwarding to `/api/logs`.
 * Call once at app startup. Safe to call in SSR (no-ops if `window` is absent).
 */
export function enableForwarding() {
  if (forwardingEnabled || typeof window === "undefined") return;
  forwardingEnabled = true;
  window.addEventListener("beforeunload", flush);
}

/**
 * Create a structured logger scoped to a module name.
 * Logs are emitted to the console and, if forwarding is enabled,
 * batched and sent to `/api/logs`.
 */
export function createLogger(module: string) {
  function emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      module,
      msg: message,
      ...data,
    };

    switch (level) {
      case "debug":
        console.debug(entry);
        break;
      case "info":
        console.info(entry);
        break;
      case "warn":
        console.warn(entry);
        break;
      case "error":
        console.error(entry);
        break;
    }

    forward(entry);
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
