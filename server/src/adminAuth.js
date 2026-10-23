import crypto from 'node:crypto';

/*
 * One shared admin password, kept in the ADMIN_PASSWORD setting (never in the code).
 * Logging in returns a signed token that lasts 12 hours. Changing the password signs everyone out.
 */
const TTL_MS = 12 * 60 * 60 * 1000;
const password = () => process.env.ADMIN_PASSWORD || '';

export const adminEnabled = () => password().length >= 8;

const key = () => crypto.createHmac('sha256', password()).update('kokobi-admin-v1').digest();
const sign = (s) => crypto.createHmac('sha256', key()).update(s).digest('base64url');
const digest = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();

export function checkPassword(input) {
  return adminEnabled() && crypto.timingSafeEqual(digest(input), digest(password()));
}

export function makeAdminToken(now = Date.now()) {
  const exp = String(now + TTL_MS);
  return { token: `${exp}.${sign(exp)}`, expiresAt: Number(exp) };
}

export function validAdminToken(token, now = Date.now()) {
  if (!adminEnabled() || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const a = Buffer.from(sign(exp));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Express middleware: lets the request through only with a valid admin token. */
export function requireAdmin(req, res, next) {
  if (!adminEnabled()) return res.status(503).json({ message: 'Admin is not set up. Add ADMIN_PASSWORD (at least 8 characters) to the backend settings.' });
  const token = /^Bearer (.+)$/.exec(req.get('authorization') || '')?.[1];
  if (!validAdminToken(token)) return res.status(401).json({ message: 'Please sign in again.' });
  next();
}
