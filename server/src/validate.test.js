import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './validate.js';
import { buildEmail } from './email.js';

const base = { name: 'Ada', email: 'Ada@Example.com', phone: '0704 877 9681', address: '1 Road, Lagos', items: [{ id: 'kb-a', qty: 2 }, { id: 'kb-b', qty: 1 }] };

test('accepts a valid order and computes total server-side', () => {
  const r = validateOrder({ ...base, total: 1 }, () => 'KB-260101-ABCD');
  assert.equal(r.ok, true);
  assert.equal(r.order.total, 10800);
  assert.equal(r.order.ref, 'KB-260101-ABCD');
  assert.equal(r.order.email, 'ada@example.com');
});
test('rejects bad phone, empty items, unknown product', () => {
  const r = validateOrder({ ...base, phone: '123', items: [{ id: 'x', qty: 3 }] }, () => 'R');
  assert.equal(r.ok, false);
  assert.ok(r.errors.phone && r.errors.items);
});
test('rejects a bad email', () => {
  const r = validateOrder({ ...base, email: 'nope' }, () => 'R');
  assert.equal(r.ok, false);
  assert.ok(r.errors.email);
});
test('caps quantity at 20 and merges duplicates', () => {
  const r = validateOrder({ ...base, items: [{ id: 'kb-a', qty: 15 }, { id: 'kb-a', qty: 15 }] }, () => 'R');
  assert.equal(r.order.items[0].qty, 20);
});
test('escapes HTML in the email', () => {
  const r = validateOrder({ ...base, name: '<script>x</script>' }, () => 'KB-260101-ABCD');
  assert.ok(!buildEmail(r.order).html.includes('<script>'));
});
