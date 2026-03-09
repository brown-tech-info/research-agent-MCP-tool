import { MCPClient } from "./mcp-client";
import { StubPubMedTool, StubFailingTool } from "./stub-tools";

/**
 * Demonstration of MCP client adapter functionality.
 * Shows metadata capture for successful and failed tool invocations.
 */
async function demonstrateMCPClient() {
  const client = new MCPClient();

  // Register stub tools
  client.registerTool(new StubPubMedTool());
  client.registerTool(new StubFailingTool());

  console.log("Registered tools:", client.getRegisteredTools());
  console.log();

  // Test 1: Successful tool invocation
  console.log("=== Test 1: Successful tool invocation ===");
  const result1 = await client.invokeTool("pubmed-stub", {
    query: "cancer immunotherapy",
  });

  console.log("Success:", result1.success);
  console.log("Data:", JSON.stringify(result1.data, null, 2));
  console.log("Metadata:", JSON.stringify(result1.metadata, null, 2));
  console.log();

  // Test 2: Tool failure
  console.log("=== Test 2: Tool failure ===");
  const result2 = await client.invokeTool("failing-stub", {
    query: "test",
  });

  console.log("Success:", result2.success);
  console.log("Error:", result2.error);
  console.log("Metadata:", JSON.stringify(result2.metadata, null, 2));
  console.log();

  // Test 3: Tool not found
  console.log("=== Test 3: Tool not found ===");
  const result3 = await client.invokeTool("nonexistent-tool", {
    query: "test",
  });

  console.log("Success:", result3.success);
  console.log("Error:", result3.error);
  console.log("Metadata:", JSON.stringify(result3.metadata, null, 2));
}

// Run demonstration if executed directly
if (require.main === module) {
  demonstrateMCPClient().catch(console.error);
}

export { demonstrateMCPClient };
