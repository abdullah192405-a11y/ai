import { env } from './config.js';
import { getGroqApiKey } from './services/platformConfig.js';
import {
  LLM_ROUTE_BUDGET,
  knowledgeBudgetForModel,
} from './knowledge/knowledgeLimits.js';
import { parseActions, streamVisibleEnd, stripActionsMarker } from './knowledge/actions.js';
import { buildChatMessages, routeAwareTemperature } from './prompt.js';
import { validateNavigateActions } from './knowledge/routes.js';
import { sanitizeAssistantResponse } from './knowledge/responseStyle.js';

function actionOptions(params) {
  const routes = params.routes || [];
  return {
    routes,
    validateNavigate: (actions) => validateNavigateActions(actions, routes),
  };
}

export function groqConfigured() {
  return Boolean(getGroqApiKey());
}

function resolveGroqModel(config) {
  const requested = config?.model;
  // Tenant configs may still store Gemini names — map them to the Groq default.
  if (requested && !requested.startsWith('gemini') && !requested.startsWith('gpt-')) {
    return requested;
  }
  return env.openaiModel || 'llama-3.3-70b-versatile';
}

// Groq small models (8b/instant) have ~6k TPM — trim aggressively; 70b supports much more.
function estimateMessageOverhead(params, routeTrimmed) {
  const { question, history, config } = params;
  let n = String(config?.systemPrompt || '').length + routeTrimmed.length + 2800;
  for (const turn of history || []) n += String(turn.content || '').length;
  n += String(question || '').length;
  return n;
}

function trimContextForGroq(knowledgeContext, routeContext, model, params, { aggressive = false, minimal = false } = {}) {
  const route = routeContext || '';
  const isSmall = model.includes('8b') || model.includes('instant') || model.includes('gemma');
  let modelBudget = knowledgeBudgetForModel(model);
  if (aggressive) modelBudget = Math.floor(modelBudget / 3);
  if (minimal) modelBudget = isSmall ? 800 : 1500;

  const maxRoute = minimal ? 400 : Math.min(LLM_ROUTE_BUDGET, isSmall ? 1200 : 4000);
  const routeTrimmed = route.length > maxRoute ? route.slice(0, maxRoute) + '\n[...]' : route;
  const totalCap = isSmall ? 10_000 : 24_000;
  const overhead = estimateMessageOverhead(params, routeTrimmed);
  const maxKnowledge = Math.min(
    modelBudget,
    Math.max(totalCap - overhead, minimal ? 600 : isSmall ? 1200 : 4000)
  );
  const budget = maxKnowledge;
  if (!knowledgeContext || knowledgeContext.length <= budget) {
    return { knowledgeContext, routeContext: routeTrimmed };
  }
  const floor = minimal ? 600 : isSmall ? 1200 : 4000;
  const trimmed =
    knowledgeContext.slice(0, Math.max(budget - 120, floor)) +
    '\n\n[... المزيد في الفهرس — اذكر كلمات أدق من سؤالك للحصول على صفحات إضافية ...]';
  return { knowledgeContext: trimmed, routeContext: routeTrimmed };
}

function isContextTooLargeError(errText) {
  const m = String(errText || '');
  return m.includes('413') || m.includes('Request too large') || m.includes('TPM');
}

async function groqChatCompletion({ apiKey, base, model, messages, temperature, stream }) {
  const url = `${base.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream, temperature }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res;
}

export function openaiConfigured() {
  return groqConfigured();
}

async function* readOpenAiSse(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore partial JSON */
      }
    }
  }
}

export async function streamGroqAnswer(params, onToken) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  let model = resolveGroqModel(params.config);
  const base = env.openaiApiBase || 'https://api.groq.com/openai/v1';
  const retryState = params._groqRetry || { attempt: 0 };

  const { knowledgeContext, routeContext } = trimContextForGroq(
    params.knowledgeContext,
    params.routeContext,
    model,
    params,
    {
      aggressive: retryState.attempt === 1,
      minimal: retryState.attempt >= 2,
    }
  );
  const messages = buildChatMessages({ ...params, knowledgeContext, routeContext });

  let res;
  try {
    res = await groqChatCompletion({
      apiKey,
      base,
      model,
      messages,
      temperature: routeAwareTemperature(params.config, params.question),
      stream: true,
    });
  } catch (err) {
    if (!isContextTooLargeError(err.message)) throw err;

    const nextAttempt = retryState.attempt + 1;
    if (nextAttempt > 2) throw err;

    const isSmall = model.includes('8b') || model.includes('instant') || model.includes('gemma');
    const nextModel =
      nextAttempt === 1 && isSmall ? 'llama-3.3-70b-versatile' : model;
    console.warn(
      `[groq] context too large for ${model}, retry ${nextAttempt} with ${nextModel}`
    );
    return streamGroqAnswer(
      {
        ...params,
        config: { ...params.config, model: nextModel },
        _groqRetry: { attempt: nextAttempt },
      },
      onToken
    );
  }

  let full = '';
  let sentLen = 0;

  for await (const token of readOpenAiSse(res.body)) {
    full += token;
    const { delta, sentLen: next } = streamVisibleEnd(full, sentLen);
    if (delta) onToken(delta);
    sentLen = next;
  }

  const { text, actions } = parseActions(full, actionOptions(params));
  const clean = sanitizeAssistantResponse(text || stripActionsMarker(full));
  return {
    text: clean,
    actions,
    provider: 'groq',
    model,
  };
}

/** One-shot completion for document extraction (non-streaming). */
export async function completeGroqOnce({ system, user, maxTokens = 4096, temperature = 0.2 }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  const model = env.openaiModel || 'llama-3.1-8b-instant';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

export const streamOpenAiAnswer = streamGroqAnswer;
