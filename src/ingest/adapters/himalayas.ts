import type { FeedSource, NormalizedJob } from "../types";

interface HimalayasJob {
  guid?: string;
  title?: string;
  excerpt?: string;
  description?: string;
  companyName?: string;
  employmentType?: string;
  applicationLink?: string;
  pubDate?: number | string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  locationRestrictions?: string[];
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
}

function toIso(d: number | string | undefined): string | null {
  if (d === undefined || d === null) return null;
  const t = typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return isNaN(t.valueOf()) ? null : t.toISOString();
}

export async function fetchHimalayasApi(source: FeedSource): Promise<NormalizedJob[]> {
  const url = source.url.includes("limit=")
    ? source.url
    : `${source.url}${source.url.includes("?") ? "&" : "?"}limit=20`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Jobhunt/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Himalayas API request failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as HimalayasResponse;
  const raw = data.jobs || [];
  return raw
    .filter((j) => j.title && (j.applicationLink || j.guid))
    .map((j) => {
      const link = j.applicationLink || j.guid as string;
      return {
        id: `himalayas:${j.guid || link}`,
        title: j.title as string,
        company: j.companyName || null,
        description: j.description || j.excerpt || null,
        url: link,
        location:
          j.locationRestrictions && j.locationRestrictions.length > 0
            ? j.locationRestrictions.join(", ")
            : "Remote",
        employment_type: j.employmentType || null,
        salary_min: typeof j.minSalary === "number" ? j.minSalary : null,
        salary_max: typeof j.maxSalary === "number" ? j.maxSalary : null,
        salary_currency: j.currency || null,
        published_at: toIso(j.pubDate),
      };
    });
}
