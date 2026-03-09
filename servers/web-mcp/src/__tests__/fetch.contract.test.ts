import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebFetchTool } from "../fetch-tool.js";

const makeMockResponse = (
  status: number,
  body: string,
  contentType = "text/html"
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === "content-type" ? contentType : null) },
    text: async () => body,
  } as unknown as Response);

describe("WebFetchTool contract", () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    vi.resetAllMocks();
  });

  it("returns content with correct provenance fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeMockResponse(200, "<h1>Hello</h1>", "text/html; charset=utf-8"))
    );

    const result = await tool.execute({ url: "https://example.com" });

    expect(result.source.url).toBe("https://example.com");
    expect(result.source.content).toBe("<h1>Hello</h1>");
    expect(result.source.contentType).toBe("text/html; charset=utf-8");
    expect(result.source.isWebSource).toBe(true);
    expect(typeof result.source.retrievedAt).toBe("string");
    expect(new Date(result.source.retrievedAt).toISOString()).toBe(result.source.retrievedAt);
  });

  it("throws on missing url", async () => {
    await expect(tool.execute({})).rejects.toThrow("url is required");
  });

  it("throws on empty url", async () => {
    await expect(tool.execute({ url: "   " })).rejects.toThrow("url is required");
  });

  it("throws on invalid URL (not http/https)", async () => {
    await expect(tool.execute({ url: "ftp://example.com" })).rejects.toThrow(
      'must start with http:// or https://'
    );
  });

  it("throws with clear message on HTTP 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeMockResponse(404, "Not Found"))
    );

    await expect(tool.execute({ url: "https://example.com/missing" })).rejects.toThrow(
      "Web fetch failed: HTTP 404 for https://example.com/missing"
    );
  });

  it("isWebSource is always true in response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeMockResponse(200, "content"))
    );

    const result = await tool.execute({ url: "https://example.com" });
    expect(result.source.isWebSource).toBe(true);
  });
});
