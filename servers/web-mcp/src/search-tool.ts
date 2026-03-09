import type { MCPTool, WebSearchInputs, WebSearchResult, WebSearchResultItem } from "./types.js";

const DEFAULT_MAX_RESULTS = 5;
const MAX_ALLOWED_RESULTS = 10;
const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";

interface TavilyResult {
  url: string;
  title: string;
  content?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
}

export class WebSearchTool implements MCPTool {
  readonly name = "web-search";
  private apiKey: string;

  /**
   * @param apiKey Optional API key override — useful for tests.
   *   Defaults to TAVILY_API_KEY environment variable.
   *   Get a free key (1,000 searches/month) at https://app.tavily.com/
   */
  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.TAVILY_API_KEY;
    if (!key) {
      throw new Error(
        "WebSearchTool: TAVILY_API_KEY environment variable is required. " +
        "Get a free key at https://app.tavily.com/ and set it in your .env file."
      );
    }
    this.apiKey = key;
  }

  async execute(inputs: Record<string, unknown>): Promise<WebSearchResult> {
    const { query, maxResults } = inputs as Partial<WebSearchInputs>;

    if (!query || typeof query !== "string" || query.trim() === "") {
      throw new Error("Web search failed: query is required and must be a non-empty string");
    }

    const count = Math.min(
      typeof maxResults === "number" && maxResults > 0 ? maxResults : DEFAULT_MAX_RESULTS,
      MAX_ALLOWED_RESULTS
    );

    let response: Response;
    try {
      response = await fetch(TAVILY_SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
          max_results: count,
          search_depth: "basic",
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Web search failed: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Web search failed: Tavily API returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as TavilySearchResponse;
    const items = body.results ?? [];

    const results: WebSearchResultItem[] = items.map((item) => ({
      url: item.url,
      title: item.title,
      snippet: item.content ?? "",
      isWebSource: true as const,
    }));

    return {
      query: query.trim(),
      totalFound: results.length,
      results,
    };
  }
}
