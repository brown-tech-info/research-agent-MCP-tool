export interface MCPTool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

export interface Citation {
  type: "pmid" | "nct" | "url";
  id: string;
  title?: string;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  citations: Citation[];
  savedAt: string;
  updatedAt: string;
}

export interface SaveMemoryInputs {
  title: string;
  content: string;
  citations?: Citation[];
}

export interface SaveMemoryResult {
  entry: MemoryEntry;
}

export interface RetrieveMemoryInputs {
  id?: string;
}

export interface RetrieveMemoryResult {
  entries: MemoryEntry[];
  count: number;
}

export interface DeleteMemoryInputs {
  id: string;
}

export interface DeleteMemoryResult {
  deleted: boolean;
  id: string;
}

export interface ListMemoryResult {
  entries: MemoryEntry[];
  count: number;
}
