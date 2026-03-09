import type { MCPTool, PubMedPublication, PubMedSearchResult } from "./types.js";

const ESEARCH_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const EFETCH_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

function mapSummaryEntry(uid: string, entry: Record<string, unknown>): PubMedPublication {
  const authors = Array.isArray(entry["authors"])
    ? (entry["authors"] as Array<Record<string, unknown>>).map((a) =>
        typeof a["name"] === "string" ? a["name"] : ""
      )
    : [];

  const publicationTypes = Array.isArray(entry["pubtype"])
    ? (entry["pubtype"] as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

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

/** Fetch abstracts for a batch of PMIDs via efetch (XML). Returns a map of PMID → abstract text. */
async function fetchAbstracts(pmids: string[]): Promise<Map<string, string>> {
  const url = `${EFETCH_BASE}?db=pubmed&id=${pmids.join(",")}&retmode=xml&rettype=abstract`;
  const res = await fetch(url);
  if (!res.ok) return new Map();

  const xml = await res.text();
  const abstracts = new Map<string, string>();

  // Extract PMID + AbstractText pairs using lightweight regex (no XML parser dependency)
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articleRegex.exec(xml)) !== null) {
    const articleXml = articleMatch[1] ?? "";

    const pmidMatch = /<PMID[^>]*>(\d+)<\/PMID>/.exec(articleXml);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1] ?? "";

    // Collect all AbstractText sections (some articles have structured abstracts with labels)
    const abstractParts: string[] = [];
    const abstractRegex = /<AbstractText(?:[^>]*Label="([^"]*)"[^>]*)?>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]*>)*[^<]*)<\/AbstractText>/g;
    let absMatch: RegExpExecArray | null;
    while ((absMatch = abstractRegex.exec(articleXml)) !== null) {
      const label = absMatch[1];
      // Strip any inner XML tags from text
      const text = (absMatch[2] ?? "").replace(/<[^>]+>/g, "").trim();
      if (text) abstractParts.push(label ? `${label}: ${text}` : text);
    }

    if (abstractParts.length > 0) {
      abstracts.set(pmid, abstractParts.join(" "));
    }
  }

  return abstracts;
}

export class PubMedSearchTool implements MCPTool {
  readonly name = "pubmed-search";

  async execute(inputs: Record<string, unknown>): Promise<PubMedSearchResult> {
    const query = inputs["query"];
    if (typeof query !== "string" || query.trim() === "") {
      throw new Error("query is required and must be a non-empty string");
    }

    const maxResults = typeof inputs["maxResults"] === "number" ? inputs["maxResults"] : 20;

    const esearchUrl =
      `${ESEARCH_BASE}?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}`;

    const esearchRes = await fetch(esearchUrl);
    if (!esearchRes.ok) {
      throw new Error(`PubMed search failed: HTTP ${esearchRes.status}`);
    }

    const esearchData = (await esearchRes.json()) as Record<string, unknown>;
    const esearchResult = esearchData["esearchresult"] as Record<string, unknown> | undefined;
    const idList = Array.isArray(esearchResult?.["idlist"])
      ? (esearchResult["idlist"] as unknown[]).filter((id): id is string => typeof id === "string")
      : [];

    if (idList.length === 0) {
      return { query, totalFound: 0, results: [] };
    }

    const esummaryUrl = `${ESUMMARY_BASE}?db=pubmed&id=${idList.join(",")}&retmode=json`;
    const esummaryRes = await fetch(esummaryUrl);
    if (!esummaryRes.ok) {
      throw new Error(`PubMed summary fetch failed: HTTP ${esummaryRes.status}`);
    }

    const esummaryData = (await esummaryRes.json()) as Record<string, unknown>;
    const summaryResult = esummaryData["result"] as Record<string, unknown> | undefined;

    const publications: PubMedPublication[] = idList
      .map((uid) => {
        const entry = summaryResult?.[uid];
        if (!entry || typeof entry !== "object") return null;
        return mapSummaryEntry(uid, entry as Record<string, unknown>);
      })
      .filter((p): p is PubMedPublication => p !== null);

    // Fetch abstracts in parallel with a single efetch call
    const abstracts = await fetchAbstracts(idList);
    for (const pub of publications) {
      const abstract = abstracts.get(pub.pmid);
      if (abstract) pub.abstract = abstract;
    }

    const totalFound =
      typeof esearchResult?.["count"] === "string"
        ? parseInt(esearchResult["count"], 10)
        : publications.length;

    return { query, totalFound: isNaN(totalFound) ? publications.length : totalFound, results: publications };
  }
}
