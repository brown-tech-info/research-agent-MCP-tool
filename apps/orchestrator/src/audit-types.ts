import { ResearchRequest, ResearchResponse } from "./types";
import { ToolInvocationMetadata } from "./mcp-types";

/**
 * Complete audit record for a single interaction.
 * 
 * Captures all information needed to fully reconstruct an interaction
 * per Spec Section 12 (Trust, Audit & Observability).
 */
export interface AuditRecord {
  /** Unique identifier for this interaction */
  interactionId: string;

  /** ISO 8601 timestamp when interaction started */
  timestamp: string;

  /** User's research request */
  userInput: ResearchRequest;

  /** All tool invocations made during this interaction */
  toolCalls: ToolInvocationMetadata[];

  /** Final response returned to user */
  finalResponse: ResearchResponse;

  /** Total duration of interaction in milliseconds */
  durationMs: number;
}

/**
 * Interface for audit record persistence.
 * Different implementations can store to file, database, etc.
 */
export interface AuditStorage {
  /** Save an audit record */
  save(record: AuditRecord): Promise<void>;

  /** Retrieve an audit record by ID */
  retrieve(interactionId: string): Promise<AuditRecord | null>;

  /** List all audit record IDs */
  listIds(): Promise<string[]>;
}
