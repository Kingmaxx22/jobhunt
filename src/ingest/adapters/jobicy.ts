import type { FeedSource, NormalizedJob } from "../types";

interface JobicyJob {
  id: number | string;
  url: string;
  jobSlug?: string;
  jobTitle?: string;
  companyName?: string;
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

function toIso(d?: string): string | null {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.valueOf()) ? null : t.toISOString();
}

export async function fetchJobicyApi(source: FeedSource): Promise<NormalizedJob[]> {
  const url = source.url.includes("count=")
    ? source.url
    : `${source.url}${source.url.includes("?") ? "&" : "?"}count=50`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Jobhunt/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jobicy API request failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as JobicyResponse;
  const raw = data.jobs || [];
  return raw
    .filter((j) => j.jobTitle && j.url)
    .map((j) => ({
      id: `jobicy:${j.id}`,
      title: j.jobTitle as string,
      company: j.companyName || null,
      description: j.jobDescription || j.jobExcerpt || null,
      url: j.url,
      location: j.jobGeo || null,
      employment_type: j.jobType?.[0] || null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      published_at: toIso(j.pubDate),
    }));
}
