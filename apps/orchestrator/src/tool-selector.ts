/**
 * Tool Selection Rules — Spec Section 10.2 & 10.3
 *
 * Determines the minimum set of MCP tools required to answer a research question.
 * Tool order is always enforced: PubMed → ClinicalTrials.gov → Web Research.
 *
 * Per Spec 10.2: select only the minimum set required.
 * Per Spec 10.3: default order must be respected; deviation requires justification.
 * Per Spec 10.1: tool selection must be inspectable and explainable.
 */

export type ToolName = "pubmed-search" | "clinicaltrials-search" | "web-fetch" | "web-search";

export interface SelectedTool {
  /** MCP tool name to invoke */
  name: ToolName;
  /** Human-readable justification for why this tool was selected */
  justification: string;
}

export interface ToolSelection {
  /** Ordered list of tools to invoke (always in spec order) */
  tools: SelectedTool[];
  /** Explanation of ordering decisions */
  orderJustification: string;
}

// Terms indicating biomedical literature search is needed (PubMed)
const BIOMEDICAL_TERMS: readonly string[] = [
  "drug",
  "compound",
  "molecule",
  "inhibitor",
  "antibody",
  "protein",
  "gene",
  "mutation",
  "pathway",
  "mechanism",
  "target",
  "receptor",
  "enzyme",
  "cancer",
  "tumor",
  "tumour",
  "disease",
  "disorder",
  "syndrome",
  "therapy",
  "treatment",
  "efficacy",
  "pharmacology",
  "pharmacokinetics",
  "pharmacodynamics",
  "biomarker",
  "inflammation",
  "immune",
  "immunotherapy",
  "checkpoint",
  "expression",
  "signaling",
  "signalling",
  "cell",
  "tissue",
  "organ",
  "toxicity",
  "safety",
  "adverse",
  "dose",
  "literature",
  "publication",
  "evidence",
  "study",
  "research",
];

// Terms specifically indicating clinical trial data is needed (ClinicalTrials.gov)
const CLINICAL_TRIAL_TERMS: readonly string[] = [
  "trial",
  "clinical trial",
  "phase 1",
  "phase 2",
  "phase 3",
  "phase 4",
  "phase i",
  "phase ii",
  "phase iii",
  "phase iv",
  "nct",
  "randomized",
  "randomised",
  "placebo",
  "enrollment",
  "enrolment",
  "sponsor",
  "endpoint",
  "primary outcome",
  "secondary outcome",
  "arm",
  "cohort",
  "recruiting",
  "ongoing trial",
  "completed trial",
  "terminated trial",
];

// Terms indicating web research is useful (regulatory, guidelines, news)
const WEB_TERMS: readonly string[] = [
  "guideline",
  "guidelines",
  "fda",
  "ema",
  "regulatory",
  "approval",
  "approved",
  "label",
  "prescribing information",
  "news",
  "press release",
  "organization",
  "organisation",
  "website",
  "recent",
  "latest",
  "current",
];

function containsAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

/**
 * Select the minimum set of MCP tools required to answer a research question.
 *
 * Tools are always returned in spec-mandated order:
 * 1. PubMed (peer-reviewed evidence)
 * 2. ClinicalTrials.gov (trial data)
 * 3. Web Research (supplementary/regulatory context)
 *
 * Selection is based on keyword detection and is always explainable.
 */
export function selectTools(question: string): ToolSelection {
  const q = question.toLowerCase();
  const tools: SelectedTool[] = [];

  const needsPubMed = containsAny(q, BIOMEDICAL_TERMS);
  const needsTrials = containsAny(q, CLINICAL_TRIAL_TERMS);
  const needsWeb = containsAny(q, WEB_TERMS);

  // Step 1 — PubMed: for any biomedical or trial-related question
  // (trials queries also consult PubMed per default ordering)
  if (needsPubMed || needsTrials) {
    tools.push({
      name: "pubmed-search",
      justification: needsPubMed
        ? "Query contains biomedical terminology; peer-reviewed literature search required (Spec 10.3)."
        : "Clinical trial queries are preceded by PubMed search per default tool order (Spec 10.3).",
    });
  }

  // Step 2 — ClinicalTrials.gov: only when trial-specific terms present
  if (needsTrials) {
    tools.push({
      name: "clinicaltrials-search",
      justification:
        "Query contains clinical trial terminology; ClinicalTrials.gov registry consulted.",
    });
  }

  // Step 3 — Web: when regulatory/guideline context is explicitly needed,
  // or as fallback when no other tools were selected
  if (needsWeb || tools.length === 0) {
    tools.push({
      name: "web-fetch",
      justification: needsWeb
        ? "Query involves regulatory or guideline information; web research supplements peer-reviewed sources."
        : "No biomedical or trial terms detected; web research used as sole source. Note: results will not be peer-reviewed.",
    });
  }

  const orderJustification =
    tools.length > 1
      ? "Tools invoked in default spec order: PubMed → ClinicalTrials.gov → Web Research (Spec 10.3)."
      : "Single tool selected; ordering rule not applicable.";

  return { tools, orderJustification };
}
