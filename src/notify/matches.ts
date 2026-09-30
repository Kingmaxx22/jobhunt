import { sendTelegramMessage, formatMatchMessage, matchFeedbackKeyboard } from "./telegram";

export interface PendingMatchRow {
  match_id: number;
  job_id: string;
  match_score: number;
  match_explanation: string | null;
  lane: string | null;
  profile_name: string | null;
  title: string;
  company: string | null;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  url: string;
  published_at: string | null;
}

export interface FlushSummary {
  checked: number;
  sent: number;
  failed: number;
  skipped?: number;
  errors: string[];
}

/** Companies the user repeatedly skipped -> deprioritize (simple learning loop). */
export async function getSkippedCompanies(db: D1Database, minSkips = 2): Promise<Set<string>> {
  try {
    const { results } = await db
      .prepare(
        `SELECT LOWER(j.company) as c, COUNT(*) as n FROM job_matches m
         JOIN jobs j ON m.job_id = j.id
         WHERE m.user_feedback = 'skip' AND j.company IS NOT NULL
         GROUP BY LOWER(j.company) HAVING n >= ?`
      )
      .bind(minSkips)
      .all<{ c: string; n: number }>();
    return new Set((results || []).map((r) => r.c));
  } catch {
    return new Set();
  }
}

/**
 * Shared cron + manual sender: picks unnotified high-score matches,
 * sends each with the shared match format, marks notified on success.
 * One failing send never blocks the rest.
 */
export async function flushPendingMatches(
  db: D1Database,
  token: string,
  chatId: string | number,
  opts?: { minScore?: number; limit?: number }
): Promise<FlushSummary> {
  const minScore = opts?.minScore ?? 0.4;
  const limit = opts?.limit ?? 5;

  const { results } = await db
    .prepare(
      `
      SELECT m.id as match_id, m.job_id, m.match_score, m.match_explanation, m.lane,
             p.name as profile_name,
             j.title, j.company, j.location, j.employment_type,
             j.salary_min, j.salary_max, j.salary_currency, j.url, j.published_at
      FROM job_matches m
      JOIN jobs j ON m.job_id = j.id
      LEFT JOIN candidate_profiles p ON m.profile_id = p.id
      WHERE m.notified = 0 AND m.match_score >= ?
      ORDER BY m.match_score DESC
      LIMIT ?
      `
    )
    .bind(minScore, limit)
    .all<PendingMatchRow>();

  const pending = results || [];
  const summary: FlushSummary = { checked: pending.length, sent: 0, failed: 0, skipped: 0, errors: [] };
  const blocked = await getSkippedCompanies(db);

  for (const m of pending) {
    // Learning loop: auto-skip (mark notified, don't send) repeatedly-skipped companies.
    if (m.company && blocked.has(m.company.toLowerCase())) {
      await db.prepare("UPDATE job_matches SET notified = 1 WHERE id = ?").bind(m.match_id).run();
      summary.skipped = (summary.skipped || 0) + 1;
      continue;
    }
    try {
      const message = formatMatchMessage(m);
      const res = await sendTelegramMessage(token, chatId, message, {
        reply_markup: matchFeedbackKeyboard(m.match_id),
      });
      if ((res as any).ok) {
        await db.prepare("UPDATE job_matches SET notified = 1 WHERE id = ?").bind(m.match_id).run();
        await db.prepare("UPDATE jobs SET sent_to_telegram = 1 WHERE id = ?").bind(m.job_id).run();
        summary.sent += 1;
      } else {
        summary.failed += 1;
        summary.errors.push(`match ${m.match_id}: ${(res as any).description || "send failed"}`);
      }
    } catch (err) {
      summary.failed += 1;
      summary.errors.push(`match ${m.match_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
