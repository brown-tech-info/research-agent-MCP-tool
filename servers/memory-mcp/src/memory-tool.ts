import { randomUUID } from "crypto";
import type {
  MCPTool,
  MemoryEntry,
  SaveMemoryResult,
  RetrieveMemoryResult,
  DeleteMemoryResult,
} from "./types.js";

export class MemorySaveTool implements MCPTool {
  readonly name = "memory-save";

  constructor(private readonly store: Map<string, MemoryEntry>) {}

  async execute(inputs: Record<string, unknown>): Promise<SaveMemoryResult> {
    const { title, content, citations } = inputs;

    if (typeof title !== "string" || title.trim() === "") {
      throw new Error("memory-save: 'title' must be a non-empty string");
    }
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("memory-save: 'content' must be a non-empty string");
    }

    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(),
      title: title.trim(),
      content,
      citations: Array.isArray(citations) ? citations : [],
      savedAt: now,
      updatedAt: now,
    };

    this.store.set(entry.id, entry);
    return { entry };
  }
}

export class MemoryRetrieveTool implements MCPTool {
  readonly name = "memory-retrieve";

  constructor(private readonly store: Map<string, MemoryEntry>) {}

  async execute(inputs: Record<string, unknown>): Promise<RetrieveMemoryResult> {
    const { id } = inputs;

    if (id !== undefined) {
      if (typeof id !== "string" || id.trim() === "") {
        throw new Error("memory-retrieve: 'id' must be a non-empty string when provided");
      }
      const entry = this.store.get(id.trim());
      const entries = entry ? [entry] : [];
      return { entries, count: entries.length };
    }

    const entries = Array.from(this.store.values());
    return { entries, count: entries.length };
  }
}

export class MemoryDeleteTool implements MCPTool {
  readonly name = "memory-delete";

  constructor(private readonly store: Map<string, MemoryEntry>) {}

  async execute(inputs: Record<string, unknown>): Promise<DeleteMemoryResult> {
    const { id } = inputs;

    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("memory-delete: 'id' must be a non-empty string");
    }

    const trimmedId = id.trim();
    const existed = this.store.has(trimmedId);
    this.store.delete(trimmedId);
    return { deleted: existed, id: trimmedId };
  }
}
