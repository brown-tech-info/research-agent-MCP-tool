import { describe, expect, it } from "vitest";
import { DraftMailTool } from "../draft-tool.js";

describe("DraftMailTool contract", () => {
  const tool = new DraftMailTool();

  const validInputs = {
    to: "researcher@example.com",
    subject: "Study Summary",
    body: "Please find the evidence summary attached.",
  };

  it("creates a valid draft with all required fields", async () => {
    const result = await tool.execute(validInputs);
    expect(result.draft.to).toBe(validInputs.to);
    expect(result.draft.subject).toBe(validInputs.subject);
    expect(result.draft.body).toBe(validInputs.body);
  });

  it("draft always has status: DRAFT, sendCapability: false, requiresUserApproval: true", async () => {
    const result = await tool.execute(validInputs);
    expect(result.draft.status).toBe("DRAFT");
    expect(result.draft.sendCapability).toBe(false);
    expect(result.draft.requiresUserApproval).toBe(true);
  });

  it("throws on missing 'to' field", async () => {
    await expect(
      tool.execute({ ...validInputs, to: "" })
    ).rejects.toThrow("'to'");
  });

  it("throws on missing 'subject' field", async () => {
    await expect(
      tool.execute({ ...validInputs, subject: "" })
    ).rejects.toThrow("'subject'");
  });

  it("throws on missing 'body' field", async () => {
    await expect(
      tool.execute({ ...validInputs, body: "" })
    ).rejects.toThrow("'body'");
  });

  it("citations default to empty array when not provided", async () => {
    const result = await tool.execute(validInputs);
    expect(result.draft.citations).toEqual([]);
  });

  it("includes citations when provided", async () => {
    const citations = [{ type: "pmid" as const, id: "12345678", title: "Test Study" }];
    const result = await tool.execute({ ...validInputs, citations });
    expect(result.draft.citations).toEqual(citations);
  });

  it("draft has a unique id and valid ISO 8601 createdAt timestamp", async () => {
    const r1 = await tool.execute(validInputs);
    const r2 = await tool.execute(validInputs);
    expect(r1.draft.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(r1.draft.id).not.toBe(r2.draft.id);
    expect(new Date(r1.draft.createdAt).toISOString()).toBe(r1.draft.createdAt);
  });

  it("tool has no 'send' method — draft-only enforcement", () => {
    expect((tool as unknown as Record<string, unknown>)["send"]).toBeUndefined();
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(tool));
    expect(proto).not.toContain("send");
  });
});
