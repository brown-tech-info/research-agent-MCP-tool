import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSearchTool } from "../search-tool.js";
import type { TokenCredential } from "@azure/identity";

const makeBingResponse = (pages: object[], status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      webPages: {
        totalEstimatedMatches: pages.length,
        value: pages,
      },
    }),
  } as unknown as Response);

const fakePage = (n: number) => ({
  url: `https://example.com/page${n}`,
  name: `Result ${n}`,
  snippet: `Snippet for result ${n}`,
  datePublished: "2025-01-15T00:00:00Z",
});

/** Stub TokenCredential that returns a fake token — avoids real Azure auth in tests */
const stubCredential: TokenCredential = {
  getToken: vi.fn().mockResolvedValue({ token: "fake-test-token", expiresOnTimestamp: Date.now() + 3600000 }),
};

/** Stub TokenCredential that simulates a credential failure */
const failingCredential: TokenCredential = {
  getToken: vi.fn().mockRejectedValue(new Error("Azure CLI not logged in")),
};

describe("WebSearchTool contract (spec §9.3b)", () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool(stubCredential);
    vi.resetAllMocks();
    // Re-apply the stub after reset
    (stubCredential.getToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: "fake-test-token",
      expiresOnTimestamp: Date.now() + 3600000,
    });
  });

  it("returns results with correct provenance fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeBingResponse([fakePage(1), fakePage(2)])));

    const result = await tool.execute({ query: "FDA guidance GLP-1 agonists" });

    expect(result.query).toBe("FDA guidance GLP-1 agonists");
    expect(result.totalFound).toBe(2);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first.url).toBe("https://example.com/page1");
    expect(first.title).toBe("Result 1");
    expect(first.snippet).toBe("Snippet for result 1");
    expect(first.publishedDate).toBe("2025-01-15T00:00:00Z");
    expect(first.isWebSource).toBe(true);
  });

  it("uses Authorization Bearer header (not API key header)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeBingResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "FDA guidance" });

    const headers = (fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers["Authorization"]).toBe("Bearer fake-test-token");
    expect(headers["Ocp-Apim-Subscription-Key"]).toBeUndefined();
  });

  it("isWebSource is always true — never peer-reviewed (spec §9.3b)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeBingResponse([fakePage(1)])));

    const result = await tool.execute({ query: "semaglutide EMA approval" });

    expect(result.results.every((r) => r.isWebSource === true)).toBe(true);
    expect(result.results.every((r) => !("isPeerReviewed" in r))).toBe(true);
  });

  it("returns empty result set when Bing returns no hits (not an error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ webPages: { totalEstimatedMatches: 0, value: [] } }),
      } as unknown as Response)
    );

    const result = await tool.execute({ query: "extremely obscure nonexistent topic xyz" });

    expect(result.totalFound).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("returns empty result set when webPages key is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response)
    );

    const result = await tool.execute({ query: "something with no web pages" });

    expect(result.totalFound).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("throws on missing query", async () => {
    await expect(tool.execute({})).rejects.toThrow("query is required");
  });

  it("throws on empty query string", async () => {
    await expect(tool.execute({ query: "   " })).rejects.toThrow("query is required");
  });

  it("throws with clear message when Azure credential cannot acquire token", async () => {
    const failingTool = new WebSearchTool(failingCredential);
    await expect(failingTool.execute({ query: "FDA guidelines" })).rejects.toThrow(
      "could not acquire Azure credential for Bing"
    );
  });

  it("throws on Bing API HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)
    );

    await expect(tool.execute({ query: "test query" })).rejects.toThrow(
      "Bing API returned HTTP 401"
    );
  });

  it("caps maxResults at 10", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeBingResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "test", maxResults: 99 });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(calledUrl.searchParams.get("count")).toBe("10");
  });

  it("defaults to 5 results when maxResults is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeBingResponse([fakePage(1)]));
    vi.stubGlobal("fetch", fetchMock);

    await tool.execute({ query: "FDA approval news" });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(calledUrl.searchParams.get("count")).toBe("5");
  });
});
