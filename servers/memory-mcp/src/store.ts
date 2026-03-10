import { randomUUID } from "crypto";
import type { MemoryEntry } from "./types.js";

export interface IMemoryStore {
  save(entry: Omit<MemoryEntry, "id" | "savedAt" | "updatedAt">): Promise<MemoryEntry>;
  getById(id: string): Promise<MemoryEntry | undefined>;
  list(): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
}

/** In-memory store used for local development and tests (no Azure required). */
export class InMemoryStore implements IMemoryStore {
  private readonly map = new Map<string, MemoryEntry>();

  async save(entry: Omit<MemoryEntry, "id" | "savedAt" | "updatedAt">): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const saved: MemoryEntry = { ...entry, id: randomUUID(), savedAt: now, updatedAt: now };
    this.map.set(saved.id, saved);
    return saved;
  }

  async getById(id: string): Promise<MemoryEntry | undefined> {
    return this.map.get(id);
  }

  async list(): Promise<MemoryEntry[]> {
    return Array.from(this.map.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.map.delete(id);
  }
}
