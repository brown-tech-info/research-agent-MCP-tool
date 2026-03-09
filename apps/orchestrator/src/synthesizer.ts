/**
 * Synthesis Engine — Spec Sections 10.5, 11
 *
 * Transforms raw MCP tool outputs into a structured research response
 * following Spec Section 11.2 (Standard Response Structure).
 *
 * Rules enforced:
 * - Citations attached at the point of each claim (Spec 11.3)
 * - Disagreement, uncertainty, and limitations preserved (Spec 10.5)
 * - Conservative, scientific language (Spec 11.5)
 * - Explicit uncertainty signaling (Spec 11.6)
 * - Web sources never misrepresented as peer-reviewed (Spec 9.3)
 */

import { ResearchResponse, EvidenceSource, Reference } from "./types";
import { ToolSelection } from "./tool-selector";
import { ToolInvocationResult } from "./mcp-types";

// ---------------------------------------------------------------------------
// Internal types mirroring server output shapes (structural compatibility)
// ---------------------------------------------------------------------------

interface PubMedPublication {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  abstract: string;
  url: string;
  publicationTypes: string[];
}

interface PubMedSearchResult {
  query: string;
  totalFound: number;
  results: PubMedPublication[];
}

interface ClinicalTrial {
  nctId: string;
  title: string;
  phase: string[];
  status: string;
  sponsor: string;
  eligibilityCriteria: string;
  primaryEndpoints: string[];
  secondaryEndpoints: string[];
  url: string;
  resultsAvailable: boolean;
}

interface TrialSearchResult {
  query: string;
  totalFound: number;
  results: ClinicalTrial[];
}

interface WebSource {
  url: string;
  content: string;
  retrievedAt: string;
  isWebSource: true;
}

interface WebFetchResult {
  source: WebSource;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isPubMedResult(data: unknown): data is PubMedSearchResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "totalFound" in data &&
    "results" in data &&
    Array.isArray((data as PubMedSearchResult).results)
  );
}

function isTrialResult(data: unknown): data is TrialSearchResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "totalFound" in data &&
    "results" in data &&
    Array.isArray((data as TrialSearchResult).results) &&
    ((data as TrialSearchResult).results.length === 0 ||
      "nctId" in (data as TrialSearchResult).results[0])
  );
}

