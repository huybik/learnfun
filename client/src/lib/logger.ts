/**
 * Browser-only structured logger.
 * Logs to console as structured objects (captured by log-forwarder).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export function createLogger(module: string) {
  function emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry = {
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
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
