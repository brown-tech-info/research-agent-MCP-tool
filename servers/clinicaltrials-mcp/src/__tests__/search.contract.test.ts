import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClinicalTrialsSearchTool } from "../search-tool.js";

const makeMockStudy = (overrides: Record<string, unknown> = {}) => ({
  protocolSection: {
    identificationModule: { nctId: "NCT00000001", briefTitle: "Test Trial" },
    statusModule: { overallStatus: "RECRUITING" },
    sponsorCollaboratorsModule: { leadSponsor: { name: "Acme Pharma" } },
    designModule: { phases: ["PHASE2"] },
    eligibilityModule: { eligibilityCriteria: "Adults 18+" },
    outcomesModule: {
      primaryOutcomes: [{ measure: "Overall Survival" }],
      secondaryOutcomes: [{ measure: "PFS" }],
    },
  },
  ...overrides,
});

describe("ClinicalTrialsSearchTool contract", () => {
  let tool: ClinicalTrialsSearchTool;

  beforeEach(() => {
    tool = new ClinicalTrialsSearchTool();
    vi.restoreAllMocks();
  });

  it("returns empty result when no studies found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ totalCount: 0, studies: [] }),
      })
    );

    const result = await tool.execute({ query: "obscure condition xyz" });

    expect(result).toEqual({ query: "obscure condition xyz", totalFound: 0, results: [] });
  });

  it("returns parsed trials on success", async () => {
    const study = makeMockStudy();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ totalCount: 1, studies: [study] }),
      })
    );

    const result = await tool.execute({ query: "cancer" });

    expect(result).toMatchObject({
      query: "cancer",
      totalFound: 1,
      results: [
        {
          nctId: "NCT00000001",
          title: "Test Trial",
          status: "RECRUITING",
          sponsor: "Acme Pharma",
          phase: ["PHASE2"],
          eligibilityCriteria: "Adults 18+",
          primaryEndpoints: ["Overall Survival"],
          secondaryEndpoints: ["PFS"],
          url: "https://clinicaltrials.gov/study/NCT00000001",
          resultsAvailable: false,
        },
      ],
    });
  });

  it("throws on missing query", async () => {
    await expect(tool.execute({})).rejects.toThrow(
      "ClinicalTrials search requires a non-empty query string"
    );
  });

  it("throws on empty query string", async () => {
    await expect(tool.execute({ query: "   " })).rejects.toThrow(
      "ClinicalTrials search requires a non-empty query string"
    );
  });

  it("throws with clear message on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" })
    );

    await expect(tool.execute({ query: "cancer" })).rejects.toThrow(
      "ClinicalTrials search failed: HTTP 503"
    );
  });

  it("resultsAvailable is false when no resultsSection present", async () => {
    const study = makeMockStudy(); // no resultsSection key
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ totalCount: 1, studies: [study] }),
      })
    );

    const result = await tool.execute({ query: "cancer" });

    expect(result.results[0].resultsAvailable).toBe(false);
  });

  it("resultsAvailable is true when resultsSection is present", async () => {
    const study = makeMockStudy({ resultsSection: { someData: true } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ totalCount: 1, studies: [study] }),
      })
    );

    const result = await tool.execute({ query: "cancer" });

    expect(result.results[0].resultsAvailable).toBe(true);
  });
});
