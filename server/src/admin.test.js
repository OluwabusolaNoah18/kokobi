import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://abc.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'sb_secret_test';
process.env.ADMIN_PASSWORD = 'correct horse battery';

const { getCatalog, getProductRows, invalidateCatalog } = await import('./catalog.js');
const { lookupPromo } = await import('./promos.js');
const adm = await import('./admin.js');
const { validAdminToken, makeAdminToken, requireAdmin } = await import('./adminAuth.js');
const { validateProduct } = await import('./products.js');

const realFetch = globalThis.fetch;
let calls;
const json = (data, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
const mockFetch = (...responses) => {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    return typeof next === 'function' ? next() : next.clone();
  };
};
const mkRes = () => ({
  code: 200, body: undefined,
  status(c) { this.code = c; return this; },
  json(b) { this.body = b; return this; },
});
beforeEach(() => { invalidateCatalog(); });
afterEach(() => { globalThis.fetch = realFetch; });

const row = { id: 'p-1', slug: 'oat-mix', name: 'Oat Mix', price: 2000, regular_price: 2500, images: [], details: {}, active: true, sort_order: 0 };
const body = { name: 'Oat Mix', price: '2000', regularPrice: '2500', desc: 'Tasty', who: ['a', 'b'] };

/* ---- catalog ---- */
test('catalog comes from the database, is cached briefly, and survives a short outage', async () => {
  mockFetch(json([row]));
  assert.deepEqual(await getCatalog(), { 'p-1': { name: 'Oat Mix', price: 2000 } });
  await getCatalog();
  assert.equal(calls.length, 1, 'second call used the cache');
  assert.match(calls[0].url, /\/rest\/v1\/products\?select=\*&active=eq\.true/);
  assert.equal(calls[0].headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].headers.Authorization, undefined, 'new-style secret keys go in apikey only');
});
test('with no database cached and the database down, loading fails loudly (never guesses prices)', async () => {
  mockFetch(json({ message: 'boom' }, 500));
  await assert.rejects(() => getProductRows(), /boom/);
});

/* ---- promo lookup ---- */
const promoRow = { code: 'WELCOME10', kind: 'percent', value: 10, active: true, min_order: 0, max_uses: null, expires_at: null };
test('promo lookup: valid, inactive, expired, and used up', async () => {
  mockFetch(json([promoRow]));
  assert.equal((await lookupPromo('welcome10')).promo.value, 10);
  assert.match(calls[0].url, /code=eq\.WELCOME10/);

  mockFetch(json([{ ...promoRow, active: false }]));
  assert.match((await lookupPromo('WELCOME10')).error, /not valid/);

  mockFetch(json([{ ...promoRow, expires_at: '2020-01-01T00:00:00Z' }]));
  assert.match((await lookupPromo('WELCOME10')).error, /expired/);

  mockFetch(json([{ ...promoRow, max_uses: 2 }]), json([], 200, { 'content-range': '0-0/2' }));
  assert.match((await lookupPromo('WELCOME10')).error, /limit/);

  mockFetch(json([{ ...promoRow, max_uses: 2 }]), json([], 200, { 'content-range': '0-0/1' }));
  assert.ok((await lookupPromo('WELCOME10')).promo);

  mockFetch(json([]));
  assert.match((await lookupPromo('NOPE')).error, /not valid/);
});

/* ---- admin auth ---- */
test('admin tokens: valid, expired, tampered, and gone after a password change', () => {
  const { token } = makeAdminToken(1000);
  assert.equal(validAdminToken(token, 2000), true);
  assert.equal(validAdminToken(token, 1000 + 13 * 3600 * 1000), false);
  const [exp, sig] = token.split('.');
  assert.equal(validAdminToken(`${Number(exp) + 99999}.${sig}`, 2000), false);
  assert.equal(validAdminToken('garbage', 2000), false);
  const old = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'a different password';
  assert.equal(validAdminToken(token, 2000), false);
  process.env.ADMIN_PASSWORD = old;
});
test('requireAdmin blocks requests without a good token', () => {
  const run = (authorization) => {
    const res = mkRes(); let passed = false;
    requireAdmin({ get: () => authorization }, res, () => { passed = true; });
    return { res, passed };
  };
  assert.equal(run(undefined).res.code, 401);
  assert.equal(run('Bearer nope').res.code, 401);
  assert.equal(run(`Bearer ${makeAdminToken().token}`).passed, true);
});
test('login: wrong password is refused, right password returns a token', async () => {
  let res = mkRes();
  await adm.login({ body: { password: 'wrong' } }, res);
  assert.equal(res.code, 401);
  res = mkRes();
  await adm.login({ body: { password: 'correct horse battery' } }, res);
  assert.equal(res.body.ok, true);
  assert.equal(validAdminToken(res.body.token), true);
});

