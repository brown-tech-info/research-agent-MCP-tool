import { MCPTool } from "./mcp-types";

/**
 * Stub MCP tool for testing the client adapter.
 * Returns static data to verify the adapter captures metadata correctly.
 * 
 * This is NOT a real implementation - it's for testing T2.2 completion.
 */
export class StubPubMedTool implements MCPTool {
  name = "pubmed-stub";

  async execute(inputs: Record<string, unknown>): Promise<unknown> {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      results: [
        {
          pmid: "12345678",
          title: "Stub publication for testing",
          authors: ["Stub A", "Test B"],
          journal: "Journal of Stub Studies",
          year: 2024,
          abstract: "This is a stub result for testing the MCP client adapter.",
        },
      ],
      query: inputs.query || "unknown",
    };
  }
}

/**
 * Stub MCP tool that simulates failure.
 * Used to test error handling and metadata capture.
 */
export class StubFailingTool implements MCPTool {
  name = "failing-stub";

  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    throw new Error("Simulated tool failure for testing");
  }
}
