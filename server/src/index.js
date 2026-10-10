import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateOrder, REF_RE } from './validate.js';
import { buildEmail } from './email.js';
import { buildReceiptEmail, buildReceiptPdf } from './receipt.js';
import { sendMail } from './mailer.js';
import { paystackConfigured, initializeTransaction, verifyTransaction, validSignature, receiptToken, validReceiptToken } from './paystack.js';
import { fulfilPayment, orderFromTransaction } from './fulfil.js';
import { chargeFor } from './fees.js';
import { confirmEnabled, confirmUrl, readToken } from './confirm.js';
import { askPage, donePage, errorPage } from './confirmPage.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ORDER_TO = process.env.ORDER_TO || 'kokobifoods@gmail.com';
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const origins = (process.env.CORS_ORIGINS || CLIENT_URL).split(',').map((s) => s.trim()).filter(Boolean);

const makeRef = () =>
  'KB-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const deps = { sendMail, ownerTo: ORDER_TO, buildReceiptEmail, buildReceiptPdf };
const maskEmail = (e) => e.replace(/^(.).*(@.*)$/, '$1***$2');

app.set('trust proxy', 1); // correct client IPs behind Render/Railway/etc. for rate limiting
app.use(helmet());
app.use(cors({ origin: origins, methods: ['POST', 'GET'] }));
// Keep the raw body: Paystack signs it, and we must check the signature against the exact bytes.
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, paystack: paystackConfigured() }));

const limiter = (limit, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { message } });
const orderLimiter = limiter(10, 'Too many orders from this connection. Please try again later or message us on WhatsApp.');
const verifyLimiter = limiter(60, 'Too many requests. Please try again shortly.');

/* ---- Bank transfer: email the owner an order that is awaiting payment ---- */
app.post('/api/orders', orderLimiter, async (req, res) => {
  // Honeypot: real visitors never fill this in. Pretend success so bots move on.
  if (req.body?.website) return res.json({ ok: true, ref: makeRef() });

  const result = validateOrder(req.body, makeRef);
  if (!result.ok) return res.status(400).json({ message: 'Please check your order details.', errors: result.errors });

  try {
    const link = confirmEnabled() ? confirmUrl(result.order) : null;
    await sendMail({ to: ORDER_TO, ...buildEmail(result.order, { method: 'bank', confirmUrl: link }) });
    console.log(`Order ${result.order.ref} (bank transfer) emailed to owner`);
    res.json({ ok: true, ref: result.order.ref });
  } catch (err) {
    console.error(`Order ${result.order.ref} email FAILED:`, err.message);
    res.status(502).json({ message: 'We could not send your order. Please message us on WhatsApp.' });
  }
});

/* ---- Bank transfer: you press the button in your email once the money has arrived ---- */
const confirmLimiter = limiter(30, 'Too many requests. Please try again shortly.');
const receiptsSent = new Map(); // ref -> ISO time (in memory; a restart forgets it)

const orderFromLink = (d, s) => {
  const payload = readToken(d, s);
  if (!payload) return null;
  const r = validateOrder({ ...payload, ref: payload.ref }, () => payload.ref);
  return r.ok ? { ...r.order, ref: payload.ref } : null;
};

app.get('/api/orders/confirm', confirmLimiter, (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const order = orderFromLink(req.query.d, req.query.s);
  if (!order) return res.status(400).send(errorPage('This link is invalid or has expired.'));
  res.send(receiptsSent.has(order.ref) ? donePage(order, true) : askPage(order, req.query.d, req.query.s));
});

app.post('/api/orders/confirm', confirmLimiter, async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const order = orderFromLink(req.body?.d, req.body?.s);
  if (!order) return res.status(400).send(errorPage('This link is invalid or has expired.'));
  if (receiptsSent.has(order.ref)) return res.send(donePage(order, true));
  const pay = { paidAt: new Date().toISOString(), channel: 'Bank transfer', reference: order.ref };
  try {
    const attachments = [];
    try {
      attachments.push({ filename: `Kokobi-receipt-${order.ref}.pdf`, content: await buildReceiptPdf(order, pay) });
    } catch (err) {
      console.error(`Receipt PDF failed for ${order.ref} (sending email without it):`, err.message);
    }
    await sendMail({ to: order.email, attachments, ...buildReceiptEmail(order, pay) });
    receiptsSent.set(order.ref, pay.paidAt);
    console.log(`Order ${order.ref}: bank transfer receipt emailed to customer`);
    res.send(donePage(order, false));
  } catch (err) {
    console.error(`Order ${order.ref}: bank receipt email FAILED:`, err.message);
    res.status(502).send(errorPage('The receipt email could not be sent. Please go back and try again.'));
  }
});