/* ---- product validation ---- */
test('product validation: reserved address, price rules, and tidy details', () => {
  assert.match(validateProduct({ ...body, name: 'Order' }).errors.slug, /reserved/);
  assert.ok(validateProduct({ ...body, price: '50' }).errors.price);
  assert.ok(validateProduct({ ...body, regularPrice: '1000' }).errors.regularPrice);
  const ok = validateProduct({ ...body, regularPrice: '', images: ['https://x.co/a.jpg', 'javascript:alert(1)', '/local.png'], uses: ['  Oats ', ''] });
  assert.equal(ok.ok, true);
  assert.equal(ok.row.regular_price, 2000, 'blank regular price means no discount');
  assert.equal(ok.row.slug, 'oat-mix');
  assert.deepEqual(ok.row.images, ['https://x.co/a.jpg'], 'only https images are kept');
  assert.deepEqual(ok.row.details.uses, ['Oats']);
});

/* ---- product handlers ---- */
test('createProduct saves to the database and clears the price cache', async () => {
  mockFetch(json([row])); // seed the cache first
  await getCatalog();
  mockFetch(json([{ ...row, price: 2000 }], 201));
  const res = mkRes();
  await adm.createProduct({ body }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.product.slug, 'oat-mix');
  assert.equal(calls[0].method, 'POST');
  const sent = JSON.parse(calls[0].body);
  assert.match(sent.id, /^p-/);
  assert.equal(sent.price, 2000);
  assert.equal(sent.regular_price, 2500);
  mockFetch(json([row]));
  await getCatalog();
  assert.equal(calls.length, 1, 'cache was cleared so prices are re-read');
});
test('createProduct: bad input never reaches the database; duplicate address is reported', async () => {
  mockFetch(json([]));
  let res = mkRes();
  await adm.createProduct({ body: { ...body, name: 'admin' } }, res);
  assert.equal(res.code, 400);
  assert.equal(calls.length, 0);

  mockFetch(json({ code: '23505', message: 'duplicate' }, 409));
  res = mkRes();
  await adm.createProduct({ body }, res);
  assert.equal(res.code, 409);
  assert.ok(res.body.errors.slug);
});
test('updateProduct and deleteProduct: 404 for unknown products, filter by id', async () => {
  mockFetch(json([]));
  let res = mkRes();
  await adm.updateProduct({ params: { id: 'p-9' }, body }, res);
  assert.equal(res.code, 404);

  mockFetch(json([{ ...row, price: 1800 }]));
  res = mkRes();
  await adm.updateProduct({ params: { id: 'p-1' }, body: { ...body, price: '1800' } }, res);
  assert.equal(res.body.product.price, 1800);
  assert.equal(calls[0].method, 'PATCH');
  assert.match(calls[0].url, /products\?id=eq\.p-1$/);

  res = mkRes();
  await adm.updateProduct({ params: { id: 'p-1; drop table' }, body }, res);
  assert.equal(res.code, 400, 'ids are checked before they go near a query');

  mockFetch(json([row]));
  res = mkRes();
  await adm.deleteProduct({ params: { id: 'p-1' } }, res);
  assert.equal(res.body.ok, true);
  assert.equal(calls[0].method, 'DELETE');
});

/* ---- promo handlers ---- */
test('createPromo validates and saves', async () => {
  let res = mkRes();
  mockFetch(json([]));
  await adm.createPromo({ body: { code: 'x', kind: 'percent', value: 10 } }, res);
  assert.equal(res.code, 400);
  assert.ok(res.body.errors.code);

  res = mkRes();
  await adm.createPromo({ body: { code: 'welcome10', kind: 'percent', value: 95 } }, res);
  assert.ok(res.body.errors.value);

  mockFetch(json([{ ...promoRow, min_order: 5000, max_uses: 50, expires_at: '2026-12-31T23:59:59+01:00' }], 201));
  res = mkRes();
  await adm.createPromo({ body: { code: 'welcome10', kind: 'percent', value: 10, minOrder: 5000, maxUses: 50, expiresAt: '2026-12-31' } }, res);
  assert.equal(res.code, 201);
  const sent = JSON.parse(calls[0].body);
  assert.equal(sent.code, 'WELCOME10');
  assert.equal(sent.expires_at, '2026-12-31T23:59:59+01:00');
  assert.equal(sent.max_uses, 50);
});

