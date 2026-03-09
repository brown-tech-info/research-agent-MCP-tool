/**
 * LLM Query Parser
 *
 * Converts a natural language research question into structured parameters
 * for MCP tool invocation. Replaces keyword-based tool selection and
 * clarification logic when an LLM is available.
 */

import { LLMClient } from "./llm-client";
import { ToolName } from "./tool-selector";

export interface ParsedQuery {
  /** Terse, tool-friendly search string (e.g. "cluster headache elderly men") */
  searchTerms: string;
  /** Tools to invoke, in spec order */
  toolsNeeded: ToolName[];
  /** Human-readable explanation of tool choices */
  toolReasoning: string;
  /** Optional PubMed date filter, e.g. "2023/01/01"[PDAT] : "3000"[PDAT] */
  dateFilter?: string;
  /** True when the question is too vague for reliable retrieval */
  clarificationNeeded: boolean;
  /** Question to ask the user when clarification is needed */
  clarificationQuestion?: string;
}

const SYSTEM_PROMPT = `You are a query parser for a pharmaceutical research assistant.
Your job is to convert a researcher's natural language question into structured search parameters.

Always respond with valid JSON matching this exact shape:
{
  "searchTerms": "<terse PubMed/ClinicalTrials-friendly search string>",
  "toolsNeeded": ["pubmed-search"] | ["pubmed-search","clinicaltrials-search"] | ["web-fetch"],
  "toolReasoning": "<one sentence explaining tool choice>",
  "dateFilter": "<optional: ISO date range for PubMed, e.g. '2023/01/01[PDAT]:3000[PDAT]' — omit if not specified>",
  "clarificationNeeded": false,
  "clarificationQuestion": null
}

Tool selection rules (in priority order):
- "pubmed-search": always include for any biomedical, clinical, or pharmacological question
- "clinicaltrials-search": add when the question mentions trials, phases, recruiting, endpoints, NCT, or asks about ongoing/registered studies
- Never include "web-fetch" — it is not available for query-based searches

If the question is too vague to retrieve meaningful evidence (e.g. a single generic word, no condition or intervention mentioned), set clarificationNeeded to true and provide a clarificationQuestion.`;

export async function parseQuery(
  question: string,
  llm: LLMClient,
  history?: import("./types").ConversationTurn[]
): Promise<ParsedQuery> {
  // Build context string from prior turns so the LLM can resolve follow-ups
  const historyContext = history && history.length > 0
    ? "\n\nPrior conversation:\n" +
      history.map((t) => `${t.role === "user" ? "Researcher" : "Assistant"}: ${t.content}`).join("\n")
    : "";

  const raw = await llm.chat(SYSTEM_PROMPT, question + historyContext);

  // Strip markdown code fences if the model wraps output
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  let parsed: ParsedQuery;
  try {
    parsed = JSON.parse(json) as ParsedQuery;
  } catch {
    throw new Error(`LLM query parser returned invalid JSON: ${raw}`);
  }

  // Validate required fields
  if (typeof parsed.searchTerms !== "string" || !parsed.searchTerms.trim()) {
    throw new Error("LLM query parser returned empty searchTerms");
  }
  if (!Array.isArray(parsed.toolsNeeded) || parsed.toolsNeeded.length === 0) {
    throw new Error("LLM query parser returned no toolsNeeded");
  }

  return parsed;
}
