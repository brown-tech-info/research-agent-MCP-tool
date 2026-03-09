import { randomUUID } from "crypto";
import type { Citation, DraftMailResult, MCPTool } from "./types.js";

// SPEC REQUIREMENT: This tool creates drafts ONLY. No send capability exists by design.
export class DraftMailTool implements MCPTool {
  readonly name = "m365-draft-mail" as const;

  async execute(inputs: Record<string, unknown>): Promise<DraftMailResult> {
    const { to, subject, body, citations } = inputs;

    if (typeof to !== "string" || to.trim() === "") {
      throw new Error("Missing or empty required field: 'to'");
    }
    if (typeof subject !== "string" || subject.trim() === "") {
      throw new Error("Missing or empty required field: 'subject'");
    }
    if (typeof body !== "string" || body.trim() === "") {
      throw new Error("Missing or empty required field: 'body'");
    }

    const validatedCitations: Citation[] = Array.isArray(citations)
      ? (citations as Citation[])
      : [];

    const draft = {
      id: randomUUID(),
      to,
      subject,
      body,
      citations: validatedCitations,
      status: "DRAFT" as const,
      createdAt: new Date().toISOString(),
      sendCapability: false as const,
      requiresUserApproval: true as const,
    };

    return { draft };
  }
}
