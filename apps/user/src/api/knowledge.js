import { request, upload } from './client.js';

export async function uploadKnowledgeDocument(file, title) {
  const form = new FormData();
  form.append('file', file);
  if (title?.trim()) form.append('title', title.trim());
  return upload('/v1/me/knowledge/documents/upload', form);
}

/** Kick off a background crawl. Returns the job record (crawl keeps running server-side). */
export async function startCrawl(url, { depth = 'medium' } = {}) {
  return request('/v1/me/knowledge/crawl', {
    method: 'POST',
    body: { url: url || undefined, depth },
  });
}

/** Current/last crawl job. `since` returns only newer log lines for incremental polling. */
export async function getCrawlStatus(since = 0) {
  return request(`/v1/me/knowledge/crawl/status?since=${encodeURIComponent(since)}`);
}

export async function cancelCrawl(jobId) {
  return request('/v1/me/knowledge/crawl/cancel', {
    method: 'POST',
    body: { jobId },
  });
}

/**
 * Run a crawl and stream progress via polling. Resolves with the final summary
 * when the job completes. The crawl runs in the background on the server, so the
 * returned promise rejecting (e.g. the user left) does NOT stop the crawl.
 */
export async function crawlKnowledge(url, { onLog, depth = 'medium', signal } = {}) {
  const started = await startCrawl(url, { depth });
  return pollCrawlToCompletion({ onLog, signal, initial: started?.job });
}

const POLL_INTERVAL_MS = 1500;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollCrawlToCompletion({ onLog, signal, initial } = {}) {
  let since = 0;
  if (initial?.logs?.length) {
    for (const log of initial.logs) onLog?.(log);
    since = initial.logSeq ?? since;
  }

  while (true) {
    if (signal?.aborted) throw new Error('aborted');
    const { job } = await getCrawlStatus(since);
    if (!job) throw new Error('تعذّر العثور على مهمة الزحف');

    if (job.logs?.length) {
      for (const log of job.logs) onLog?.(log);
      since = job.logSeq ?? since;
    }

    if (job.status === 'completed') return job.summary || {};
    if (job.status === 'failed') throw new Error(job.error || 'فشل الزحف');
    if (job.status === 'canceled') throw new Error('تم إلغاء الزحف');

    await wait(POLL_INTERVAL_MS);
  }
}
