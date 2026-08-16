/** Optional headless browser rendering for JS-heavy pages (Next.js / React SPAs). */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let browserPromise = null;
let launchFailed = false;

export function disableBrowserRendering() {
  launchFailed = true;
  browserPromise = null;
}

function ensureBrowserPath() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const here = dirname(fileURLToPath(import.meta.url));
    process.env.PLAYWRIGHT_BROWSERS_PATH = join(here, '../../.playwright-browsers');
  }
}

async function getBrowser() {
  if (launchFailed) throw new Error('browser unavailable');
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    ensureBrowserPath();
    const { chromium } = await import('playwright');
    return chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  })().catch((err) => {
    browserPromise = null;
    launchFailed = true;
    throw err;
  });
  return browserPromise;
}

export async function isBrowserRenderingAvailable() {
  if (launchFailed) return false;
  try {
    await getBrowser();
    return true;
  } catch {
    launchFailed = true;
    return false;
  }
}

export async function renderPageHtml(url, { timeoutMs = 20000 } = {}) {
  if (launchFailed) throw new Error('browser unavailable');
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    });

    await page
      .waitForFunction(
        () => {
          const root = document.querySelector('main, [role="main"], #root, #app, article');
          const text = (root?.innerText || document.body?.innerText || '').replace(/\s+/g, ' ').trim();
          if (text.length > 120) return true;
          const h1 = document.querySelector('main h1, h1');
          const heading = h1?.textContent?.trim() || '';
          return heading.length > 2 && !/^loading/i.test(heading);
        },
        { timeout: 8000 }
      )
      .catch(() => {});

    await page.waitForTimeout(500);
    return await page.content();
  } catch (err) {
    if (/closed|crashed|killed/i.test(String(err.message))) {
      launchFailed = true;
      browserPromise = null;
    }
    throw err;
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    /* ignore */
  }
  browserPromise = null;
}
