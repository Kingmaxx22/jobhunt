import type { FeedSource, NormalizedJob } from "./types";
import { parseRss } from "./rss";
import { fetchRemotiveApi } from "./adapters/remotive";
import { fetchRemoteOkApi } from "./adapters/remoteok";
import { fetchJobicyApi } from "./adapters/jobicy";
import { fetchHimalayasApi } from "./adapters/himalayas";
import { fetchArbeitnowApi } from "./adapters/arbeitnow";
import { fetchGreenhouseApi } from "./adapters/greenhouse";

export async function fetchRss(source: FeedSource): Promise<NormalizedJob[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Jobhunt/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const jobs = parseRss(text);

  // If the source is Hacker News, company can often be parsed from the title
  // Example HN title: "Stable (YC W20) Is Hiring Product Engineers" -> company: "Stable", title: "Product Engineers"
  if (source.slug === "hackernews" || source.slug === "hn") {
    return jobs.map((job) => {
      const hnMatch = job.title.match(/^(.*?)(?:\s*\([^)]*\))?\s+(?:is hiring|hiring|Is Hiring)\s+(.*)$/i);
      if (hnMatch) {
        return {
          ...job,
          id: `hn:${job.id}`,
          company: hnMatch[1].trim(),
          title: hnMatch[2].trim(),
        };
      }
      return {
        ...job,
        id: `hn:${job.id}`,
      };
    });
  }

  return jobs;
}

export async function fetchSource(source: FeedSource): Promise<NormalizedJob[]> {
  switch (source.type) {
    case "rss":
      return fetchRss(source);
    case "api":
      if (source.slug === "remotive") {
        return fetchRemotiveApi(source);
      }
      if (source.slug === "remoteok") {
        return fetchRemoteOkApi(source);
      }
      if (source.slug === "jobicy") {
        return fetchJobicyApi(source);
      }
      if (source.slug === "himalayas") {
        return fetchHimalayasApi(source);
      }
      if (source.slug === "arbeitnow") {
        return fetchArbeitnowApi(source);
      }
      if (source.slug === "greenhouse" || source.slug.startsWith("greenhouse-")) {
        return fetchGreenhouseApi(source);
      }
      throw new Error(`No API adapter implemented for source slug '${source.slug}'`);
    default:
      throw new Error(`Unsupported source type: ${(source as FeedSource).type}`);
  }
}
