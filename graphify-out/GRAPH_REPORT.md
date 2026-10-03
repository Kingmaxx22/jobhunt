# Graph Report - jobhunt  (2026-10-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1995 nodes · 2163 edges · 161 communities (14 shown, 147 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e89b40a4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker-configuration.d.ts
- pipeline.ts
- ServiceWorkerGlobalScope
- Event
- package.json
- Console
- TransformStream
- URL
- compilerOptions
- URLSearchParams
- Container
- DurableObjectStorage
- Element
- Headers
- SubtleCrypto
- Blob
- Body
- BrowserRun
- FormData
- URLPattern
- DurableObjectState
- WorkerEntrypoint
- StreamError
- Flagship
- R2ObjectBody
- AgentMemoryProfile
- ByteLengthQueuingStrategy
- WritableStream
- DurableObject
- DurableObjectTransaction
- ReadableStream
- Socket
- WorkflowInstance
- WritableStreamDefaultWriter
- Ai
- AiSearchInstance
- DurableObjectNamespace
- R2Bucket
- Span
- SqlStorageCursor
- Vectorize
- test/tsconfig.json
- AiSearchNamespace
- Disposable
- ReadableStreamBYOBReader
- VectorizeIndex
- AiSearchItem
- AiSearchItems
- Artifacts
- ArtifactsRepo
- D1Database
- D1PreparedStatement
- ImageHandle
- KVNamespace
- ReadableByteStreamController
- ReadableStreamDefaultReader
- TextDecoder
- AiGateway
- Comment
- DurableObjectFacets
- ForwardableEmailMessage
- HostedImagesBinding
- HTMLRewriter
- HTMLRewriterDocumentContentHandlers
- ReadableStreamBYOBRequest
- ReadableStreamDefaultController
- StreamScopedCaptions
- StreamVideoHandle
- StreamWatermarks
- SyncKvStorage
- Table
- Text
- TextEncoder
- Tracing
- TransformStreamDefaultController
- Workflow
- AbortController
- AiSearchJob
- AiSearchJobs
- AutoRAG
- Cache
- Crypto
- D1DatabaseSession
- EndTag
- ExecProcess
- ExecutionContext
- HTMLRewriterElementContentHandlers
- ImagesBinding
- ImageTransformationResult
- ImageTransformer
- MediaTransformationResult
- Module
- Performance
- Queue
- R2MultipartUpload
- StreamBinding
- StreamScopedDownloads
- WebSocketRequestResponsePair
- WorkflowEntrypoint
- AgentMemoryNamespace
- BasicImageTransformations
- ColoLocalActorNamespace
- DOMException
- DurableObjectId
- Global
- HelloWorldBinding
- HyperdriveDynamicApi
- MediaTransformer
- Memory
- Message
- MessageBatch
- NodeStyleServer
- PipelineTransformationEntrypoint
- RequestInitCfPropertiesVaryHeader
- SqlStorage
- ToMarkdownService
- WorkerLoader
- WorkerStub
- WorkflowStep
- WritableStreamDefaultController
- AnalyticsEngineDataset
- AnalyticsSQLBinding
- __BaseEnv_Env
- CacheContext
- CacheStorage
- CloudflareAccessContext
- CompileError
- DispatchNamespace
- DocumentEnd
- EventListenerObject
- Hyperdrive
- IncomingRequestCfPropertiesBotManagement
- Instance
- JsonWebKey
- MediaBinding
- MediaTransformationGenerator
- MessageChannel
- Navigator
- NonRetryableError
- Pipeline
- R2Checksums
- RateLimit
- ResponseFunctionToolCall
- RpcTarget
- RuntimeError
- ScheduledController
- Scheduler
- SecretsStoreSecret
- SendEmail
- StreamVideos
- TraceItemFetchEventInfoRequest
- UnsafeTraceMetrics
- WebSearch
- Base_Ai_Cf_Google_Gemma_4_26B_A4B_It
- __DURABLE_OBJECT_BRAND
- onRequest
- __RPC_STUB_BRAND
- __RPC_TARGET_BRAND
- __WORKER_ENTRYPOINT_BRAND
- __WORKFLOW_ENTRYPOINT_BRAND

