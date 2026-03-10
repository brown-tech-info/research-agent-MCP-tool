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
export type { IMemoryStore } from "./store.js";
export { InMemoryStore } from "./store.js";
export { CosmosMemoryStore } from "./cosmos-store.js";

import { MemorySaveTool, MemoryRetrieveTool, MemoryDeleteTool } from "./memory-tool.js";
import { InMemoryStore } from "./store.js";
import { CosmosMemoryStore } from "./cosmos-store.js";
import type { IMemoryStore } from "./store.js";

export async function createMemoryTools(): Promise<{
  saveTool: MemorySaveTool;
  retrieveTool: MemoryRetrieveTool;
  deleteTool: MemoryDeleteTool;
}> {
  let store: IMemoryStore;

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
  if (cosmosEndpoint) {
    const cosmosStore = new CosmosMemoryStore(cosmosEndpoint);
    await cosmosStore.init();
    store = cosmosStore;
    console.info("[memory-mcp] Using Cosmos DB store:", cosmosEndpoint);
  } else {
    store = new InMemoryStore();
    console.warn("[memory-mcp] COSMOS_ENDPOINT not set — using in-memory store (data will not persist across restarts)");
  }

  return {
    saveTool: new MemorySaveTool(store),
    retrieveTool: new MemoryRetrieveTool(store),
    deleteTool: new MemoryDeleteTool(store),
  };
}

