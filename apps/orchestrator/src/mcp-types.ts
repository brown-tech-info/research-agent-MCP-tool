/**
 * MCP tool invocation metadata
 * Captures all information needed for audit and traceability (Spec 12.2)
 */
export interface ToolInvocationMetadata {
  /** Tool name (e.g., "pubmed-search", "clinicaltrials-query") */
  toolName: string;

  /** ISO 8601 timestamp of invocation */
  timestamp: string;

  /** Tool inputs (sanitized where necessary) */
  inputs: Record<string, unknown>;

  /** Tool outputs or error state */
  outputs: unknown;

  /** Whether the tool invocation succeeded */
  success: boolean;

  /** Error message if tool failed */
  error?: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * MCP tool interface
 * All MCP tools must implement this contract
 */
export interface MCPTool {
  /** Tool name identifier */
  name: string;

  /** Execute the tool with given inputs */
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

/**
 * Result of an MCP tool invocation
 */
export interface ToolInvocationResult {
  /** Whether the invocation succeeded */
  success: boolean;

  /** Tool output data (if successful) */
  data?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Invocation metadata for audit trail */
  metadata: ToolInvocationMetadata;
}
