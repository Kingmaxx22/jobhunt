export interface NormalizedJob {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  published_at: string | null;
}

export interface FeedSource {
  id: number;
  slug: string;
  name: string;
  url: string;
  type: "rss" | "api";
  enabled: number;
  config: string | null;
  last_fetched_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
}

export interface IngestSourceResult {
  sourceId: number;
  slug: string;
  name: string;
  fetched: number;
  inserted: number;
  filtered?: number;
  error?: string;
}

export interface IngestRunSummary {
  timestamp: string;
  totalFetched: number;
  totalInserted: number;
  totalFiltered?: number;
  sources: IngestSourceResult[];
}
