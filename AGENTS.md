# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Local Explorer (Debugging & Inspection)

When running `npx wrangler dev`, a Local Explorer API is available for inspecting and debugging local Workers, bindings, and storage state. The API base URL is printed in the terminal when the dev server starts.

Key endpoints (relative to the dev server URL):

| Endpoint | Description |
|----------|-------------|
| `GET /cdn-cgi/local/explorer/api/local/workers` | List local Workers and their bindings |
| `GET /cdn-cgi/local/explorer/api/storage/kv/namespaces` | List KV namespaces |
| `GET /cdn-cgi/local/explorer/api/d1/database` | List D1 databases |
| `GET /cdn-cgi/local/explorer/api/r2/buckets` | List R2 buckets |
| `GET /cdn-cgi/local/explorer/api/workers/durable_objects/namespaces` | List Durable Object namespaces |
| `GET /cdn-cgi/local/explorer/api/workflows` | List Workflows |
| `POST /cdn-cgi/local/explorer/api/local/observability/query` | Run a read-only SQL query (SELECT/WITH only) over captured request traces and console logs. Tables: `spans`, `logs` (read attributes via `json(attributes)`). Example: `curl -X POST <base>/cdn-cgi/local/explorer/api/local/observability/query -H 'Content-Type: application/json' -d '{"sql":"SELECT service, name, outcome, duration_ms FROM spans WHERE parent_id IS NULL LIMIT 20"}'` |
| `POST /cdn-cgi/local/explorer/api/local/observability/clear` | Clear all captured traces and logs |

If the routes above don't cover what you need, fetch the full OpenAPI schema (large - use only as a last resort): `GET /cdn-cgi/local/explorer/api`

Use the Local Explorer to debug issues by inspecting storage state (KV keys, D1 rows, R2 objects, DO storage), viewing Worker bindings, and querying request traces and logs captured during the dev session.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

---

# Jobhunt project handbook

For AI coding agents working in this repo. A queryable code graph also
exists: start at `graphify-out/wiki/index.md`, or run
`graphify query "<question>"` / `graphify explain "<symbol>"` with the
graphify CLI (installed via `uv tool install graphifyy`).

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
