import { describe, it, expect } from "vitest";
import { checkClarificationNeeded } from "../clarification";

describe("checkClarificationNeeded — Spec §10.4", () => {
  it("returns needed:false for a specific research question", () => {
    const result = checkClarificationNeeded(
      "efficacy of pembrolizumab in non-small cell lung cancer"
    );
    expect(result.needed).toBe(false);
  });

  it("returns needed:true for an empty query", () => {
    const result = checkClarificationNeeded("");
    expect(result.needed).toBe(true);
    if (result.needed) {
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.suggestion.length).toBeGreaterThan(0);
    }
  });

  it("returns needed:true for a whitespace-only query", () => {
    const result = checkClarificationNeeded("   ");
    expect(result.needed).toBe(true);
  });

  it("returns needed:true for a single generic term like 'cancer'", () => {
    const result = checkClarificationNeeded("cancer");
    expect(result.needed).toBe(true);
  });

  it("returns needed:true for a single generic term like 'drug'", () => {
    const result = checkClarificationNeeded("drug");
    expect(result.needed).toBe(true);
  });

  it("returns needed:false for a single specific term like 'pembrolizumab'", () => {
    const result = checkClarificationNeeded("pembrolizumab");
    expect(result.needed).toBe(false);
  });

  it("returns needed:true for two generic terms together", () => {
    const result = checkClarificationNeeded("cancer trial");
    expect(result.needed).toBe(true);
  });

  it("returns needed:false for a two-word query where one term is specific", () => {
    // "pembrolizumab cancer" — one term is specific
    const result = checkClarificationNeeded("pembrolizumab cancer");
    expect(result.needed).toBe(false);
  });

  it("clarification reason and suggestion are non-empty when needed", () => {
    const result = checkClarificationNeeded("disease");
    expect(result.needed).toBe(true);
    if (result.needed) {
      expect(result.reason.trim().length).toBeGreaterThan(0);
      expect(result.suggestion.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns needed:false for a multi-word specific question", () => {
    const result = checkClarificationNeeded(
      "KRAS G12C mutation frequency in pancreatic adenocarcinoma"
    );
    expect(result.needed).toBe(false);
  });
});
