import { fetchSource } from "./ingest/sources";
import { runIngestion } from "./ingest/pipeline";
import { sendTelegramMessage, formatJobMessage } from "./notify/telegram";
import { flushPendingMatches } from "./notify/matches";
import { getActiveProfiles, processAiMatching } from "./ai/matching";

interface Env {
  jobhunt_db: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

function composeHeartbeat(
  fetched: number,
  inserted: number,
  filtered: number,
  matchedCareer: number,
  matchedEasy: number,
  failedSources: string[]
): string {
  return (
    `🔍 <b>Hourly scan complete — no suitable jobs</b>\n\n` +
    `📥 Fetched: ${fetched} | New: ${inserted} | Filtered: ${filtered}\n` +
    `🤖 New matches: ${matchedCareer} career, ${matchedEasy} easy-entry\n` +
    (failedSources.length > 0 ? `⚠️ Source errors: ${failedSources.join(", ")}\n` : ``) +
    `Next scan at the top of the next hour.`
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({ name: "Jobhunt", status: "ok" });
    }

    if (url.pathname === "/api/feeds") {
      const result = await env.jobhunt_db
        .prepare(
          "SELECT id, slug, name, url, type, enabled, last_fetched_at, last_success_at, last_error FROM feeds ORDER BY id"
        )
        .all();
      return Response.json({ feeds: result.results });
    }

    if (url.pathname === "/api/jobs") {
      const result = await env.jobhunt_db
        .prepare(
          "SELECT id, feed_id, title, company, location, employment_type, salary_min, salary_max, salary_currency, url, published_at, discovered_at FROM jobs ORDER BY published_at DESC LIMIT 50"
        )
        .all();
      return Response.json({ count: result.results.length, jobs: result.results });
    }

    if (url.pathname === "/api/test-rss") {
      const source = {
        id: 1,
        slug: "weworkremotely",
        name: "We Work Remotely",
        url: "https://weworkremotely.com/remote-jobs.rss",
        type: "rss" as const,
        enabled: 1,
        config: null,
      };
      const jobs = await fetchSource(source);
      return Response.json({ source: source.name, count: jobs.length, jobs: jobs.slice(0, 5) });
    }

    // Trigger full ingestion or single feed ingestion:
    // POST /api/ingest
    // POST /api/feeds/:id/sync
    const syncMatch = url.pathname.match(/^\/api\/feeds\/(\d+)\/sync$/);
    if (request.method === "POST" && (url.pathname === "/api/ingest" || syncMatch)) {
      const sourceId = syncMatch ? parseInt(syncMatch[1], 10) : undefined;
      const summary = await runIngestion(env.jobhunt_db, sourceId);
      
      // If we inserted new jobs, we can run the AI matching immediately
      // Real-time API response will be slow if we block, so we use ctx.waitUntil if available in standard fetch,
      // but here we just return the summary for manual trigger.
      return Response.json(summary);
    }

    // Temporary Endpoint to run AI analysis manually (accepts {threshold, topK, limit})
    if (request.method === "POST" && url.pathname === "/api/ai/match") {
      const body = (await request.json().catch(() => ({}))) as { threshold?: number; easyThreshold?: number; topK?: number; limit?: number };
      const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);
      const { results: recentJobs } = await env.jobhunt_db
         .prepare("SELECT * FROM jobs ORDER BY published_at DESC LIMIT ?")
         .bind(limit)
         .all();

      const profiles = await getActiveProfiles(env.jobhunt_db);

      try {
        // @ts-ignore
        const diag = await processAiMatching(env.jobhunt_db, env.AI, env.VECTORIZE, recentJobs, profiles, {
          threshold: body.threshold,
          easyThreshold: body.easyThreshold,
          topK: body.topK,
        });
        return Response.json({ status: "done", processed_jobs: recentJobs.length, active_profiles: profiles.length, ...diag });
      } catch (err) {
        console.error("[/api/ai/match] failed:", err instanceof Error ? err.stack || err.message : String(err));
        return Response.json(
          { status: "error", error: err instanceof Error ? err.message : String(err), processed_jobs: recentJobs.length, active_profiles: profiles.length },
          { status: 500 }
        );
      }
    }

