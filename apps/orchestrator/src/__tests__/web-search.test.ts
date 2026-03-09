/**
 * Web-search integration tests — verifies that the LLM orchestration path
 * correctly routes regulatory/news questions to the web-search tool,
 * includes web results in evidenceOverview, and never labels them peer-reviewed.
 */
import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "../orchestrator";
import { MCPClient } from "../mcp-client";
import { MCPTool } from "../mcp-types";
import type { LLMClient } from "../llm-client";
import type { ParsedQuery } from "../llm-query-parser";

// ---------------------------------------------------------------------------
// Stub tools
// ---------------------------------------------------------------------------

class StubWebSearchTool implements MCPTool {
  name = "web-search";
  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    return {
      query: "FDA guidance GLP-1 agonists obesity",
      totalFound: 2,
      results: [
        {
          url: "https://www.fda.gov/drugs/news-events/glp1-guidance",
          title: "FDA Draft Guidance: GLP-1 Receptor Agonists",
          snippet: "The FDA has issued draft guidance on GLP-1 receptor agonists for obesity management.",
          publishedDate: "2025-06-01T00:00:00Z",
          isWebSource: true,
        },
        {
          url: "https://www.fda.gov/news/press-releases/semaglutide-approval",
          title: "FDA Approves Semaglutide for Chronic Weight Management",
          snippet: "FDA approved semaglutide injection for chronic weight management in adults with obesity.",
          publishedDate: "2025-03-15T00:00:00Z",
          isWebSource: true,
        },
      ],
    };
  }
}

class StubPubMedTool implements MCPTool {
  name = "pubmed-search";
  async execute(_inputs: Record<string, unknown>): Promise<unknown> {
    return { query: "test", totalFound: 0, results: [] };
  }
}

// ---------------------------------------------------------------------------
// Stub LLM that routes to web-search
// ---------------------------------------------------------------------------

const STUB_SYNTHESIS_RESPONSE = {
  summary: "FDA has issued guidance on GLP-1 agonists.",
  evidenceOverview: [
    {
      type: "web",
      title: "FDA Draft Guidance: GLP-1 Receptor Agonists",
      url: "https://www.fda.gov/drugs/news-events/glp1-guidance",
      isWebSource: true,
    },
  ],
  synthesisAndInterpretation:
    "The FDA issued draft guidance on GLP-1 agonists [Source: https://www.fda.gov/drugs/news-events/glp1-guidance].",
  confidenceAndGaps:
    "Evidence is based on regulatory web sources, not peer-reviewed literature. No clinical trial data identified.",
  references: [
    {
      id: "W1",
      type: "web",
      url: "https://www.fda.gov/drugs/news-events/glp1-guidance",
      title: "FDA Draft Guidance: GLP-1 Receptor Agonists",
    },
  ],
};

function buildLLMClientReturning(parsed: ParsedQuery): LLMClient {
  return {
    // First call: query parser expects ParsedQuery JSON
    // Subsequent calls: synthesizer expects ResearchResponse JSON
    chat: vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(parsed))
      .mockResolvedValue(JSON.stringify(STUB_SYNTHESIS_RESPONSE)),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield JSON.stringify(STUB_SYNTHESIS_RESPONSE);
    }),
  } as unknown as LLMClient;
}

const WEB_SEARCH_PARSED: ParsedQuery = {
  searchTerms: "FDA guidance GLP-1 agonists obesity",
  toolsNeeded: ["web-search"],
  toolReasoning: "Question is about FDA regulatory guidance — web-search is appropriate.",
  clarificationNeeded: false,
};

const WEB_AND_PUBMED_PARSED: ParsedQuery = {
  searchTerms: "semaglutide FDA approval obesity evidence",
  toolsNeeded: ["pubmed-search", "web-search"],
  toolReasoning: "Question needs both peer-reviewed evidence and FDA regulatory context.",
  clarificationNeeded: false,
};

function buildClient(...tools: MCPTool[]): MCPClient {
  const client = new MCPClient();
  tools.forEach((t) => client.registerTool(t));
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("web-search LLM orchestration path (spec §9.3b, §10)", () => {
  it("routes regulatory question to web-search tool", async () => {
    const webSearchTool = new StubWebSearchTool();
    const executeSpy = vi.spyOn(webSearchTool, "execute");

    const client = buildClient(webSearchTool);
    const llm = buildLLMClientReturning(WEB_SEARCH_PARSED);
    const orchestrator = new Orchestrator(client, undefined, llm);

    await orchestrator.processRequest({
      question: "What are the current FDA guidelines on GLP-1 agonists for obesity?",
    });

    expect(executeSpy).toHaveBeenCalledOnce();
    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FDA guidance GLP-1 agonists obesity" })
    );
  });

  it("response includes web source in evidenceOverview with type='web'", async () => {
    const client = buildClient(new StubWebSearchTool());
    const llm = buildLLMClientReturning(WEB_SEARCH_PARSED);
    const orchestrator = new Orchestrator(client, undefined, llm);

    const result = await orchestrator.processRequest({
      question: "What are the current FDA guidelines on GLP-1 agonists for obesity?",
    });

    expect(result).toHaveProperty("evidenceOverview");
    if ("evidenceOverview" in result) {
      const webSources = result.evidenceOverview.filter((e) => e.type === "web");
      expect(webSources.length).toBeGreaterThan(0);
    }
  });

  it("web sources are never labeled as peer-reviewed (spec §9.3b guarantee)", async () => {
    const client = buildClient(new StubWebSearchTool());
    const llm = buildLLMClientReturning(WEB_SEARCH_PARSED);
    const orchestrator = new Orchestrator(client, undefined, llm);

    const result = await orchestrator.processRequest({
      question: "What are the current FDA guidelines on GLP-1 agonists for obesity?",
    });

    if ("evidenceOverview" in result) {
      const webItems = result.evidenceOverview.filter((e) => e.type === "web");
      webItems.forEach((item) => {
        expect(item).not.toHaveProperty("isPeerReviewed");
      });
    }
  });

  it("routes to both pubmed-search and web-search when both are needed", async () => {
    const pubmedTool = new StubPubMedTool();
    const webSearchTool = new StubWebSearchTool();
    const pubmedSpy = vi.spyOn(pubmedTool, "execute");
    const webSpy = vi.spyOn(webSearchTool, "execute");

    const client = buildClient(pubmedTool, webSearchTool);
    const llm = buildLLMClientReturning(WEB_AND_PUBMED_PARSED);
    const orchestrator = new Orchestrator(client, undefined, llm);

    await orchestrator.processRequest({
      question: "What is the FDA approval status and clinical evidence for semaglutide in obesity?",
    });

    expect(pubmedSpy).toHaveBeenCalledOnce();
    expect(webSpy).toHaveBeenCalledOnce();
  });

  it("does not invoke pubmed-search when only web-search is selected", async () => {
    const pubmedTool = new StubPubMedTool();
    const pubmedSpy = vi.spyOn(pubmedTool, "execute");

    const client = buildClient(pubmedTool, new StubWebSearchTool());
    const llm = buildLLMClientReturning(WEB_SEARCH_PARSED);
    const orchestrator = new Orchestrator(client, undefined, llm);

    await orchestrator.processRequest({
      question: "What are the current FDA guidelines on GLP-1 agonists for obesity?",
    });

    expect(pubmedSpy).not.toHaveBeenCalled();
  });
});
