import type { MCPTool, ClinicalTrial, TrialFetchInputs, TrialFetchResult } from "./types.js";

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
    // resultsAvailable reflects only what is present in the registry response —
    // never inferred or assumed from status or other fields.
    resultsAvailable: study.resultsSection !== undefined && study.resultsSection !== null,
  };
}

export class ClinicalTrialsFetchTool implements MCPTool {
  readonly name = "clinicaltrials-fetch";

  async execute(inputs: Record<string, unknown>): Promise<TrialFetchResult> {
    const { nctId } = inputs as unknown as TrialFetchInputs;

    if (!nctId || typeof nctId !== "string" || nctId.trim() === "") {
      throw new Error("ClinicalTrials fetch requires a non-empty nctId string");
    }

    const url = `https://clinicaltrials.gov/api/v2/studies/${encodeURIComponent(nctId.trim())}?format=json`;
    const response = await fetch(url);

    if (response.status === 404) {
      return { trial: null, found: false };
    }

    if (!response.ok) {
      throw new Error(`ClinicalTrials fetch failed: HTTP ${response.status}`);
    }

    const study = (await response.json()) as CTStudy;

    return {
      trial: mapStudyToTrial(study),
      found: true,
    };
  }
}
