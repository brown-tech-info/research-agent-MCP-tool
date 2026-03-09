export interface MCPTool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

export interface WebFetchInputs {
  url: string;
}

export interface WebSource {
  url: string;
  content: string;
  retrievedAt: string;
  contentType: string;
  /** Always true — web sources must never be misrepresented as peer-reviewed (spec §9.3) */
  isWebSource: true;
}

export interface WebFetchResult {
  source: WebSource;
}

export interface WebSearchInputs {
  query: string;
  maxResults?: number;
}

export interface WebSearchResult {
  query: string;
  results: WebSource[];
  /** Mandatory disclaimer per spec §9.3 */
  warning: string;
}
