import type { NormalizedJob } from "../ingest/types";

export interface CandidateProfile {
  id: number;
  name: string;
  cv_text: string;
  preferences_json: string | null;
  active: number;
}

export interface JobMatch {
  job_id: string;
  profile_id: number;
  match_score: number;
  match_explanation: string | null;
  notified: number;
  user_feedback: string | null;
}

/**
 * Helper to get active candidate profiles from D1
 */
export async function getActiveProfiles(db: D1Database): Promise<CandidateProfile[]> {
  const { results } = await db.prepare("SELECT * FROM candidate_profiles WHERE active = 1").all<CandidateProfile>();
  return results || [];
}

/** Vectorize vector ids are capped at 64 bytes; job ids are URLs, so hash them. */
export async function vectorIdFor(jobId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jobId));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const ENTRY_RE = /\b(intern(ship|s)?|junior|entry[- ]level|associate|graduate|trainee|apprentice|fresher|no experience|0[-–]1 years?|students? welcome)\b/i;
const EASY_RE = /\b(data annotat|data label|data tag|image label|captioning|transcri|data entry|content moderat|search evaluat|ai train(er|ing)|website rater|quality rater|micro[- ]?task|survey (taker|participant)|data collect|prompt (writ|evaluat))|human data\b/i;

export function isEntryLevel(job: NormalizedJob): boolean {
  return ENTRY_RE.test(`${job.title} ${job.description || ""}`);
}

export function isEasyGig(job: NormalizedJob): boolean {
  return EASY_RE.test(`${job.title} ${job.description || ""}`);
}

/**
 * Fetch full Greenhouse descriptions for jobs ingested with content=false.
 * Cached back into D1 so each posting is fetched at most once. Bounded per run.
 */
