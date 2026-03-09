/**
 * A single turn in a conversation (user question + agent response summary)
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Research request from user
 */
export interface ResearchRequest {
  /** The research question or query */
  question: string;
  /** Optional context or scope constraints */
  context?: string;
  /** Prior conversation turns for multi-turn context */
  history?: ConversationTurn[];
}

/**
 * Structured research response following Spec Section 11.2
 */
export interface ResearchResponse {
  /** Concise overview of key findings and conclusions */
  summary: string;

  /** Structured presentation of retrieved sources */
  evidenceOverview: EvidenceSource[];

  /** Analysis combining sources, with uncertainty and limitations preserved */
  synthesisAndInterpretation: string;

  /** Explicit statement of evidence strength, uncertainty, and missing data */
  confidenceAndGaps: string;

  /** Full list of cited sources with identifiers and links */
  references: Reference[];
}

/**
 * Evidence source from tools
 */
export interface EvidenceSource {
  /** Source type identifier */
  type: "pubmed" | "clinicaltrials" | "web" | "unknown";
  /** Brief description or title */
  description: string;
  /** Source identifier (PMID, NCT ID, URL) */
  identifier: string;
}

/**
 * Full reference entry
 */
export interface Reference {
  /** Citation number or label */
  id: string;
  /** Full citation text */
  citation: string;
  /** Direct link to source */
  url: string;
}

/**
 * Returned when the orchestrator needs clarification before tool invocation.
 * Per Spec 10.4: only when ambiguity would materially affect evidence retrieval.
 */
export interface ClarificationNeeded {
  type: "clarification";
  /** Why clarification is needed */
  reason: string;
  /** A minimal, specific question for the user */
  suggestion: string;
}