import { Resolver } from 'node:dns';
import { promisify } from 'node:util';
import { isLocalDevDomain } from './userDashboard.js';

/** Public resolvers — TXT propagation differs; succeed if any sees the token. */
const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8', '8.8.4.4', '9.9.9.9'];

function createResolver(server) {
  const resolver = new Resolver();
  resolver.setServers([server]);
  return promisify(resolver.resolveTxt.bind(resolver));
}

async function resolveTxtFrom(server, host) {
  const resolveTxt = createResolver(server);
  const chunks = await resolveTxt(host);
  return chunks.map((parts) => parts.join(''));
}

function tokenMatches(records, expectedToken) {
  for (const value of records) {
    const trimmed = value.trim();
    if (trimmed === expectedToken || trimmed.includes(expectedToken)) {
      return { match: true, record: trimmed };
    }
  }
  return { match: false };
}

/**
 * Look up TXT records on the apex domain (and optional _wba subdomain).
 * Returns true when the expected verification token is present.
 */
export async function verifyDomainDns(domain, expectedToken) {
  if (!expectedToken) {
    return { verified: true, reason: 'no_token_required' };
  }

  const hostname = String(domain || '').split(':')[0].toLowerCase();
  if (!hostname || isLocalDevDomain(domain)) {
    return { verified: true, reason: 'local_dev' };
  }

  const hosts = [hostname, `_wba.${hostname}`];
  const tried = [];

  for (const host of hosts) {
    for (const server of PUBLIC_DNS_SERVERS) {
      try {
        const records = await resolveTxtFrom(server, host);
        tried.push({ host, server, records });
        const { match, record } = tokenMatches(records, expectedToken);
        if (match) {
          return { verified: true, host, server, record };
        }
      } catch (err) {
        tried.push({ host, server, error: err.code || err.message });
      }
    }
  }

  return {
    verified: false,
    message: `لم يُعثر على سجل TXT على ${hostname} بعد. تأكد أن القيمة هي ${expectedToken} على النطاق @ (أو _wba) — قد يستغرق انتشار DNS من دقائق إلى 48 ساعة.`,
    tried,
  };
}
