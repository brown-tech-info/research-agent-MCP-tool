/**
 * LLM Synthesizer
 *
 * Converts raw MCP tool outputs into a conversational, citation-grounded
 * research response. Replaces the template-based synthesizer when an LLM
 * is available.
 *
 * Constitution rules enforced via system prompt:
 * - Every claim must cite a PMID or NCT ID from the provided data
 * - Never fabricate citations or data not present in tool outputs
 * - Explicit uncertainty over confident guessing
 * - Web sources must never be presented as peer-reviewed
 */

import { LLMClient } from "./llm-client";
import { ResearchResponse, EvidenceSource, Reference } from "./types";
import { ToolInvocationResult } from "./mcp-types";
import { ParsedQuery } from "./llm-query-parser";

export const SYSTEM_PROMPT = `You are a synthesis engine for a pharmaceutical research assistant.
You will be given a researcher's question and the raw outputs from biomedical data tools (PubMed, ClinicalTrials.gov, web sources).

Your job is to produce a structured, conversational research response.

STRICT RULES — violation is not acceptable:
1. Every factual claim MUST be followed immediately by its citation: [PMID:xxxxxxxx] or [NCT:xxxxxxxx] or [URL:...]
2. NEVER fabricate, invent, or infer data not present in the tool outputs provided
3. If data is absent or insufficient, say so explicitly — do NOT fill gaps with prior knowledge
4. Web sources are NOT peer-reviewed — always label them as such
5. Use conservative scientific language. Never use: "proves", "demonstrates conclusively", "breakthrough"
6. Surface conflicting evidence — do NOT smooth over disagreement between sources
7. If trial results are not available in the registry, say so — do NOT infer outcomes

Respond with valid JSON matching this exact shape:
{
  "summary": "<2-3 sentence overview of key findings, with inline citations>",
  "evidenceOverview": [
    { "type": "pubmed"|"clinicaltrials"|"web", "identifier": "<PMID:xxx or NCTxxx or URL>", "description": "<one line>" }
  ],
  "synthesisAndInterpretation": "<detailed paragraphs with inline citations after every claim>",
  "confidenceAndGaps": "<explicit statement of evidence strength, uncertainty, and gaps>",
  "references": [
    { "id": "<PMID:xxx or NCTxxx or URL>", "citation": "<full citation string>", "url": "<source URL>" }
  ]
}`;

/**
 * Builds the user message payload for the synthesis LLM call.
 * Exported so the streaming endpoint can reuse the same payload format.
 */
export function buildSynthesisUserMessage(
  question: string,
  parsedQuery: ParsedQuery,
  toolResults: Array<{ toolName: string; result: ToolInvocationResult }>,
  history?: import("./types").ConversationTurn[]
): string {
  const toolData = toolResults.map(({ toolName, result }) => ({
    tool: toolName,
    success: result.success,
    data: result.data,
  }));
  return JSON.stringify({
    question,
    searchTermsUsed: parsedQuery.searchTerms,
    toolResults: toolData,
    ...(history && history.length > 0 ? { priorConversation: history } : {}),
  });
}

export async function synthesizeWithLLM(
  question: string,
  parsedQuery: ParsedQuery,
  toolResults: Array<{ toolName: string; result: ToolInvocationResult }>,
  llm: LLMClient,
  history?: import("./types").ConversationTurn[]
): Promise<ResearchResponse> {
  const userMessage = buildSynthesisUserMessage(question, parsedQuery, toolResults, history);

  const raw = await llm.chat(SYSTEM_PROMPT, userMessage);
  // Extract the JSON object regardless of markdown fences or trailing whitespace.
  // GPT-4o sometimes wraps output in ```json ... ``` even when instructed not to.
  const match = raw.match(/\{[\s\S]*\}/);
  const json = match ? match[0].trim() : raw.trim();

  let parsed: ResearchResponse;
  try {
    parsed = JSON.parse(json) as ResearchResponse;
  } catch {
    throw new Error(`LLM synthesizer returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Validate required Spec §11.2 sections
  const required: (keyof ResearchResponse)[] = [
    "summary", "evidenceOverview", "synthesisAndInterpretation", "confidenceAndGaps", "references"
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`LLM synthesizer missing required field: ${field}`);
    }
  }

  return parsed;
}
