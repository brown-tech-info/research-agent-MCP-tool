import type {
  MCPTool,
  SaveMemoryResult,
  RetrieveMemoryResult,
  DeleteMemoryResult,
} from "./types.js";
import type { IMemoryStore } from "./store.js";

export class MemorySaveTool implements MCPTool {
  readonly name = "memory-save";

  constructor(private readonly store: IMemoryStore) {}

  async execute(inputs: Record<string, unknown>): Promise<SaveMemoryResult> {
    const { title, content, citations } = inputs;

    if (typeof title !== "string" || title.trim() === "") {
      throw new Error("memory-save: 'title' must be a non-empty string");
    }
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("memory-save: 'content' must be a non-empty string");
    }

    const entry = await this.store.save({
      title: title.trim(),
      content,
      citations: Array.isArray(citations) ? citations : [],
    });

    return { entry };
  }
}

export class MemoryRetrieveTool implements MCPTool {
  readonly name = "memory-retrieve";

  constructor(private readonly store: IMemoryStore) {}

  async execute(inputs: Record<string, unknown>): Promise<RetrieveMemoryResult> {
    const { id } = inputs;

    if (id !== undefined) {
      if (typeof id !== "string" || id.trim() === "") {
        throw new Error("memory-retrieve: 'id' must be a non-empty string when provided");
      }
      const entry = await this.store.getById(id.trim());
      const entries = entry ? [entry] : [];
      return { entries, count: entries.length };
    }

    const entries = await this.store.list();
    return { entries, count: entries.length };
  }
}

export class MemoryDeleteTool implements MCPTool {
  readonly name = "memory-delete";

  constructor(private readonly store: IMemoryStore) {}

  async execute(inputs: Record<string, unknown>): Promise<DeleteMemoryResult> {
    const { id } = inputs;

    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("memory-delete: 'id' must be a non-empty string");
    }

    const trimmedId = id.trim();
    const deleted = await this.store.delete(trimmedId);
    return { deleted, id: trimmedId };
  }
}
