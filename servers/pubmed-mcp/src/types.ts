export interface MCPTool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<unknown>;
}

export interface PubMedSearchInputs {
  query: string;
  maxResults?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface PubMedPublication {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  abstract: string;
  url: string;
  publicationTypes: string[];
}

export interface PubMedSearchResult {
  query: string;
  totalFound: number;
  results: PubMedPublication[];
}

export interface PubMedFetchInputs {
  pmid: string;
}

export interface PubMedFetchResult {
  publication: PubMedPublication | null;
  found: boolean;
}
