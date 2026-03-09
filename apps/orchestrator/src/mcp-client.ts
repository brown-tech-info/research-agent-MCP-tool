import {
  MCPTool,
  ToolInvocationMetadata,
  ToolInvocationResult,
} from "./mcp-types";

/**
 * MCP Client Adapter
 * 
 * Provides abstraction layer for calling MCP tools with:
 * - Metadata capture (tool name, inputs, outputs, timestamps)
 * - Error handling and explicit failure reporting
 * - Audit trail generation (Spec Section 12.2)
 * 
 * This adapter ensures all tool invocations are:
 * - Traceable
 * - Auditable
 * - Failure-aware (Spec 10.7)
 */
export class MCPClient {
  private tools: Map<string, MCPTool> = new Map();

  /**
   * Register an MCP tool with the client
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Invoke an MCP tool and capture full metadata.
   * 
   * Follows Spec Section 12.2 requirements:
   * - Tool name
   * - Timestamp of invocation
   * - Tool inputs (sanitized where necessary)
   * - Tool outputs or error states
   * 
   * @param toolName - Name of the tool to invoke
   * @param inputs - Tool inputs
   * @returns Tool invocation result with metadata
   */
  async invokeTool(
    toolName: string,
    inputs: Record<string, unknown>
  ): Promise<ToolInvocationResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const tool = this.tools.get(toolName);

    if (!tool) {
      // Tool not found - explicit failure (Spec 8.8, 10.7)
      const metadata: ToolInvocationMetadata = {
        toolName,
        timestamp,
        inputs,
        outputs: null,
        success: false,
        error: `Tool '${toolName}' not found`,
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        error: `Tool '${toolName}' not found`,
        metadata,
      };
    }

    try {
      // Execute tool
      const outputs = await tool.execute(inputs);
      const durationMs = Date.now() - startTime;

      const metadata: ToolInvocationMetadata = {
        toolName,
        timestamp,
        inputs,
        outputs,
        success: true,
        durationMs,
      };

      return {
        success: true,
        data: outputs,
        metadata,
      };
    } catch (error) {
      // Tool execution failed - explicit failure (Spec 8.8, 10.7)
      const durationMs = Date.now() - startTime;
      const cause = error instanceof Error && (error as NodeJS.ErrnoException).cause;
      const causeMsg = cause instanceof Error ? ` (cause: ${cause.message})` : "";
      const errorMessage =
        (error instanceof Error ? error.message : "Unknown error") + causeMsg;

      const metadata: ToolInvocationMetadata = {
        toolName,
        timestamp,
        inputs,
        outputs: null,
        success: false,
        error: errorMessage,
        durationMs,
      };

      return {
        success: false,
        error: errorMessage,
        metadata,
      };
    }
  }

  /**
   * Get list of registered tool names
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
