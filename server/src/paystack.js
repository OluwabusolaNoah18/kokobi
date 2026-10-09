import crypto from 'node:crypto';

const API = 'https://api.paystack.co';

export const paystackConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY);

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    throw new Error(`Paystack ${res.status}: ${body.message || 'request failed'}`);
  }
  return body.data;
}

/** Starts a hosted checkout. Amount is in naira here; Paystack wants kobo. */
export function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  return call('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountNaira * 100,
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });
}

export const verifyTransaction = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);

/** Checks the x-paystack-signature header (HMAC SHA512 of the raw body with your secret key). */
export function validSignature(rawBody, signature, secret = process.env.PAYSTACK_SECRET_KEY) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Unguessable token that lets only the paying customer download their receipt PDF. */
export const receiptToken = (ref, secret = process.env.PAYSTACK_SECRET_KEY) =>
  crypto.createHmac('sha256', secret || '').update(`receipt:${ref}`).digest('hex').slice(0, 32);

export function validReceiptToken(ref, token, secret = process.env.PAYSTACK_SECRET_KEY) {
  if (!secret || typeof token !== 'string') return false;
  const a = Buffer.from(receiptToken(ref, secret));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
