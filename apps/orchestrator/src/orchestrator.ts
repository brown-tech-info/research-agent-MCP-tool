import { ResearchRequest, ResearchResponse, ClarificationNeeded } from "./types";
import { MCPClient } from "./mcp-client";
import { AuditRecorder } from "./audit-recorder";
import { InMemoryAuditStorage } from "./audit-storage";
import { selectTools, ToolSelection } from "./tool-selector";
import { checkClarificationNeeded } from "./clarification";
import { synthesize } from "./synthesizer";
import { ToolInvocationResult } from "./mcp-types";
import { LLMClient } from "./llm-client";
import { parseQuery } from "./llm-query-parser";
import { synthesizeWithLLM } from "./llm-synthesizer";
import { logger } from "./logger";

/**
 * Core orchestrator for the Research Agent.
 *
 * When an LLMClient is provided, uses the fully conversational LLM path:
 *   natural language → LLM query parser → MCP tools → LLM synthesizer
 *
 * Falls back to the keyword-based path when no LLM is configured,
 * preserving all existing behaviour and tests.
 *
 * Spec Section 10, constitution.md rules enforced in both paths.
 */
export class Orchestrator {
  private readonly auditRecorder: AuditRecorder;

  constructor(
    private readonly mcpClient: MCPClient,
    auditRecorder?: AuditRecorder,
    private readonly llm?: LLMClient | null
  ) {
    this.auditRecorder =
      auditRecorder ?? new AuditRecorder(new InMemoryAuditStorage());
  }

  async processRequest(
    request: ResearchRequest
  ): Promise<ResearchResponse | ClarificationNeeded> {
    if (this.llm) {
      return this.processWithLLM(request);
    }
    return this.processWithKeywords(request);
  }

  // ---------------------------------------------------------------------------
  // LLM-powered path
  // ---------------------------------------------------------------------------

  private async processWithLLM(
    request: ResearchRequest
  ): Promise<ResearchResponse | ClarificationNeeded> {
    const parsed = await parseQuery(request.question, this.llm!, request.history);

    if (parsed.clarificationNeeded) {
      return {
        type: "clarification",
        reason: "Query requires clarification before evidence retrieval.",
        suggestion: parsed.clarificationQuestion ?? "Please provide more detail.",
      };
    }

    const selection: ToolSelection = {
      tools: parsed.toolsNeeded.map((name) => ({
        name,
        justification: parsed.toolReasoning,
      })),
      orderJustification: parsed.toolReasoning,
    };

    this.auditRecorder.startInteraction(request);

    try {
      const toolResults: Array<{ toolName: string; result: ToolInvocationResult }> = [];

      for (const toolName of parsed.toolsNeeded) {
        // Build tool-specific inputs from parsed query
        let inputs: Record<string, unknown>;

        if (toolName === "clinicaltrials-search") {
          // Truncate searchTerms to avoid CT API 400s from overly long queries
          const safeQuery = parsed.searchTerms.slice(0, 200);
          inputs = { query: safeQuery, maxResults: 10 };
        } else if (toolName === "web-fetch") {
          // web-fetch requires a specific URL — skip if we only have a query
          logger.info("tool_skipped", { toolName, reason: "web-fetch requires a URL, not a search query" });
          continue;
        } else {
          // pubmed-search and any future query-based tools
          inputs = { query: parsed.searchTerms, maxResults: 10 };
          if (parsed.dateFilter) inputs.dateFilter = parsed.dateFilter;
        }

        logger.info("tool_invocation", { toolName, query: inputs.query, dateFilter: parsed.dateFilter });
        const result = await this.mcpClient.invokeTool(toolName, inputs);
        this.auditRecorder.recordToolCall(result.metadata);

        if (!result.success) {
          // Non-fatal: log the failure and continue with other tools
          logger.warn("tool_failed_continuing", { toolName, error: result.error });
          continue;
        }

        toolResults.push({ toolName, result });
      }

      // If no tools returned data, surface that explicitly rather than synthesizing nothing
      if (toolResults.length === 0) {
        throw new Error("All tools failed — no evidence data available for synthesis.");
      }

      const response = await synthesizeWithLLM(
        request.question,
        parsed,
        toolResults,
        this.llm!,
        request.history
      );

      await this.auditRecorder.completeInteraction(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const errorResponse: ResearchResponse = {
        summary: `Evidence retrieval failed: ${message}`,
        evidenceOverview: [],
        synthesisAndInterpretation:
          "Tool failure prevented evidence synthesis. No partial or fabricated results are provided.",
        confidenceAndGaps: `Confidence: None — tool failure occurred. ${message}`,
        references: [],
      };
      await this.auditRecorder.completeInteraction(errorResponse);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Keyword-based fallback path (original behaviour — all existing tests pass)
  // ---------------------------------------------------------------------------

  private async processWithKeywords(
    request: ResearchRequest
  ): Promise<ResearchResponse | ClarificationNeeded> {
    const clarificationResult = checkClarificationNeeded(request.question);
    if (clarificationResult.needed) {
      return {
        type: "clarification",
        reason: clarificationResult.reason,
        suggestion: clarificationResult.suggestion,
      };
    }

    const selection: ToolSelection = selectTools(request.question);
    this.auditRecorder.startInteraction(request);

    try {
      const toolResults: Array<{ toolName: string; result: ToolInvocationResult }> = [];

      for (const selectedTool of selection.tools) {
        const result = await this.mcpClient.invokeTool(selectedTool.name, {
          query: request.question,
          maxResults: 10,
        });

        this.auditRecorder.recordToolCall(result.metadata);

        if (!result.success) {
          throw new Error(
            `Tool '${selectedTool.name}' failed: ${result.error ?? "unknown error"}`
          );
        }

        toolResults.push({ toolName: selectedTool.name, result });
      }

      const response = synthesize(request.question, selection, toolResults);
      await this.auditRecorder.completeInteraction(response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      const errorResponse: ResearchResponse = {
        summary: `Evidence retrieval failed: ${message}`,
        evidenceOverview: [],
        synthesisAndInterpretation:
          "Tool failure prevented evidence synthesis. No partial or fabricated results are provided.",
        confidenceAndGaps: `Confidence: None — tool failure occurred. ${message}`,
        references: [],
      };
      await this.auditRecorder.completeInteraction(errorResponse);
      throw error;
    }
  }

  async getInteractionAudit(interactionId: string) {
    return this.auditRecorder.retrieveInteraction(interactionId);
  }

  async listInteractions(): Promise<string[]> {
    return this.auditRecorder.listInteractions();
  }
}