function isWebResult(data: unknown): data is WebFetchResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    typeof (data as WebFetchResult).source === "object" &&
    (data as WebFetchResult).source?.isWebSource === true
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function formatPhase(phase: string[]): string {
  return phase.length > 0 ? phase.join(", ") : "Not specified";
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

interface CollectedEvidence {
  publications: PubMedPublication[];
  trials: ClinicalTrial[];
  webSources: WebSource[];
  pubMedTotalFound: number;
  trialsTotalFound: number;
}

function collectEvidence(
  toolResults: Array<{ toolName: string; result: ToolInvocationResult }>
): CollectedEvidence {
  const evidence: CollectedEvidence = {
    publications: [],
    trials: [],
    webSources: [],
    pubMedTotalFound: 0,
    trialsTotalFound: 0,
  };

  for (const { toolName, result } of toolResults) {
    if (!result.success || result.data === undefined) continue;

    // Use toolName as the primary discriminator — type guards alone are
    // insufficient because PubMed and ClinicalTrials share the same
    // { totalFound, results } envelope shape.
    if (toolName === "pubmed-search" && isPubMedResult(result.data)) {
      evidence.pubMedTotalFound = result.data.totalFound;
      evidence.publications = result.data.results;
    } else if (toolName === "clinicaltrials-search" && isTrialResult(result.data)) {
      evidence.trialsTotalFound = result.data.totalFound;
      evidence.trials = result.data.results;
    } else if (toolName === "web-fetch" && isWebResult(result.data)) {
      evidence.webSources.push(result.data.source);
    }
  }

  return evidence;
}

function buildSummary(
  question: string,
  ev: CollectedEvidence,
  selection: ToolSelection
): string {
  const parts: string[] = [];

  if (ev.pubMedTotalFound > 0) {
    parts.push(
      `${ev.pubMedTotalFound} peer-reviewed publication${ev.pubMedTotalFound !== 1 ? "s" : ""} identified in PubMed`
    );
  } else if (selection.tools.some((t) => t.name === "pubmed-search")) {
    parts.push("No peer-reviewed publications identified in PubMed");
  }

  if (ev.trialsTotalFound > 0) {
    parts.push(
      `${ev.trialsTotalFound} registered clinical trial${ev.trialsTotalFound !== 1 ? "s" : ""} identified in ClinicalTrials.gov`
    );
  } else if (selection.tools.some((t) => t.name === "clinicaltrials-search")) {
    parts.push("No registered clinical trials identified in ClinicalTrials.gov");
  }

  if (ev.webSources.length > 0) {
    parts.push(
      `${ev.webSources.length} web source${ev.webSources.length !== 1 ? "s" : ""} retrieved`
    );
  }

  if (parts.length === 0) {
    return `No evidence was identified for the query: "${question}". Evidence is limited — no data returned by any invoked tool.`;
  }

  return `Evidence retrieval for "${question}": ${parts.join("; ")}.`;
}

function buildEvidenceOverview(ev: CollectedEvidence): EvidenceSource[] {
  const sources: EvidenceSource[] = [];

  for (const pub of ev.publications) {
    sources.push({
      type: "pubmed",
      description: `${pub.title} — ${formatAuthors(pub.authors)} (${pub.journal}, ${pub.year})`,
      identifier: `PMID:${pub.pmid}`,
    });
  }

  for (const trial of ev.trials) {
    sources.push({
      type: "clinicaltrials",
      description: `${trial.title} — Phase: ${formatPhase(trial.phase)}, Status: ${trial.status}, Sponsor: ${trial.sponsor}`,
      identifier: trial.nctId,
    });
  }

  for (const web of ev.webSources) {
    sources.push({
      type: "web",
      description: `Web source retrieved at ${web.retrievedAt} [NOT peer-reviewed]`,
      identifier: web.url,
    });
  }

  return sources;
}

function buildSynthesis(ev: CollectedEvidence): string {
  if (
    ev.publications.length === 0 &&
    ev.trials.length === 0 &&
    ev.webSources.length === 0
  ) {
    return "No evidence was retrieved. Synthesis is not possible without source data. Evidence is limited — no data identified.";
  }

  const sections: string[] = [];

  if (ev.publications.length > 0) {
    const pubLines = ev.publications.map((pub, i) => {
      const ref = `[${i + 1}]`;
      const types =
        pub.publicationTypes.length > 0
          ? ` [${pub.publicationTypes.join(", ")}]`
          : "";
      return (
        `${ref} ${pub.title}. ${formatAuthors(pub.authors)}. ` +
        `${pub.journal} (${pub.year})${types}. [PMID:${pub.pmid}]`
      );
    });

    sections.push(
      `**Publications (PubMed)**\n` +
        `The following peer-reviewed publications were identified ${ev.publications.length < ev.pubMedTotalFound ? `(${ev.publications.length} of ${ev.pubMedTotalFound} total) ` : ""}and are presented without editorial modification:\n\n` +
        pubLines.join("\n")
    );
  }

  if (ev.trials.length > 0) {
    const trialLines = ev.trials.map((trial) => {
      const resultsNote = trial.resultsAvailable
        ? "Results available in registry."
        : "Results not yet available in registry.";
      const endpoints =
        trial.primaryEndpoints.length > 0
          ? `Primary endpoint(s): ${trial.primaryEndpoints.slice(0, 2).join("; ")}.`
          : "No endpoints recorded.";

      return (
        `[${trial.nctId}] ${trial.title}. ` +
        `Phase: ${formatPhase(trial.phase)}. Status: ${trial.status}. ` +
        `Sponsor: ${trial.sponsor}. ${endpoints} ${resultsNote}`
      );
    });

    sections.push(
      `**Clinical Trials (ClinicalTrials.gov)**\n` +
        `The following registered trials were identified ${ev.trials.length < ev.trialsTotalFound ? `(${ev.trials.length} of ${ev.trialsTotalFound} total) ` : ""}. ` +
        `Trial status and outcomes reflect registry data only — no outcomes are inferred:\n\n` +
        trialLines.join("\n")
    );
  }

  if (ev.webSources.length > 0) {
    const webLines = ev.webSources.map(
      (s) =>
        `[WEB] ${s.url} (retrieved: ${s.retrievedAt}). ` +
        `Note: this is a web source and is NOT peer-reviewed.`
    );

    sections.push(
      `**Web Sources**\n` +
        `The following web sources were retrieved. These are supplementary only and must not be treated as peer-reviewed evidence:\n\n` +
        webLines.join("\n")
    );
  }

  return sections.join("\n\n");
}

function buildConfidenceAndGaps(
  ev: CollectedEvidence,
  selection: ToolSelection
): string {
  const lines: string[] = [];

  // Publication confidence
  if (ev.pubMedTotalFound === 0 && selection.tools.some((t) => t.name === "pubmed-search")) {
    lines.push("No peer-reviewed publications were identified.");
  } else if (ev.pubMedTotalFound > 0 && ev.publications.length < ev.pubMedTotalFound) {
    lines.push(
      `Evidence is limited to ${ev.publications.length} of ${ev.pubMedTotalFound} total publications returned by PubMed. ` +
        `Additional publications exist and may contain relevant information.`
    );
  } else if (ev.publications.length > 0) {
    lines.push(
      `${ev.publications.length} publication${ev.publications.length !== 1 ? "s" : ""} identified. ` +
        `Evidence quality and relevance should be independently assessed.`
    );
  }

  // Trial confidence
  if (ev.trialsTotalFound === 0 && selection.tools.some((t) => t.name === "clinicaltrials-search")) {
    lines.push("No registered clinical trials were identified.");
  } else if (ev.trials.length > 0) {
    const noResults = ev.trials.filter((t) => !t.resultsAvailable).length;
    if (noResults > 0) {
      lines.push(
        `${noResults} of ${ev.trials.length} identified trial${ev.trials.length !== 1 ? "s" : ""} ` +
          `do not yet have results published in the registry. Outcomes cannot be inferred.`
      );
    }
  }

  // Web source caveats
  if (ev.webSources.length > 0) {
    lines.push(
      "Web sources are not peer-reviewed. Information from web sources should be independently verified."
    );
  }

  // General gaps
  if (ev.publications.length === 0 && ev.trials.length === 0 && ev.webSources.length === 0) {
    lines.push(
      "Evidence is limited — no data was identified across all invoked tools. " +
        "Consider refining the search query or broadening the scope."
    );
  }

  return lines.length > 0 ? lines.join(" ") : "Evidence retrieved; confidence and gaps assessed above.";
}

function buildReferences(ev: CollectedEvidence): Reference[] {
  const refs: Reference[] = [];
  let idx = 1;

  for (const pub of ev.publications) {
    refs.push({
      id: String(idx++),
      citation: `${formatAuthors(pub.authors)}. "${pub.title}." ${pub.journal} (${pub.year}). PMID:${pub.pmid}.`,
      url: pub.url,
    });
  }

  for (const trial of ev.trials) {
    refs.push({
      id: trial.nctId,
      citation: `${trial.title}. Phase: ${formatPhase(trial.phase)}. Status: ${trial.status}. Sponsor: ${trial.sponsor}. ClinicalTrials.gov identifier: ${trial.nctId}.`,
      url: trial.url,
    });
  }

  for (const web of ev.webSources) {
    refs.push({
      id: String(idx++),
      citation: `[Web source] ${web.url}. Retrieved: ${web.retrievedAt}. Note: not peer-reviewed.`,
      url: web.url,
    });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesize a structured research response from tool invocation results.
 *
 * Follows Spec Section 11.2 (Summary, Evidence Overview, Synthesis,
 * Confidence & Gaps, References) with citations attached per claim (Spec 11.3).
 *
 * This function is deterministic and traceable — every claim in the output
 * can be traced to a specific tool result.
 */
export function synthesize(
  question: string,
  selection: ToolSelection,
  toolResults: Array<{ toolName: string; result: ToolInvocationResult }>
): ResearchResponse {
  const ev = collectEvidence(toolResults);

  return {
    summary: buildSummary(question, ev, selection),
    evidenceOverview: buildEvidenceOverview(ev),
    synthesisAndInterpretation: buildSynthesis(ev),
    confidenceAndGaps: buildConfidenceAndGaps(ev, selection),
    references: buildReferences(ev),
  };
}