export async function enrichGreenhouseDescriptions(
  db: D1Database,
  jobs: NormalizedJob[],
  limit = 10
): Promise<number> {
  let enriched = 0;
  for (const job of jobs) {
    if (enriched >= limit) break;
    if (job.description || !job.id.startsWith("greenhouse-")) continue;
    const m = job.id.match(/^greenhouse-([^:]+):(.+)$/);
    if (!m) continue;
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?questions=false`,
        {
          headers: { "User-Agent": "Jobhunt/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!res.ok) continue;
      const detail = (await res.json()) as { contents?: string };
      const text = (detail.contents || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      job.description = text.substring(0, 4000);
      await db.prepare("UPDATE jobs SET description = ? WHERE id = ?").bind(job.description, job.id).run();
      enriched += 1;
    } catch {
      // best effort: title-only matching still works
    }
  }
  return enriched;
}

/**
 * Process new jobs by generating embeddings, matching against candidate preferences, and scoring with AI
 */
export async function processAiMatching(
  db: D1Database,
  ai: Ai,
  index: VectorizeIndex,
  jobs: NormalizedJob[],
  profiles: CandidateProfile[],
  opts?: { threshold?: number; easyThreshold?: number; topK?: number }
): Promise<{
  inserted: number;
  insertedCareer: number;
  insertedEasy: number;
  enriched: number;
  topScores: { job_id: string; title: string; score: number }[];
}> {
  const threshold = opts?.threshold ?? 0.55;
  const easyThreshold = opts?.easyThreshold ?? 0.4;
  const topK = opts?.topK ?? 30;
  const out = {
    inserted: 0,
    insertedCareer: 0,
    insertedEasy: 0,
    enriched: 0,
    topScores: [] as { job_id: string; title: string; score: number }[],
  };
  if (jobs.length === 0 || profiles.length === 0) return out;

  // Full descriptions for title-only Greenhouse postings (cached in D1).
  out.enriched = await enrichGreenhouseDescriptions(db, jobs);

  const BATCH_SIZE = 20;

  const jobText = (job: NormalizedJob) =>
    [
      job.title,
      `Company: ${job.company || "Unknown"}`,
      `Location: ${job.location || "Remote"}`,
      job.employment_type ? `Type: ${job.employment_type}` : "",
      job.salary_min || job.salary_max
        ? `Salary: ${job.salary_min ?? "?"}-${job.salary_max ?? "?"} ${job.salary_currency ?? ""}`
        : "",
      `Description: ${(job.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`,
    ]
      .filter(Boolean)
      .join("\n")
      .substring(0, 2000);

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    const textsToEmbed = batch.map(jobText);

    const embedded = await ai.run("@cf/baai/bge-base-en-v1.5", {
      text: textsToEmbed,
    });

    const data = (embedded as { shape: number[]; data: number[][] }).data;
    (out as any).debug = { ...(out as any).debug, jobVecDim: data[0]?.length, batches: (((out as any).debug?.batches) || 0) + 1 };

    const vectors = await Promise.all(
      batch.map(async (job, idx) => ({
        id: await vectorIdFor(job.id),
        values: data[idx],
        metadata: {
          job_id: job.id,
          title: job.title,
          company: job.company || "Unknown",
        },
      }))
    );

    if (vectors.length > 0) {
      await index.upsert(vectors);
      // Backfill vector_id for rows ingested before the column existed.
      const backfill = vectors.map((v) =>
        db
          .prepare("UPDATE jobs SET vector_id = ? WHERE id = ? AND vector_id IS NULL")
          .bind(v.id, (v.metadata as { job_id: string }).job_id)
      );
      await db.batch(backfill);
    }
  }

  for (const profile of profiles) {
    const cvEmbedding = await ai.run("@cf/baai/bge-base-en-v1.5", {
      text: [profile.cv_text],
    });

    const cvData = (cvEmbedding as { shape: number[]; data: number[][] }).data;
    (out as any).debug = {
      ...(out as any).debug,
      cvIsArray: Array.isArray(cvData?.[0]),
      cvDim: Array.isArray(cvData?.[0]) ? (cvData[0] as number[]).length : typeof cvData?.[0],
    };

    // Map hashed vector ids back to jobs for this run (plus metadata fallback).
    const byVectorId = new Map<string, NormalizedJob>();
    for (const j of jobs) byVectorId.set(await vectorIdFor(j.id), j);

    const matches = await index.query(cvData[0], { topK, returnMetadata: true });

    // Resolve a vector match to a job: same-run map, then vector metadata,
    // then the D1 vector_id backstop (covers vectors upserted before metadata existed).
    const resolveJob = async (match: { id: string; metadata?: unknown }): Promise<NormalizedJob | undefined> => {
      const metaJobId = (match.metadata as { job_id?: string } | undefined)?.job_id;
      const hit = byVectorId.get(match.id) ?? (metaJobId ? jobs.find((j) => j.id === metaJobId) : undefined);
      if (hit) return hit;
      try {
        const row = await db
          .prepare("SELECT id, title, company, description, url, location, employment_type, salary_min, salary_max, salary_currency, published_at FROM jobs WHERE vector_id = ?")
          .bind(match.id)
          .first<NormalizedJob>();
        return row ?? undefined;
      } catch {
        return undefined;
      }
    };

    // Diagnostic: top scores regardless of threshold (returned to caller, not stored).
    for (const match of matches.matches) {
      const jr = await resolveJob(match);
      out.topScores.push({ job_id: jr?.id ?? match.id, title: jr?.title ?? "(stale vector)", score: match.score });
    }
    out.topScores.sort((a, b) => b.score - a.score);

    for (const match of matches.matches) {
      const score = match.score;
      const jobRecord = await resolveJob(match);
      if (!jobRecord) continue;

      // Two lanes: career fit (threshold 0.55) and easy-entry gigs (threshold 0.4).
      // Entry-level postings get a small bonus so juniors/interns aren't filtered out.
      const easy = isEasyGig(jobRecord);
      const entry = isEntryLevel(jobRecord);
      const effective = Math.min(1, score + (!easy && entry ? 0.05 : 0));
      const laneThreshold = easy ? easyThreshold : threshold;
      if (effective <= laneThreshold) continue;
      const lane = easy ? "easy" : "career";

      let explanation = "";
      try {
        const prefs = profile.preferences_json || "none";
        const evalResult = await ai.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            {
              role: "system",
              content: easy
                ? "You assess easy-entry gig work (data tagging, annotation, transcription, micro-tasks). Note the low barrier, pay/time realism, and fit. Keep under 700 chars."
                : "You are a pragmatic job matcher. Score fit honestly. Do not reject for one missing keyword; weigh transferable skills. Favor junior/intern-friendly roles for this early-career candidate. Keep under 900 chars with sections: Why it matches / Missing requirements / Concerns (location, seniority, salary, type) / Transferable skills.",
            },
            {
              role: "user",
              content: `Candidate CV: ${profile.cv_text.substring(0, 1500)}\nPreferences: ${prefs}\nJob: ${jobText(jobRecord)}`,
            },
          ],
        });
        explanation = (evalResult as { response: string }).response || "";
        if (explanation.length > 1000) explanation = explanation.substring(0, 1000);
      } catch (err) {
        explanation = "Matched via vector similarity.";
      }
      if (entry && !easy) explanation = "🌱 Entry-level friendly. " + explanation;

      const ins = await db.prepare(
        `INSERT OR IGNORE INTO job_matches (job_id, profile_id, match_score, match_explanation, lane)
          VALUES (?, ?, ?, ?, ?)`
      ).bind(jobRecord.id, profile.id, effective, explanation, lane).run();
      if ((ins.meta as any)?.changes > 0) {
        out.inserted += 1;
        if (lane === "easy") out.insertedEasy += 1;
        else out.insertedCareer += 1;
      }
    }
  }
  return out;
}
