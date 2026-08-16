# Knowledge module layout

The `knowledge/` folder powers crawling, RAG retrieval, and chat orchestration for the widget.

## Intended subdomains

| Area | Files | Role |
|------|-------|------|
| **Crawl** | `crawler.js`, `crawlRunner.js`, `crawlJobManager.js`, `crawlDepth.js`, `browserRenderer.js` | Site crawl + job lifecycle |
| **Ingest** | `documentProcessor.js`, `documentChunks.js`, `siteKnowledge.js`, `databaseSync.js` | PDF/text ingestion |
| **Retrieval** | `search.js`, `contentSearch.js`, `catalog.js`, `knowledgeLimits.js` | Page/doc search |
| **Integrations** | `siteSupabase.js`, `liveData.js`, `carCatalog.js` | Supabase + live DB |
| **Chat** | `actions.js`, `navActions.js`, `groundedAnswer.js`, `fallbackAnswer.js`, `responseStyle.js` | Navigate buttons + composed replies |
| **Domain** | `gradesByTopic.js`, `educationDiscovery.js` | Tenant-specific plugins |
| **Routes** | `routes.js` | SPA route registry |

## Entry points

- `routes/widget.js` — chat SSE endpoint (orchestrator)
- `routes/tenant/knowledge.js` — dashboard crawl/upload API
- `knowledge/routes.js` — route registry shared by chat + crawl

## Next refactor

Split flat files into the subfolders above and extract the chat decision tree from `routes/widget.js` into `chat/pipeline.js`.
