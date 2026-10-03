import type { FeedSource, NormalizedJob } from "../types";

interface GreenhouseJob {
  id: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  company_name?: string;
  first_published?: string;
  updated_at?: string;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

function toIso(d?: string): string | null {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.valueOf()) ? null : t.toISOString();
}

/**
 * Generic Greenhouse boards API adapter. Feed url IS the board API url, e.g.
 * https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=false
 * Only remote locations are kept; company falls back to the feed name.
 */
export async function fetchGreenhouseApi(source: FeedSource): Promise<NormalizedJob[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "Jobhunt/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Greenhouse API request failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as GreenhouseResponse;
  const board = (source.url.match(/\/boards\/([^/]+)\//) || [])[1] || "greenhouse";
  const raw = (data.jobs || []).filter(
    (j) => j.title && j.absolute_url && (j.location?.name || "").toLowerCase().includes("remote")
  );
  return raw.map((j) => ({
    id: `greenhouse-${board}:${j.id}`,
    title: j.title as string,
    company: j.company_name || source.name,
    description: null,
    url: j.absolute_url as string,
    location: j.location?.name || "Remote",
    employment_type: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    published_at: toIso(j.first_published) || toIso(j.updated_at),
  }));
}
