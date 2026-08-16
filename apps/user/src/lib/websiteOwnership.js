/** Local/dev sites have no token and are treated as owned. */
export function isWebsiteOwned(site) {
  if (!site) return false;
  return Boolean(site.verified) || !site.verificationToken;
}

export function needsOwnershipVerify(site) {
  return Boolean(site && !site.verified && site.verificationToken);
}

/** Crawl URL for the selected website — no separate “save link” step. */
export function crawlUrlFromWebsite(site, existing) {
  const fromCfg = String(existing || '').trim();
  if (/^https?:\/\//i.test(fromCfg)) return fromCfg;
  const d = String(site?.domain || '').trim();
  if (!d) return '';
  if (/^(localhost|127\.|0\.0\.0\.0)/i.test(d) || d.includes(':')) return `http://${d}`;
  return `https://${d}`;
}
