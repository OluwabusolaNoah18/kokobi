import test from 'node:test';
import assert from 'node:assert/strict';
import { discountFor, normalizeCode, promoLabel } from './pricing.js';
import { validateOrder } from './validate.js';

const base = { name: 'Ada', email: 'ada@example.com', phone: '0704 877 9681', address: '1 Road', items: [{ id: 'kb-a', qty: 2 }], promoCode: 'welcome10' };
const ten = { code: 'WELCOME10', kind: 'percent', value: 10, minOrder: 0 };

test('percent and amount discounts, rounded down', () => {
  assert.equal(discountFor(ten, 7200).discount, 720);
  assert.equal(discountFor({ kind: 'percent', value: 15, minOrder: 0 }, 3601).discount, 540);
  assert.equal(discountFor({ kind: 'amount', value: 500, minOrder: 0 }, 7200).discount, 500);
  assert.equal(discountFor(null, 7200).discount, 0);
});
test('a discount can never take an order below NGN 100', () => {
  assert.equal(discountFor({ kind: 'amount', value: 9999, minOrder: 0 }, 3600).discount, 3500);
  assert.equal(discountFor({ kind: 'percent', value: 90, minOrder: 0 }, 100).discount, 0);
});
test('minimum order is enforced', () => {
  assert.match(discountFor({ ...ten, minOrder: 10000 }, 7200).error, /at least ₦10,000/);
  assert.equal(discountFor({ ...ten, minOrder: 7200 }, 7200).discount, 720);
});
test('codes are tidied and labelled', () => {
  assert.equal(normalizeCode('  welcome 10!! '), 'WELCOME10');
  assert.equal(promoLabel(ten), '10% off');
  assert.equal(promoLabel({ kind: 'amount', value: 1500 }), '₦1,500 off');
});
test('an order with a valid code gets subtotal, discount and total', () => {
  const r = validateOrder(base, () => 'KB-261010-ABCD', { promo: ten });
  assert.equal(r.order.subtotal, 7200);
  assert.equal(r.order.discount, 720);
  assert.equal(r.order.total, 6480);
  assert.equal(r.order.promoCode, 'WELCOME10');
});
test('a typed code that was not found blocks the order with a message', () => {
  const r = validateOrder(base, () => 'R', { promo: null, promoError: 'That code is not valid or has expired.' });
  assert.equal(r.ok, false);
  assert.match(r.errors.promoCode, /not valid/);
});
test('no code means no discount', () => {
  const r = validateOrder({ ...base, promoCode: '' }, () => 'KB-261010-ABCD');
  assert.equal(r.order.discount, 0);
  assert.equal(r.order.total, r.order.subtotal);
});
test('an item that is no longer for sale is reported, not silently dropped', () => {
  const r = validateOrder({ ...base, promoCode: '', items: [{ id: 'kb-a', qty: 1 }, { id: 'gone', qty: 1 }] }, () => 'R');
  assert.equal(r.ok, false);
  assert.match(r.errors.items, /no longer available/);
});
test('a custom catalog (from the database) sets the prices', () => {
  const r = validateOrder({ ...base, promoCode: '', items: [{ id: 'p-1', qty: 3 }] }, () => 'KB-261010-ABCD', { catalog: { 'p-1': { name: 'Oat Mix', price: 2000 } } });
  assert.equal(r.order.total, 6000);
  assert.equal(r.order.items[0].name, 'Oat Mix');
});
