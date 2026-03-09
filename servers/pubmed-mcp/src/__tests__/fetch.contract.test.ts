import { describe, it, expect, vi, beforeEach } from "vitest";
import { PubMedFetchTool } from "../fetch-tool.js";

const MOCK_ESUMMARY_FOUND = {
  result: {
    "99887766": {
      uid: "99887766",
      title: "Landmark Study on Drug X",
      authors: [{ name: "Jones B" }],
      source: "NEJM",
      pubdate: "2022 Mar 15",
      pubtype: ["Clinical Trial", "Journal Article"],
    },
  },
};

const MOCK_ESUMMARY_NOT_FOUND = {
  result: {
    uids: [],
  },
};

describe("PubMedFetchTool contract", () => {
  let tool: PubMedFetchTool;

  beforeEach(() => {
    tool = new PubMedFetchTool();
  });

  it("returns found: false for unknown PMID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_ESUMMARY_NOT_FOUND),
    }));

    const result = await tool.execute({ pmid: "00000001" }) as { publication: null; found: boolean };

    expect(result.found).toBe(false);
    expect(result.publication).toBeNull();
  });

  it("returns full publication for valid PMID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_ESUMMARY_FOUND),
    }));

    const result = await tool.execute({ pmid: "99887766" }) as {
      found: boolean;
      publication: {
        pmid: string;
        title: string;
        authors: string[];
        journal: string;
        year: string;
        abstract: string;
        url: string;
        publicationTypes: string[];
      };
    };

    expect(result.found).toBe(true);
    expect(result.publication).not.toBeNull();
    expect(result.publication.pmid).toBe("99887766");
    expect(result.publication.title).toBe("Landmark Study on Drug X");
    expect(result.publication.authors).toEqual(["Jones B"]);
    expect(result.publication.journal).toBe("NEJM");
    expect(result.publication.year).toBe("2022");
    expect(result.publication.abstract).toBe("");
    expect(result.publication.url).toBe("https://pubmed.ncbi.nlm.nih.gov/99887766/");
    expect(result.publication.publicationTypes).toEqual(["Clinical Trial", "Journal Article"]);
  });

  it("throws when pmid is missing", async () => {
    await expect(tool.execute({})).rejects.toThrow(
      "pmid is required and must be a non-empty string"
    );
  });

  it("throws when pmid is empty string", async () => {
    await expect(tool.execute({ pmid: "" })).rejects.toThrow(
      "pmid is required and must be a non-empty string"
    );
  });

  it("throws with clear message on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
    }));

    await expect(tool.execute({ pmid: "12345678" })).rejects.toThrow(
      "PubMed fetch failed: HTTP 429"
    );
  });
});
