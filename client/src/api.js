import { API_URL } from './data.js';

async function request(path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctrl.signal });
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, errors: (data && data.errors) || null, message: (data && data.message) || `The server answered ${res.status} ${res.statusText}. Check that the website points at the backend.` };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, httpStatus: res.status, message: `The server answered ${res.status} with no data. The website is probably not pointing at the backend (check VITE_API_URL, then redeploy).` };
    }
    return { ...data, ok: data.ok !== false }; // a 200 reply can still say ok:false (for example, a promo code that is not valid)
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

/** The products on sale. { source: 'database' | 'static', products: [...] } */
export const getProducts = () => request('/api/products');

/** Checks a promo code against the cart. */
export const checkPromo = (code, items) => post('/api/promo/check', { code, items });

/** After Paystack redirects back: confirms the payment and triggers the receipt. */
export const verifyPayment = (ref) => request(`/api/paystack/verify/${encodeURIComponent(ref)}`);
