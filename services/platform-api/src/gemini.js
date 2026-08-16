import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './config.js';
import { getGeminiApiKey } from './services/platformConfig.js';
import { parseActions, streamVisibleEnd, stripActionsMarker } from './knowledge/actions.js';
import { buildSystemInstruction, routeAwareTemperature } from './prompt.js';
import { validateNavigateActions } from './knowledge/routes.js';
import { sanitizeAssistantResponse } from './knowledge/responseStyle.js';

function actionOptions(params) {
  const routes = params.routes || [];
  return {
    routes,
    validateNavigate: (actions) => validateNavigateActions(actions, routes),
  };
}

const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

function getClient() {
  const key = getGeminiApiKey();
  return key ? new GoogleGenerativeAI(key) : null;
}

export function geminiConfigured() {
  return Boolean(getGeminiApiKey());
}

function isRetryable(err) {
  const m = err?.message || '';
  return (
    m.includes('429') ||
    m.includes('503') ||
    m.includes('quota') ||
    m.includes('high demand') ||
    m.includes('Failed to parse stream') ||
    m.includes('parse stream')
  );
}

function parseResult(full, params, modelName) {
  const { text, actions } = parseActions(full, actionOptions(params));
  const clean = sanitizeAssistantResponse(text || stripActionsMarker(full));
  return { text: clean, actions, provider: 'gemini', model: modelName };
}

async function generateNonStream(modelName, params, onToken) {
  const client = getClient();
  if (!client) throw new Error('GEMINI_API_KEY is not configured');
  const { question, history, config, knowledgeContext, routeContext } = params;
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(config, knowledgeContext, routeContext, {
      question,
    }),
    generationConfig: {
      temperature: routeAwareTemperature(config, question),
    },
  });

  const result = await model.generateContent({ contents: toContents(history, question) });
  const full = result.response.text();
  const visible = stripActionsMarker(full);
  if (visible.trim()) onToken(visible);
  return parseResult(full, params, modelName);
}

async function streamWithModel(modelName, params, onToken) {
  const client = getClient();
  if (!client) throw new Error('GEMINI_API_KEY is not configured');
  const { question, history, config, knowledgeContext, routeContext } = params;
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(config, knowledgeContext, routeContext, {
      question,
    }),
    generationConfig: {
      temperature: routeAwareTemperature(config, question),
    },
  });

  let result;
  try {
    result = await model.generateContentStream({
      contents: toContents(history, question),
    });
  } catch (err) {
    if (isRetryable(err)) {
      console.warn('[gemini] stream init failed, non-stream fallback:', modelName);
      return generateNonStream(modelName, params, onToken);
    }
    throw err;
  }

  let full = '';
  let sentLen = 0;

  try {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (!text) continue;
      full += text;
      const { delta, sentLen: next } = streamVisibleEnd(full, sentLen);
      if (delta) onToken(delta);
      sentLen = next;
    }
  } catch (streamErr) {
    console.warn('[gemini] stream parse error, recovering:', streamErr.message?.slice(0, 80));
    try {
      const recovered = (await result.response).text();
      if (recovered) full = recovered;
    } catch {
      /* use partial full if any */
    }
    if (!full.trim()) {
      console.warn('[gemini] non-stream fallback after stream error:', modelName);
      return generateNonStream(modelName, params, onToken);
    }
  }

  return parseResult(full, params, modelName);
}

function parseRetryMs(err) {
  const m = err?.message || '';
  const sec = m.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (sec) return Math.min(60000, Math.ceil(parseFloat(sec[1]) * 1000));
  const delay = m.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (delay) return Math.min(60000, parseInt(delay[1], 10) * 1000);
  return 2000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toContents(history, question) {
  const contents = [];
  for (const turn of history || []) {
    if (!turn || !turn.content) continue;
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(turn.content) }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: String(question) }] });
  return contents;
}

// Streams answer via Gemini; tries fallback models on 429/503.
export async function streamGeminiAnswer(params, onToken) {
  if (!getClient()) throw new Error('GEMINI_API_KEY is not configured');

  const primary = params.config?.model || env.defaultModel;
  const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  let lastErr;
  let quotaErr;
  for (let i = 0; i < chain.length; i++) {
    try {
      if (i > 0) await sleep(parseRetryMs(lastErr));
      return await streamWithModel(chain[i], params, onToken);
    } catch (err) {
      lastErr = err;
      const m = err?.message || '';
      if (m.includes('429') || m.includes('quota') || m.includes('Quota exceeded')) {
        quotaErr = err;
      }
      console.warn(`[gemini] model ${chain[i]} failed:`, m.slice(0, 120));
      if (!isRetryable(err) || i === chain.length - 1) {
        throw quotaErr || err;
      }
    }
  }
  throw quotaErr || lastErr;
}

/** One-shot completion for document extraction (non-streaming). */
export async function completeGeminiOnce({ system, user, maxTokens = 4096, temperature = 0.2 }) {
  const client = getClient();
  if (!client) throw new Error('GEMINI_API_KEY is not configured');

  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      });
      const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: user }] }] });
      return String(result.response.text() || '').trim();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      console.warn(`[gemini] completeOnce ${modelName} failed:`, err.message?.slice(0, 100));
    }
  }
  throw new Error('Gemini completion failed');
}
