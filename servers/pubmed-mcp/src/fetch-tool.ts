import type { MCPTool, PubMedPublication, PubMedFetchResult } from "./types.js";

const ESUMMARY_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

function mapSummaryEntry(uid: string, entry: Record<string, unknown>): PubMedPublication {
  const authors = Array.isArray(entry["authors"])
    ? (entry["authors"] as Array<Record<string, unknown>>).map((a) =>
        typeof a["name"] === "string" ? a["name"] : ""
      )
    : [];

  const publicationTypes = Array.isArray(entry["pubtype"])
    ? (entry["pubtype"] as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  // Abstract is not available from esummary; a separate efetch call would be needed
  return {
    pmid: uid,
    title: typeof entry["title"] === "string" ? entry["title"] : "",
    authors,
    journal: typeof entry["source"] === "string" ? entry["source"] : "",
    year: typeof entry["pubdate"] === "string" ? entry["pubdate"].split(" ")[0] ?? "" : "",
    abstract: "",
    url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    publicationTypes,
  };
}

export class PubMedFetchTool implements MCPTool {
  readonly name = "pubmed-fetch";

  async execute(inputs: Record<string, unknown>): Promise<PubMedFetchResult> {
    const pmid = inputs["pmid"];
    if (typeof pmid !== "string" || pmid.trim() === "") {
      throw new Error("pmid is required and must be a non-empty string");
    }

    const esummaryUrl = `${ESUMMARY_BASE}?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=json`;
    const res = await fetch(esummaryUrl);
    if (!res.ok) {
      throw new Error(`PubMed fetch failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const result = data["result"] as Record<string, unknown> | undefined;
    const entry = result?.[pmid];

    // NCBI returns an error object or omits the key when the PMID is unknown
    if (!entry || typeof entry !== "object" || (entry as Record<string, unknown>)["error"]) {
      return { publication: null, found: false };
    }

    const publication = mapSummaryEntry(pmid, entry as Record<string, unknown>);
    return { publication, found: true };
  }
}
