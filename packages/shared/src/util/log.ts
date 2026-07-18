export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

function defaultLevel(): LogLevel {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.VITEST) return "warn"; // keep test output readable
    const env = process.env.LOG_LEVEL as LogLevel | undefined;
    if (env && env in ORDER) return env;
  }
  return "info";
}

let current: LogLevel = defaultLevel();

export function setLogLevel(level: LogLevel): void {
  current = level;
}

export function getLogLevel(): LogLevel {
  return current;
}

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Namespaced leveled logger, safe in node and the browser.
 * Server: LOG_LEVEL=debug npm run dev:server
 * Browser: localStorage.setItem("bgs:log", "debug") or ?log=debug (see bootstrap).
 */
export function createLogger(ns: string): Logger {
  const emit = (level: LogLevel, sink: (...args: unknown[]) => void, args: unknown[]): void => {
    if (ORDER[level] < ORDER[current]) return;
    sink(`${new Date().toISOString().slice(11, 23)} ${level.toUpperCase().padEnd(5)} [${ns}]`, ...args);
  };
  return {
    debug: (...args) => emit("debug", console.debug, args),
    info: (...args) => emit("info", console.log, args),
    warn: (...args) => emit("warn", console.warn, args),
    error: (...args) => emit("error", console.error, args)
  };
}
