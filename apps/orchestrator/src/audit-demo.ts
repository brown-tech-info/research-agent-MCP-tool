import { AuditRecorder } from "./audit-recorder";
import { InMemoryAuditStorage } from "./audit-storage";
import { MCPClient } from "./mcp-client";
import { StubPubMedTool } from "./stub-tools";

/**
 * Demonstration of audit trail functionality.
 * Shows how a complete interaction is captured and can be reconstructed.
 */
async function demonstrateAuditTrail() {
  const storage = new InMemoryAuditStorage();
  const recorder = new AuditRecorder(storage);
  const mcpClient = new MCPClient();

  // Register stub tool
  mcpClient.registerTool(new StubPubMedTool());

  console.log("=== Starting Interaction ===");
  console.log();

  // Step 1: Start interaction
  const interactionId = recorder.startInteraction({
    question: "What are recent advances in cancer immunotherapy?",
    context: "Focus on checkpoint inhibitors",
  });

  console.log("Interaction ID:", interactionId);
  console.log();

  // Step 2: Invoke tools and record metadata
  console.log("=== Invoking Tools ===");
  const toolResult = await mcpClient.invokeTool("pubmed-stub", {
    query: "cancer immunotherapy checkpoint inhibitors",
  });

  recorder.recordToolCall(toolResult.metadata);
  console.log("Tool invoked:", toolResult.metadata.toolName);
  console.log("Success:", toolResult.success);
  console.log();

  // Step 3: Complete interaction with final response
  console.log("=== Completing Interaction ===");
  const finalResponse = {
    summary:
      "Limited evidence retrieved from stub tool. Real implementation would synthesize findings.",
    evidenceOverview: [
      {
        type: "pubmed" as const,
        description: "Stub publication for testing",
        identifier: "PMID:12345678",
      },
    ],
    synthesisAndInterpretation:
      "This demonstrates audit trail capture. Real synthesis would combine multiple sources.",
    confidenceAndGaps:
      "Confidence: Low - stub data only. Gaps: All real evidence missing.",
    references: [
      {
        id: "1",
        citation: "Stub et al. (2024). Stub publication for testing. Journal of Stub Studies.",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678",
      },
    ],
  };

  const auditRecord = await recorder.completeInteraction(finalResponse);
  console.log("Audit record saved");
  console.log("Duration:", auditRecord.durationMs, "ms");
  console.log();

  // Step 4: Retrieve and verify reconstruction
  console.log("=== Reconstructing Interaction ===");
  const retrieved = await recorder.retrieveInteraction(interactionId);

  if (retrieved) {
    console.log("✓ Interaction reconstructed successfully");
    console.log();
    console.log("User Input:", JSON.stringify(retrieved.userInput, null, 2));
    console.log();
    console.log("Tool Calls:", retrieved.toolCalls.length);
    retrieved.toolCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.toolName} (${call.success ? "success" : "failed"})`);
    });
    console.log();
    console.log("Final Response Summary:", retrieved.finalResponse.summary);
    console.log();
    console.log("Total Duration:", retrieved.durationMs, "ms");
  } else {
    console.log("✗ Failed to reconstruct interaction");
  }

  console.log();
  console.log("=== Audit Trail Complete ===");
  console.log("All interactions are now auditable and reconstructible (Spec 12.1)");
}

// Run demonstration if executed directly
if (require.main === module) {
  demonstrateAuditTrail().catch(console.error);
}

export { demonstrateAuditTrail };
