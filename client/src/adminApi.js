import { API_URL } from './data.js';

async function call(method, path, token, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${API_URL}/api/admin${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) return { ok: false, status: res.status, errors: data.errors || null, message: data.message || `The server answered ${res.status}.` };
    return { ...data, ok: true, status: res.status };
  } catch {
    return { ok: false, status: 0, message: 'We could not reach the server. Check your internet and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

export const adminApi = {
  login: (password) => call('POST', '/login', null, { password }),
  products: (t) => call('GET', '/products', t),
  saveProduct: (t, p) => (p.id ? call('PUT', `/products/${encodeURIComponent(p.id)}`, t, p) : call('POST', '/products', t, p)),
  deleteProduct: (t, id) => call('DELETE', `/products/${encodeURIComponent(id)}`, t),
  promos: (t) => call('GET', '/promos', t),
  savePromo: (t, p, isNew) => (isNew ? call('POST', '/promos', t, p) : call('PUT', `/promos/${encodeURIComponent(p.code)}`, t, p)),
  deletePromo: (t, code) => call('DELETE', `/promos/${encodeURIComponent(code)}`, t),
  orders: (t) => call('GET', '/orders?limit=200', t),
  summary: (t, from, to) => call('GET', `/summary?from=${from}&to=${to}`, t),
  logSale: (t, sale) => call('POST', '/sales', t, sale),
  sendReceipt: (t, ref, email) => call('POST', `/orders/${encodeURIComponent(ref)}/receipt`, t, { email }),
  deleteSale: (t, ref) => call('DELETE', `/orders/${encodeURIComponent(ref)}`, t),
  upload: (t, data) => call('POST', '/upload', t, { data }),
};

/** Shrinks a chosen photo in the browser (max 1400 px wide, WebP) so uploads are small and fast. Resolves to a data URL. */
export function shrinkImage(file, maxWidth = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const out = canvas.toDataURL('image/webp', 0.88);
      resolve(out.startsWith('data:image/webp') ? out : canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}
