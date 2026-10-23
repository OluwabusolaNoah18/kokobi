import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validSignature } from './paystack.js';
import { fulfilPayment, orderFromTransaction, _resetForTests } from './fulfil.js';
import { buildEmail } from './email.js';
import { chargeFor } from './fees.js';

const txn = (over = {}) => ({
  status: 'success', reference: 'KB-261005-ABCD', amount: chargeFor(10800).charge * 100, currency: 'NGN', channel: 'card',
  paid_at: '2026-10-05T20:00:00.000Z', customer: { email: 'ada@example.com' },
  metadata: { order: { name: 'Ada Obi', email: 'ada@example.com', phone: '0704 877 9681', address: '1 Road, Lagos', note: '', items: [{ id: 'kb-a', qty: 2 }, { id: 'kb-b', qty: 1 }] } },
  ...over,
});
const mkDeps = () => {
  const sent = [];
  return {
    sent,
    deps: {
      sendMail: async (m) => { sent.push(m); }, ownerTo: 'owner@example.com',
      buildReceiptEmail: (o) => ({ subject: 'receipt ' + o.ref, text: 't', html: 'h' }),
      buildReceiptPdf: async () => Buffer.from('%PDF-fake'),
      log: { log() {}, error() {} },
    },
  };
};
beforeEach(_resetForTests);

test('signature: accepts a correct HMAC and rejects wrong or missing ones', () => {
  const body = Buffer.from('{"event":"charge.success"}');
  const good = crypto.createHmac('sha512', 'sk_test_x').update(body).digest('hex');
  assert.equal(validSignature(body, good, 'sk_test_x'), true);
  assert.equal(validSignature(body, (good[0] === 'a' ? 'b' : 'a') + good.slice(1), 'sk_test_x'), false);
  assert.equal(validSignature(body, 'abc', 'sk_test_x'), false);
  assert.equal(validSignature(body, undefined, 'sk_test_x'), false);
  assert.equal(validSignature(Buffer.from('tampered'), good, 'sk_test_x'), false);
});

test('rejects unpaid transactions and amount mismatches', () => {
  assert.throws(() => orderFromTransaction(txn({ status: 'abandoned' })), /not successful/);
  assert.throws(() => orderFromTransaction(txn({ amount: 100 })), /Amount mismatch/);
  assert.throws(() => orderFromTransaction(txn({ currency: 'USD' })), /Amount mismatch/);
  assert.equal(orderFromTransaction(txn()).total, 10800);
});

test('prices come from the catalog, not from the stored order', () => {
  const t = txn();
  t.metadata.order.items = [{ id: 'kb-a', qty: 2, unitPrice: 1 }];
  assert.throws(() => orderFromTransaction(t), /Amount mismatch/);
});

test('emails owner (PAID) and customer (receipt with PDF) exactly once, even if called twice at once', async () => {
  const { sent, deps } = mkDeps();
  await Promise.all([fulfilPayment(txn(), deps), fulfilPayment(txn(), deps)]);
  await fulfilPayment(txn(), deps);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.match(sent[0].subject, /^\[PAID\]/);
  assert.equal(sent[1].to, 'ada@example.com');
  assert.equal(sent[1].attachments[0].filename, 'Kokobi-receipt-KB-261005-ABCD.pdf');
});

test('a failed receipt email does not fail the payment, and is retried later', async () => {
  const { sent, deps } = mkDeps();
  let fail = true;
  const real = deps.sendMail;
  deps.sendMail = async (m) => { if (m.to === 'ada@example.com' && fail) throw new Error('smtp down'); return real(m); };
  const order = await fulfilPayment(txn(), deps);
  assert.equal(order.ref, 'KB-261005-ABCD');
  assert.equal(sent.length, 1); // owner only
  fail = false;
  await fulfilPayment(txn(), deps);
  assert.equal(sent.length, 2); // owner not repeated, customer now sent
});

test('a PDF failure still sends the receipt email without the attachment', async () => {
  const { sent, deps } = mkDeps();
  deps.buildReceiptPdf = async () => { throw new Error('boom'); };
  await fulfilPayment(txn(), deps);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1].attachments, []);
});

test('owner email labels unpaid bank-transfer orders clearly', () => {
  const o = orderFromTransaction(txn());
  assert.match(buildEmail(o, { method: 'bank' }).subject, /^\[AWAITING PAYMENT\]/);
});

import { receiptToken, validReceiptToken } from './paystack.js';
test('receipt token only works for its own reference and secret', () => {
  const t = receiptToken('KB-261009-ABCD', 'sk_test_x');
  assert.equal(validReceiptToken('KB-261009-ABCD', t, 'sk_test_x'), true);
  assert.equal(validReceiptToken('KB-261009-ZZZZ', t, 'sk_test_x'), false);
  assert.equal(validReceiptToken('KB-261009-ABCD', t, 'sk_test_y'), false);
  assert.equal(validReceiptToken('KB-261009-ABCD', undefined, 'sk_test_x'), false);
  assert.equal(validReceiptToken('KB-261009-ABCD', t, ''), false);
});

test('fee pass-through: customer pays enough that the shop receives the full item total', () => {
  for (const total of [1000, 2400, 3600, 7200, 14400, 50000, 400000]) {
    const { fee, charge } = chargeFor(total, true);
    assert.equal(charge, total + fee);
    const paystackTakes = Math.min(2000, Math.ceil(charge * 0.015 + (charge >= 2500 ? 100 : 0)));
    assert.ok(charge - paystackTakes >= total, `short for ${total}`);
    assert.ok(charge - paystackTakes <= total + 2, `overcharged for ${total}`);
  }
  assert.equal(chargeFor(14400, true).charge, 14721);
  assert.deepEqual(chargeFor(14400, false), { total: 14400, fee: 0, charge: 14400 });
});

test('paid order emails show the fee line and the real total paid', () => {
  const o = orderFromTransaction(txn());
  assert.equal(o.fee, chargeFor(10800).fee);
  const mail = buildEmail(o, { method: 'paystack', paidAt: '2026-10-05T20:00:00Z', channel: 'card' });
  assert.match(mail.text, /ONLINE PAYMENT FEE/);
  assert.match(mail.html, /Online payment fee/);
});

test('paid orders keep the prices and discount agreed at checkout, even if prices change later', async () => {
  const meta = { order: {
    name: 'Ada Obi', email: 'ada@example.com', phone: '0704 877 9681', fulfilment: 'pickup', address: '', note: '',
    lines: [{ id: 'p-1', qty: 2, name: 'Oat Mix', unitPrice: 3000 }], discount: 600, promoCode: 'WELCOME10',
  } };
  const t = txn({ amount: chargeFor(5400).charge * 100, metadata: meta });
  const o = orderFromTransaction(t);
  assert.equal(o.subtotal, 6000);
  assert.equal(o.discount, 600);
  assert.equal(o.total, 5400);
  assert.equal(o.items[0].name, 'Oat Mix');
  assert.equal(o.fulfilment, 'pickup');
  const { sent, deps } = mkDeps();
  await fulfilPayment(t, deps);
  assert.match(sent[0].text, /DISCOUNT \(code WELCOME10\): -₦600/);
  assert.match(sent[0].subject, /\[PICKUP\]/);
  // a customer who paid the wrong amount is still caught
  assert.throws(() => orderFromTransaction({ ...t, amount: chargeFor(6000).charge * 100 }), /Amount mismatch/);
});
