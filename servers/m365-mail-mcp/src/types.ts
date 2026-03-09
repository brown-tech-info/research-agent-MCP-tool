export interface MCPTool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

export interface Citation {
  type: "pmid" | "nct" | "url";
  id: string;
  title?: string;
}

export interface DraftMailInputs {
  to: string;
  subject: string;
  body: string;
  citations?: Citation[];
}

export interface MailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  citations: Citation[];
  status: "DRAFT";
  createdAt: string;
  sendCapability: false;
  requiresUserApproval: true;
}

export interface DraftMailResult {
  draft: MailDraft;
}
