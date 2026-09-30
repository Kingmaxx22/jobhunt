import type { FeedSource, NormalizedJob } from "../types";

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
}

export async function fetchRemoteOkApi(source: FeedSource): Promise<NormalizedJob[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Jobhunt/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Remote OK API request failed: ${response.status} ${response.statusText}`);
  }

  const items = (await response.json()) as (RemoteOkJob | { legal?: string })[];

  // Remote OK first element is usually a legal notice object without an `id` or `position`
  const jobs = items.filter(
    (item): item is RemoteOkJob => "position" in item && Boolean(item.position)
  );

  return jobs.map((item) => {
    const rawId = item.id ? String(item.id) : item.slug;
    const jobUrl = item.url || item.apply_url || (item.slug ? `https://remoteok.com/remote-jobs/${item.slug}` : "");

    return {
      id: `remoteok:${rawId || jobUrl}`,
      title: item.position ?? "Untitled",
      company: item.company || null,
      description: item.description || null,
      url: jobUrl,
      location: item.location || "Worldwide",
      employment_type: null,
      salary_min: typeof item.salary_min === "number" && item.salary_min > 0 ? item.salary_min : null,
      salary_max: typeof item.salary_max === "number" && item.salary_max > 0 ? item.salary_max : null,
      salary_currency: item.salary_min || item.salary_max ? "USD" : null,
      published_at: item.date
        ? new Date(item.date).toISOString()
        : item.epoch
        ? new Date(item.epoch * 1000).toISOString()
        : null,
    };
  });
}