/* ---- Paystack: start a hosted checkout ---- */
app.post('/api/paystack/initialize', orderLimiter, async (req, res) => {
  if (req.body?.website) return res.status(400).json({ message: 'Bad request' });
  if (!paystackConfigured()) {
    return res.status(503).json({ message: 'Online payment is not available right now. Please pay by bank transfer.' });
  }
  const result = validateOrder(req.body, makeRef);
  if (!result.ok) return res.status(400).json({ message: 'Please check your order details.', errors: result.errors });
  const o = result.order;

  try {
    const data = await initializeTransaction({
      email: o.email,
      amountNaira: chargeFor(o.total).charge, // item total plus the online payment fee (if enabled)
      reference: o.ref,
      callbackUrl: `${CLIENT_URL}/order/complete`,
      // The order travels with the transaction, so no database is needed to rebuild it after payment.
      metadata: {
        order: { name: o.name, email: o.email, phone: o.phone, address: o.address, note: o.note, items: o.items.map((i) => ({ id: i.id, qty: i.qty })) },
        custom_fields: [{ display_name: 'Customer', variable_name: 'customer', value: o.name }],
      },
    });
    console.log(`Order ${o.ref}: Paystack checkout started`);
    res.json({ ok: true, ref: o.ref, url: data.authorization_url });
  } catch (err) {
    console.error(`Order ${o.ref}: Paystack initialize FAILED:`, err.message);
    res.status(502).json({ message: 'We could not start online payment. Please try again or pay by bank transfer.' });
  }
});

/* ---- Paystack: the customer's browser returns here after paying ---- */
app.get('/api/paystack/verify/:reference', verifyLimiter, async (req, res) => {
  const { reference } = req.params;
  if (!REF_RE.test(reference)) return res.status(400).json({ message: 'Invalid reference.' });
  if (!paystackConfigured()) return res.status(503).json({ message: 'Online payment is not configured.' });
  try {
    const txn = await verifyTransaction(reference);
    if (txn.status !== 'success') return res.json({ paid: false, status: txn.status });
    const order = await fulfilPayment(txn, deps);
    res.json({
      paid: true, ref: order.ref, subtotal: order.total, fee: order.fee, total: order.charged, email: maskEmail(order.email), receiptToken: receiptToken(order.ref),
      items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
    });
  } catch (err) {
    console.error(`Verify ${reference} FAILED:`, err.message);
    res.status(502).json({ message: 'We could not confirm your payment yet. If you were charged, message us on WhatsApp with your order reference.' });
  }
});

/* ---- Paystack: download the receipt PDF (needs the token returned by verify) ---- */
app.get('/api/paystack/receipt/:reference', verifyLimiter, async (req, res) => {
  const { reference } = req.params;
  if (!REF_RE.test(reference) || !validReceiptToken(reference, req.query.t)) return res.status(403).json({ message: 'Not allowed.' });
  try {
    const txn = await verifyTransaction(reference);
    if (txn.status !== 'success') return res.status(404).json({ message: 'No paid order found.' });
    const order = orderFromTransaction(txn);
    const pdf = await buildReceiptPdf(order, { paidAt: txn.paid_at, channel: txn.channel, reference });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Kokobi-receipt-${order.ref}.pdf"` });
    res.send(pdf);
  } catch (err) {
    console.error(`Receipt download ${reference} FAILED:`, err.message);
    res.status(502).json({ message: 'We could not create your receipt. Please message us on WhatsApp.' });
  }
});

/* ---- Paystack: server-to-server notification (the reliable path if the customer closes the tab) ---- */
app.post('/api/paystack/webhook', async (req, res) => {
  if (!validSignature(req.rawBody, req.get('x-paystack-signature'))) return res.sendStatus(401);
  const evt = req.body;
  if (evt?.event !== 'charge.success') return res.sendStatus(200);
  try {
    orderFromTransaction(evt.data); // sanity check: amount and order must match our catalog
    await fulfilPayment(evt.data, deps);
    res.sendStatus(200);
  } catch (err) {
    console.error(`Webhook ${evt?.data?.reference} FAILED:`, err.message);
    res.sendStatus(500); // Paystack will retry
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ message: 'Bad request' });
});

app.listen(PORT, () => {
  console.log(`Kokobi+ API listening on :${PORT}`);
  console.log(`Orders go to ${ORDER_TO}. Allowed origins: ${origins.join(', ')}`);
  console.log(`Bank transfer receipt links: ${confirmEnabled() ? `enabled (${process.env.API_PUBLIC_URL || 'http://localhost:4000'})` : 'OFF (set RECEIPT_SECRET to enable)'}`);
  console.log(`Paystack: ${paystackConfigured() ? 'enabled' : 'NOT configured (bank transfer only)'}`);
});
