/** Per-page storage cap (Postgres TEXT — keep high for full articles/scholarships). */
export const MAX_STORED_CONTENT_CHARS = 500_000;

/** Max chars of indexed knowledge sent to the LLM (Groq ~128k ctx; Gemini higher). */
export const LLM_KNOWLEDGE_BUDGET = parseInt(process.env.KNOWLEDGE_CONTEXT_MAX || '120000', 10);

export const LLM_ROUTE_BUDGET = parseInt(process.env.ROUTE_CONTEXT_MAX || '8000', 10);

/** Default page-content picks per query (site map always includes every path). */
export const LLM_PAGE_PICK_LIMIT = parseInt(process.env.KNOWLEDGE_PAGE_LIMIT || '12', 10);
export const LLM_PAGE_PICK_BROAD = parseInt(process.env.KNOWLEDGE_PAGE_BROAD || '25', 10);

/** Groq on-demand TPM caps — keep total request well under these (Arabic ≈ 2.5 chars/token). */
export const MODEL_KNOWLEDGE_BUDGET = {
  'llama-3.1-8b-instant': 3_500,
  'gemma2-9b-it': 3_500,
  'llama-3.3-70b-versatile': 10_000,
  'mixtral-8x7b-32768': 20_000,
};

/** Max site-map lines embedded in knowledge context (full index stays in DB). */
export const LLM_SITEMAP_LINES = parseInt(process.env.KNOWLEDGE_SITEMAP_LINES || '30', 10);
export const LLM_SITEMAP_LINES_MINIMAL = 12;

export function knowledgeBudgetForModel(model) {
  const m = String(model || '').toLowerCase();
  if (MODEL_KNOWLEDGE_BUDGET[m]) return MODEL_KNOWLEDGE_BUDGET[m];
  if (m.includes('8b') || m.includes('instant') || m.includes('gemma2')) {
    return MODEL_KNOWLEDGE_BUDGET['llama-3.1-8b-instant'];
  }
  if (m.includes('70b') || m.includes('mixtral')) {
    return MODEL_KNOWLEDGE_BUDGET['llama-3.3-70b-versatile'];
  }
  return LLM_KNOWLEDGE_BUDGET;
}
