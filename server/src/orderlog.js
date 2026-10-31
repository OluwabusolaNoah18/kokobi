import { dbConfigured, upsert, select } from './db.js';

/*
 * Keeps a record of orders so you can see them in /admin. It is best effort: a database problem
 * is logged but never stops a customer's order or payment from going through.
 */
export async function recordOrder(o, { method, status, paidAt = null, fee = 0, charged = null, createdAt = null, strict = false, deliveredAt = undefined }) {
  if (!dbConfigured()) return;
  try {
    await upsert('orders', {
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(deliveredAt !== undefined ? { delivered_at: deliveredAt } : {}), // only sent when given, so older databases keep working
      ref: o.ref, status, method, fulfilment: o.fulfilment,
      name: o.name, email: o.email, phone: o.phone, address: o.address || '', note: o.note || '',
      items: o.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: o.subtotal ?? o.total, discount: o.discount || 0, promo_code: o.promoCode || null,
      total: o.total, fee, charged: charged ?? o.total, paid_at: paidAt,
    }, 'ref');
  } catch (err) {
    if (strict) throw err; // admin sales must not pretend to be saved
    console.error(`Order ${o.ref}: could not save to the database:`, err.message);
  }
}

export const orderToApi = (r) => ({
  ref: r.ref, createdAt: r.created_at, status: r.status, method: r.method, fulfilment: r.fulfilment,
  name: r.name, email: r.email, phone: r.phone, address: r.address, note: r.note,
  items: Array.isArray(r.items) ? r.items : [], subtotal: r.subtotal, discount: r.discount, promoCode: r.promo_code,
  total: r.total, fee: r.fee, charged: r.charged, paidAt: r.paid_at,
  deliveredAt: r.delivered_at || null, deliveryNote: r.delivery_note || '',
});

export const listOrders = async (limit = 100) =>
  (await select('orders', `?select=*&order=created_at.desc&limit=${Math.max(1, Math.min(500, limit))}`)).map(orderToApi);
