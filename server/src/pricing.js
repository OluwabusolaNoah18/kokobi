/** Pure discount maths, shared by order validation and the promo-check endpoint. */
export const MIN_PAYABLE = 100; // an order can never be discounted below NGN 100 (Paystack needs a real amount)

export const normalizeCode = (c) => String(c ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);

export const promoLabel = (p) => (p.kind === 'percent' ? `${p.value}% off` : `₦${Number(p.value).toLocaleString('en-NG')} off`);

/** Returns { discount } or { error }. promo = { code, kind: 'percent'|'amount', value, minOrder } */
export function discountFor(promo, subtotal) {
  if (!promo) return { discount: 0 };
  if (promo.minOrder && subtotal < promo.minOrder) {
    return { error: `Spend at least ₦${Number(promo.minOrder).toLocaleString('en-NG')} to use this code.` };
  }
  const raw = promo.kind === 'percent' ? Math.floor((subtotal * promo.value) / 100) : Math.min(promo.value, subtotal);
  return { discount: Math.max(0, Math.min(raw, Math.max(0, subtotal - MIN_PAYABLE))) };
}
