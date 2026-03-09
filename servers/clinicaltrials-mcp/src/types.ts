export interface MCPTool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

export type TrialStatus =
  | "RECRUITING"
  | "COMPLETED"
  | "TERMINATED"
  | "WITHDRAWN"
  | "ACTIVE_NOT_RECRUITING"
  | "NOT_YET_RECRUITING"
  | "SUSPENDED"
  | "UNKNOWN";

export interface ClinicalTrial {
  nctId: string;
  title: string;
  phase: string[];
  status: TrialStatus | string;
  sponsor: string;
  eligibilityCriteria: string;
  primaryEndpoints: string[];
  secondaryEndpoints: string[];
  url: string;
  resultsAvailable: boolean;
}

export interface TrialSearchInputs {
  query: string;
  condition?: string;
  intervention?: string;
  phase?: string;
  status?: string;
  maxResults?: number;
}

export interface TrialSearchResult {
  query: string;
  totalFound: number;
  results: ClinicalTrial[];
}

export interface TrialFetchInputs {
  nctId: string;
}

export interface TrialFetchResult {
  trial: ClinicalTrial | null;
  found: boolean;
}
