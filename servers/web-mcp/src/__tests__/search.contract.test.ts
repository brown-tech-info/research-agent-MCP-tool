import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSearchTool } from "../search-tool.js";

const makeTavilyResponse = (results: object[], status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ results }),
  } as unknown as Response);

const fakePage = (n: number) => ({
  url: `https://example.com/page${n}`,
  title: `Result ${n}`,
  content: `Snippet for result ${n}`,
  score: 0.9,
});

const TEST_API_KEY = "test-tavily-api-key-12345";

describe("WebSearchTool contract (spec §9.3b)", () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool(TEST_API_KEY);
    vi.resetAllMocks();
  });

  it("returns results with correct provenance fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1), fakePage(2)])));

    const result = await tool.execute({ query: "FDA guidance GLP-1 agonists" });

    expect(result.query).toBe("FDA guidance GLP-1 agonists");
    expect(result.totalFound).toBe(2);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first.url).toBe("https://example.com/page1");
    expect(first.title).toBe("Result 1");
    expect(first.snippet).toBe("Snippet for result 1");
    expect(first.isWebSource).toBe(true);
  });

  it("uses POST with Authorization Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "FDA guidance" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.method).toBe("POST");
    expect(headers["Authorization"]).toBe(`Bearer ${TEST_API_KEY}`);
    expect(headers["Ocp-Apim-Subscription-Key"]).toBeUndefined();
  });

  it("sends query and max_results in JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "semaglutide FDA", maxResults: 7 });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.query).toBe("semaglutide FDA");
    expect(body.max_results).toBe(7);
    expect(body.search_depth).toBe("basic");
  });

  it("isWebSource is always true — never peer-reviewed (spec §9.3b)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1)])));

    const result = await tool.execute({ query: "semaglutide EMA approval" });

    expect(result.results.every((r) => r.isWebSource === true)).toBe(true);
    expect(result.results.every((r) => !("isPeerReviewed" in r))).toBe(true);
  });

  it("returns empty result set when Tavily returns no results (not an error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      } as unknown as Response)
    );

    const result = await tool.execute({ query: "extremely obscure nonexistent topic xyz" });

    expect(result.totalFound).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("returns empty result set when results key is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response)
    );

    const result = await tool.execute({ query: "something with no results" });

    expect(result.totalFound).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("throws on missing query", async () => {
    await expect(tool.execute({})).rejects.toThrow("query is required");
  });

  it("throws on empty query string", async () => {
    await expect(tool.execute({ query: "   " })).rejects.toThrow("query is required");
  });

  it("throws when TAVILY_API_KEY is not set", async () => {
    const savedKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    expect(() => new WebSearchTool()).toThrow("TAVILY_API_KEY environment variable is required");
    process.env.TAVILY_API_KEY = savedKey;
  });

  it("throws on Tavily API HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)
    );

    await expect(tool.execute({ query: "test query" })).rejects.toThrow(
      "Tavily API returned HTTP 401"
    );
  });

  it("caps maxResults at 10", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "test", maxResults: 99 });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.max_results).toBe(10);
  });

  it("defaults to 5 results when maxResults is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeTavilyResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "FDA approval news" });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.max_results).toBe(5);
  });
});
