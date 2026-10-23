/*
 * Tiny Supabase client using plain fetch (no extra packages).
 * Uses the SECRET / service-role key, so it only ever runs on the server. Never expose that key to the browser.
 */
const url = () => (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = () => (process.env.SUPABASE_SERVICE_KEY || '').trim();
const BUCKET = () => process.env.SUPABASE_BUCKET || 'product-images';

export const dbConfigured = () => Boolean(url() && key());

const authHeaders = () => {
  const k = key();
  // Legacy service_role keys are JWTs and go in both headers. New "sb_secret_" keys go in apikey only.
  return k.startsWith('eyJ') ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k };
};

async function call(path, init = {}) {
  if (!dbConfigured()) throw Object.assign(new Error('Database is not configured'), { status: 503 });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${url()}${path}`, { ...init, headers: { ...authHeaders(), ...init.headers }, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fail(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  throw Object.assign(new Error(body?.message || `Database error ${res.status}`), { status: res.status, code: body?.code, body });
}

async function rest(method, table, { query = '', body, prefer } = {}) {
  const res = await call(`/rest/v1/${table}${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** select('products', '?select=*&active=eq.true') -> array of rows */
export const select = (table, query = '') => rest('GET', table, { query });
/** insert one row and return it */
export const insert = async (table, row) => (await rest('POST', table, { body: row, prefer: 'return=representation' }))?.[0] ?? null;
/** insert or update by a unique column (default primary key) */
export const upsert = (table, row, onConflict) =>
  rest('POST', table, { query: onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });
/** update rows matching a filter, e.g. update('products', 'id=eq.p-1', {...}) -> updated rows */
export const update = (table, filter, patch) =>
  rest('PATCH', table, { query: `?${filter}`, body: patch, prefer: 'return=representation' });
export const remove = (table, filter) => rest('DELETE', table, { query: `?${filter}`, prefer: 'return=representation' });

/** Number of rows matching a filter (uses the Content-Range header). */
export async function count(table, filter) {
  const res = await call(`/rest/v1/${table}?select=ref&${filter}`, { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) await fail(res);
  const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
  return m ? Number(m[1]) : 0;
}

/** Uploads an image to the public storage bucket and returns its public URL. */
export async function uploadImage(path, buffer, contentType) {
  const res = await call(`/storage/v1/object/${BUCKET()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: buffer,
  });
  if (!res.ok) await fail(res);
  return `${url()}/storage/v1/object/public/${BUCKET()}/${path}`;
}
