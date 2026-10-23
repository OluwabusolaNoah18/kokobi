import { validateOrder } from './validate.js';
import { CATALOG } from './catalog.js';

/*
 * An order's prices and discount are frozen at the moment it is placed, so changing a price later
 * (in /admin) never breaks a payment already in flight or an old "send receipt" link.
 */
export const snapshotOf = (o) => ({
  lines: o.items.map((i) => ({ id: i.id, qty: i.qty, name: i.name, unitPrice: i.unitPrice })),
  discount: o.discount || 0,
  promoCode: o.promoCode || '',
});

/** Rebuilds a validated order from stored data (Paystack metadata or a signed link payload). */
export function rebuildOrder(raw, ref, fallbackCatalog = CATALOG) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (Array.isArray(r.lines) && r.lines.length) {
    const catalog = {};
    for (const l of r.lines) {
      const price = Number.parseInt(l?.unitPrice, 10);
      if (l && typeof l.id === 'string' && Number.isInteger(price) && price >= 0) catalog[l.id] = { name: String(l.name ?? l.id), price };
    }
    const items = r.lines.map((l) => ({ id: l.id, qty: l.qty }));
    return validateOrder({ ...r, items, ref }, () => ref, { catalog, snapshot: { discount: r.discount, promoCode: r.promoCode } });
  }
  // Older orders (placed before prices were stored with them)
  return validateOrder({ ...r, ref }, () => ref, { catalog: fallbackCatalog });
}
