import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryTools } from "../index.js";
import type { Citation } from "../types.js";

describe("Memory MCP Contract Tests", () => {
  let saveTool: ReturnType<typeof createMemoryTools>["saveTool"];
  let retrieveTool: ReturnType<typeof createMemoryTools>["retrieveTool"];
  let deleteTool: ReturnType<typeof createMemoryTools>["deleteTool"];

  beforeEach(() => {
    const tools = createMemoryTools();
    saveTool = tools.saveTool;
    retrieveTool = tools.retrieveTool;
    deleteTool = tools.deleteTool;
  });

  // 1. Save creates entry with required fields
  it("save creates entry with id, savedAt, and citations", async () => {
    const result = await saveTool.execute({
      title: "EGFR Inhibitor Notes",
      content: "First-line erlotinib shows OS benefit.",
      citations: [{ type: "pmid", id: "12345678", title: "Erlotinib trial" }],
    });

    expect(result.entry.id).toBeTruthy();
    expect(typeof result.entry.id).toBe("string");
    expect(result.entry.savedAt).toBeTruthy();
    expect(result.entry.updatedAt).toBeTruthy();
    expect(result.entry.citations).toHaveLength(1);
    expect(result.entry.title).toBe("EGFR Inhibitor Notes");
  });

  // 2. Retrieve all returns all saved entries
  it("retrieve all returns all saved entries", async () => {
    await saveTool.execute({ title: "Entry A", content: "Content A" });
    await saveTool.execute({ title: "Entry B", content: "Content B" });

    const result = await retrieveTool.execute({});
    expect(result.count).toBe(2);
    expect(result.entries).toHaveLength(2);
  });

  // 3. Retrieve by id returns specific entry
  it("retrieve by id returns the specific entry", async () => {
    const saved = await saveTool.execute({ title: "Specific", content: "Data" });
    const id = saved.entry.id;

    const result = await retrieveTool.execute({ id });
    expect(result.count).toBe(1);
    expect(result.entries[0].id).toBe(id);
    expect(result.entries[0].title).toBe("Specific");
  });

  // 4. Retrieve by unknown id returns empty array
  it("retrieve by unknown id returns empty array", async () => {
    const result = await retrieveTool.execute({ id: "nonexistent-id" });
    expect(result.count).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  // 5. Delete removes entry and returns deleted: true
  it("delete removes entry and returns deleted: true", async () => {
    const saved = await saveTool.execute({ title: "To Delete", content: "Gone soon" });
    const id = saved.entry.id;

    const deleteResult = await deleteTool.execute({ id });
    expect(deleteResult.deleted).toBe(true);
    expect(deleteResult.id).toBe(id);

    const afterDelete = await retrieveTool.execute({ id });
    expect(afterDelete.count).toBe(0);
  });

  // 6. Delete non-existent id returns deleted: false
  it("delete non-existent id returns deleted: false", async () => {
    const result = await deleteTool.execute({ id: "ghost-id" });
    expect(result.deleted).toBe(false);
    expect(result.id).toBe("ghost-id");
  });

  // 7. Throws on save with missing title
  it("throws on save with missing title", async () => {
    await expect(
      saveTool.execute({ content: "Some content" })
    ).rejects.toThrow("'title' must be a non-empty string");
  });

  // 8. Throws on save with missing content
  it("throws on save with missing content", async () => {
    await expect(
      saveTool.execute({ title: "A title" })
    ).rejects.toThrow("'content' must be a non-empty string");
  });

  // 9. Throws on delete with missing id
  it("throws on delete with missing id", async () => {
    await expect(
      deleteTool.execute({})
    ).rejects.toThrow("'id' must be a non-empty string");
  });

  // 10. User can inspect all memory — list all returns correct count
  it("list all returns correct count after multiple saves", async () => {
    const titles = ["Note 1", "Note 2", "Note 3"];
    for (const title of titles) {
      await saveTool.execute({ title, content: `Content for ${title}` });
    }

    const result = await retrieveTool.execute({});
    expect(result.count).toBe(3);
    expect(result.entries.map((e) => e.title)).toEqual(expect.arrayContaining(titles));
  });

  // 11. Citation integrity: citations saved are citations retrieved
  it("citation integrity: saved citations are retrieved intact", async () => {
    const citations: Citation[] = [
      { type: "pmid", id: "11111111", title: "Study A" },
      { type: "nct", id: "NCT00000001", title: "Trial B" },
      { type: "url", id: "https://example.com/paper", title: "Web Source C" },
    ];

    const saved = await saveTool.execute({
      title: "Citation Test",
      content: "Multi-citation entry",
      citations,
    });

    const retrieved = await retrieveTool.execute({ id: saved.entry.id });
    expect(retrieved.entries[0].citations).toHaveLength(3);
    expect(retrieved.entries[0].citations).toEqual(citations);
  });
});
