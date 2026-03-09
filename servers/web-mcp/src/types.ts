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
  /** Always true — web sources must never be misrepresented as peer-reviewed (spec §9.3a) */
  isWebSource: true;
}

export interface WebFetchResult {
  source: WebSource;
}

export interface WebSearchInputs {
  query: string;
  maxResults?: number;
}

/** A single result from the Bing Search API (spec §9.3b) */
export interface WebSearchResultItem {
  url: string;
  title: string;
  snippet: string;
  publishedDate?: string;
  /** Always true — never peer-reviewed (spec §9.3b) */
  isWebSource: true;
}

export interface WebSearchResult {
  query: string;
  totalFound: number;
  results: WebSearchResultItem[];
}
