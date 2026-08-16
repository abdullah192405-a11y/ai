/** Upload PDF/TXT → extract text → AI → text-only document_chunks (no URL paths). */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';
import { completeOnce } from '../llm.js';
import {
  ensureDocumentChunksTable,
  saveDocumentChunks,
  deleteDocumentChunks,
  getDocumentExtractedKnowledge,
  searchDocumentChunks,
  listDocumentChunksForContext,
  formatDocumentChunksForPrompt,
  purgeLegacyDocPaths,
} from './documentChunks.js';

export {
  getDocumentExtractedKnowledge,
  searchDocumentChunks,
  listDocumentChunksForContext,
  formatDocumentChunksForPrompt,
  purgeLegacyDocPaths,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

const SUPPORTED_EXT = new Set(['.pdf', '.txt', '.md', '.markdown']);

function parseAiKnowledgeJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    const summary = String(parsed.summary || '').trim();
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
          .map((s) => ({
            title: String(s?.title || '').trim(),
            content: String(s?.content || '').trim(),
          }))
          .filter((s) => s.title && s.content)
      : [];
    if (!summary && !sections.length) return null;
    return { summary, sections };
  } catch {
    return null;
  }
}

function chunkRawText(text, size = 3500) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts;
}

export async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) {
    throw new Error('نوع الملف غير مدعوم — PDF أو TXT أو MD فقط');
  }

  const buf = await fs.readFile(filePath);
  if (ext === '.pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy?.().catch(() => {});
    const text = String(result?.text || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 40) {
      throw new Error('لم يُستخرج نص كافٍ من PDF — قد يكون ملفاً ممسوحاً ضوئياً بدون طبقة نص');
    }
    return text;
  }

  const text = buf.toString('utf8').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 20) throw new Error('الملف النصي فارغ أو قصير جداً');
  return text;
}

export async function extractKnowledgeWithAi(rawText, title) {
  const excerpt = rawText.slice(0, 14000);
  const system = `أنت محلل محتوى لمواقع وخدمات. استخرج كل المعرفة المفيدة للمساعد الذكي: الخدمات، الأسعار، السياسات، الأسئلة الشائعة، خطوات الاستخدام، ومعلومات التواصل.
أعد JSON صالحاً فقط بدون markdown:
{"summary":"ملخص شامل بالعربية","sections":[{"title":"عنوان القسم","content":"تفاصيل كاملة بالعربية"}]}
- summary: فقرة أو فقرتان تلخصان المستند
- sections: 3–12 أقسام واضحة (خدمات، أسعار، FAQ، إلخ)
- لا تخترع معلومات غير موجودة في النص`;

  const user = `عنوان المستند: ${title}\n\n--- النص ---\n${excerpt}`;

  try {
    const reply = await completeOnce({ system, user, maxTokens: 4096, temperature: 0.2 });
    const parsed = parseAiKnowledgeJson(reply);
    if (parsed) return parsed;
  } catch (err) {
    console.warn('[documents] AI extraction failed:', err.message?.slice(0, 120));
  }

  return {
    summary: excerpt.slice(0, 4000),
    sections: chunkRawText(excerpt, 3500).map((content, i) => ({
      title: `${title} — جزء ${i + 1}`,
      content,
    })),
  };
}

export async function processUploadedDocument({
  tenantId,
  websiteId,
  documentId,
  filePath,
  originalName,
  title,
}) {
  await query(
    `UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [documentId]
  );

  try {
    const rawText = await extractTextFromFile(filePath, originalName);
    const { summary, sections } = await extractKnowledgeWithAi(rawText, title);
    const chunkCount = await saveDocumentChunks({
      tenantId,
      websiteId,
      documentId,
      documentTitle: title,
      summary,
      sections,
    });

    const hash = crypto.createHash('sha256').update(rawText).digest('hex');
    await query(
      `UPDATE documents SET
         status = 'indexed', chunk_count = $2, content_hash = $3,
         metadata = metadata || $4::jsonb, error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [
        documentId,
        chunkCount,
        hash,
        JSON.stringify({
          sections: sections.length,
          chars: rawText.length,
          summaryPreview: summary.slice(0, 400),
          sectionTitles: sections.map((s) => s.title),
        }),
      ]
    );

    return {
      chunkCount,
      sections: sections.length,
      chars: rawText.length,
      summary,
      sectionTitles: sections.map((s) => s.title),
    };
  } catch (err) {
    await query(
      `UPDATE documents SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [documentId, err.message?.slice(0, 500)]
    );
    throw err;
  }
}

export async function deleteDocumentKnowledge(websiteId, documentId) {
  await deleteDocumentChunks(documentId, websiteId);
}

export function uploadDirFor(tenantId, websiteId) {
  return path.join(UPLOAD_ROOT, tenantId, websiteId);
}

export async function ensureDocumentsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID NOT NULL,
      website_id      UUID,
      title           VARCHAR(500),
      source_type     VARCHAR(50) NOT NULL,
      source_url      TEXT,
      file_path       TEXT,
      content_hash    VARCHAR(64),
      status          VARCHAR(20) DEFAULT 'pending',
      chunk_count     INTEGER DEFAULT 0,
      metadata        JSONB DEFAULT '{}',
      error_message   TEXT,
      excluded_from_ai BOOLEAN NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS excluded_from_ai BOOLEAN NOT NULL DEFAULT false;
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_documents_website ON documents(website_id, status);
  `);
  await ensureDocumentChunksTable();
}
