import { naira, waNumber } from './format.js';

export const WALKIN = 'Walk-in customer';
const MAX_QTY = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

/**
 * Checks a cash sale typed into the admin and builds the order from the CURRENT product prices.
 * products = rows of { id, name, price }. Name, email and phone are all optional.
 * Returns { ok, order } or { ok:false, errors }.
 */
export function validateSale(body, products, makeRef, now = new Date()) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const name = str(b.name, 80) || WALKIN;
  const email = str(b.email, 120).toLowerCase();
  const phone = str(b.phone, 30);
  const note = str(b.note, 300);
  if (email && !EMAIL_RE.test(email)) errors.email = 'That email address does not look right.';
  if (phone && !/^[\d\s+()-]{7,30}$/.test(phone)) errors.phone = 'That phone number does not look right.';

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const qtys = new Map();
  if (!Array.isArray(b.items)) errors.items = 'Choose at least one product.';
  else {
    for (const it of b.items) {
      const qty = Number.parseInt(it?.qty, 10);
      if (!it || !byId.has(it.id) || !Number.isInteger(qty) || qty < 1) continue;
      if (qty > MAX_QTY) { errors.items = `Quantity cannot be more than ${MAX_QTY}.`; continue; }
      qtys.set(it.id, (qtys.get(it.id) || 0) + qty);
    }
    if (!qtys.size && !errors.items) errors.items = 'Choose at least one product.';
  }
  const items = [...qtys].map(([id, qty]) => {
    const p = byId.get(id);
    return { id, name: p.name, qty, unitPrice: p.price, lineTotal: p.price * qty };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);

  let discount = 0;
  if (String(b.discount ?? '').trim() !== '') {
    discount = Number(b.discount);
    if (!Number.isInteger(discount) || discount < 0) errors.discount = 'Enter the discount as a whole number of naira.';
    else if (discount >= subtotal && subtotal > 0) errors.discount = 'The discount must be less than the total.';
  }

  let paidAt = now.toISOString();
  const date = str(b.date, 10);
  if (date) {
    const d = new Date(`${date}T12:00:00+01:00`); // noon in Lagos
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime())) errors.date = 'Enter a valid date.';
    else if (d.getTime() > now.getTime() + 24 * 3600e3) errors.date = 'The date cannot be in the future.';
    else if (d.getTime() < now.getTime() - 800 * 24 * 3600e3) errors.date = 'That date is too far back.';
    else if (date !== now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })) paidAt = d.toISOString(); // today keeps the real time, so it sorts correctly
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  const total = subtotal - discount;
  return {
    ok: true,
    order: { ref: makeRef(), name, email, phone, fulfilment: 'instore', address: '', note, items, subtotal, discount, promoCode: '', total, paidAt },
  };
}

/** A WhatsApp link that opens a ready-written receipt message (for customers without email). */
export function receiptWhatsAppUrl(o) {
  const first = o.name && o.name !== WALKIN ? ` ${o.name.split(' ')[0]}` : '';
  const lines = [
    `Hi${first}! Thank you for your purchase from Kokobi+. Here is your receipt.`,
    `Order: ${o.ref}`,
    ...o.items.map((i) => `${i.qty} x ${i.name} = ${naira(i.lineTotal)}`),
    ...(o.discount ? [`Discount: -${naira(o.discount)}`] : []),
    `Total paid (cash): ${naira(o.total)}`,
  ];
  const text = encodeURIComponent(lines.join('\n'));
  const num = o.phone ? waNumber(o.phone).replace(/\D/g, '') : '';
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Rebuilds an order object from a saved database row. */
export const orderFromRow = (r) => ({
  ref: r.ref, name: r.name, email: r.email || '', phone: r.phone || '', fulfilment: r.fulfilment, address: r.address || '', note: r.note || '',
  items: Array.isArray(r.items) ? r.items : [], subtotal: r.subtotal, discount: r.discount || 0, promoCode: r.promo_code || '',
  total: r.total, fee: r.fee || 0, charged: r.charged || r.total, paidAt: r.paid_at || r.created_at,
});
