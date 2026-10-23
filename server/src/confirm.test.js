import test from 'node:test';
import assert from 'node:assert/strict';
import { makeToken, readToken } from './confirm.js';
import { askPage } from './confirmPage.js';
import { buildEmail } from './email.js';
import { validateOrder } from './validate.js';
import { rebuildOrder } from './snapshot.js';

const base = { ref: 'KB-261010-ABCD', name: 'Ada', email: 'ada@example.com', phone: '0704 877 9681', address: '1 Road', items: [{ id: 'kb-a', qty: 2 }] };
const order = validateOrder(base, () => 'KB-261010-ABCD').order;
const SECRET = 'test-secret';

test('a valid link reads back the order', () => {
  const { d, s } = makeToken(order, SECRET);
  const p = readToken(d, s, SECRET);
  assert.equal(p.ref, order.ref);
  assert.equal(p.lines[0].qty, 2);
  assert.equal(p.lines[0].unitPrice, 3600);
});
test('tampered payload, wrong signature, wrong secret and missing secret are rejected', () => {
  const { d, s } = makeToken(order, SECRET);
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(d, 'base64url')), email: 'evil@example.com' })).toString('base64url');
  assert.equal(readToken(forged, s, SECRET), null);
  assert.equal(readToken(d, s.slice(1) + 'x', SECRET), null);
  assert.equal(readToken(d, s, 'other-secret'), null);
  assert.equal(readToken(d, s, ''), null);
  assert.equal(readToken(undefined, s, SECRET), null);
});
test('links expire after 90 days', () => {
  const t0 = Date.now();
  const { d, s } = makeToken(order, SECRET, t0);
  assert.ok(readToken(d, s, SECRET, t0 + 89 * 864e5));
  assert.equal(readToken(d, s, SECRET, t0 + 91 * 864e5), null);
});
test('prices on the confirm page come from the signed link, so later price changes do not affect it', () => {
  const { d, s } = makeToken({ ...order, items: order.items.map((i) => ({ ...i, unitPrice: 3000 })) }, SECRET);
  const r = rebuildOrder(readToken(d, s, SECRET), 'KB-261010-ABCD');
  assert.equal(r.order.items[0].unitPrice, 3000);
  assert.equal(r.order.total, 6000);
});
test('a link made before prices were stored falls back to the catalog', () => {
  const legacy = { ...base, t: Date.now() };
  assert.equal(rebuildOrder(legacy, 'KB-261010-ABCD').order.total, 7200);
});
test('discounts survive inside the link', () => {
  const discounted = { ...order, discount: 720, promoCode: 'WELCOME10' };
  const { d, s } = makeToken(discounted, SECRET);
  const r = rebuildOrder(readToken(d, s, SECRET), 'KB-261010-ABCD');
  assert.equal(r.order.subtotal, 7200);
  assert.equal(r.order.discount, 720);
  assert.equal(r.order.total, 6480);
  assert.equal(r.order.promoCode, 'WELCOME10');
});
test('page escapes HTML and the owner email carries the button only for unpaid orders', () => {
  const r = validateOrder({ ...order, name: '<script>x</script>' }, () => 'KB-261010-ABCD');
  assert.ok(!askPage(r.order, 'd', 's').includes('<script>'));
  assert.match(buildEmail(r.order, { method: 'bank', confirmUrl: 'https://api.example.com/x?d=1&s=2' }).html, /Review and send receipt/);
  assert.doesNotMatch(buildEmail(r.order, { method: 'bank' }).html, /Review and send receipt/);
  assert.doesNotMatch(buildEmail({ ...r.order, charged: 7200, fee: 0 }, { method: 'paystack', confirmUrl: 'https://x' }).html, /Review and send receipt/);
});
