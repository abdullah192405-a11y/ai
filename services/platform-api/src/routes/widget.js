import express from 'express';
import { query } from '../db.js';
import { publicConfig, fullConfig } from '../config.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { aiConfigured, streamAnswer, userFacingAiError } from '../llm.js';
import { searchPages, buildKnowledgeContext } from '../knowledge/search.js';
import {
  buildRouteRegistry,
  mergeDynamicRoutes,
  pruneSpaShellRoutes,
  formatRouteMapForPrompt,
  isRouteQuestion,
  verifyUndeclaredRoutes,
} from '../knowledge/routes.js';
import {
  buildGroundedSearchBlock,
  composeSearchAnswer,
  shouldUseComposedSearchAnswer,
} from '../knowledge/groundedAnswer.js';
import { composeGradesByTopicAnswer, isGradesByTopicQuestion } from '../knowledge/gradesByTopic.js';
import {
  composeEducationalDiscoveryAnswer,
  isEducationalDiscoveryQuestion,
} from '../knowledge/educationDiscovery.js';
import { finalizeAssistantActions, navActionsFromTargets } from '../knowledge/navActions.js';
import {
  formatContentSearchContext,
  isContentSearchQuestion,
  needsCatalogSearch,
  isPricingQuestion,
  buildPricingContext,
  searchSiteContent,
  pickNavigateActions,
} from '../knowledge/contentSearch.js';
import { formatCatalogForPrompt, mergeCatalogs, dedupeItems } from '../knowledge/catalog.js';
import { knowledgeBudgetForModel, LLM_SITEMAP_LINES_MINIMAL } from '../knowledge/knowledgeLimits.js';
import { fallbackAnswer, isSimpleQuery } from '../knowledge/fallbackAnswer.js';
import { fetchLiveDatabaseCatalog } from '../knowledge/liveData.js';
import { assertCanQuery } from '../services/plans.js';

export const widgetRouter = express.Router();

async function getWebsiteConfig(websiteId) {
  if (!websiteId) return {};
  const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [
    websiteId,
  ]);
  return rows[0]?.settings || {};
}

