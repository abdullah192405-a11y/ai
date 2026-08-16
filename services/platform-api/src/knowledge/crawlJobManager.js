import { query } from '../db.js';
import { performKnowledgeCrawl, CrawlCanceledError } from './crawlRunner.js';

// Live jobs run detached from the HTTP request that started them, so a crawl
// keeps going after the user navigates away. Progress is buffered in memory for
// fast polling and flushed to crawl_jobs so the UI can reconnect after a reload.

const MEM_LOG_CAP = 500;
const PERSIST_THROTTLE_MS = 1500;
const DONE_RETENTION_MS = 5 * 60 * 1000;

/** websiteId -> live job record */
const liveByWebsite = new Map();
/** jobId -> live job record */
const liveById = new Map();

function nowIso() {
  return new Date().toISOString();
}

function publicJob(job, since = 0) {
  const sinceNum = Number.isFinite(since) ? Number(since) : 0;
  const logs = job.logs.filter((l) => l.seq > sinceNum);
  return {
    id: job.id,
    websiteId: job.websiteId,
    status: job.status,
    phase: job.phase || null,
    depth: job.depth,
    baseUrl: job.baseUrl,
    logs,
    logSeq: job.logSeq,
    pagesIndexed: job.pagesIndexed || 0,
    summary: job.summary || null,
    error: job.error || null,
    cancelRequested: Boolean(job.cancelRequested),
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt || null,
  };
}

async function persist(job, { force = false } = {}) {
  const due = force || Date.now() - (job._lastPersist || 0) >= PERSIST_THROTTLE_MS;
  if (!due) return;
  job._lastPersist = Date.now();
  const logsForDb = job.logs.slice(-MEM_LOG_CAP);
  try {
    await query(
      `UPDATE crawl_jobs
          SET status = $2, phase = $3, logs = $4::jsonb, summary = $5::jsonb,
              error = $6, pages_indexed = $7, log_seq = $8,
              cancel_requested = $9, updated_at = NOW(),
              finished_at = $10
        WHERE id = $1`,
      [
        job.id,
        job.status,
        job.phase || null,
        JSON.stringify(logsForDb),
        job.summary ? JSON.stringify(job.summary) : null,
        job.error || null,
        job.pagesIndexed || 0,
        job.logSeq,
        Boolean(job.cancelRequested),
        job.finishedAt || null,
      ]
    );
  } catch (err) {
    console.warn('[crawl-job] persist failed:', err.message);
  }
}

function appendLog(job, entry) {
  job.logSeq += 1;
  const log = {
    seq: job.logSeq,
    ts: entry.ts || Date.now(),
    phase: entry.phase || null,
    text: entry.text || '',
    meta: entry.meta || undefined,
  };
  job.logs.push(log);
  if (job.logs.length > MEM_LOG_CAP) job.logs.splice(0, job.logs.length - MEM_LOG_CAP);
  job.phase = entry.phase || job.phase;
  if (entry.meta?.pagesIndexed != null) job.pagesIndexed = entry.meta.pagesIndexed;
  job.updatedAt = nowIso();
}

function cleanupLater(job) {
  setTimeout(() => {
    if (liveById.get(job.id) === job) liveById.delete(job.id);
    if (liveByWebsite.get(job.websiteId) === job) liveByWebsite.delete(job.websiteId);
  }, DONE_RETENTION_MS).unref?.();
}

/** Returns the currently running job for a website, or null. */
export function getRunningJob(websiteId) {
  const job = liveByWebsite.get(websiteId);
  return job && job.status === 'running' ? job : null;
}

/**
 * Start a detached background crawl for a website. If one is already running,
 * the existing job is returned (no duplicate crawl).
 */
export async function startCrawlJob({ websiteId, tenantId, baseUrl, depth = 'medium' }) {
  const running = getRunningJob(websiteId);
  if (running) return { job: publicJob(running), alreadyRunning: true };

  const { rows } = await query(
    `INSERT INTO crawl_jobs (tenant_id, website_id, base_url, depth, status, phase, logs)
     VALUES ($1, $2, $3, $4, 'running', 'start', '[]'::jsonb)
     RETURNING id, started_at`,
    [tenantId, websiteId, baseUrl, depth]
  );
  const jobId = rows[0].id;

  const job = {
    id: jobId,
    websiteId,
    tenantId,
    baseUrl,
    depth,
    status: 'running',
    phase: 'start',
    logs: [],
    logSeq: 0,
    pagesIndexed: 0,
    summary: null,
    error: null,
    cancelRequested: false,
    startedAt: rows[0].started_at?.toISOString?.() || nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
    _lastPersist: 0,
  };
  liveByWebsite.set(websiteId, job);
  liveById.set(jobId, job);

  // Detached — intentionally not awaited so the HTTP request can return now.
  runJob(job).catch((err) => console.error('[crawl-job] unhandled:', err));

  return { job: publicJob(job), alreadyRunning: false };
}