## God Nodes (most connected - your core abstractions)
1. `Event` - 25 edges
2. `Console` - 21 edges
3. `URLSearchParams` - 16 edges
4. `compilerOptions` - 16 edges
5. `Container` - 15 edges
6. `DurableObjectStorage` - 15 edges
7. `Element` - 14 edges
8. `Headers` - 14 edges
9. `SubtleCrypto` - 14 edges
10. `BrowserRun` - 13 edges

## Surprising Connections (you probably didn't know these)
- `fetch()` --calls--> `answerTelegramCallback()`  [EXTRACTED]
  src/index.ts → src/notify/telegram.ts
- `fetch()` --calls--> `getActiveProfiles()`  [EXTRACTED]
  src/index.ts → src/ai/matching.ts
- `scheduled()` --calls--> `getActiveProfiles()`  [EXTRACTED]
  src/index.ts → src/ai/matching.ts
- `fetch()` --calls--> `processAiMatching()`  [EXTRACTED]
  src/index.ts → src/ai/matching.ts
- `scheduled()` --calls--> `processAiMatching()`  [EXTRACTED]
  src/index.ts → src/ai/matching.ts

## Import Cycles
- None detected.

## Communities (161 total, 147 thin omitted)

### Community 0 - "worker-configuration.d.ts"
Cohesion: 0.00
Nodes (925): RFC-2253, RFC-3339, RFC-5246, RFC-9440, AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions (+917 more)

### Community 1 - "pipeline.ts"
Cohesion: 0.05
Nodes (73): entities, CandidateProfile, enrichGreenhouseDescriptions(), getActiveProfiles(), isEasyGig(), isEntryLevel(), JobMatch, processAiMatching() (+65 more)

### Community 2 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 3 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 4 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, @cloudflare/ai, entities, devDependencies, @cloudflare/vitest-plugin, @cloudflare/workers-types, @types/node, typescript (+18 more)

### Community 6 - "TransformStream"
Cohesion: 0.10
Nodes (7): CompressionStream, DecompressionStream, FixedLengthStream, IdentityTransformStream, TextDecoderStream, TextEncoderStream, TransformStream

### Community 8 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, checkJs, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 16 - "Body"
Cohesion: 0.15
Nodes (3): Body, Request, Response

### Community 22 - "StreamError"
Cohesion: 0.18
Nodes (11): AlreadyUploadedError, BadRequestError, ForbiddenError, InternalError, InvalidURLError, MaxFileSizeError, NotFoundError, QuotaReachedError (+3 more)

### Community 26 - "ByteLengthQueuingStrategy"
Cohesion: 0.22
Nodes (3): ByteLengthQueuingStrategy, CountQueuingStrategy, QueuingStrategy

### Community 41 - "test/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../tsconfig.json, compilerOptions, types, exclude, extends, include

### Community 43 - "Disposable"
Cohesion: 0.29
Nodes (4): Disposable, HyperdriveDynamic, StubBase, WorkflowInstanceSubscription

### Community 101 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 114 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

## Knowledge Gaps
- **995 isolated node(s):** `AgentMemoryGetSummaryOptions`, `AgentMemoryGetSummaryResponse`, `AgentMemoryIncomingMemory`, `AgentMemoryIngestOptions`, `AgentMemoryListMemoriesOptions` (+990 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1704 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **147 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Console` connect `Console` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `URL` connect `URL` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Event` connect `Event` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `AgentMemoryGetSummaryOptions`, `AgentMemoryGetSummaryResponse`, `AgentMemoryIncomingMemory` to the rest of the system?**
  _995 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.002152852529601722 - nodes in this community are weakly interconnected._
- **Should `pipeline.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050686641697877656 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._