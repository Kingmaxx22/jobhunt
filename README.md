# Jobhunt

Personal remote-job aggregation and matching system on Cloudflare. It collects
remote jobs from multiple boards, normalizes and deduplicates them into D1,
scores them against your CV with Workers AI + Vectorize, and sends the good
ones to Telegram every hour.

```
RSS / API job sources
        ↓
Cloudflare Worker (hourly cron + HTTP API)
        ↓
Fetch + normalize → NormalizedJob
        ↓
Hard filters (remote-only, EN/ID language, profile prefs)
        ↓
D1 dedup + history (id / url / fingerprint)
        ↓
AI semantic match vs your CV (Vectorize + LLM explanation)
        ↓
Telegram alert (career + easy-entry lanes, Apply/Save/Skip feedback)
```

## Sources (10)

| Feed | Type |
|------|------|
| We Work Remotely (+ Programming) | RSS |
| Hacker News Jobs | RSS |
| Remotive, Remote OK, Jobicy, Himalayas, Arbeitnow | API |
| GitLab, Anthropic (Greenhouse boards API) | API |

Each source has its own adapter under `src/ingest/adapters/` that normalizes
into `NormalizedJob` (`src/ingest/types.ts`). The pipeline never contains
source-specific parsing.

## Prerequisites

- Node.js 18+, Wrangler (`npm i -g wrangler` or `npx wrangler`)
- Cloudflare account with Workers, D1, Workers AI, Vectorize
- A Telegram bot (via [@BotFather](https://t.me/BotFather))

## Setup

```powershell
npm install

# D1 + schema
npx wrangler d1 create jobhunt-db
npx wrangler d1 migrations apply jobhunt-db --remote

# Secrets (never commit these)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID   # message @YourBot, run POST /api/notify/test, or /start to learn it

# Deploy (cron runs hourly at :00 UTC)
npx wrangler deploy
```

`wrangler.jsonc` already wires D1 (`jobhunt_db`), Vectorize (`VECTORIZE` →
`jobhunt-index`) and Workers AI (`AI`). After changing bindings, regenerate
types:

```powershell
npx wrangler types
```

## Uploading your CV

Your profile lives in D1 (`candidate_profiles`), not in the repo.

1. Save your CV as plain text, e.g. `cv.txt` (outside git - `cv/` is ignored).
2. Run (PowerShell escapes quotes for you):

```powershell
$cv = (Get-Content -Raw .\cv.txt) -replace "'", "''"
"UPDATE candidate_profiles SET cv_text = '$cv', updated_at = CURRENT_TIMESTAMP WHERE id = 1;" | Set-Content .\update_cv.sql -Encoding UTF8
npx wrangler d1 execute jobhunt-db --remote --file .\update_cv.sql
Remove-Item .\update_cv.sql
```

3. Set matching preferences (all optional):

```powershell
npx wrangler d1 execute jobhunt-db --remote --command "UPDATE candidate_profiles SET preferences_json = '{\"remote_only\":true}' WHERE id = 1;"
```

Supported keys: `remote_only`, `min_salary`, `blocklist_keywords`,
`allow_locations`, `block_companies`, `employment_types`.

The matcher reads ~1500 chars of CV for the LLM explanation and embeds the
full text for Vectorize. One to two pages of real CV text works best.

## How matching works

- **Career lane** (threshold 0.55): vector similarity + LLM review with
  sections for why-it-matches, missing requirements, concerns, and
  transferable skills. Entry-level postings get +0.05 and a 🌱 tag.
- **Easy-entry lane** (threshold 0.40): data annotation/tagging,
  transcription, moderation, AI-training gigs, micro-tasks - low-barrier
  side-income work with gig-realistic explanations.
- Greenhouse postings ingested title-only get full descriptions fetched
  on demand (`content=true`) and cached in D1.
- Vectorize vector IDs are SHA-256 hashes of job IDs (Vectorize caps IDs at
  64 bytes, job URLs are longer) and every row carries `vector_id` for
  stable resolution.

## Telegram

- Alerts include title, company, location, salary, link, match %, and the
  AI explanation, plus inline **Apply / Save / Skip** buttons.
- Button taps are stored in `job_matches.user_feedback`. Companies you skip
  repeatedly get auto-deprioritized.
- Quiet scans send a heartbeat instead of silence:
  `🔍 Hourly scan complete — no suitable jobs` with fetch/match stats.
- Webhook: point your bot at `POST /api/telegram/webhook`
  (`/start` replies with the chat ID).

## API

| Method + path | Purpose |
|---|---|
| `GET /` | Health |
| `GET /api/feeds` | Feed list + fetch status |
| `POST /api/feeds` | Add a source `{slug, name, url, type}` - no code change |
| `POST /api/feeds/:id/sync` | Ingest one source |
| `POST /api/ingest` | Ingest all enabled sources |
| `GET /api/jobs` | Latest stored jobs |
| `POST /api/ai/match` | Run matching `{limit, threshold, easyThreshold, topK}` |
| `POST /api/notify/matches` | Flush pending matches to Telegram |
| `POST /api/notify/first-job` | Send latest job (connectivity test) |
| `POST /api/notify/test` | Test-message ping |
| `POST /api/notify/heartbeat` | Heartbeat on demand |
| `GET /api/feedback/stats` | Apply/save/skip counts |
| `POST /api/vectorize/backfill` | Backfill `vector_id` (200 rows/call) |
| `POST /api/cron/dry-run` | What the next tick would do (no side effects) |
| `GET /api/cron/runs` | Last 10 cron ticks with fetch/match/notify stats |

Manual full cycle:

```powershell
Invoke-RestMethod -Method Post -Uri "https://<worker>/api/ingest"
$body = @{ limit = 50 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://<worker>/api/ai/match" -ContentType "application/json" -Body $body
Invoke-RestMethod -Method Post -Uri "https://<worker>/api/notify/matches"
```

## Repo layout

```
src/
  index.ts            # routes + hourly scheduled() pipeline
  ingest/             # types, rss parser, filters, pipeline, per-source adapters
  ai/matching.ts      # embeddings, Vectorize query, LLM scoring, lanes
  notify/             # telegram sender/formatters, match flushing
migrations/           # D1 schema (applied in order)
test/                 # vitest specs (npx vitest run)
```

## Free-tier notes

- Ingestion is fetch + D1 batches (50 statements/batch).
- AI runs are bounded: 20-job embed batches, `topK` capped, LLM only for
  qualifying matches, Greenhouse enrichment max 10 postings/run and cached.
- Cron does ingest → match → notify inline; if a tick ever times out at
  higher feed counts, split per-feed work into Queues.

## Troubleshooting

- `No API adapter implemented for slug 'x'` right after deploy: edge still
  serving the previous version, retry in ~30s.
- `1101` on sync with a `D1_TYPE_ERROR`: a source changed a field shape
  (e.g. string → array); check `feeds.last_error`, the failing source never
  blocks the others.
- `VECTOR_UPSERT_ERROR: id too long`: fixed via hashed vector IDs; if you
  add a custom Vectorize integration, keep IDs ≤ 64 bytes.
- Quiet inbox: check `GET /api/cron/runs` - it shows per-tick
  fetched/inserted/matched/notified so you can tell "no new jobs" apart
  from "new jobs, no matches" apart from errors.
