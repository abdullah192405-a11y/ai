import { query, generateApiKey } from '../db.js';
import { formatDateAr } from '../utils/dates.js';

function mapKeyRow(k) {
  return {
    id: k.id,
    name: k.name || 'مفتاح',
    key: `${k.key_prefix}…`,
    status: k.revoked ? 'revoked' : 'active',
    created: formatDateAr(k.created_at),
    lastUsed: k.last_used_at ? formatDateAr(k.last_used_at) : '—',
    tenant: k.tenant_name,
    scope: (k.scopes || [])[0] || 'read:assistant',
  };
}

export async function revokeAdminApiKey(keyId) {
  const { rows } = await query(
    'UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND NOT revoked RETURNING id',
    [keyId]
  );
  if (!rows.length) {
    const err = new Error('المفتاح غير موجود أو مُلغى مسبقاً');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

export async function rotateAdminApiKey(keyId) {
  const { rows } = await query(
    `SELECT k.id, k.tenant_id, k.name, k.scopes, k.website_id, t.name AS tenant_name
       FROM api_keys k
       JOIN tenants t ON t.id = k.tenant_id
      WHERE k.id = $1 AND NOT k.revoked`,
    [keyId]
  );
  const existing = rows[0];
  if (!existing) {
    const err = new Error('المفتاح غير موجود أو مُلغى');
    err.status = 404;
    throw err;
  }

  const { key, hash, prefix } = generateApiKey();
  await query('UPDATE api_keys SET revoked = TRUE WHERE id = $1', [keyId]);

  const { rows: created } = await query(
    `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, scopes, website_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, key_prefix, name, scopes, revoked, last_used_at, created_at`,
    [
      existing.tenant_id,
      hash,
      prefix,
      existing.name,
      existing.scopes,
      existing.website_id,
    ]
  );

  return {
    ...mapKeyRow({ ...created[0], tenant_name: existing.tenant_name }),
    key,
    rotatedFrom: keyId,
  };
}

export async function updateAdminApiKey(keyId, { name }) {
  if (!name || !String(name).trim()) {
    const err = new Error('اسم المفتاح مطلوب');
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    'UPDATE api_keys SET name = $1 WHERE id = $2 RETURNING id',
    [String(name).trim(), keyId]
  );
  if (!rows.length) {
    const err = new Error('المفتاح غير موجود');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}
