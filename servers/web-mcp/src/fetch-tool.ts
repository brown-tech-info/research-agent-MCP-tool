import type { MCPTool, WebFetchInputs, WebFetchResult } from "./types.js";

const MAX_CONTENT_CHARS = 5000;

export class WebFetchTool implements MCPTool {
  readonly name = "web-fetch";

  async execute(inputs: Record<string, unknown>): Promise<WebFetchResult> {
    const { url } = inputs as Partial<WebFetchInputs>;

    if (!url || typeof url !== "string" || url.trim() === "") {
      throw new Error("Web fetch failed: url is required and must be a non-empty string");
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith("https://") && !trimmedUrl.startsWith("http://")) {
      throw new Error(`Web fetch failed: url must start with http:// or https:// — got "${trimmedUrl}"`);
    }

    const retrievedAt = new Date().toISOString();

    let response: Response;
    try {
      response = await fetch(trimmedUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Web fetch failed: ${message} for ${trimmedUrl}`);
    }

    if (!response.ok) {
      throw new Error(`Web fetch failed: HTTP ${response.status} for ${trimmedUrl}`);
    }

    const rawText = await response.text();
    const content = rawText.slice(0, MAX_CONTENT_CHARS).trim();
    const contentType = response.headers.get("content-type") ?? "unknown";

    return {
      source: {
        url: trimmedUrl,
        content,
        retrievedAt,
        contentType,
        isWebSource: true,
      },
    };
  }
}
