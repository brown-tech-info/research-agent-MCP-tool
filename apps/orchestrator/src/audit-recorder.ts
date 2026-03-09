import { ResearchRequest, ResearchResponse } from "./types";
import { ToolInvocationMetadata } from "./mcp-types";
import { AuditRecord, AuditStorage } from "./audit-types";
import { randomUUID } from "crypto";

/**
 * Audit Trace Recorder
 * 
 * Captures and persists full interaction records for auditability.
 * Per Spec Section 12.1, enables independent reviewers to:
 * - Reconstruct what question was asked
 * - Identify which tools were invoked, in what order, with what inputs
 * - Inspect raw tool outputs used in synthesis
 * - Trace every claim in the final response to its originating source
 */
export class AuditRecorder {
  private currentRecord: Partial<AuditRecord> | null = null;
  private startTime: number = 0;

  constructor(private storage: AuditStorage) {}

  /**
   * Start recording a new interaction.
   * Captures user input and generates unique interaction ID.
   */
  startInteraction(userInput: ResearchRequest): string {
    const interactionId = randomUUID();
    this.startTime = Date.now();

    this.currentRecord = {
      interactionId,
      timestamp: new Date().toISOString(),
      userInput,
      toolCalls: [],
    };

    return interactionId;
  }

  /**
   * Record a tool invocation.
   * Must be called after startInteraction.
   */
  recordToolCall(metadata: ToolInvocationMetadata): void {
    if (!this.currentRecord) {
      throw new Error("No active interaction. Call startInteraction first.");
    }

    if (!this.currentRecord.toolCalls) {
      this.currentRecord.toolCalls = [];
    }

    this.currentRecord.toolCalls.push(metadata);
  }

  /**
   * Complete the interaction and persist the audit record.
   * Returns the complete audit record.
   */
  async completeInteraction(
    finalResponse: ResearchResponse
  ): Promise<AuditRecord> {
    if (!this.currentRecord) {
      throw new Error("No active interaction. Call startInteraction first.");
    }

    const durationMs = Date.now() - this.startTime;

    const completeRecord: AuditRecord = {
      interactionId: this.currentRecord.interactionId!,
      timestamp: this.currentRecord.timestamp!,
      userInput: this.currentRecord.userInput!,
      toolCalls: this.currentRecord.toolCalls || [],
      finalResponse,
      durationMs,
    };

    // Persist to storage
    await this.storage.save(completeRecord);

    // Clear current record
    this.currentRecord = null;
    this.startTime = 0;

    return completeRecord;
  }

  /**
   * Retrieve a previously recorded interaction.
   */
  async retrieveInteraction(
    interactionId: string
  ): Promise<AuditRecord | null> {
    return this.storage.retrieve(interactionId);
  }

  /**
   * List all recorded interaction IDs.
   */
  async listInteractions(): Promise<string[]> {
    return this.storage.listIds();
  }
}
