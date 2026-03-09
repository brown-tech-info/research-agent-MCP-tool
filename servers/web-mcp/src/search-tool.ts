import { DefaultAzureCredential } from "@azure/identity";
import type { TokenCredential } from "@azure/identity";
import type { MCPTool, WebSearchInputs, WebSearchResult, WebSearchResultItem } from "./types.js";

const DEFAULT_MAX_RESULTS = 5;
const MAX_ALLOWED_RESULTS = 10;
const BING_SEARCH_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search";
/** AAD resource scope for Bing Search API */
const BING_TOKEN_SCOPE = "https://api.bing.microsoft.com/.default";

interface BingWebPage {
  url: string;
  name: string;
  snippet: string;
  datePublished?: string;
}

interface BingSearchResponse {
  webPages?: {
    totalEstimatedMatches?: number;
    value?: BingWebPage[];
  };
}

export class WebSearchTool implements MCPTool {
  readonly name = "web-search";
  private credential: TokenCredential;

  /**
   * @param credential Optional TokenCredential — defaults to DefaultAzureCredential.
   *   Pass a mock credential in tests to avoid real Azure token acquisition.
   */
  constructor(credential?: TokenCredential) {
    this.credential = credential ?? new DefaultAzureCredential();
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

    // Acquire bearer token via DefaultAzureCredential (az login locally, Managed Identity in Azure)
    let token: string;
    try {
      const tokenResult = await this.credential.getToken(BING_TOKEN_SCOPE);
      if (!tokenResult?.token) {
        throw new Error("Token acquisition returned null");
      }
      token = tokenResult.token;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Web search failed: could not acquire Azure credential for Bing — ${message}. Run 'az login' locally.`);
    }

    const searchUrl = new URL(BING_SEARCH_ENDPOINT);
    searchUrl.searchParams.set("q", query.trim());
    searchUrl.searchParams.set("count", String(count));
    searchUrl.searchParams.set("mkt", "en-US");
    searchUrl.searchParams.set("safeSearch", "Moderate");

    let response: Response;
    try {
      response = await fetch(searchUrl.toString(), {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Web search failed: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Web search failed: Bing API returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as BingSearchResponse;
    const pages = body.webPages?.value ?? [];

    const results: WebSearchResultItem[] = pages.map((page) => ({
      url: page.url,
      title: page.name,
      snippet: page.snippet,
      publishedDate: page.datePublished,
      isWebSource: true as const,
    }));

    return {
      query: query.trim(),
      totalFound: results.length,
      results,
    };
  }
}
