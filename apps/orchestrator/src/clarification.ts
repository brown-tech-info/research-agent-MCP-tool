/**
 * Clarification Logic — Spec Section 10.4
 *
 * Determines whether a research question requires clarification before
 * tool invocation. Clarification is requested only when ambiguity would
 * materially affect evidence retrieval.
 *
 * Per Spec 10.4: clarifying questions must be minimal, explicit,
 * and clearly tied to evidence retrieval.
 */

export interface ClarificationRequest {
  needed: true;
  /** Why clarification is needed */
  reason: string;
  /** A specific, minimal question for the user */
  suggestion: string;
}

export interface NoClarificationNeeded {
  needed: false;
}

export type ClarificationResult = ClarificationRequest | NoClarificationNeeded;

// Single-word generic terms that are too broad for targeted evidence retrieval
const OVERLY_GENERIC_SINGLE_TERMS = new Set<string>([
  "cancer",
  "disease",
  "drug",
  "treatment",
  "therapy",
  "medicine",
  "research",
  "study",
  "trial",
  "patient",
  "health",
  "protein",
  "gene",
  "cell",
  "virus",
  "bacteria",
  "infection",
  "tumor",
  "tumour",
]);

/**
 * Determine whether a research question needs clarification before tool invocation.
 *
 * Returns a ClarificationRequest (needed: true) when:
 * - The query is too brief to retrieve meaningful evidence
 * - The query is a single overly generic term
 * - The query contains only generic terms with no specificity
 *
 * Returns NoClarificationNeeded (needed: false) when the query is specific
 * enough for evidence retrieval to proceed.
 */
export function checkClarificationNeeded(question: string): ClarificationResult {
  const trimmed = question.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Empty or missing question
  if (words.length === 0) {
    return {
      needed: true,
      reason: "No research question was provided.",
      suggestion:
        "Please enter a research question — for example, a drug name, mechanism, disease area, or clinical question.",
    };
  }

  // Single-word query
  if (words.length === 1) {
    const term = words[0].toLowerCase();
    if (OVERLY_GENERIC_SINGLE_TERMS.has(term)) {
      return {
        needed: true,
        reason: `"${trimmed}" is too broad to retrieve focused evidence.`,
        suggestion:
          "Could you specify a particular aspect — for example, a drug name, gene target, disease subtype, or patient population?",
      };
    }
    // Single specific term (e.g., "pembrolizumab") is acceptable
    return { needed: false };
  }

  // Two-word query where both terms are generic
  if (
    words.length === 2 &&
    OVERLY_GENERIC_SINGLE_TERMS.has(words[0].toLowerCase()) &&
    OVERLY_GENERIC_SINGLE_TERMS.has(words[1].toLowerCase())
  ) {
    return {
      needed: true,
      reason: "The query contains only generic terms and lacks specificity.",
      suggestion:
        "Please specify a more precise research question — for example, a named drug, mechanism of action, or condition with context.",
    };
  }

  return { needed: false };
}
