import { rebuildOrder } from './snapshot.js';
import { recordOrder } from './orderlog.js';
import { buildEmail } from './email.js';
import { chargeFor } from './fees.js';

/*
 * Runs once per successful payment: emails the owner a PAID order and the customer a receipt.
 * Called from both the browser's return page (verify) and Paystack's webhook, so it is idempotent.
 * State is kept in memory, so a server restart forgets it (worst case: a duplicate email).
 */
const ownerSent = new Set();
const customerSent = new Set();
const running = new Map();

export function orderFromTransaction(txn) {
  if (txn?.status !== 'success') throw new Error('Payment not successful');
  const raw = txn.metadata?.order;
  const result = rebuildOrder({ ...raw, email: raw?.email || txn.customer?.email }, txn.reference);
  if (!result.ok) throw new Error('Stored order is invalid: ' + JSON.stringify(result.errors));
  const { fee, charge } = chargeFor(result.order.total);
  const order = { ...result.order, ref: txn.reference, fee, charged: charge };
  if (txn.currency !== 'NGN' || txn.amount !== charge * 100) {
    throw new Error(`Amount mismatch for ${txn.reference}: paid ${txn.amount}, expected ${charge * 100}`);
  }
  return order;
}

export function fulfilPayment(txn, deps) {
  const ref = txn?.reference;
  if (running.has(ref)) return running.get(ref);
  const p = run(txn, deps).finally(() => running.delete(ref));
  running.set(ref, p);
  return p;
}

async function run(txn, { sendMail, ownerTo, buildReceiptEmail, buildReceiptPdf, log = console }) {
  const order = orderFromTransaction(txn);
  const pay = { method: 'paystack', paidAt: txn.paid_at || new Date().toISOString(), channel: txn.channel, reference: txn.reference };

  await recordOrder(order, { method: 'paystack', status: 'paid', paidAt: pay.paidAt, fee: order.fee, charged: order.charged });

  if (!ownerSent.has(order.ref)) {
    await sendMail({ to: ownerTo, ...buildEmail(order, pay) });
    ownerSent.add(order.ref);
    log.log(`Order ${order.ref} PAID, owner emailed`);
  }
  if (!customerSent.has(order.ref)) {
    try {
      const attachments = [];
      try {
        attachments.push({ filename: `Kokobi-receipt-${order.ref}.pdf`, content: await buildReceiptPdf(order, pay) });
      } catch (err) {
        log.error(`Receipt PDF failed for ${order.ref} (sending email without it):`, err.message);
      }
      await sendMail({ to: order.email, attachments, ...buildReceiptEmail(order, pay) });
      customerSent.add(order.ref);
      log.log(`Receipt for ${order.ref} emailed to customer`);
    } catch (err) {
      // The owner already knows about the paid order, so do not fail the whole payment.
      log.error(`Receipt email FAILED for ${order.ref}:`, err.message);
    }
  }
  return order;
}

export const _resetForTests = () => { ownerSent.clear(); customerSent.clear(); running.clear(); };