async function runJob(job) {
  const startedMs = Date.now();
  try {
    const payload = await performKnowledgeCrawl({
      websiteId: job.websiteId,
      tenantId: job.tenantId,
      baseUrl: job.baseUrl,
      depth: job.depth,
      shouldCancel: () => job.cancelRequested,
      onProgress: (entry) => {
        appendLog(job, entry);
        persist(job);
      },
    });

    const totalMs = Date.now() - startedMs;
    job.pagesIndexed = payload.pagesIndexed || 0;
    const { siteKnowledge: _omit, ...summary } = payload;
    job.summary = { ...summary, totalMs };
    job.status = 'completed';
    job.finishedAt = nowIso();

    const dbPart = payload.dbRecordsSynced ? ` + ${payload.dbRecordsSynced} من Supabase` : '';
    appendLog(job, {
      phase: 'done',
      text: `اكتمل — ${payload.pagesIndexed} صفحة ويب${dbPart} — الإجمالي ${payload.routesSynced} سجل (${Math.round(totalMs / 1000)}ث)`,
      meta: { ms: totalMs, pagesIndexed: payload.pagesIndexed },
    });
    console.log(
      `[crawl] زحف الموقع — اكتمل (خلفية) pages=${payload.routesSynced} web=${payload.pagesIndexed} db=${payload.dbRecordsSynced} ms=${totalMs}`
    );
  } catch (err) {
    job.finishedAt = nowIso();
    if (err instanceof CrawlCanceledError || job.cancelRequested) {
      job.status = 'canceled';
      job.error = null;
      appendLog(job, { phase: 'canceled', text: 'تم إلغاء الزحف بناءً على طلبك' });
    } else {
      job.status = 'failed';
      job.error = err.message || 'خطأ في الزحف';
      appendLog(job, { phase: 'error', text: `فشل الزحف — ${job.error}` });
      console.error('[crawl-job] failed:', err);
    }
  } finally {
    await persist(job, { force: true });
    cleanupLater(job);
  }
}

/** Best-effort cancel of a running job for a website. */
export async function cancelCrawlJob({ websiteId, jobId }) {
  const job = jobId ? liveById.get(jobId) : getRunningJob(websiteId);
  if (job && job.websiteId === websiteId && job.status === 'running') {
    job.cancelRequested = true;
    await persist(job, { force: true });
    return { ok: true, job: publicJob(job) };
  }
  return { ok: false };
}

/**
 * Latest crawl status for a website: live job from memory if present, otherwise
 * the most recent persisted job. `since` returns only newer log entries.
 */
export async function getCrawlStatus(websiteId, since = 0) {
  const live = liveByWebsite.get(websiteId);
  if (live) return publicJob(live, since);

  const { rows } = await query(
    `SELECT id, website_id, base_url, depth, status, phase, logs, summary,
            error, pages_indexed, log_seq, cancel_requested,
            started_at, updated_at, finished_at
       FROM crawl_jobs
      WHERE website_id = $1
      ORDER BY started_at DESC
      LIMIT 1`,
    [websiteId]
  );
  if (!rows.length) return null;

  const r = rows[0];
  const sinceNum = Number.isFinite(Number(since)) ? Number(since) : 0;
  const allLogs = Array.isArray(r.logs) ? r.logs : [];
  return {
    id: r.id,
    websiteId: r.website_id,
    status: r.status,
    phase: r.phase || null,
    depth: r.depth,
    baseUrl: r.base_url,
    logs: allLogs.filter((l) => (l.seq || 0) > sinceNum),
    logSeq: r.log_seq || 0,
    pagesIndexed: r.pages_indexed || 0,
    summary: r.summary || null,
    error: r.error || null,
    cancelRequested: Boolean(r.cancel_requested),
    startedAt: r.started_at?.toISOString?.() || r.started_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
    finishedAt: r.finished_at?.toISOString?.() || r.finished_at || null,
  };
}

/** Mark orphaned 'running' rows as failed on boot (server restarted mid-crawl). */
export async function reapStaleCrawlJobs() {
  try {
    const { rowCount } = await query(
      `UPDATE crawl_jobs
          SET status = 'failed',
              error = COALESCE(error, 'انقطع الزحف بسبب إعادة تشغيل الخادم'),
              finished_at = NOW(), updated_at = NOW()
        WHERE status = 'running'`
    );
    if (rowCount) console.log(`[crawl-job] reaped ${rowCount} stale running job(s)`);
  } catch (err) {
    console.warn('[crawl-job] reap failed:', err.message);
  }
}