async function getOrCreateSession({ tenantId, websiteId, sessionId, pageUrl }) {
  const existing = await query(
    'SELECT id FROM sessions WHERE website_id = $1 AND visitor_id = $2 LIMIT 1',
    [websiteId, sessionId]
  );
  if (existing.rows[0]) {
    await query(
      'UPDATE sessions SET last_active_at = NOW(), message_count = message_count + 1 WHERE id = $1',
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const created = await query(
    `INSERT INTO sessions (tenant_id, website_id, visitor_id, page_url, message_count)
     VALUES ($1, $2, $3, $4, 1) RETURNING id`,
    [tenantId, websiteId, sessionId, pageUrl || null]
  );
  return created.rows[0].id;
}

function saveMessage({ sessionId, tenantId, role, content, pageUrl, model, latencyMs }) {
  return query(
    `INSERT INTO messages (session_id, tenant_id, role, content, page_url, model_used, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, tenantId, role, content, pageUrl || null, model || null, latencyMs || null]
  ).catch((err) => console.error('[messages] save failed:', err.message));
}

widgetRouter.get('/widget/config', apiKeyAuth, async (req, res, next) => {
  try {
    const settings = await getWebsiteConfig(req.auth.websiteId);
    res.json(publicConfig(settings));
  } catch (err) {
    next(err);
  }
});

widgetRouter.post('/assistant/query', apiKeyAuth, async (req, res, next) => {
  const { question, session_id: sessionId, conversation_history: history, page_url: pageUrl, page_context: pageContext } =
    req.body || {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ message: 'السؤال مطلوب' });
  }
  if (!aiConfigured()) {
    return res
      .status(503)
      .json({ message: 'لم يتم ضبط مفتاح AI على الخادم (GROQ_API_KEY أو GEMINI_API_KEY)' });
  }

  const { tenantId, websiteId } = req.auth;
  const config = fullConfig(await getWebsiteConfig(websiteId));
  const baseUrl = config.knowledgeBaseUrl || 'http://localhost:8081';

  try {
    await assertCanQuery(tenantId);
  } catch (err) {
    return res.status(403).json({
      message: 'تجاوز مالك الموقع حد الاستعلامات الشهري. يرجى المحاولة لاحقاً.',
      code: err.code || 'QUERY_LIMIT',
    });
  }

  const routeQuestion = isRouteQuestion(question);
  const catalogSearch = isContentSearchQuestion(question) || needsCatalogSearch(question);
  const simpleQuery = isSimpleQuery(question);

  const { searchDocumentChunks, listDocumentChunksForContext } = await import(
    '../knowledge/documentProcessor.js'
  );
  let documentChunks = [];
  if (!simpleQuery) {
    documentChunks = await searchDocumentChunks(websiteId, question, { limit: 20 });
    if (!documentChunks.length && catalogSearch) {
      documentChunks = await listDocumentChunksForContext(websiteId, { limit: 15 });
    }
  }

  const kb = await searchPages({
    websiteId,
    question,
    pageUrl: pageUrl || baseUrl,
    routeQuestion: routeQuestion || catalogSearch,
    broadSearch: catalogSearch,
    fullContent: true,
    limit: simpleQuery ? 3 : 5,
  });

  const liveDb = simpleQuery ? { items: [], allItems: [] } : await fetchLiveDatabaseCatalog(config, {});
  const clientItems = mergeCatalogs(pageContext?.catalog);
  const allDbItems = dedupeItems([...(liveDb.allItems || liveDb.items), ...clientItems]);

  let searchResult = null;
  if (catalogSearch) {
    searchResult = searchSiteContent({
      question,
      livePageContext: pageContext,
      catalog: pageContext?.catalog,
      dbItems: allDbItems,
      indexedPages: kb.pages,
      documentChunks,
    });
  }

  let { routes } = buildRouteRegistry({
    siteMap: kb.siteMap,
    siteKnowledge: config.siteKnowledge,
    currentPath: kb.currentPath,
  });
  if (!simpleQuery) {
    routes = mergeDynamicRoutes(routes, {
      liveLinks: pageContext?.links || [],
      catalogItems: allDbItems,
      indexedPages: kb.pages,
      matchedItems: searchResult?.matches || [],
    });
    routes = pruneSpaShellRoutes(routes);
    routes = await verifyUndeclaredRoutes({ baseUrl, routes });
  }

  const routeContext = simpleQuery
    ? ''
    : formatRouteMapForPrompt(routes, { currentPath: kb.currentPath });

  let knowledgeContext = buildKnowledgeContext({
    ...kb,
    baseUrl,
    siteKnowledge: config.siteKnowledge,
    livePageContext: pageContext,
    documentChunks,
    routeQuestion: routeQuestion || catalogSearch,
    budget: knowledgeBudgetForModel(config.model),
    maxSiteMapLines: simpleQuery ? LLM_SITEMAP_LINES_MINIMAL : undefined,
  });

  if (isPricingQuestion(question)) {
    const pricingCtx = buildPricingContext(config.siteKnowledge, question);
    if (pricingCtx) knowledgeContext += `\n\n${pricingCtx}`;
  }

  const catalogItems =
    catalogSearch && searchResult?.matches?.length
      ? dedupeItems(searchResult.matches)
      : catalogSearch
        ? allDbItems.slice(0, 40)
        : [];

  if (catalogItems.length && !(catalogSearch && searchResult?.matches?.length)) {
    knowledgeContext += `\n\n${formatCatalogForPrompt(catalogItems, { question, maxItems: 12 })}`;
  }

  if (catalogSearch && searchResult) {
    knowledgeContext += `\n\n${formatContentSearchContext({ question, result: searchResult, routes })}`;
    const grounded = buildGroundedSearchBlock({ question, result: searchResult });
    if (grounded) knowledgeContext += `\n\n${grounded}`;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const started = Date.now();
  let dbSessionId = null;
  try {
    dbSessionId = await getOrCreateSession({
      tenantId,
      websiteId,
      sessionId: sessionId || `sess_${Date.now()}`,
      pageUrl,
    });
    saveMessage({ sessionId: dbSessionId, tenantId, role: 'user', content: question, pageUrl });

    const educationDiscoveryReply = isEducationalDiscoveryQuestion(question)
      ? composeEducationalDiscoveryAnswer({
          indexedPages: kb.allPages || kb.pages || [],
          siteMap: kb.siteMap || [],
        })
      : null;

    const gradesTopicReply =
      !educationDiscoveryReply?.text &&
      catalogSearch &&
      isGradesByTopicQuestion(question)
        ? composeGradesByTopicAnswer({
            question,
            catalogItems: allDbItems,
            indexedPages: kb.allPages || [],
          })
        : null;

    const useComposed =
      !educationDiscoveryReply?.text &&
      !gradesTopicReply?.text &&
      catalogSearch &&
      searchResult &&
      shouldUseComposedSearchAnswer({ question, result: searchResult });
    const composedText = useComposed ? composeSearchAnswer({ question, result: searchResult }) : null;

    const quickReply =
      simpleQuery
        ? fallbackAnswer(question, {
            siteKnowledge: config.siteKnowledge,
            pages: kb.pages,
            livePageContext: pageContext,
            siteMap: kb.siteMap,
          })
        : null;

    let full;
    let actions = [];
    let provider;
    let usedModel;
    let attachNavFromSearch = false;

    if (quickReply?.text) {
      full = quickReply.text;
      actions = quickReply.actions || [];
      send({ token: full });
    } else if (educationDiscoveryReply?.text) {
      full = educationDiscoveryReply.text;
      send({ token: full });
      if (educationDiscoveryReply.navigateTargets?.length) {
        actions = navActionsFromTargets(educationDiscoveryReply.navigateTargets, routes);
      }
    } else if (gradesTopicReply?.text) {
      full = gradesTopicReply.text;
      send({ token: full });
      if (gradesTopicReply.navigateTargets?.length) {
        actions = navActionsFromTargets(gradesTopicReply.navigateTargets, routes);
      }
    } else if (composedText) {
      full = composedText;
      send({ token: composedText });
      attachNavFromSearch = true;
    } else {
      ({ text: full, actions, provider, model: usedModel } = await streamAnswer(
        { question, history, config, knowledgeContext, routeContext, routes },
        (token) => send({ token })
      ));
    }

    if (attachNavFromSearch && !actions.length) {
      const navTargets = pickNavigateActions({ question, searchResult, routes, limit: 4 });
      if (navTargets.length) {
        actions = navActionsFromTargets(navTargets, routes);
      }
    }

    actions = finalizeAssistantActions(actions, routes);
    if (actions.length) send({ actions });

    saveMessage({
      sessionId: dbSessionId,
      tenantId,
      role: 'assistant',
      content: full,
      pageUrl,
      model: usedModel || provider || config.model,
      latencyMs: Date.now() - started,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[assistant/query] error:', err.message);

    const msg = userFacingAiError(err);
    send({ token: msg });
    saveMessage({
      sessionId: dbSessionId,
      tenantId,
      role: 'assistant',
      content: msg,
      pageUrl,
      model: 'error',
      latencyMs: Date.now() - started,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  }
});

widgetRouter.post('/assistant/feedback', apiKeyAuth, async (req, res) => {
  const { rating, session_id: sessionId } = req.body || {};
  try {
    const session = await query(
      'SELECT id FROM sessions WHERE website_id = $1 AND visitor_id = $2 LIMIT 1',
      [req.auth.websiteId, sessionId]
    );
    await query(
      'INSERT INTO message_feedback (session_id, tenant_id, rating) VALUES ($1, $2, $3)',
      [session.rows[0]?.id || null, req.auth.tenantId, String(rating || 'unknown')]
    );
  } catch (err) {
    console.error('[feedback] save failed:', err.message);
  }
  res.json({ ok: true });
});
