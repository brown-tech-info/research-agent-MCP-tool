import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClinicalTrialsFetchTool } from "../fetch-tool.js";

const makeFullStudy = () => ({
  protocolSection: {
    identificationModule: { nctId: "NCT12345678", briefTitle: "Full Trial" },
    statusModule: { overallStatus: "COMPLETED" },
    sponsorCollaboratorsModule: { leadSponsor: { name: "Big Pharma Inc" } },
    designModule: { phases: ["PHASE3"] },
    eligibilityModule: { eligibilityCriteria: "Age ≥ 18" },
    outcomesModule: {
      primaryOutcomes: [{ measure: "Disease-Free Survival" }],
      secondaryOutcomes: [{ measure: "Quality of Life" }],
    },
  },
  resultsSection: { outcomeData: {} },
});

describe("ClinicalTrialsFetchTool contract", () => {
  let tool: ClinicalTrialsFetchTool;

  beforeEach(() => {
    tool = new ClinicalTrialsFetchTool();
    vi.restoreAllMocks();
  });

  it("returns found: false for 404 NCT ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    const result = await tool.execute({ nctId: "NCT99999999" });

    expect(result).toEqual({ trial: null, found: false });
  });

  it("returns full trial for valid NCT ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeFullStudy(),
      })
    );

    const result = await tool.execute({ nctId: "NCT12345678" });

    expect(result.found).toBe(true);
    expect(result.trial).toMatchObject({
      nctId: "NCT12345678",
      title: "Full Trial",
      status: "COMPLETED",
      sponsor: "Big Pharma Inc",
      phase: ["PHASE3"],
      primaryEndpoints: ["Disease-Free Survival"],
      secondaryEndpoints: ["Quality of Life"],
      url: "https://clinicaltrials.gov/study/NCT12345678",
      resultsAvailable: true,
    });
  });

  it("throws on missing nctId", async () => {
    await expect(tool.execute({})).rejects.toThrow(
      "ClinicalTrials fetch requires a non-empty nctId string"
    );
  });

  it("throws on empty nctId string", async () => {
    await expect(tool.execute({ nctId: "  " })).rejects.toThrow(
      "ClinicalTrials fetch requires a non-empty nctId string"
    );
  });

  it("throws with clear message on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    await expect(tool.execute({ nctId: "NCT12345678" })).rejects.toThrow(
      "ClinicalTrials fetch failed: HTTP 500"
    );
  });
});
