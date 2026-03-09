import { describe, it, expect } from "vitest";
import { synthesize } from "../synthesizer";
import { ToolInvocationResult } from "../mcp-types";
import { selectTools } from "../tool-selector";

// ---------------------------------------------------------------------------
// Helpers — build minimal mock ToolInvocationResult values
// ---------------------------------------------------------------------------

function mockPubMedResult(
  totalFound: number,
  results: unknown[] = []
): ToolInvocationResult {
  return {
    success: true,
    data: {
      query: "test query",
      totalFound,
      results,
    },
    metadata: {
      toolName: "pubmed-search",
      timestamp: new Date().toISOString(),
      inputs: { query: "test query" },
      outputs: null,
      success: true,
      durationMs: 10,
    },
  };
}

function mockTrialResult(
  totalFound: number,
  results: unknown[] = []
): ToolInvocationResult {
  return {
    success: true,
    data: {
      query: "test query",
      totalFound,
      results,
    },
    metadata: {
      toolName: "clinicaltrials-search",
      timestamp: new Date().toISOString(),
      inputs: { query: "test query" },
      outputs: null,
      success: true,
      durationMs: 10,
    },
  };
}

const SAMPLE_PUB = {
  pmid: "12345678",
  title: "Sample Publication Title",
  authors: ["Smith A", "Jones B"],
  journal: "Journal of Test Studies",
  year: "2024",
  abstract: "",
  url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  publicationTypes: ["Journal Article"],
};

const SAMPLE_TRIAL = {
  nctId: "NCT12345678",
  title: "Sample Phase 3 Trial",
  phase: ["PHASE3"],
  status: "RECRUITING",
  sponsor: "Test Pharma Inc",
  eligibilityCriteria: "Adults 18+",
  primaryEndpoints: ["Overall Survival"],
  secondaryEndpoints: ["PFS"],
  url: "https://clinicaltrials.gov/study/NCT12345678",
  resultsAvailable: false,
};

describe("synthesize — Spec §10.5 & §11", () => {
  const selection = selectTools("pembrolizumab lung cancer trial");

  it("returns a response with all required Spec §11.2 sections", () => {
    const result = synthesize(
      "pembrolizumab efficacy",
      selection,
      [{ toolName: "pubmed-search", result: mockPubMedResult(0) }]
    );

    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("evidenceOverview");
    expect(result).toHaveProperty("synthesisAndInterpretation");
    expect(result).toHaveProperty("confidenceAndGaps");
    expect(result).toHaveProperty("references");
  });

  it("explicitly states when no evidence is found (Spec §8.5, §11.6)", () => {
    const result = synthesize(
      "obscure compound XYZ",
      selectTools("obscure compound XYZ"),
      [{ toolName: "pubmed-search", result: mockPubMedResult(0) }]
    );

    expect(result.summary.toLowerCase()).toContain("no");
    expect(result.confidenceAndGaps.toLowerCase()).toMatch(/no|none|limited/);
  });

  it("includes PubMed results in evidenceOverview with PMID identifiers", () => {
    const result = synthesize(
      "pembrolizumab",
      selectTools("pembrolizumab efficacy cancer"),
      [
        {
          toolName: "pubmed-search",
          result: mockPubMedResult(1, [SAMPLE_PUB]),
        },
      ]
    );

    const pubEntry = result.evidenceOverview.find((e) => e.type === "pubmed");
    expect(pubEntry).toBeDefined();
    expect(pubEntry?.identifier).toContain("PMID:12345678");
  });

  it("includes clinical trial results in evidenceOverview with NCT identifiers", () => {
    const result = synthesize(
      "phase 3 trial",
      selectTools("phase 3 trial"),
      [
        {
          toolName: "clinicaltrials-search",
          result: mockTrialResult(1, [SAMPLE_TRIAL]),
        },
      ]
    );

    const trialEntry = result.evidenceOverview.find(
      (e) => e.type === "clinicaltrials"
    );
    expect(trialEntry).toBeDefined();
    expect(trialEntry?.identifier).toBe("NCT12345678");
  });

  it("attaches citations in synthesisAndInterpretation (Spec §11.3)", () => {
    const result = synthesize(
      "pembrolizumab",
      selectTools("pembrolizumab efficacy cancer"),
      [
        {
          toolName: "pubmed-search",
          result: mockPubMedResult(1, [SAMPLE_PUB]),
        },
      ]
    );

    expect(result.synthesisAndInterpretation).toContain("PMID:12345678");
  });

  it("builds references with PMIDs for publications", () => {
    const result = synthesize(
      "pembrolizumab",
      selectTools("pembrolizumab efficacy cancer"),
      [
        {
          toolName: "pubmed-search",
          result: mockPubMedResult(1, [SAMPLE_PUB]),
        },
      ]
    );

    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references[0].citation).toContain("PMID:12345678");
    expect(result.references[0].url).toContain("pubmed");
  });

  it("notes when trial results are not yet available (Spec §9.2)", () => {
    const result = synthesize(
      "phase 3 trial pembrolizumab",
      selectTools("phase 3 trial pembrolizumab"),
      [
        {
          toolName: "clinicaltrials-search",
          result: mockTrialResult(1, [SAMPLE_TRIAL]),
        },
      ]
    );

    expect(result.confidenceAndGaps.toLowerCase()).toMatch(/result|not yet/);
  });

  it("marks web sources as not peer-reviewed (Spec §9.3)", () => {
    const webResult: ToolInvocationResult = {
      success: true,
      data: {
        source: {
          url: "https://example.com/guidelines",
          content: "Some web content",
          retrievedAt: new Date().toISOString(),
          isWebSource: true,
        },
      },
      metadata: {
        toolName: "web-fetch",
        timestamp: new Date().toISOString(),
        inputs: {},
        outputs: null,
        success: true,
        durationMs: 10,
      },
    };

    const result = synthesize(
      "FDA guidelines oncology",
      selectTools("FDA guidelines oncology"),
      [{ toolName: "web-fetch", result: webResult }]
    );

    const webEntry = result.evidenceOverview.find((e) => e.type === "web");
    expect(webEntry).toBeDefined();
    expect(webEntry?.description.toLowerCase()).toContain("not peer-reviewed");
  });

  it("evidenceOverview is empty when no tools return data", () => {
    const result = synthesize(
      "test query",
      selectTools("some random query with no match"),
      []
    );

    expect(result.evidenceOverview).toEqual([]);
  });
});
