import { AuditRecord, AuditStorage } from "./audit-types";

/**
 * In-memory audit storage implementation.
 * For production, replace with persistent storage (file system, database, etc.)
 */
export class InMemoryAuditStorage implements AuditStorage {
  private records: Map<string, AuditRecord> = new Map();

  async save(record: AuditRecord): Promise<void> {
    this.records.set(record.interactionId, record);
  }

  async retrieve(interactionId: string): Promise<AuditRecord | null> {
    return this.records.get(interactionId) || null;
  }

  async listIds(): Promise<string[]> {
    return Array.from(this.records.keys());
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Get number of stored records
   */
  size(): number {
    return this.records.size;
  }
}
