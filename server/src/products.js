import { clean } from './validate.js';

/* Web addresses that already mean something on the site. A product can't use them. */
export const RESERVED_SLUGS = new Set(['order', 'admin', 'api', 'assets', 'login', 'cart', 'checkout', 'index', 'favicon']);

export const slugify = (s) =>
  String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Database row -> the shape the website uses. */
export const toApi = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  purpose: r.purpose || '',
  desc: r.description || '',
  netWeight: r.net_weight || '',
  price: r.price,
  regularPrice: r.regular_price ?? r.price,
  images: Array.isArray(r.images) ? r.images : [],
  active: r.active !== false,
  sortOrder: r.sort_order || 0,
  ...(r.details && typeof r.details === 'object' ? r.details : {}),
});

const int = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const list = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : []).map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems);

function cleanNutrition(n) {
  if (!n || typeof n !== 'object' || !Array.isArray(n.rows)) return null;
  const rows = n.rows
    .map((r) => (Array.isArray(r) ? [clean(r[0], 60), clean(r[1], 80)] : null))
    .filter((r) => r && r[0] && r[1])
    .slice(0, 20);
  return rows.length ? { basis: clean(n.basis, 40) || 'Per 100 g', rows } : null;
}

/** Validates what the admin form sends. Returns { ok, row } (database columns) or { ok:false, errors }. */
export function validateProduct(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const name = clean(b.name, 100);
  if (!name) errors.name = 'Enter a product name.';

  const slug = slugify(b.slug || name);
  if (!slug) errors.slug = 'Enter a web address for the product page.';
  else if (RESERVED_SLUGS.has(slug)) errors.slug = `"${slug}" is reserved. Choose a different web address.`;

  const price = int(b.price);
  if (!Number.isInteger(price) || price < 100 || price > 10_000_000) errors.price = 'Enter the selling price in naira (at least 100).';

  let regularPrice = int(b.regularPrice);
  if (Number.isNaN(regularPrice)) regularPrice = price;
  if (Number.isInteger(price) && (!Number.isInteger(regularPrice) || regularPrice < price)) {
    errors.regularPrice = 'The regular price must be the same as or higher than the selling price.';
  }

  const images = (Array.isArray(b.images) ? b.images : [])
    .map((u) => clean(u, 500))
    .filter((u) => /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/i.test(u)) // https only, except a local test database
    .slice(0, 6);

  const sortOrder = Number.isInteger(int(b.sortOrder)) ? Math.max(-1000, Math.min(1000, int(b.sortOrder))) : 0;

  if (Object.keys(errors).length) return { ok: false, errors };

  const details = {
    formula: clean(b.formula, 20),
    type: clean(b.type, 80),
    what: clean(b.what, 1000),
    who: list(b.who, 10, 200),
    uses: list(b.uses, 12, 60),
    ingredients: list(b.ingredients, 40, 60),
    allergens: Array.isArray(b.allergens) && list(b.allergens, 12, 40).length ? list(b.allergens, 12, 40) : null,
    directions: clean(b.directions, 600) || null,
    storage: clean(b.storage, 400),
    nutrition: cleanNutrition(b.nutrition),
  };

  return {
    ok: true,
    row: {
      slug, name,
      purpose: clean(b.purpose, 60),
      description: clean(b.desc, 600),
      net_weight: clean(b.netWeight, 30),
      price, regular_price: regularPrice,
      images,
      details,
      active: b.active !== false,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    },
  };
}

export const newProductId = () => 'p-' + Math.random().toString(36).slice(2, 10);
