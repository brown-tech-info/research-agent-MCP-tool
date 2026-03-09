export type {
  MCPTool,
  Citation,
  MemoryEntry,
  SaveMemoryInputs,
  SaveMemoryResult,
  RetrieveMemoryInputs,
  RetrieveMemoryResult,
  DeleteMemoryInputs,
  DeleteMemoryResult,
  ListMemoryResult,
} from "./types.js";

export { MemorySaveTool, MemoryRetrieveTool, MemoryDeleteTool } from "./memory-tool.js";

import { MemorySaveTool, MemoryRetrieveTool, MemoryDeleteTool } from "./memory-tool.js";
import type { MemoryEntry } from "./types.js";

export function createMemoryTools(): {
  saveTool: MemorySaveTool;
  retrieveTool: MemoryRetrieveTool;
  deleteTool: MemoryDeleteTool;
} {
  const store = new Map<string, MemoryEntry>();
  return {
    saveTool: new MemorySaveTool(store),
    retrieveTool: new MemoryRetrieveTool(store),
    deleteTool: new MemoryDeleteTool(store),
  };
}
