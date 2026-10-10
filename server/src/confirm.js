import crypto from 'node:crypto';

/*
 * Stateless "payment received" links for bank-transfer orders.
 * The order details travel inside the link and are signed with RECEIPT_SECRET, so nobody can forge or edit one.
 * No database needed. Only the shop owner receives these links (inside the [AWAITING PAYMENT] email).
 */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const sign = (d, secret) => crypto.createHmac('sha256', secret).update(d).digest('base64url');

export const confirmEnabled = () => Boolean(process.env.RECEIPT_SECRET);

export function makeToken(order, secret = process.env.RECEIPT_SECRET, now = Date.now()) {
  const payload = {
    ref: order.ref, name: order.name, email: order.email, phone: order.phone, address: order.address,
    items: order.items.map((i) => ({ id: i.id, qty: i.qty })), t: now,
  };
  const d = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { d, s: sign(d, secret) };
}

/** Returns the order fields if the signature is valid and the link is not too old, otherwise null. */
export function readToken(d, s, secret = process.env.RECEIPT_SECRET, now = Date.now()) {
  if (!secret || typeof d !== 'string' || typeof s !== 'string' || d.length > 8000) return null;
  const a = Buffer.from(sign(d, secret));
  const b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(d, 'base64url').toString('utf8'));
    if (!p || typeof p.t !== 'number' || now - p.t > MAX_AGE_MS || p.t > now + 60000) return null;
    return p;
  } catch {
    return null;
  }
}

export function confirmUrl(order, base = process.env.API_PUBLIC_URL || 'http://localhost:4000') {
  const { d, s } = makeToken(order);
  return `${base.replace(/\/$/, '')}/api/orders/confirm?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`;
}
