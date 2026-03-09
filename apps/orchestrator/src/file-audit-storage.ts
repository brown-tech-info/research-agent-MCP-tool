/**
 * File-based Audit Storage — Spec Section 12.1
 *
 * Persists audit records to a JSONL (newline-delimited JSON) file so that
 * every interaction survives server restarts and is fully replayable.
 *
 * Format: one JSON object per line, appended on save.
 * On startup the file is read and all records are indexed into memory
 * for fast retrieval.
 *
 * Per Spec 12.4: only data necessary for audit is stored.
 * Per Spec 12.6: outputs must be reproducible from the same stored inputs.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { AuditRecord, AuditStorage } from "./audit-types";

export class FileAuditStorage implements AuditStorage {
  /** In-memory index for fast retrieval — populated from file on startup */
  private index: Map<string, AuditRecord> = new Map();

  /**
   * @param filePath - Absolute or relative path to the JSONL audit file.
   *   Parent directories are created automatically.
   */
  constructor(private readonly filePath: string) {
    this.ensureDir();
    this.loadFromDisk();
  }

  async save(record: AuditRecord): Promise<void> {
    // Update in-memory index
    this.index.set(record.interactionId, record);

    // Append to JSONL file — atomic enough for audit purposes
    appendFileSync(this.filePath, JSON.stringify(record) + "\n", "utf8");
  }

  async retrieve(interactionId: string): Promise<AuditRecord | null> {
    return this.index.get(interactionId) ?? null;
  }

  async listIds(): Promise<string[]> {
    return Array.from(this.index.keys());
  }

  /** Total number of persisted records */
  size(): number {
    return this.index.size;
  }

  // ---------------------------------------------------------------------------

  private ensureDir(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Read all records from disk into the in-memory index.
   * Skips blank lines and malformed entries (logs a warning).
   */
  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) return;

    const lines = readFileSync(this.filePath, "utf8").split("\n");
    let loaded = 0;
    let skipped = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const record = JSON.parse(trimmed) as AuditRecord;
        if (record.interactionId) {
          this.index.set(record.interactionId, record);
          loaded++;
        }
      } catch {
        skipped++;
      }
    }

    if (loaded > 0 || skipped > 0) {
      process.stdout.write(
        JSON.stringify({
          level: "info",
          event: "audit_storage_loaded",
          loaded,
          skipped,
          file: this.filePath,
          timestamp: new Date().toISOString(),
        }) + "\n"
      );
    }
  }

  /**
   * Rewrite the entire JSONL file from the in-memory index.
   * Used to compact the file (e.g. after deletes if supported in future).
   */
  compact(): void {
    const lines = Array.from(this.index.values())
      .map((r) => JSON.stringify(r))
      .join("\n");
    writeFileSync(this.filePath, lines ? lines + "\n" : "", "utf8");
  }
}
