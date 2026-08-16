/** Runtime platform config — DB overrides fall back to environment variables. */

import { query } from '../db.js';
import { env } from '../config.js';

const CONFIG_KEYS = ['groq_api_key', 'gemini_api_key', 'ai_provider'];

const cache = {
  groq_api_key: null,
  gemini_api_key: null,
  ai_provider: null,
  loaded: false,
};

export function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function loadPlatformConfig() {
  try {
    const { rows } = await query(
      'SELECT key, value FROM platform_config WHERE key = ANY($1)',
      [CONFIG_KEYS]
    );
    cache.groq_api_key = null;
    cache.gemini_api_key = null;
    cache.ai_provider = null;
    for (const row of rows) {
      cache[row.key] = row.value;
    }
  } catch (err) {
    console.warn('[platformConfig] load skipped:', err.message);
  }
  cache.loaded = true;
}

export function getGroqApiKey() {
  return cache.groq_api_key || env.groqApiKey || env.openaiApiKey || '';
}

export function getGeminiApiKey() {
  return cache.gemini_api_key || env.geminiApiKey || '';
}

export function getAiProviderMode() {
  return (cache.ai_provider || env.aiProvider || 'auto').toLowerCase();
}

export function getProviderKeysStatus() {
  const groqKey = getGroqApiKey();
  const geminiKey = getGeminiApiKey();
  return {
    groq: {
      configured: Boolean(groqKey),
      masked: maskSecret(groqKey),
      source: cache.groq_api_key ? 'database' : groqKey ? 'env' : 'none',
    },
    gemini: {
      configured: Boolean(geminiKey),
      masked: maskSecret(geminiKey),
      source: cache.gemini_api_key ? 'database' : geminiKey ? 'env' : 'none',
    },
    aiProvider: getAiProviderMode(),
  };
}

async function upsertConfig(key, value, adminId) {
  await query(
    `INSERT INTO platform_config (key, value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [key, value, adminId || null]
  );
}

async function deleteConfig(key) {
  await query('DELETE FROM platform_config WHERE key = $1', [key]);
  cache[key] = null;
}

export async function updateProviderKeys({ groqApiKey, geminiApiKey, aiProvider, adminId }) {
  if (groqApiKey !== undefined) {
    const trimmed = String(groqApiKey || '').trim();
    if (!trimmed) {
      await deleteConfig('groq_api_key');
    } else {
      await upsertConfig('groq_api_key', trimmed, adminId);
      cache.groq_api_key = trimmed;
    }
  }

  if (geminiApiKey !== undefined) {
    const trimmed = String(geminiApiKey || '').trim();
    if (!trimmed) {
      await deleteConfig('gemini_api_key');
    } else {
      await upsertConfig('gemini_api_key', trimmed, adminId);
      cache.gemini_api_key = trimmed;
    }
  }

  if (aiProvider !== undefined) {
    const mode = String(aiProvider || 'auto').trim().toLowerCase();
    if (!mode || mode === 'auto') {
      await deleteConfig('ai_provider');
    } else if (['groq', 'gemini'].includes(mode)) {
      await upsertConfig('ai_provider', mode, adminId);
      cache.ai_provider = mode;
    } else {
      const err = new Error('وضع AI غير صالح — استخدم auto أو groq أو gemini');
      err.status = 400;
      throw err;
    }
  }

  return getProviderKeysStatus();
}