    // Test Telegram notification endpoint:
    // POST /api/notify/test
    if (request.method === "POST" && url.pathname === "/api/notify/test") {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 400 });
      }

      let targetChatId = env.TELEGRAM_CHAT_ID;
      try {
        const body = (await request.json().catch(() => ({}))) as { chat_id?: string | number };
        if (body.chat_id) targetChatId = String(body.chat_id);
      } catch {
        // no body
      }

      if (!targetChatId) {
        return Response.json(
          {
            ok: false,
            error: "TELEGRAM_CHAT_ID is missing. Send a message to @kyzojobhuntbot on Telegram or provide { \"chat_id\": \"your_id\" } in the POST request body.",
          },
          { status: 400 }
        );
      }

      const message =
        `🚀 <b>Jobhunt Notification Test</b>\n\n` +
        `Your Telegram bot is successfully connected to Cloudflare Worker!\n\n` +
        `Ready for pipeline notifications and AI matches.`;

      const result = await sendTelegramMessage(token, targetChatId, message);
      return Response.json(result);
    }

    // Send first/latest job listing to Telegram:
    // POST /api/notify/first-job
    if (request.method === "POST" && url.pathname === "/api/notify/first-job") {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 400 });
      }
      let targetChatId = env.TELEGRAM_CHAT_ID;
      try {
        const body = (await request.json().catch(() => ({}))) as { chat_id?: string | number };
        if (body.chat_id) targetChatId = String(body.chat_id);
      } catch {
        // no body
      }
      if (!targetChatId) {
        return Response.json({ ok: false, error: "TELEGRAM_CHAT_ID is missing" }, { status: 400 });
      }

      const { results } = await env.jobhunt_db
        .prepare(
          "SELECT id, title, company, location, employment_type, salary_min, salary_max, salary_currency, url, published_at FROM jobs ORDER BY published_at DESC LIMIT 1"
        )
        .all<any>();
      const job = results?.[0];
      if (!job) {
        return Response.json({ ok: false, error: "No jobs in D1 yet. Run POST /api/ingest first." }, { status: 404 });
      }

      const message = formatJobMessage(job);

      const result = await sendTelegramMessage(token, targetChatId, message);
      if ((result as any).ok) {
        await env.jobhunt_db
          .prepare("UPDATE jobs SET sent_to_telegram = 1 WHERE id = ?")
          .bind(job.id)
          .run();
      }
      return Response.json({ ...result, job });
    }

    // Flush pending high-score AI matches to Telegram (manual cron trigger):
    // POST /api/notify/matches
    if (request.method === "POST" && url.pathname === "/api/notify/matches") {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 400 });
      }
      const targetChatId = env.TELEGRAM_CHAT_ID;
      if (!targetChatId) {
        return Response.json({ ok: false, error: "TELEGRAM_CHAT_ID is missing" }, { status: 400 });
      }
      const summary = await flushPendingMatches(env.jobhunt_db, token, targetChatId);
      return Response.json({ ok: true, ...summary });
    }

    // Telegram webhook handler endpoint (messages + Apply/Save/Skip buttons):
    // POST /api/telegram/webhook
    if (request.method === "POST" && url.pathname === "/api/telegram/webhook") {
      const update = (await request.json().catch(() => ({}))) as any;
      const token = env.TELEGRAM_BOT_TOKEN;
      if (token && update.callback_query) {
        const cb = update.callback_query;
        const m = String(cb.data || "").match(/^fb:(\d+):(apply|save|skip)$/);
        if (m) {
          const { answerTelegramCallback } = await import("./notify/telegram");
          await env.jobhunt_db
            .prepare("UPDATE job_matches SET user_feedback = ? WHERE id = ?")
            .bind(m[2], Number(m[1]))
            .run();
          await answerTelegramCallback(token, cb.id, m[2] === "apply" ? "Marked: Apply 🎯" : m[2] === "save" ? "Saved 💾" : "Skipped ⏭");
        } else {
          const { answerTelegramCallback } = await import("./notify/telegram");
          await answerTelegramCallback(token, cb.id, "Unknown action");
        }
        return Response.json({ ok: true });
      }
      if (update.message?.chat?.id) {
        const chatId = update.message.chat.id;
        const text = update.message.text || "";

        if (token) {
          if (text.startsWith("/start")) {
            await sendTelegramMessage(
              token,
              chatId,
              `👋 Hello! Welcome to <b>Jobhunt</b>.\n\nYour Chat ID is: <code>${chatId}</code>\n\nSave this Chat ID to configure your automated job alerts! (Run \`echo ${chatId} | npx wrangler secret put TELEGRAM_CHAT_ID\`)`
            );
          }
        }
      }
      return Response.json({ ok: true });
    }

    // Generic source adder (no ingestion rewrite needed):
    // POST /api/feeds { slug, name, url, type: rss|api }
    if (request.method === "POST" && url.pathname === "/api/feeds") {
      const body = (await request.json().catch(() => ({}))) as any;
      const { slug, name, url: feedUrl, type } = body;
      if (!slug || !name || !feedUrl || (type !== "rss" && type !== "api")) {
        return Response.json(
          { ok: false, error: "Need { slug, name, url, type: 'rss'|'api' }" },
          { status: 400 }
        );
      }
      try {
        await env.jobhunt_db
          .prepare("INSERT INTO feeds (slug, name, url, type, enabled) VALUES (?, ?, ?, ?, 1)")
          .bind(String(slug).toLowerCase().trim(), name, feedUrl, type)
          .run();
        return Response.json({ ok: true, slug });
      } catch (err) {
        return Response.json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          { status: 400 }
        );
      }
    }

    // Feedback stats (learning loop visibility):
    // GET /api/feedback/stats
    if (request.method === "GET" && url.pathname === "/api/feedback/stats") {
      const { results } = await env.jobhunt_db
        .prepare("SELECT user_feedback as feedback, COUNT(*) as n FROM job_matches WHERE user_feedback IS NOT NULL GROUP BY user_feedback")
        .all<{ feedback: string; n: number }>();
      return Response.json({ stats: results || [] });
    }

    // Cron dry-run (no sends, no inserts):
    // POST /api/cron/dry-run
    if (request.method === "POST" && url.pathname === "/api/cron/dry-run") {
      const { results: feeds } = await env.jobhunt_db
        .prepare("SELECT COUNT(*) as n FROM feeds WHERE enabled = 1")
        .all<{ n: number }>();
      const { results: pending } = await env.jobhunt_db
        .prepare("SELECT COUNT(*) as n FROM job_matches WHERE notified = 0 AND match_score >= 0.4")
        .all<{ n: number }>();
      const { results: recent } = await env.jobhunt_db
        .prepare("SELECT COUNT(*) as n FROM jobs WHERE discovered_at > datetime('now', '-60 minutes')")
        .all<{ n: number }>();
      const log = {
        timestamp: new Date().toISOString(),
        cron: "0 * * * *",
        enabled_feeds: feeds?.[0]?.n ?? 0,
        jobs_last_60m: recent?.[0]?.n ?? 0,
        pending_matches: pending?.[0]?.n ?? 0,
        telegram_configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        would_ingest: true,
        would_match: (recent?.[0]?.n ?? 0) > 0,
        would_notify: (pending?.[0]?.n ?? 0) > 0,
      };
      console.log(`[Cron dry-run] ${JSON.stringify(log)}`);
      return Response.json(log);
    }

    // Manual heartbeat (same composition the cron sends):
    // POST /api/notify/heartbeat
    if (request.method === "POST" && url.pathname === "/api/notify/heartbeat") {
      const token = env.TELEGRAM_BOT_TOKEN;
      const targetChatId = env.TELEGRAM_CHAT_ID;
      if (!token || !targetChatId) {
        return Response.json({ ok: false, error: "Telegram not configured" }, { status: 400 });
      }
      const { results: last } = await env.jobhunt_db
        .prepare("SELECT * FROM cron_runs ORDER BY id DESC LIMIT 1")
        .all<any>();
      const r = last?.[0];
      const hb = composeHeartbeat(
        r?.fetched ?? 0, r?.inserted ?? 0, r?.filtered ?? 0,
        r?.matched_career ?? 0, r?.matched_easy ?? 0, []
      );
      const result = await sendTelegramMessage(token, targetChatId, hb);
      return Response.json(result);
    }

    // One-off: backfill vector_id for rows ingested before the column existed.
    // POST /api/vectorize/backfill
    if (request.method === "POST" && url.pathname === "/api/vectorize/backfill") {
      const { vectorIdFor: hashJob } = await import("./ai/matching");
      const { results } = await env.jobhunt_db
        .prepare("SELECT id FROM jobs WHERE vector_id IS NULL LIMIT 200")
        .all<{ id: string }>();
      const rows = results || [];
      if (rows.length > 0) {
        const stmts = await Promise.all(
          rows.map(async (r) =>
            env.jobhunt_db.prepare("UPDATE jobs SET vector_id = ? WHERE id = ?").bind(await hashJob(r.id), r.id)
          )
        );
        await env.jobhunt_db.batch(stmts);
      }
      const { results: left } = await env.jobhunt_db
        .prepare("SELECT COUNT(*) as n FROM jobs WHERE vector_id IS NULL")
        .all<{ n: number }>();
      return Response.json({ backfilled: rows.length, remaining: left?.[0]?.n ?? 0 });
    }

    // Cron run history (why did/didn't messages send?):
    // GET /api/cron/runs
    if (request.method === "GET" && url.pathname === "/api/cron/runs") {
      const { results } = await env.jobhunt_db
        .prepare("SELECT * FROM cron_runs ORDER BY id DESC LIMIT 10")
        .all();
      return Response.json({ runs: results || [] });
    }

    return new Response("Not Found", { status: 404 });
  },

  // @ts-ignore
  async scheduled(event: any, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron] Scheduled ingestion triggered...`);
    ctx.waitUntil(
      (async () => {
        const startedAt = new Date().toISOString();
        const run = await env.jobhunt_db
          .prepare("INSERT INTO cron_runs (started_at) VALUES (?)")
          .bind(startedAt)
          .run();
        const runId = run.meta.last_row_id;
        const finish = (patch: Record<string, unknown>) =>
          env.jobhunt_db
            .prepare(
              `UPDATE cron_runs SET finished_at = ?, fetched = ?, inserted = ?, filtered = ?,
               matched_career = ?, matched_easy = ?, notified = ?, error = ?,
               heartbeat_sent = ?, heartbeat_error = ? WHERE id = ?`
            )
            .bind(
              new Date().toISOString(),
              patch.fetched ?? 0,
              patch.inserted ?? 0,
              patch.filtered ?? 0,
              patch.matchedCareer ?? 0,
              patch.matchedEasy ?? 0,
              patch.notified ?? 0,
              (patch.error as string) ?? null,
              patch.heartbeatSent ?? 0,
              (patch.heartbeatError as string) ?? null,
              runId
            )
            .run()
            .catch(() => undefined);

        try {
          const summary = await runIngestion(env.jobhunt_db);
          console.log(
            `[Cron] Ingestion finished. Fetched: ${summary.totalFetched}, Inserted: ${summary.totalInserted}`
          );

          let matchedCareer = 0;
          let matchedEasy = 0;
          // AI matching only makes sense with fresh inserts, but notify flush
          // must run every tick so backlog is never stranded.
          if (summary.totalInserted > 0) {
            const queryTime = new Date(Date.now() - 60 * 60000).toISOString(); // hourly cron window
            const { results: newJobs } = await env.jobhunt_db
               .prepare("SELECT * FROM jobs WHERE discovered_at > ?")
               .bind(queryTime)
               .all();

            const profiles = await getActiveProfiles(env.jobhunt_db);
            if (profiles.length > 0 && newJobs.length > 0) {
              // @ts-ignore
              const diag = await processAiMatching(env.jobhunt_db, env.AI, env.VECTORIZE, newJobs, profiles);
              matchedCareer = diag.insertedCareer || 0;
              matchedEasy = diag.insertedEasy || 0;
            }
          } else {
            console.log(`[Cron] No new jobs; skipping AI matching, still flushing notify backlog.`);
          }

          let notified = 0;
          let heartbeatSent = 0;
          let heartbeatError: string | null = null;
          if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
            const flushed = await flushPendingMatches(
              env.jobhunt_db,
              env.TELEGRAM_BOT_TOKEN,
              env.TELEGRAM_CHAT_ID
            );
            notified = flushed.sent;
            console.log(
              `[Cron] Notify flush. Checked: ${flushed.checked}, Sent: ${flushed.sent}, Failed: ${flushed.failed}, Skipped: ${flushed.skipped || 0}`
            );

          // Heartbeat: if nothing qualified, say so instead of staying silent.
          if (notified === 0) {
            const failedSources = summary.sources.filter((s) => s.error).map((s) => s.slug);
            const hb = composeHeartbeat(summary.totalFetched, summary.totalInserted, summary.totalFiltered || 0, matchedCareer, matchedEasy, failedSources);
            try {
              const hbRes = (await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, hb)) as any;
              if (hbRes?.ok) heartbeatSent = 1;
              else heartbeatError = String(hbRes?.description || "send failed").slice(0, 300);
            } catch (hbErr) {
              heartbeatError = (hbErr instanceof Error ? hbErr.message : String(hbErr)).slice(0, 300);
              console.error(`[Cron] Heartbeat failed:`, heartbeatError);
            }
          }
          }
          await finish({
            fetched: summary.totalFetched,
            inserted: summary.totalInserted,
            filtered: summary.totalFiltered || 0,
            matchedCareer,
            matchedEasy,
            notified,
            heartbeatSent,
            heartbeatError,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Cron] Pipeline failed:`, msg);
          await finish({ error: msg.slice(0, 500) });
        }
      })()
    );
  },
};
