import type { MCPTool, ClinicalTrial, TrialSearchInputs, TrialSearchResult } from "./types.js";

interface CTStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    designModule?: { phases?: string[] };
    eligibilityModule?: { eligibilityCriteria?: string };
    outcomesModule?: {
      primaryOutcomes?: Array<{ measure?: string }>;
      secondaryOutcomes?: Array<{ measure?: string }>;
    };
  };
  resultsSection?: unknown;
}

interface CTApiResponse {
  totalCount?: number;
  studies?: CTStudy[];
}

function mapStudyToTrial(study: CTStudy): ClinicalTrial {
  const proto = study.protocolSection ?? {};
  const id = proto.identificationModule ?? {};
  const status = proto.statusModule ?? {};
  const sponsor = proto.sponsorCollaboratorsModule ?? {};
  const design = proto.designModule ?? {};
  const eligibility = proto.eligibilityModule ?? {};
  const outcomes = proto.outcomesModule ?? {};

  const nctId = id.nctId ?? "";

  return {
    nctId,
    title: id.briefTitle ?? "",
    status: status.overallStatus ?? "UNKNOWN",
    sponsor: sponsor.leadSponsor?.name ?? "",
    phase: design.phases ?? [],
    eligibilityCriteria: eligibility.eligibilityCriteria ?? "",
    primaryEndpoints: (outcomes.primaryOutcomes ?? []).map((o) => o.measure ?? "").filter(Boolean),
    secondaryEndpoints: (outcomes.secondaryOutcomes ?? []).map((o) => o.measure ?? "").filter(Boolean),
    url: `https://clinicaltrials.gov/study/${nctId}`,
    resultsAvailable: study.resultsSection !== undefined && study.resultsSection !== null,
  };
}

export class ClinicalTrialsSearchTool implements MCPTool {
  readonly name = "clinicaltrials-search";

  async execute(inputs: Record<string, unknown>): Promise<TrialSearchResult> {
    const { query, condition, intervention, phase, status, maxResults = 10 } =
      inputs as unknown as TrialSearchInputs;

    if (!query || typeof query !== "string" || query.trim() === "") {
      throw new Error("ClinicalTrials search requires a non-empty query string");
    }

    const pageSize = typeof maxResults === "number" && maxResults > 0 ? maxResults : 10;

    let url =
      `https://clinicaltrials.gov/api/v2/studies` +
      `?query.term=${encodeURIComponent(query.trim())}` +
      `&pageSize=${pageSize}` +
      `&format=json`;

    if (condition) url += `&query.cond=${encodeURIComponent(condition)}`;
    if (intervention) url += `&query.intr=${encodeURIComponent(intervention)}`;
    if (phase) url += `&filter.phase=${encodeURIComponent(phase)}`;
    if (status) url += `&filter.overallStatus=${encodeURIComponent(status)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ClinicalTrials search failed: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    }

    const data = (await response.json()) as CTApiResponse;
    const studies = data.studies ?? [];

    return {
      query,
      totalFound: data.totalCount ?? studies.length,
      results: studies.map(mapStudyToTrial),
    };
  }
}
