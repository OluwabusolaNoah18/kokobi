import { CATALOG, MAX_QTY } from './catalog.js';

const PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const REF_RE = /^KB-\d{6}-[A-Z0-9]{4}$/;

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

/**
 * Validates an order payload. Returns { ok:true, order } or { ok:false, errors }.
 * `order` contains only sanitised values and server-calculated prices.
 */
export function validateOrder(body, makeRef) {
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
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      const id = String(it?.id ?? '');
      const qty = Number.parseInt(it?.qty, 10);
      if (!CATALOG[id] || !Number.isInteger(qty) || qty < 1) continue;
      merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
    }
  }
  const items = [...merged].map(([id, qty]) => ({
    id, qty, name: CATALOG[id].name, unitPrice: CATALOG[id].price, lineTotal: CATALOG[id].price * qty,
  }));
  if (!items.length) errors.items = 'Choose at least one pack.';

  if (Object.keys(errors).length) return { ok: false, errors };

  const ref = REF_RE.test(String(b.ref ?? '')) ? String(b.ref) : makeRef();
  const total = items.reduce((t, i) => t + i.lineTotal, 0);
  return { ok: true, order: { ref, name, email, phone, fulfilment, address, note, items, total } };
}
