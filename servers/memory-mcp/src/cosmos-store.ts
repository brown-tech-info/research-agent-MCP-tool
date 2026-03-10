import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "crypto";
import type { MemoryEntry } from "./types.js";
import type { IMemoryStore } from "./store.js";

const DATABASE_ID = process.env.COSMOS_DATABASE ?? "research-agent";
const CONTAINER_ID = "memory-entries";

/**
 * Cosmos DB-backed memory store.
 * Uses DefaultAzureCredential — no connection string or key needed.
 * Locally: run `az login` once. In Azure: Container App managed identity is used automatically.
 */
export class CosmosMemoryStore implements IMemoryStore {
  private readonly client: CosmosClient;

  constructor(endpoint: string) {
    this.client = new CosmosClient({
      endpoint,
      aadCredentials: new DefaultAzureCredential(),
    });
  }

  private get container() {
    return this.client
      .database(DATABASE_ID)
      .container(CONTAINER_ID);
  }

  /** Ensures the database and container exist (idempotent — safe to call on every startup). */
  async init(): Promise<void> {
    const { database } = await this.client.databases.createIfNotExists({ id: DATABASE_ID });
    await database.containers.createIfNotExists({
      id: CONTAINER_ID,
      partitionKey: { paths: ["/id"] },
    });
  }

  async save(entry: Omit<MemoryEntry, "id" | "savedAt" | "updatedAt">): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const doc: MemoryEntry = { ...entry, id: randomUUID(), savedAt: now, updatedAt: now };
    await this.container.items.create(doc);
    return doc;
  }

  async getById(id: string): Promise<MemoryEntry | undefined> {
    try {
      const { resource } = await this.container.item(id, id).read<MemoryEntry>();
      return resource ?? undefined;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<MemoryEntry[]> {
    const { resources } = await this.container.items
      .query<MemoryEntry>("SELECT * FROM c ORDER BY c.savedAt DESC")
      .fetchAll();
    return resources;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.container.item(id, id).delete();
      return true;
    } catch {
      return false;
    }
  }
}
