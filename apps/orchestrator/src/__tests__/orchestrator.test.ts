import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator";
import { MCPClient } from "../mcp-client";
import { MCPTool } from "../mcp-types";

// ---------------------------------------------------------------------------
// Stub tools for orchestrator integration tests
// ---------------------------------------------------------------------------

class StubPubMedSearchTool implements MCPTool {
  name = "pubmed-search";
  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    return {
      query: "test",
      totalFound: 1,
      results: [
        {
          pmid: "99999999",
          title: "Test Publication",
          authors: ["Author A"],
          journal: "Test Journal",
          year: "2024",
          abstract: "",
          url: "https://pubmed.ncbi.nlm.nih.gov/99999999/",
          publicationTypes: ["Journal Article"],
        },
      ],
    };
  }
}

class StubClinicalTrialsSearchTool implements MCPTool {
  name = "clinicaltrials-search";
  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    return { query: "test", totalFound: 0, results: [] };
  }
}

class StubFailingTool implements MCPTool {
  name = "pubmed-search";
  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    throw new Error("Simulated tool failure");
  }
}

function buildClient(...tools: MCPTool[]): MCPClient {
  const client = new MCPClient();
  tools.forEach((t) => client.registerTool(t));
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Orchestrator — Phase 4 integration", () => {
  describe("Clarification (Spec §10.4)", () => {
    it("returns ClarificationNeeded for an empty query", async () => {
      const orchestrator = new Orchestrator(buildClient());
      const result = await orchestrator.processRequest({ question: "" });

      expect(result).toHaveProperty("type", "clarification");
    });

    it("returns ClarificationNeeded for a single generic term", async () => {
      const orchestrator = new Orchestrator(buildClient());
      const result = await orchestrator.processRequest({ question: "cancer" });

      expect(result).toHaveProperty("type", "clarification");
    });

    it("does NOT request clarification for a specific research question", async () => {
      const client = buildClient(
        new StubPubMedSearchTool(),
        new StubClinicalTrialsSearchTool()
      );
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "efficacy of pembrolizumab in NSCLC",
      });

      expect(result).not.toHaveProperty("type");
      expect(result).toHaveProperty("summary");
    });
  });

  describe("Tool invocation (Spec §10.2, §10.3)", () => {
    it("invokes pubmed-search for a biomedical query", async () => {
      const client = buildClient(new StubPubMedSearchTool());
      const executeSpy = vi.spyOn(
        client["tools"].get("pubmed-search") as MCPTool,
        "execute"
      );

      const orchestrator = new Orchestrator(client);
      await orchestrator.processRequest({
        question: "pembrolizumab efficacy in cancer",
      });

      expect(executeSpy).toHaveBeenCalled();
    });

    it("throws — and does not return partial data — on tool failure (Spec §10.7)", async () => {
      const client = buildClient(new StubFailingTool());
      const orchestrator = new Orchestrator(client);

      await expect(
        orchestrator.processRequest({
          question: "pembrolizumab efficacy in cancer",
        })
      ).rejects.toThrow("Simulated tool failure");
    });
  });

  describe("Structured response (Spec §11.2)", () => {
    it("returns all required Spec §11.2 sections", async () => {
      const client = buildClient(new StubPubMedSearchTool());
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "pembrolizumab cancer treatment efficacy",
      });

      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("evidenceOverview");
      expect(result).toHaveProperty("synthesisAndInterpretation");
      expect(result).toHaveProperty("confidenceAndGaps");
      expect(result).toHaveProperty("references");
    });

    it("response includes retrieved publication in evidenceOverview", async () => {
      const client = buildClient(new StubPubMedSearchTool());
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "pembrolizumab cancer treatment efficacy",
      });

      if ("evidenceOverview" in result) {
        expect(result.evidenceOverview.length).toBeGreaterThan(0);
        expect(result.evidenceOverview[0].type).toBe("pubmed");
      }
    });
  });

  describe("Conflicting evidence (Spec §10.5)", () => {
    // PubMed returns a positive publication; ClinicalTrials returns a TERMINATED trial.
    // The agent must preserve both sources without creating false consensus.

    class StubPositivePubMedTool implements MCPTool {
      name = "pubmed-search";
      async execute(_inputs: Record<string, unknown>): Promise<unknown> {
        return {
          query: "test",
          totalFound: 1,
          results: [
            {
              pmid: "11111111",
              title: "Drug X shows efficacy in Phase 2 study",
              authors: ["Smith A"],
              journal: "Test Journal",
              year: "2023",
              abstract: "",
              url: "https://pubmed.ncbi.nlm.nih.gov/11111111/",
              publicationTypes: ["Journal Article"],
            },
          ],
        };
      }
    }

    class StubTerminatedTrialTool implements MCPTool {
      name = "clinicaltrials-search";
      async execute(_inputs: Record<string, unknown>): Promise<unknown> {
        return {
          query: "test",
          totalFound: 1,
          results: [
            {
              nctId: "NCT99999999",
              title: "Drug X Phase 3 Trial — Terminated",
              phase: ["PHASE3"],
              status: "TERMINATED",
              sponsor: "Test Sponsor",
              eligibilityCriteria: "Adults 18+",
              primaryEndpoints: ["Overall Survival"],
              secondaryEndpoints: [],
              url: "https://clinicaltrials.gov/study/NCT99999999",
              resultsAvailable: false,
            },
          ],
        };
      }
    }

    it("includes both conflicting sources in evidenceOverview without merging them (Spec §10.5)", async () => {
      const client = buildClient(
        new StubPositivePubMedTool(),
        new StubTerminatedTrialTool()
      );
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "efficacy of drug X in cancer phase 3 trial",
      });

      if (!("evidenceOverview" in result)) {
        throw new Error("Expected ResearchResponse, got ClarificationNeeded");
      }
      const types = result.evidenceOverview.map((e) => e.type);
      expect(types).toContain("pubmed");
      expect(types).toContain("clinicaltrials");
    });

    it("synthesisAndInterpretation references both PMID and NCT ID (Spec §11.3)", async () => {
      const client = buildClient(
        new StubPositivePubMedTool(),
        new StubTerminatedTrialTool()
      );
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "efficacy of drug X in cancer phase 3 trial",
      });

      if (!("synthesisAndInterpretation" in result)) {
        throw new Error("Expected ResearchResponse, got ClarificationNeeded");
      }
      expect(result.synthesisAndInterpretation).toContain("PMID:11111111");
      expect(result.synthesisAndInterpretation).toContain("NCT99999999");
    });

    it("confidenceAndGaps surfaces trial results unavailability (Spec §9.2, §11.6)", async () => {
      const client = buildClient(
        new StubPositivePubMedTool(),
        new StubTerminatedTrialTool()
      );
      const orchestrator = new Orchestrator(client);
      const result = await orchestrator.processRequest({
        question: "efficacy of drug X in cancer phase 3 trial",
      });

      if (!("confidenceAndGaps" in result)) {
        throw new Error("Expected ResearchResponse, got ClarificationNeeded");
      }
      // Registry note must appear — agent must not infer outcomes for the terminated trial
      expect(result.confidenceAndGaps.toLowerCase()).toMatch(/result|registry/);
    });
  });

  describe("Audit trail (Spec §12.1)", () => {
    it("records an interaction that can be retrieved by ID", async () => {
      const client = buildClient(new StubPubMedSearchTool());
      const orchestrator = new Orchestrator(client);

      await orchestrator.processRequest({
        question: "pembrolizumab cancer treatment efficacy",
      });

      const ids = await orchestrator.listInteractions();
      expect(ids.length).toBeGreaterThan(0);

      const audit = await orchestrator.getInteractionAudit(ids[0]);
      expect(audit).not.toBeNull();
      expect(audit?.toolCalls.length).toBeGreaterThan(0);
      expect(audit?.userInput.question).toBe(
        "pembrolizumab cancer treatment efficacy"
      );
    });
  });
});