/* ---- photo upload ---- */
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
test('photo upload: real images are stored and a public link returned', async () => {
  mockFetch(json({ Key: 'ok' }));
  const res = mkRes();
  await adm.uploadPhoto({ body: { data: 'data:image/png;base64,' + png.toString('base64') } }, res);
  assert.equal(res.body.ok, true);
  assert.match(res.body.url, /^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/product-images\/\d+-[a-z0-9]+\.png$/);
  assert.match(calls[0].url, /\/storage\/v1\/object\/product-images\//);
  assert.equal(calls[0].headers['Content-Type'], 'image/png');
});
test('photo upload: rejects non-images (even if labelled as images) and huge files', async () => {
  mockFetch(json({}));
  let res = mkRes();
  await adm.uploadPhoto({ body: { data: Buffer.from('<script>alert(1)</script>').toString('base64'), contentType: 'image/png' } }, res);
  assert.equal(res.code, 400);
  res = mkRes();
  await adm.uploadPhoto({ body: { data: Buffer.concat([png, Buffer.alloc(3.2 * 1024 * 1024)]).toString('base64') } }, res);
  assert.equal(res.code, 413);
  assert.equal(calls.length, 0);
});

/* ---- cash sales ---- */
const { validateSale, receiptWhatsAppUrl } = await import('./sales.js');
const stock = [{ id: 'kb-a', name: 'Formula A', price: 3600 }, { id: 'kb-b', name: 'Formula B', price: 3000 }];
const ref = () => 'KB-261025-ABCD';

test('cash sale: prices come from the product list, name/email/phone are optional', () => {
  const r = validateSale({ items: [{ id: 'kb-a', qty: 2 }, { id: 'kb-b', qty: '1' }, { id: 'nope', qty: 5 }] }, stock, ref);
  assert.equal(r.ok, true);
  assert.equal(r.order.name, 'Walk-in customer');
  assert.equal(r.order.subtotal, 10200);
  assert.equal(r.order.total, 10200);
  assert.equal(r.order.items.length, 2);
});
test('cash sale: discount, date and bad input are checked', () => {
  const ok = validateSale({ name: 'Ada', email: 'ADA@x.com', items: [{ id: 'kb-a', qty: 1 }], discount: '600', date: '2026-10-20' }, stock, ref, new Date('2026-10-25T10:00:00Z'));
  assert.equal(ok.order.total, 3000);
  assert.equal(ok.order.email, 'ada@x.com');
  assert.match(ok.order.paidAt, /^2026-10-20T11:00:00/);
  const bad = validateSale({ email: 'nope', phone: 'abc', items: [], discount: '-5', date: '2030-01-01' }, stock, ref);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.email && bad.errors.phone && bad.errors.items && bad.errors.date);
  assert.ok(validateSale({ items: [{ id: 'kb-a', qty: 1 }], discount: 3600 }, stock, ref).errors.discount, 'discount cannot cover the whole sale');
  assert.ok(validateSale({ items: [{ id: 'kb-a', qty: 9999 }] }, stock, ref).errors.items);
});
test('cash sale: WhatsApp link carries the receipt text', () => {
  const o = validateSale({ name: 'Ada Obi', phone: '0704 877 9681', items: [{ id: 'kb-a', qty: 1 }] }, stock, ref).order;
  const u = receiptWhatsAppUrl(o);
  assert.match(u, /^https:\/\/wa\.me\/2347048779681\?text=/);
  assert.match(decodeURIComponent(u), /1 x Formula A/);
  assert.match(receiptWhatsAppUrl({ ...o, phone: '' }), /^https:\/\/wa\.me\/\?text=/);
});
test('createSale saves the order, emails the receipt, and survives an email failure', async () => {
  const sent = [];
  const deps = {
    makeRef: ref,
    sendMail: async (m) => { sent.push(m); if (m.to === 'fail@x.com') throw new Error('smtp down'); },
    buildReceiptEmail: (o, pay) => ({ subject: `R ${o.ref} ${pay.method}`, text: 't', html: 'h' }),
    buildReceiptPdf: async () => Buffer.from('pdf'),
  };
  mockFetch(() => json(stock), () => json(null, 204));
  let res = mkRes();
  await adm.createSale(deps)({ body: { name: 'Ada', email: 'ada@x.com', items: [{ id: 'kb-a', qty: 2 }] } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.emailed, true);
  assert.equal(sent[0].to, 'ada@x.com');
  assert.equal(sent[0].subject, 'R KB-261025-ABCD cash');
  assert.equal(sent[0].attachments.length, 1);
  const saved = JSON.parse(calls.find((c) => c.method === 'POST' && /\/orders/.test(c.url)).body);
  assert.equal(saved.method, 'cash'); assert.equal(saved.status, 'paid'); assert.equal(saved.total, 7200);

  mockFetch(() => json(stock), () => json(null, 204));
  res = mkRes();
  await adm.createSale(deps)({ body: { email: 'fail@x.com', items: [{ id: 'kb-b', qty: 1 }] } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.emailed, false);
  assert.match(res.body.emailError, /sale was saved/);

  mockFetch(() => json(stock));
  res = mkRes();
  await adm.createSale(deps)({ body: { items: [] } }, res);
  assert.equal(res.code, 400);
});
test('sendCashReceipt and deleteSale only act on cash sales', async () => {
  const sent = [];
  const deps = { makeRef: ref, sendMail: async (m) => sent.push(m), buildReceiptEmail: () => ({ subject: 's', text: 't', html: 'h' }), buildReceiptPdf: async () => Buffer.from('p') };
  const cashRow = { ref: 'KB-261025-ABCD', method: 'cash', name: 'Ada', email: '', phone: '', fulfilment: 'instore', items: [{ id: 'kb-a', name: 'Formula A', qty: 1, unitPrice: 3600, lineTotal: 3600 }], subtotal: 3600, discount: 0, total: 3600, charged: 3600, created_at: '2026-10-25T09:00:00Z' };
  mockFetch(() => json([cashRow]), () => json([cashRow]));
  let res = mkRes();
  await adm.sendCashReceipt(deps)({ params: { ref: 'KB-261025-ABCD' }, body: {} }, res);
  assert.equal(res.code, 400, 'no email on file yet');

  mockFetch(() => json([cashRow]), () => json([cashRow]));
  res = mkRes();
  await adm.sendCashReceipt(deps)({ params: { ref: 'KB-261025-ABCD' }, body: { email: 'Ada@X.com' } }, res);
  assert.equal(res.code, 200);
  assert.equal(sent[0].to, 'ada@x.com');
  assert.ok(calls.some((c) => c.method === 'PATCH' && /ref=eq\.KB-261025-ABCD/.test(c.url)), 'email saved to the order');

  mockFetch(() => json([{ ...cashRow, method: 'paystack' }]));
  res = mkRes();
  await adm.deleteSale({ params: { ref: 'KB-261025-ABCD' } }, res);
  assert.equal(res.code, 400);
  res = mkRes();
  await adm.deleteSale({ params: { ref: 'bad' } }, res);
  assert.equal(res.code, 400);

  mockFetch(() => json([{ ref: 'KB-261025-ABCD', method: 'cash' }]), () => json([{}]));
  res = mkRes();
  await adm.deleteSale({ params: { ref: 'KB-261025-ABCD' } }, res);
  assert.equal(res.code, 200);
});

/* ---- sales summary ---- */
const { parseRange, summarize } = await import('./summary.js');
test('summary range: validates dates and uses Lagos midnight', () => {
  const r = parseRange('2026-10-01', '2026-10-03');
  assert.equal(r.ok, true);
  assert.equal(r.days, 3);
  assert.equal(r.startIso, '2026-09-30T23:00:00.000Z');
  assert.equal(r.endIso, '2026-10-03T23:00:00.000Z');
  assert.equal(parseRange('2026-10-05', '2026-10-01').ok, false);
  assert.equal(parseRange('x', '2026-10-01').ok, false);
  assert.equal(parseRange('2025-01-01', '2026-10-01').ok, false, 'over a year');
});
test('summary: totals, methods, per-day (Lagos time) and pending', () => {
  const range = parseRange('2026-10-01', '2026-10-03');
  const paid = [
    { method: 'cash', total: 3000, discount: 600, paid_at: '2026-10-01T10:00:00Z' },
    { method: 'paystack', total: 7200, discount: 0, paid_at: '2026-10-01T23:30:00Z' }, // 00:30 on the 2nd in Lagos
    { method: 'bank', total: 3600, discount: 0, paid_at: '2026-10-03T08:00:00Z' },
  ];
  const s = summarize(range, paid, [{ total: 4500 }, { total: 500 }]);
  assert.equal(s.totals.revenue, 13800);
  assert.equal(s.totals.orders, 3);
  assert.equal(s.average, 4600);
  assert.deepEqual(s.byMethod.cash, { orders: 1, revenue: 3000 });
  assert.equal(s.byMethod.paystack.revenue, 7200);
  assert.deepEqual(s.daily.map((d) => [d.date, d.revenue]), [['2026-10-01', 3000], ['2026-10-02', 7200], ['2026-10-03', 3600]]);
  assert.deepEqual(s.pending, { orders: 2, total: 5000 });
});
test('getSummary queries paid and pending orders and rejects bad ranges', async () => {
  mockFetch(() => json([{ method: 'cash', total: 1000, paid_at: '2026-10-02T10:00:00Z' }]), () => json([]));
  let res = mkRes();
  await adm.getSummary({ query: { from: '2026-10-01', to: '2026-10-31' } }, res);
  assert.equal(res.body.totals.revenue, 1000);
  assert.ok(calls.some((c) => /status=eq\.paid&paid_at=gte\./.test(c.url)));
  assert.ok(calls.some((c) => /status=eq\.awaiting_payment/.test(c.url)));
  res = mkRes();
  await adm.getSummary({ query: { from: 'bad', to: '2026-10-31' } }, res);
  assert.equal(res.code, 400);
});

/* ---- delivery tracker ---- */
const gref = 'KB-261029-ABCD';
const gdeps = (sent) => ({
  sendMail: async (m) => { sent.push(m); if (m.to === 'fail@x.com') throw new Error('smtp down'); },
  buildGuideEmail: (o) => ({ subject: `Guide ${o.ref}`, text: 't', html: 'h' }),
  guideAttachment: () => ({ filename: 'guide.pdf', content: Buffer.from('pdf') }),
});
const orderRow = (over = {}) => ({ ref: gref, method: 'bank', name: 'Ada Obi', email: 'ada@x.com', phone: '0801', fulfilment: 'delivery', items: [], subtotal: 3600, total: 3600, delivered_at: null, ...over });

test('marking delivered saves it and emails the usage guide with the PDF attached', async () => {
  const sent = [];
  mockFetch(() => json([orderRow()]), () => json([{ ref: gref, delivered_at: '2026-10-30T10:00:00Z', delivery_note: 'Left with security' }]));
  const res = mkRes();
  await adm.setDelivery(gdeps(sent))({ params: { ref: gref }, body: { delivered: true, note: ' Left with security ' } }, res);
  assert.equal(res.body.deliveredAt, '2026-10-30T10:00:00Z');
  assert.equal(res.body.guide, 'sent');
  const patch = JSON.parse(calls.find((c) => c.method === 'PATCH').body);
  assert.ok(patch.delivered_at && patch.delivery_note === 'Left with security');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ada@x.com');
  assert.equal(sent[0].subject, 'Guide KB-261029-ABCD');
  assert.equal(sent[0].attachments[0].filename, 'guide.pdf');
});
test('the guide is sent once: not again when only the note changes, and not when undoing', async () => {
  const sent = [];
  mockFetch(() => json([orderRow({ delivered_at: '2026-10-30T09:00:00Z' })]), () => json([{ ref: gref, delivered_at: '2026-10-30T10:00:00Z', delivery_note: 'x' }]));
  let res = mkRes();
  await adm.setDelivery(gdeps(sent))({ params: { ref: gref }, body: { delivered: true, note: 'x' } }, res);
  assert.equal(res.body.guide, 'none');
  mockFetch(() => json([orderRow({ delivered_at: '2026-10-30T09:00:00Z' })]), () => json([{ ref: gref, delivered_at: null }]));
  res = mkRes();
  await adm.setDelivery(gdeps(sent))({ params: { ref: gref }, body: { delivered: false } }, res);
  assert.equal(JSON.parse(calls.find((c) => c.method === 'PATCH').body).delivered_at, null);
  assert.equal(res.body.guide, 'none');
  assert.equal(sent.length, 0);
});
test('delivery is still saved when the guide email fails or the customer has no email', async () => {
  const sent = [];
  mockFetch(() => json([orderRow({ email: 'fail@x.com' })]), () => json([{ ref: gref, delivered_at: '2026-10-30T10:00:00Z' }]));
  let res = mkRes();
  await adm.setDelivery(gdeps(sent))({ params: { ref: gref }, body: { delivered: true } }, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.guide, 'failed');
  assert.match(res.body.guideError, /send it again/);
  mockFetch(() => json([orderRow({ email: '', method: 'cash' })]), () => json([{ ref: gref, delivered_at: '2026-10-30T10:00:00Z' }]));
  res = mkRes();
  await adm.setDelivery(gdeps(sent))({ params: { ref: gref }, body: { delivered: true } }, res);
  assert.equal(res.body.guide, 'no-email');
});
test('delivery explains a missing database column and rejects bad references', async () => {
  mockFetch(() => json([orderRow()]), () => json({ code: 'PGRST204', message: "Could not find the 'delivered_at' column" }, 400));
  let res = mkRes();
  await adm.setDelivery(gdeps([]))({ params: { ref: gref }, body: { delivered: true } }, res);
  assert.equal(res.code, 503);
  assert.match(res.body.message, /one-time database update/);
  res = mkRes();
  await adm.setDelivery(gdeps([]))({ params: { ref: 'bad' }, body: {} }, res);
  assert.equal(res.code, 400);
});
test('sendGuide resends to the order email or a new one, and saves it for cash sales', async () => {
  const sent = [];
  mockFetch(() => json([orderRow({ method: 'cash', email: '' })]), () => json([{}]));
  let res = mkRes();
  await adm.sendGuide(gdeps(sent))({ params: { ref: gref }, body: {} }, res);
  assert.equal(res.code, 400, 'needs an email');
  mockFetch(() => json([orderRow({ method: 'cash', email: '' })]), () => json([{}]));
  res = mkRes();
  await adm.sendGuide(gdeps(sent))({ params: { ref: gref }, body: { email: 'New@X.com' } }, res);
  assert.equal(res.body.ok, true);
  assert.equal(sent[0].to, 'new@x.com');
  assert.ok(calls.some((c) => c.method === 'PATCH' && /ref=eq\./.test(c.url)), 'email saved on the cash sale');
  mockFetch(() => json([orderRow()]));
  res = mkRes();
  await adm.sendGuide(gdeps(sent))({ params: { ref: gref }, body: { email: 'not-an-email' } }, res);
  assert.equal(res.code, 400);
  mockFetch(() => json([orderRow({ email: 'fail@x.com' })]));
  res = mkRes();
  await adm.sendGuide(gdeps(sent))({ params: { ref: gref }, body: {} }, res);
  assert.equal(res.code, 502);
});
test('the guide email has the requested subject and the PDF is real', async () => {
  const { buildGuideEmail, guidePdf, GUIDE_SUBJECT } = await import('./guide.js');
  assert.equal(GUIDE_SUBJECT, 'Your KOKÓBI+ Guide to Better Nourishment 🌿');
  const e = buildGuideEmail({ ref: gref, name: 'Ada Obi', fulfilment: 'delivery', method: 'bank' });
  assert.equal(e.subject, GUIDE_SUBJECT);
  assert.match(e.html, /has been delivered/);
  assert.match(buildGuideEmail({ ref: gref, name: 'Ada', fulfilment: 'pickup', method: 'bank' }).html, /collecting/);
  assert.equal(guidePdf().subarray(0, 5).toString(), '%PDF-');
});
test('cash sale still saves if the delivery columns are not in the database yet', async () => {
  const deps = { makeRef: () => 'KB-261029-ABCD', sendMail: async () => {}, buildReceiptEmail: () => ({}), buildReceiptPdf: async () => Buffer.from('p') };
  mockFetch(() => json([{ id: 'kb-a', name: 'A', price: 1000 }]), () => json({ code: 'PGRST204', message: "Could not find the 'delivered_at' column of 'orders'" }, 400), () => json(null, 204));
  const res = mkRes();
  await adm.createSale(deps)({ body: { items: [{ id: 'kb-a', qty: 1 }] } }, res);
  assert.equal(res.code, 201);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 2);
  assert.ok(!('delivered_at' in JSON.parse(posts[1].body)));
});
