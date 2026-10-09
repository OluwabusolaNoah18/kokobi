import { API_URL } from './data.js';

async function request(path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, httpStatus: res.status, errors: data.errors || null, message: data.message || 'Something went wrong.' };
    return { ok: true, ...data };
  } catch {
    return { ok: false, message: 'We could not reach the order server.' };
  } finally {
    clearTimeout(timer);
  }
}

const post = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Bank transfer: the backend emails the order to the Kokobi+ owner. */
export const submitOrder = (order) => post('/api/orders', order);

/** Paystack: returns { ok, ref, url } where url is Paystack's hosted checkout page. */
export const startPaystack = (order) => post('/api/paystack/initialize', order);

/** After Paystack redirects back: confirms the payment and triggers the receipt. */
export const verifyPayment = (ref) => request(`/api/paystack/verify/${encodeURIComponent(ref)}`);
