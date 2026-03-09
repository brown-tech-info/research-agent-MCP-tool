export interface ResearchResponse {
  type: 'response';
  interactionId: string;
  summary: string;
  evidenceOverview: EvidenceSource[];
  synthesisAndInterpretation: string;
  confidenceAndGaps: string;
  references: Reference[];
}

export interface ClarificationResponse {
  type: 'clarification';
  reason: string;
  suggestion: string;
}

export interface MailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  citations: Citation[];
  status: 'DRAFT';
  createdAt: string;
  sendCapability: false;
  requiresUserApproval: true;
}

export interface DraftResponse {
  type: 'draft';
  draft: MailDraft;
}

export type ApiResponse = ResearchResponse | ClarificationResponse | DraftResponse;

export interface EvidenceSource {
  type: 'pubmed' | 'clinicaltrials' | 'web' | 'unknown';
  description: string;
  identifier: string;
}

export interface Reference {
  id: string;
  citation: string;
  url: string;
}

export interface ToolCall {
  toolName: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  outputs: unknown;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface AuditRecord {
  interactionId: string;
  timestamp: string;
  userInput: { question: string; context?: string };
  toolCalls: ToolCall[];
  finalResponse: unknown;
  durationMs: number;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  citations: Citation[];
  savedAt: string;
  updatedAt: string;
}

export interface Citation {
  type: 'pmid' | 'nct' | 'url';
  id: string;
  title?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'streaming';
  content: string | ApiResponse;
  timestamp: string;
  /** Status label shown while a streaming response is in progress */
  streamingStatus?: string;
}
