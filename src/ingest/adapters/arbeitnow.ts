import type { FeedSource, NormalizedJob } from "../types";

interface ArbeitnowJob {
  slug: string;
  title?: string;
  company_name?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  tags?: string | string[];
  job_types?: string | string[];
  created_at?: number;
  description?: string;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
}

function toIso(epoch?: number): string | null {
  if (!epoch) return null;
  const t = new Date(epoch * 1000);
  return isNaN(t.valueOf()) ? null : t.toISOString();
}

/** Arbeitnow is mostly on-site; Jobhunt only keeps remote=true listings. */
export async function fetchArbeitnowApi(source: FeedSource): Promise<NormalizedJob[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "Jobhunt/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Arbeitnow API request failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as ArbeitnowResponse;
  const raw = (data.data || []).filter((j) => j.remote === true && j.title && j.slug);
  return raw.map((j) => ({
    id: `arbeitnow:${j.slug}`,
    title: j.title as string,
    company: j.company_name || null,
    description: j.description || null,
    url: j.url || `https://www.arbeitnow.com/jobs/${j.slug}`,
    location: j.location || "Remote",
    employment_type: Array.isArray(j.job_types) ? j.job_types.join(", ") : j.job_types || null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    published_at: toIso(j.created_at),
  }));
}
