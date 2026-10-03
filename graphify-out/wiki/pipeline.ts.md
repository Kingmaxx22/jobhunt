# pipeline.ts

> 90 nodes · cohesion 0.05

## Key Concepts

- **pipeline.ts** (21 connections) — `src/ingest/pipeline.ts`
- **sources.ts** (21 connections) — `src/ingest/sources.ts`
- **index.ts** (18 connections) — `src/index.ts`
- **telegram.ts** (15 connections) — `src/notify/telegram.ts`
- **types.ts** (14 connections) — `src/ingest/types.ts`
- **matching.ts** (13 connections) — `src/ai/matching.ts`
- **fetch()** (12 connections) — `src/index.ts`
- **fetchSource()** (12 connections) — `src/ingest/sources.ts`
- **NormalizedJob** (11 connections) — `src/ingest/types.ts`
- **filters.ts** (10 connections) — `src/ingest/filters.ts`
- **FeedSource** (9 connections) — `src/ingest/types.ts`
- **matches.ts** (9 connections) — `src/notify/matches.ts`
- **processAiMatching()** (8 connections) — `src/ai/matching.ts`
- **arbeitnow.ts** (8 connections) — `src/ingest/adapters/arbeitnow.ts`
- **greenhouse.ts** (8 connections) — `src/ingest/adapters/greenhouse.ts`
- **himalayas.ts** (8 connections) — `src/ingest/adapters/himalayas.ts`
- **jobicy.ts** (8 connections) — `src/ingest/adapters/jobicy.ts`
- **remotive.ts** (8 connections) — `src/ingest/adapters/remotive.ts`
- **ingestSource()** (8 connections) — `src/ingest/pipeline.ts`
- **flushPendingMatches()** (8 connections) — `src/notify/matches.ts`
- **scheduled()** (7 connections) — `src/index.ts`
- **rss.ts** (7 connections) — `src/ingest/rss.ts`
- **remoteok.ts** (6 connections) — `src/ingest/adapters/remoteok.ts`
- **runIngestion()** (6 connections) — `src/ingest/pipeline.ts`
- **parseRss()** (6 connections) — `src/ingest/rss.ts`
- *... and 65 more nodes in this community*

## Relationships

- [package.json](package.json.md) (4 shared connections)
- [worker-configuration.d.ts](worker-configuration.d.ts.md) (1 shared connections)

## Source Files

- `package.json`
- `src/ai/matching.ts`
- `src/index.ts`
- `src/ingest/adapters/arbeitnow.ts`
- `src/ingest/adapters/greenhouse.ts`
- `src/ingest/adapters/himalayas.ts`
- `src/ingest/adapters/jobicy.ts`
- `src/ingest/adapters/remoteok.ts`
- `src/ingest/adapters/remotive.ts`
- `src/ingest/filters.ts`
- `src/ingest/pipeline.ts`
- `src/ingest/rss.ts`
- `src/ingest/sources.ts`
- `src/ingest/types.ts`
- `src/notify/matches.ts`
- `src/notify/telegram.ts`
- `test/pipeline.spec.ts`
- `test/rss.spec.ts`

## Audit Trail

- EXTRACTED: 208 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*