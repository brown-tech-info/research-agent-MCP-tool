import { describe, it, expect, vi, beforeEach } from "vitest";
import { PubMedSearchTool } from "../search-tool.js";

const MOCK_ESEARCH_EMPTY = {
  esearchresult: { count: "0", idlist: [] },
};

const MOCK_ESEARCH_HIT = {
  esearchresult: { count: "1", idlist: ["12345678"] },
};

const MOCK_ESUMMARY_HIT = {
  result: {
    "12345678": {
      uid: "12345678",
      title: "Test Article Title",
      authors: [{ name: "Smith J" }, { name: "Doe A" }],
      source: "Nature Medicine",
      pubdate: "2023 Jan",
      pubtype: ["Journal Article"],
    },
  },
};

const MOCK_EFETCH_XML = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345678</PMID>
      <Article>
        <Abstract>
          <AbstractText>This is the full abstract text for the test article.</AbstractText>
        </Abstract>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

function makeFetchMock(...responses: Array<{ ok: boolean; status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++];
    if (!r) throw new Error("Unexpected fetch call");
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? 200,
      json: r.json ?? (() => Promise.resolve({})),
      text: r.text ?? (() => Promise.resolve("")),
    });
  });
}

describe("PubMedSearchTool contract", () => {
  let tool: PubMedSearchTool;

  beforeEach(() => {
    tool = new PubMedSearchTool();
  });

  it("returns empty result when esearch finds no ids", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ ok: true, json: () => Promise.resolve(MOCK_ESEARCH_EMPTY) })
    );

    const result = await tool.execute({ query: "nonexistent compound XYZ" });

    expect(result).toEqual({ query: "nonexistent compound XYZ", totalFound: 0, results: [] });
  });

  it("returns parsed publications on success", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(
        { ok: true, json: () => Promise.resolve(MOCK_ESEARCH_HIT) },
        { ok: true, json: () => Promise.resolve(MOCK_ESUMMARY_HIT) },
        { ok: true, text: () => Promise.resolve(MOCK_EFETCH_XML) }
      )
    );

    const result = await tool.execute({ query: "BRCA1 cancer" }) as {
      query: string;
      totalFound: number;
      results: Array<{
        pmid: string;
        title: string;
        authors: string[];
        journal: string;
        year: string;
        abstract: string;
        url: string;
        publicationTypes: string[];
      }>;
    };

    expect(result.query).toBe("BRCA1 cancer");
    expect(result.totalFound).toBe(1);
    expect(result.results).toHaveLength(1);

    const pub = result.results[0];
    expect(pub?.pmid).toBe("12345678");
    expect(pub?.title).toBe("Test Article Title");
    expect(pub?.authors).toEqual(["Smith J", "Doe A"]);
    expect(pub?.journal).toBe("Nature Medicine");
    expect(pub?.year).toBe("2023");
    expect(pub?.abstract).toBe("This is the full abstract text for the test article.");
    expect(pub?.url).toBe("https://pubmed.ncbi.nlm.nih.gov/12345678/");
    expect(pub?.publicationTypes).toEqual(["Journal Article"]);
  });

  it("throws when query is missing", async () => {
    await expect(tool.execute({})).rejects.toThrow(
      "query is required and must be a non-empty string"
    );
  });

  it("throws when query is empty string", async () => {
    await expect(tool.execute({ query: "   " })).rejects.toThrow(
      "query is required and must be a non-empty string"
    );
  });

  it("throws with clear message on HTTP error from esearch", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ ok: false, status: 500 })
    );

    await expect(tool.execute({ query: "aspirin" })).rejects.toThrow(
      "PubMed search failed: HTTP 500"
    );
  });

  it("throws with clear message on HTTP error from esummary", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(
        { ok: true, json: () => Promise.resolve(MOCK_ESEARCH_HIT) },
        { ok: false, status: 503 }
      )
    );

    await expect(tool.execute({ query: "aspirin" })).rejects.toThrow(
      "PubMed summary fetch failed: HTTP 503"
    );
  });
});
