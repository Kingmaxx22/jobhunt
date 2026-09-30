import type { FeedSource, NormalizedJob, IngestSourceResult, IngestRunSummary } from "./types";
import { fetchSource } from "./sources";
import { parsePrefs, passesAnyProfile, passesLanguage, type HardFilterPrefs } from "./filters";
import { vectorIdFor } from "../ai/matching";

const D1_BATCH_SIZE = 50;

/**
 * Normalizes URL by stripping tracking params and fragment for clean deduplication
 */
export function normalizeJobUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Generates a deduplication key from company and title when present.
 * Useful for cross-source matching (e.g. if the same job is posted to Remotive and WWR).
 */
export function generateJobFingerprint(company: string | null, title: string): string {
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normCompany = (company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normCompany}:${normTitle}`;
}

/**
 * Ingests jobs for a single feed source into D1.
 * Updates last_fetched_at, last_success_at, and last_error on the feeds table.
 */
export async function loadActiveFilterPrefs(db: D1Database): Promise<HardFilterPrefs[]> {
  try {
    const { results } = await db
      .prepare("SELECT preferences_json FROM candidate_profiles WHERE active = 1")
      .all<{ preferences_json: string | null }>();
    return (results || []).map((r) => parsePrefs(r.preferences_json));
  } catch {
    return [];
  }
}

export async function ingestSource(
  source: FeedSource,
  db: D1Database,
  filterPrefs?: HardFilterPrefs[]
): Promise<IngestSourceResult> {
  const now = new Date().toISOString();

  // Record fetch start timestamp
  await db
    .prepare("UPDATE feeds SET last_fetched_at = ? WHERE id = ?")
    .bind(now, source.id)
    .run();

  let jobs: NormalizedJob[];
  try {
    jobs = await fetchSource(source);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .prepare("UPDATE feeds SET last_error = ? WHERE id = ?")
      .bind(errorMessage, source.id)
      .run();

    return {
      sourceId: source.id,
      slug: source.slug,
      name: source.name,
      fetched: 0,
      inserted: 0,
      filtered: 0,
      error: errorMessage,
    };
  }

  let totalInserted = 0;
  let totalFiltered = 0;

  // Hard filters run before D1: global EN/ID language gate first,
  // then keep job if ANY active profile passes.
  let eligible: NormalizedJob[] = [];
  for (const job of jobs) {
    if (!job.title || !job.url) {
      totalFiltered += 1;
      continue;
    }
    if (!passesLanguage(job).pass) {
      totalFiltered += 1;
      continue;
    }
    if (filterPrefs && filterPrefs.length > 0 && !passesAnyProfile(job, filterPrefs).pass) {
      totalFiltered += 1;
      continue;
    }
    eligible.push(job);
  }

  if (eligible.length > 0) {
    // Process insertions in batches to stay well within D1 statement limits
    for (let i = 0; i < eligible.length; i += D1_BATCH_SIZE) {
      const batch = eligible.slice(i, i + D1_BATCH_SIZE);
      const vectorIds = await Promise.all(batch.map((job) => vectorIdFor(job.id)));
      const statements: D1PreparedStatement[] = batch.map((job, idx) => {
        const cleanUrl = normalizeJobUrl(job.url);
        const fingerprint = generateJobFingerprint(job.company, job.title);
        return db
          .prepare(
            `INSERT INTO jobs (
              id,
              feed_id,
              title,
              company,
              description,
              url,
              location,
              employment_type,
              salary_min,
              salary_max,
              salary_currency,
              published_at,
              fingerprint,
              vector_id
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM jobs WHERE id = ? OR url = ? OR (fingerprint IS NOT NULL AND fingerprint = ?)
            )`
          )
          .bind(
            job.id,
            source.id,
            job.title,
            job.company,
            job.description,
            cleanUrl,
            job.location,
            job.employment_type,
            job.salary_min,
            job.salary_max,
            job.salary_currency,
            job.published_at,
            fingerprint,
            vectorIds[idx],
            job.id,
            cleanUrl,
            fingerprint
          );
      });

      const batchResults = await db.batch(statements);
      for (const res of batchResults) {
        if (res.meta && typeof res.meta.changes === "number") {
          totalInserted += res.meta.changes;
        }
      }
    }
  }

  // Update success metadata and clear last_error
  await db
    .prepare("UPDATE feeds SET last_success_at = ?, last_error = NULL WHERE id = ?")
    .bind(now, source.id)
    .run();

  return {
    sourceId: source.id,
    slug: source.slug,
    name: source.name,
    fetched: jobs.length,
    inserted: totalInserted,
    filtered: totalFiltered,
  };
}

/**
 * Ingests all enabled feed sources or a specific source if sourceId is provided.
 */
export async function runIngestion(
  db: D1Database,
  sourceId?: number
): Promise<IngestRunSummary> {
  const query = sourceId
    ? "SELECT id, slug, name, url, type, enabled, config, last_fetched_at, last_success_at, last_error FROM feeds WHERE id = ?"
    : "SELECT id, slug, name, url, type, enabled, config, last_fetched_at, last_success_at, last_error FROM feeds WHERE enabled = 1";

  const stmt = db.prepare(query);
  const result = sourceId ? await stmt.bind(sourceId).all<FeedSource>() : await stmt.all<FeedSource>();

  const sources = result.results || [];
  const results: IngestSourceResult[] = [];
  const filterPrefs = await loadActiveFilterPrefs(db);

  for (const source of sources) {
    try {
      const res = await ingestSource(source, db, filterPrefs);
      results.push(res);
    } catch (err) {
      // One bad source must never kill the whole run.
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Ingest] source ${source.slug} crashed:`, errorMessage);
      try {
        await db
          .prepare("UPDATE feeds SET last_error = ? WHERE id = ?")
          .bind(errorMessage.slice(0, 500), source.id)
          .run();
      } catch {
        // ignore bookkeeping failure
      }
      results.push({
        sourceId: source.id,
        slug: source.slug,
        name: source.name,
        fetched: 0,
        inserted: 0,
        filtered: 0,
        error: errorMessage,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalFetched: results.reduce((sum, r) => sum + r.fetched, 0),
    totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
    totalFiltered: results.reduce((sum, r) => sum + (r.filtered || 0), 0),
    sources: results,
  };
}
