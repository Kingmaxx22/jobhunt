# agents.md — Jobhunt project handbook

For AI coding agents working in this repo. Toolchain rules live in
`AGENTS.md`; this file explains the project itself. A queryable code graph
also exists: start at `graphify-out/wiki/index.md`, or run
`graphify query "<question>"` / `graphify explain "<symbol>"` with the
graphify CLI.

## What this is

Personal remote-job hunter on Cloudflare: 10 job sources → Worker ingestion
→ D1 → Workers AI + Vectorize matching against one candidate profile →
Telegram alerts (hourly cron). See `README.md` for the user-facing guide.

## Architecture (data flow)

```
src/ingest/adapters/*.ts  per-source fetch  →  NormalizedJob
src/ingest/sources.ts     dispatcher (rss | api by slug)
src/ingest/rss.ts         Worker-safe RSS parser (no DOMParser!)
src/ingest/filters.ts     hard filters: profile prefs + EN/ID language gate
src/ingest/pipeline.ts    ingestSource/runIngestion, D1 insert + dedup
src/ai/matching.ts        embeddings → Vectorize → LLM scoring, 2 lanes
src/notify/telegram.ts    send + HTML formatters + feedback buttons
src/notify/matches.ts     flushPendingMatches (cron + manual share this)
src/index.ts              HTTP routes + scheduled() hourly pipeline
migrations/               D1 schema, applied in numeric order
```

Key tables: `feeds` (sources + fetch health), `jobs` (dedupe by
`id OR url OR fingerprint`, plus `vector_id`), `candidate_profiles` (CV +
`preferences_json`), `job_matches` (`lane` career|easy, `notified`,
`user_feedback`), `cron_runs` (per-tick observability).

## Conventions

- **PowerShell-first**: every command must run in Windows PowerShell.
  Prefer `Invoke-RestMethod` over curl. Never use `cd`; pass
  `-workdir`/`workdir` instead.
- **Incremental**: smallest diff that fixes the issue. Never rewrite modules.
- **No browser/Node-only APIs** in `src/`: no `DOMParser`, no `fs`/`path`.
  `AbortSignal.timeout()` is available — every outbound `fetch` MUST have
  one (a hanging source silently kills cron ticks; this happened Oct 2026).
- **Secrets**: only via Worker bindings/secrets (`TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`). Never in code, migrations, tests, or docs.
- **Personal data**: `cv/` and `*.pdf` are git-ignored. CV text lives in D1.

## Gotchas (learned the hard way)

1. **Vectorize vector IDs ≤ 64 bytes** — job IDs are URLs, so
   `vectorIdFor()` (SHA-256, 32 hex chars) is the vector ID; `jobs.vector_id`
   + vector `metadata.job_id` map back. Never use raw job IDs as vector IDs.
2. **Deploy propagation**: edge serves the previous version for ~30s after
   `wrangler deploy`. Sleep before verifying a fix.
3. **No silent cron**: `scheduled()` must record per-tick stats to
   `cron_runs` and send either matches or the heartbeat. Diagnose quiet
   inboxes via `GET /api/cron/runs` before touching code.
4. **Thresholds live in 3 places** — `matching.ts` defaults (career 0.55 /
   easy 0.40, topK 30), `matches.ts` flush floor (0.4), dry-run pending
   query in `index.ts`. Change them together.
5. **`/api/ai/match` scans recent-N by `published_at`**, cron scans
   `discovered_at` last 60m — different windows, different batches.
6. **Account ID is `de47bb2f91a4941b4a68a83940854eb6`** (double-b; old notes
   have a typo). If D1 commands 7403 once then work, it was transient.

## Common tasks

| Task | How |
|---|---|
| Add a source | New file in `adapters/` → slug branch in `sources.ts` → seed row migration → `POST /api/feeds/:id/sync` to verify (isolated; failures can't break other sources) |
| Tune matching | Thresholds (see #4), `ENTRY_RE`/`EASY_RE` in `matching.ts`, prefs keys in `filters.ts` (`remote_only`, `min_salary`, `blocklist_keywords`, `allow_locations`, `block_companies`, `employment_types`) |
| Debug "no messages" | `GET /api/cron/runs` → `GET /api/notify/matches` manual flush → `POST /api/ai/match` with diagnostics |
| After editing bindings | `npx wrangler types` |
| After code changes | `npx tsc --noEmit && npx vitest run` → deploy → wait 30s → hit the endpoint |
| Refresh code graph | `graphify update .` (no LLM needed); full rebuild `graphify extract . --code-only` |

## Verification endpoints (prod)

`GET /api/feeds` (source health) · `GET /api/cron/runs` (tick history) ·
`GET /api/feedback/stats` · `POST /api/cron/dry-run` (no side effects).
