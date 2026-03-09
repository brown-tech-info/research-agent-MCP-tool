import { describe, it, expect } from "vitest";
import { selectTools } from "../tool-selector";

describe("selectTools — Spec §10.2 & §10.3", () => {
  it("selects PubMed for biomedical queries", () => {
    const result = selectTools("efficacy of pembrolizumab in lung cancer");
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("pubmed-search");
  });

  it("selects both PubMed and ClinicalTrials for trial queries", () => {
    const result = selectTools("phase 3 clinical trial for KRAS inhibitor");
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("pubmed-search");
    expect(names).toContain("clinicaltrials-search");
  });

  it("enforces PubMed before ClinicalTrials in the returned order", () => {
    const result = selectTools("phase 2 trial for BRAF inhibitor");
    const pubmedIdx = result.tools.findIndex((t) => t.name === "pubmed-search");
    const trialsIdx = result.tools.findIndex(
      (t) => t.name === "clinicaltrials-search"
    );
    expect(pubmedIdx).toBeLessThan(trialsIdx);
  });

  it("selects web-fetch for regulatory/guideline queries", () => {
    const result = selectTools("FDA guidelines for oncology drug approval");
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("web-fetch");
  });

  it("falls back to web-fetch when no known terms match", () => {
    const result = selectTools("hello world foo bar");
    const names = result.tools.map((t) => t.name);
    expect(names).toEqual(["web-fetch"]);
  });

  it("selects minimum set — no duplicate tools", () => {
    const result = selectTools("cancer drug trial phase 3");
    const names = result.tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes justification for every selected tool", () => {
    const result = selectTools("pembrolizumab clinical trial efficacy");
    result.tools.forEach((t) => {
      expect(t.justification.length).toBeGreaterThan(0);
    });
  });

  it("includes orderJustification in the result", () => {
    const result = selectTools("KRAS mutation treatment efficacy");
    expect(result.orderJustification.length).toBeGreaterThan(0);
  });

  it("does not include ClinicalTrials without trial terms", () => {
    const result = selectTools("mechanism of BRAF inhibitor resistance");
    const names = result.tools.map((t) => t.name);
    expect(names).not.toContain("clinicaltrials-search");
  });
});
