import { dbConfigured, select } from './db.js';

/*
 * Server-side source of truth for prices. The browser's total is never trusted.
 * When Supabase is configured, products come from the database (so you can change them in /admin).
 * Otherwise this built-in list is used, so the site keeps working without a database.
 */
export const CATALOG = {
  'kb-a': { name: 'Kokobi+ Formula A', price: 3600 },
  'kb-b': { name: 'Kokobi+ Formula B', price: 3600 },
};
export const MAX_QTY = 20;

const TTL_MS = 20 * 1000; // how long a fetched product list is reused
const STALE_MS = 10 * 60 * 1000; // if the database hiccups, a list this young may still be used
let cache = null;

export const invalidateCatalog = () => { cache = null; };

/** Active products straight from the database (cached briefly). Returns null when no database is configured. */
export async function getProductRows() {
  if (!dbConfigured()) return null;
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  try {
    const rows = await select('products', '?select=*&active=eq.true&order=sort_order.asc,created_at.asc');
    cache = { at: now, rows };
    return rows;
  } catch (err) {
    if (cache && now - cache.at < STALE_MS) return cache.rows;
    throw err;
  }
}

/** { id: { name, price } } for everything that can currently be ordered. */
export async function getCatalog() {
  const rows = await getProductRows();
  if (!rows) return CATALOG;
  return Object.fromEntries(rows.map((r) => [r.id, { name: r.name, price: r.price }]));
}
