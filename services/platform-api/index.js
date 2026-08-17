import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './src/config.js';
import { aiConfigured, geminiConfigured, groqConfigured } from './src/llm.js';
import { ensureSchema, pool } from './src/db.js';
import { loadPlatformConfig } from './src/services/platformConfig.js';
import { widgetRouter } from './src/routes/widget.js';
import { tenantRouter } from './src/routes/tenant/index.js';
import { platformAdminRouter } from './src/routes/platformAdmin.js';

// ─── Production Safety Guard ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') {
    console.warn('[WARN] JWT_SECRET is missing or using default in production!');
  }
  if (!process.env.DATABASE_URL) {
    console.warn('[WARN] DATABASE_URL is not set!');
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ─── Security Headers (helmet) ────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));

// ─── CORS ─────────────────────────────────────────────────────────
const openCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
});

const dashboardOrigins = [
  /\.vercel\.app$/,
  process.env.USER_DASHBOARD_URL,
  process.env.ADMIN_DASHBOARD_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5180',
].filter(Boolean);

const restrictedCors = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = dashboardOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(ok ? null : new Error(`CORS: origin not allowed — ${origin}`), ok);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
});

// ─── Rate Limiting ────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/v1/widget', openCors);
app.use('/v1', restrictedCors);
app.use('/v1/admin', restrictedCors);

app.use('/v1/widget/chat', chatLimiter);
app.use('/v1/auth', authLimiter);
app.use('/v1', generalLimiter);

app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use('/.well-known', (_req, res) => res.status(404).end());

app.get('/', (_req, res) => {
  const base = env.publicBaseUrl;
  res.type('html').send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WBA — API</title>
</head>
<body>
  <h1>NABEEH API</h1>
  <p>الخادم يعمل بنجاح.</p>
</body>
</html>`);
});

app.use('/v1', widgetRouter);
app.use('/v1', tenantRouter);
app.use('/v1/admin', platformAdminRouter);

const staticHeaders = (res) => res.setHeader('Access-Control-Allow-Origin', '*');

app.use(
  '/',
  express.static(path.join(__dirname, 'public'), {
    setHeaders: staticHeaders,
    extensions: ['js'],
  })
);

app.get('/widget.iife.js', (_req, res) => {
  staticHeaders(res);
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, '..', '..', 'apps', 'widget', 'dist', 'widget.iife.js'));
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'خطأ في الخادم' });
});

// ─── Start HTTP Server immediately on 0.0.0.0 ──────────────────────
const port = env.port;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on 0.0.0.0:${port}`);
  console.log(`[server] public base URL: ${env.publicBaseUrl}`);
});

server.timeout = 600000;
server.keepAliveTimeout = 620000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[error] port ${port} is already in use.`);
    process.exit(1);
  }
  throw err;
});

// ─── Async Database & Background Init ────────────────────────────
async function initAsync() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[warn] DATABASE_URL not set — skipping DB initialization');
      return;
    }
    await pool.query('SELECT 1');
    await ensureSchema();
    await loadPlatformConfig();
    const { reapStaleCrawlJobs } = await import('./src/knowledge/crawlJobManager.js');
    await reapStaleCrawlJobs();
    console.log('[db] connected and schema ensured');
  } catch (err) {
    console.error('[db] async init warning:', err.message || String(err));
  }
}

initAsync();

// Prevent Gemini stream SDK bugs from crashing the whole server.
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('GoogleGenerativeAI') || msg.includes('parse stream')) {
    console.error('[warn] Suppressed unhandled AI rejection:', msg.slice(0, 120));
    return;
  }
  console.error('[fatal] unhandledRejection:', reason);
});
