import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './src/config.js';
import { aiConfigured, geminiConfigured, groqConfigured } from './src/llm.js';
import { ensureSchema, pool } from './src/db.js';
import { loadPlatformConfig } from './src/services/platformConfig.js';
import { widgetRouter } from './src/routes/widget.js';
import { tenantRouter } from './src/routes/tenant/index.js';
import { platformAdminRouter } from './src/routes/platformAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '1mb' }));

// Permissive CORS: the widget + loader run on arbitrary customer origins.
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Browsers request these automatically; silence console noise.
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
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; line-height: 1.6; color: #1a1a2e; }
    h1 { font-size: 1.5rem; }
    code { background: #f0f2f7; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; direction: ltr; }
    pre { background: #f0f2f7; padding: 12px; border-radius: 8px; overflow-x: auto; direction: ltr; text-align: left; font-size: 13px; }
    a { color: #6366f1; }
    ul { padding-right: 1.2em; }
  </style>
</head>
<body>
  <h1>WBA API</h1>
  <p>الخادم يعمل. هذا ليس موقعاً — استخدم الروابط أدناه.</p>
  <ul>
    <li><a href="${base}/health">/health</a> — فحص الحالة</li>
    <li><a href="${base}/embed.js">${base}/embed.js</a> — سكربت التضمين للمواقع</li>
    <li><a href="${base}/widget.iife.js">/widget.iife.js</a> — حزمة الويدجت</li>
  </ul>
  <p><strong>لوحة التحكم:</strong> شغّل <code>cd apps/user && npm run dev</code> ثم افتح <a href="http://localhost:5173">http://localhost:5173</a></p>
  <p><strong>التضمين في موقعك:</strong></p>
  <pre>&lt;script src="${base}/embed.js" data-key="YOUR_API_KEY" async&gt;&lt;/script&gt;</pre>
  <p>أنشئ المفتاح من لوحة التحكم ← مفاتيح API، أو شغّل <code>npm run seed</code>.</p>
</body>
</html>`);
});

// API routes
app.use('/v1', widgetRouter);
app.use('/v1', tenantRouter);
app.use('/v1/admin', platformAdminRouter);

// ─── Static assets: the loader + the prebuilt widget bundle ──
// Served with open CORS so any site can <script src> them.
const staticHeaders = (res) => res.setHeader('Access-Control-Allow-Origin', '*');

app.use(
  '/',
  express.static(path.join(__dirname, 'public'), {
    setHeaders: staticHeaders,
    extensions: ['js'],
  })
);

// The widget bundle lives in apps/widget/dist (gitignored build output).
app.get('/widget.iife.js', (_req, res) => {
  staticHeaders(res);
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, '..', '..', 'apps', 'widget', 'dist', 'widget.iife.js'));
});

// Unknown routes — avoid Express default HTML error page (triggers CSP noise in DevTools).
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'خطأ في الخادم' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    await ensureSchema();
    await loadPlatformConfig();
    const { reapStaleCrawlJobs } = await import('./src/knowledge/crawlJobManager.js');
    await reapStaleCrawlJobs();
    console.log('[db] connected');
  } catch (err) {
    const msg = err.message || err.code || String(err);
    console.error('[db] connection failed:', msg || '(no message)');
    if (err.code === 'ECONNREFUSED') {
      console.error('     Postgres is not running. From the repo root:');
    }
    console.error('     docker compose up -d postgres');
    process.exit(1);
  }
  const server = app.listen(env.port, () => {
    console.log(`[server] listening on ${env.publicBaseUrl}  (port ${env.port})`);
    console.log(`[server] embed loader:  ${env.publicBaseUrl}/embed.js`);
    if (!aiConfigured()) {
      console.warn('[warn] No AI key — set GROQ_API_KEY or GEMINI_API_KEY in server/.env');
    } else {
      const mode = (env.aiProvider || 'auto').toLowerCase();
      const primary = mode === 'gemini' ? 'gemini' : mode === 'groq' ? 'groq' : groqConfigured() ? 'groq' : 'gemini';
      const model =
        primary === 'groq' ? env.openaiModel || 'llama-3.1-8b-instant' : env.defaultModel;
      const fallbacks =
        mode === 'groq' || mode === 'gemini'
          ? []
          : [
              ...(groqConfigured() && primary !== 'groq' ? ['Groq'] : []),
              ...(geminiConfigured() && primary !== 'gemini' ? ['Gemini'] : []),
            ];
      console.log(
        `[server] AI: ${primary} (${model})${fallbacks.length ? `, fallback: ${fallbacks.join(', ')}` : ''}`
      );
    }
  });
  server.timeout = 600000;
  server.keepAliveTimeout = 620000;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[error] port ${env.port} is already in use.`);
      console.error(`        Stop the other process:  lsof -i :${env.port}  then  kill <PID>`);
      console.error(`        Or change PORT in server/.env`);
      process.exit(1);
    }
    throw err;
  });
}

start();

// Prevent Gemini stream SDK bugs from crashing the whole server.
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('GoogleGenerativeAI') || msg.includes('parse stream')) {
    console.error('[warn] Suppressed unhandled AI rejection:', msg.slice(0, 120));
    return;
  }
  console.error('[fatal] unhandledRejection:', reason);
});
