import { CATALOG, MAX_QTY } from './catalog.js';
import { discountFor } from './pricing.js';

const PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const REF_RE = /^KB-\d{6}-[A-Z0-9]{4}$/;

export const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

/**
 * Validates an order payload. Returns { ok:true, order } or { ok:false, errors }.
 * `order` contains only sanitised values and server-calculated prices.
 *
 * ctx (all optional):
 *   catalog   { id: { name, price } } prices to use (default: the built-in list)
 *   promo     a promo record found by the caller { code, kind, value, minOrder }
 *   promoError message to show if a code was typed but not found
 *   snapshot  { discount, promoCode } a discount that was already agreed when the order was placed
 *             (used when rebuilding an order from a paid Paystack transaction or a signed link)
 */
export function validateOrder(body, makeRef, ctx = {}) {
  const catalog = ctx.catalog || CATALOG;
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const name = clean(b.name, 100);
  const email = clean(b.email, 120).toLowerCase();
  const phone = clean(b.phone, 20);
  const fulfilment = b.fulfilment === 'pickup' ? 'pickup' : 'delivery'; // older orders had no choice: they were deliveries
  const address = fulfilment === 'pickup' ? '' : clean(b.address, 300);
  const note = clean(b.note, 500);

  if (!name) errors.name = 'Enter your name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email, like name@example.com.';
  if (!PHONE_RE.test(phone.replace(/[\s-]/g, ''))) errors.phone = 'Enter a Nigerian number, like 0704 877 9681.';
  if (fulfilment === 'delivery' && !address) errors.address = 'Enter your delivery address.';

  const merged = new Map();
  let unavailable = false;
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      const id = String(it?.id ?? '');
      const qty = Number.parseInt(it?.qty, 10);
      if (!Number.isInteger(qty) || qty < 1) continue;
      if (!Object.hasOwn(catalog, id)) { unavailable = true; continue; }
      merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
    }
  }
  const items = [...merged].map(([id, qty]) => ({
    id, qty, name: catalog[id].name, unitPrice: catalog[id].price, lineTotal: catalog[id].price * qty,
  }));
  if (unavailable) errors.items = 'One of the items is no longer available. Please refresh the page and choose again.';
  else if (!items.length) errors.items = 'Choose at least one pack.';

  const subtotal = items.reduce((t, i) => t + i.lineTotal, 0);
  let discount = 0;
  let promoCode = '';
  if (ctx.snapshot) {
    discount = Math.max(0, Math.min(Number.parseInt(ctx.snapshot.discount, 10) || 0, subtotal));
    promoCode = clean(ctx.snapshot.promoCode, 30);
  } else if (clean(b.promoCode, 40)) {
    if (!ctx.promo) errors.promoCode = ctx.promoError || 'That code is not valid.';
    else {
      const r = discountFor(ctx.promo, subtotal);
      if (r.error) errors.promoCode = r.error;
      else { discount = r.discount; promoCode = ctx.promo.code; }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const ref = REF_RE.test(String(b.ref ?? '')) ? String(b.ref) : makeRef();
  const total = subtotal - discount;
  return { ok: true, order: { ref, name, email, phone, fulfilment, address, note, items, subtotal, discount, promoCode, total } };
}
