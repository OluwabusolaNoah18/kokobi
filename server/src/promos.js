import { clean } from './validate.js';
import { dbConfigured, select, count } from './db.js';
import { normalizeCode } from './pricing.js';

export const promoToApi = (r) => ({
  code: r.code, kind: r.kind, value: r.value, active: r.active !== false,
  minOrder: r.min_order || 0, maxUses: r.max_uses ?? null, expiresAt: r.expires_at || null,
});

const NOT_VALID = 'That code is not valid or has expired.';

/** Finds a code a customer typed and checks it can be used right now. Returns { promo } or { error }. */
export async function lookupPromo(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { error: 'Enter a promo code.' };
  if (!dbConfigured()) return { error: 'Promo codes are not available right now.' };
  const rows = await select('promo_codes', `?select=*&code=eq.${encodeURIComponent(code)}&limit=1`);
  const row = rows?.[0];
  if (!row || row.active === false) return { error: NOT_VALID };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { error: NOT_VALID };
  if (row.max_uses != null) {
    const used = await count('orders', `promo_code=eq.${encodeURIComponent(code)}`);
    if (used >= row.max_uses) return { error: 'This code has reached its limit.' };
  }
  return { promo: promoToApi(row) };
}

const int = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** Validates what the admin form sends for a promo code. */
export function validatePromo(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const code = normalizeCode(b.code);
  if (code.length < 3) errors.code = 'Use at least 3 letters or numbers, for example WELCOME10.';

  const kind = b.kind === 'amount' ? 'amount' : 'percent';
  const value = int(b.value);
  if (kind === 'percent' && !(Number.isInteger(value) && value >= 1 && value <= 90)) errors.value = 'Enter a percentage between 1 and 90.';
  if (kind === 'amount' && !(Number.isInteger(value) && value >= 100 && value <= 1_000_000)) errors.value = 'Enter an amount in naira (at least 100).';

  let minOrder = int(b.minOrder);
  if (Number.isNaN(minOrder)) minOrder = 0;
  if (!Number.isInteger(minOrder) || minOrder < 0) errors.minOrder = 'Enter 0 or a naira amount.';

  let maxUses = int(b.maxUses);
  if (Number.isNaN(maxUses)) maxUses = null;
  else if (!Number.isInteger(maxUses) || maxUses < 1) errors.maxUses = 'Leave empty for unlimited, or enter 1 or more.';

  let expiresAt = null;
  const d = clean(b.expiresAt, 10);
  if (d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) errors.expiresAt = 'Choose a valid date.';
    else expiresAt = `${d}T23:59:59+01:00`; // end of that day, Nigerian time
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, row: { code, kind, value, min_order: minOrder, max_uses: maxUses, expires_at: expiresAt, active: b.active !== false } };
}
