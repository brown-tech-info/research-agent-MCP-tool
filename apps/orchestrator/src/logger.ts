/**
 * Structured Logger — Spec Section 12.4
 *
 * Emits JSON-structured log lines to stdout.
 * All logs are machine-parseable and include level, event, timestamp.
 *
 * Spec constraints:
 * - Only data necessary for audit and debugging is logged (12.4)
 * - No personal health data (12.4)
 * - Silent or undisclosed logging is prohibited — this logger is declared
 *   in the API server startup message (12.4)
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info(event: string, fields: Record<string, unknown> = {}): void {
    emit({ level: "info", event, timestamp: new Date().toISOString(), ...fields });
  },

  warn(event: string, fields: Record<string, unknown> = {}): void {
    emit({ level: "warn", event, timestamp: new Date().toISOString(), ...fields });
  },

  error(event: string, fields: Record<string, unknown> = {}): void {
    emit({ level: "error", event, timestamp: new Date().toISOString(), ...fields });
  },
};
