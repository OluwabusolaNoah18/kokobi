import { dbConfigured, select, insert, update, remove, uploadImage } from './db.js';
import { checkPassword, makeAdminToken, adminEnabled, requireAdmin } from './adminAuth.js';
import { validateProduct, newProductId, toApi } from './products.js';
import { validatePromo, promoToApi } from './promos.js';
import { listOrders } from './orderlog.js';
import { invalidateCatalog } from './catalog.js';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ID_RE = /^[a-z0-9-]{1,40}$/;
const CODE_RE = /^[A-Z0-9_-]{3,30}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wraps a handler so database problems become a friendly message instead of a crash. */
export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('Admin request failed:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'That already exists. Choose a different one.', errors: { [err.field || 'slug']: 'That one is already in use.' } });
    }
    res.status(err.status && err.status < 600 ? err.status : 500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const dbGuard = (_req, res, next) =>
  dbConfigured() ? next() : res.status(503).json({ message: 'The database is not connected yet. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to the backend settings.' });

/* ---- sign in ---- */
export async function login(req, res) {
  if (!adminEnabled()) return res.status(503).json({ message: 'Admin is not set up. Add ADMIN_PASSWORD (at least 8 characters) to the backend settings.' });
  if (!checkPassword(req.body?.password)) {
    await sleep(500); // slows down guessing
    return res.status(401).json({ message: 'That password is not right.' });
  }
  res.json({ ok: true, ...makeAdminToken(), dbReady: dbConfigured() });
}

/* ---- products ---- */
export async function listProducts(_req, res) {
  const rows = await select('products', '?select=*&order=sort_order.asc,created_at.asc');
  res.json({ products: rows.map(toApi) });
}

export async function createProduct(req, res) {
  const v = validateProduct(req.body);
  if (!v.ok) return res.status(400).json({ message: 'Please check the highlighted fields.', errors: v.errors });
  try {
    const row = await insert('products', { id: newProductId(), ...v.row });
    invalidateCatalog();
    res.status(201).json({ product: toApi(row) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Another product already uses that web address.', errors: { slug: 'Another product already uses this web address.' } });
    throw err;
  }
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ message: 'Unknown product.' });
  const v = validateProduct(req.body);
  if (!v.ok) return res.status(400).json({ message: 'Please check the highlighted fields.', errors: v.errors });
  try {
    const rows = await update('products', `id=eq.${id}`, v.row);
    if (!rows?.length) return res.status(404).json({ message: 'That product was not found.' });
    invalidateCatalog();
    res.json({ product: toApi(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Another product already uses that web address.', errors: { slug: 'Another product already uses this web address.' } });
    throw err;
  }
}

export async function deleteProduct(req, res) {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ message: 'Unknown product.' });
  const rows = await remove('products', `id=eq.${id}`);
  if (!rows?.length) return res.status(404).json({ message: 'That product was not found.' });
  invalidateCatalog();
  res.json({ ok: true });
}

/* ---- promo codes ---- */
export async function listPromos(_req, res) {
  const rows = await select('promo_codes', '?select=*&order=created_at.desc');
  res.json({ promos: rows.map(promoToApi) });
}

export async function createPromo(req, res) {
  const v = validatePromo(req.body);
  if (!v.ok) return res.status(400).json({ message: 'Please check the highlighted fields.', errors: v.errors });
  try {
    const row = await insert('promo_codes', v.row);
    res.status(201).json({ promo: promoToApi(row) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'That code already exists.', errors: { code: 'That code already exists.' } });
    throw err;
  }
}

export async function updatePromo(req, res) {
  const code = String(req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ message: 'Unknown code.' });
  const v = validatePromo({ ...req.body, code });
  if (!v.ok) return res.status(400).json({ message: 'Please check the highlighted fields.', errors: v.errors });
  const { code: _same, ...patch } = v.row;
  const rows = await update('promo_codes', `code=eq.${encodeURIComponent(code)}`, patch);
  if (!rows?.length) return res.status(404).json({ message: 'That code was not found.' });
  res.json({ promo: promoToApi(rows[0]) });
}

export async function deletePromo(req, res) {
  const code = String(req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ message: 'Unknown code.' });
  const rows = await remove('promo_codes', `code=eq.${encodeURIComponent(code)}`);
  if (!rows?.length) return res.status(404).json({ message: 'That code was not found.' });
  res.json({ ok: true });
}

/* ---- orders ---- */
export async function getOrders(req, res) {
  res.json({ orders: await listOrders(Number.parseInt(req.query.limit, 10) || 100) });
}

/* ---- product photos ---- */
const sniff = (b) => {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['image/png', 'png'];
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return ['image/webp', 'webp'];
  return null;
};

export async function uploadPhoto(req, res) {
  const raw = String(req.body?.data ?? '').replace(/^data:[^,]*,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) return res.status(400).json({ message: 'No image received.' });
  if (buf.length > MAX_IMAGE_BYTES) return res.status(413).json({ message: 'That image is too large. Please use one under 3 MB.' });
  const kind = sniff(buf); // judge by the file's real contents, not what the browser claims
  if (!kind) return res.status(400).json({ message: 'Please upload a JPG, PNG or WebP image.' });
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind[1]}`;
  const url = await uploadImage(path, buf, kind[0]);
  res.json({ ok: true, url });
}

/** Mounts everything under /api/admin. Body parsing is set up in index.js. */
export function registerAdmin(app, express, { loginLimiter }) {
  const r = express.Router();
  r.post('/login', loginLimiter, handle(login));
  r.use(requireAdmin, dbGuard);
  r.get('/products', handle(listProducts));
  r.post('/products', handle(createProduct));
  r.put('/products/:id', handle(updateProduct));
  r.delete('/products/:id', handle(deleteProduct));
  r.get('/promos', handle(listPromos));
  r.post('/promos', handle(createPromo));
  r.put('/promos/:code', handle(updatePromo));
  r.delete('/promos/:code', handle(deletePromo));
  r.get('/orders', handle(getOrders));
  r.post('/upload', handle(uploadPhoto));
  app.use('/api/admin', r);
}
