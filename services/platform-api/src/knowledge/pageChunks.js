/** Split page text into sections for keyword RAG (stored in indexed_pages.rag_chunks). */

const MAX_CHUNK_CHARS = 1400;
const MAX_CHUNKS_PER_PAGE = 32;

const META_LINE_RE = /^(مسار الصفحة|عنوان الصفحة|الوصف|og:|الكلمات|روابط الصفحة):/;

function normalizeHeadings(headings) {
  if (!headings) return [];
  if (Array.isArray(headings)) return headings;
  try {
    const parsed = JSON.parse(headings);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stripMetaBlock(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !META_LINE_RE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyHeading(line, headingTexts) {
  const t = line.trim();
  if (!t || t.length > 140 || t.includes('\n')) return false;
  if (headingTexts.has(t)) return true;
  if (/^(#{1,4}\s|[-*•]\s)/.test(t)) return true;
  if (t.length <= 80 && /^[\u0600-\u06FFa-zA-Z0-9\s·\-–—:|،.()]+$/.test(t) && t.split(/\s+/).length <= 10) {
    return /^[A-Z\u0600-\u06FF]/.test(t);
  }
  return false;
}

/** Build searchable chunks from a crawled/indexed page. */
export function buildRagChunks({ title, path, content, headings }) {
  const headingList = normalizeHeadings(headings);
  const headingTexts = new Set(headingList.map((h) => String(h.text || '').trim()).filter(Boolean));
  const body = stripMetaBlock(content);
  if (!body) {
    return [{ id: '0', title: title || path || 'صفحة', text: '', kind: 'page' }];
  }

  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 8);
  const chunks = [];
  let buffer = [];
  let bufferLen = 0;
  let sectionTitle = title || path || 'صفحة';
  let chunkIdx = 0;

  const flush = () => {
    if (!buffer.length) return;
    chunks.push({
      id: String(chunkIdx++),
      title: sectionTitle,
      text: buffer.join('\n\n').slice(0, MAX_CHUNK_CHARS * 2),
      kind: chunks.length === 0 ? 'lead' : 'section',
    });
    buffer = [];
    bufferLen = 0;
  };

  for (const para of paragraphs) {
    if (isLikelyHeading(para, headingTexts)) {
      flush();
      sectionTitle = para.replace(/^#{1,4}\s*/, '').slice(0, 120);
      continue;
    }
    if (bufferLen + para.length > MAX_CHUNK_CHARS && buffer.length) flush();
    buffer.push(para);
    bufferLen += para.length;
  }
  flush();

  if (!chunks.length) {
    chunks.push({
      id: '0',
      title: title || path || 'صفحة',
      text: body.slice(0, MAX_CHUNK_CHARS * 2),
      kind: 'page',
    });
  }

  return chunks.slice(0, MAX_CHUNKS_PER_PAGE);
}

export function ragChunkCount(chunks) {
  return Array.isArray(chunks) ? chunks.length : 0;
}
