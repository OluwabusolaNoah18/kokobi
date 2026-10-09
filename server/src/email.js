import { esc, naira, lagosDate, waNumber } from './format.js';

/**
 * Email to the shop owner.
 * pay = { method: 'paystack' | 'bank', paidAt?, channel?, reference? }
 */
export function buildEmail(o, pay = { method: 'bank' }) {
  const paid = pay.method === 'paystack';
  const fee = paid ? o.fee || 0 : 0;
  const grand = paid ? o.charged ?? o.total : o.total;
  const wa = waNumber(o.phone);
  const status = paid
    ? `PAID online via Paystack${pay.channel ? ` (${pay.channel})` : ''}${pay.paidAt ? ` on ${lagosDate(pay.paidAt)}` : ''}`
    : 'NOT PAID YET. Customer chose bank transfer and should send proof of payment on WhatsApp';
  const subject = `${paid ? '[PAID]' : '[AWAITING PAYMENT]'} Kokobi+ order ${o.ref} - ${o.name} - ${naira(grand)}`;

  const text = [
    `New order ${o.ref}`,
    `Status: ${status}`,
    '',
    'ITEMS',
    ...o.items.map((i) => `  ${i.qty} x ${i.name} @ ${naira(i.unitPrice)} = ${naira(i.lineTotal)}`),
    `ITEMS TOTAL (delivery not included): ${naira(o.total)}`,
    fee ? `ONLINE PAYMENT FEE (paid by customer): ${naira(fee)}` : null,
    fee ? `TOTAL PAID: ${naira(grand)}` : null,
    '',
    'CUSTOMER',
    `  Name:    ${o.name}`,
    `  Email:   ${o.email}`,
    `  Phone:   ${o.phone}`,
    `  WhatsApp: https://wa.me/${wa}`,
    `  Address: ${o.address}`,
    o.note ? `  Note:    ${o.note}` : null,
    '',
    paid
      ? 'A receipt has been emailed to the customer. Remember to confirm the delivery cost with them.'
      : "Wait for the customer's proof of payment on WhatsApp before confirming.",
  ].filter((l) => l !== null).join('\n');

  const rows = o.items
    .map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #E4D6AE">${esc(i.name)}</td>
<td style="padding:8px;border-bottom:1px solid #E4D6AE;text-align:center">${i.qty}</td>
<td style="padding:8px;border-bottom:1px solid #E4D6AE;text-align:right">${naira(i.lineTotal)}</td></tr>`)
    .join('');
  const badge = paid
    ? 'background:#1F7A4D;color:#fff'
    : 'background:#B4521A;color:#fff';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17391F">
<h2 style="margin:0 0 4px">New Kokobi+ order</h2>
<p style="margin:0 0 12px;color:#58614F">Reference <strong>${esc(o.ref)}</strong></p>
<p style="margin:0 0 16px"><span style="${badge};padding:4px 10px;border-radius:999px;font-size:13px">${esc(status)}</span></p>
<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#FBF5E1">
<th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="2" style="padding:8px;text-align:right"><strong>Items total</strong></td>
<td style="padding:8px;text-align:right"><strong>${naira(o.total)}</strong></td></tr>${fee ? `<tr><td colspan="2" style="padding:8px;text-align:right">Online payment fee</td><td style="padding:8px;text-align:right">${naira(fee)}</td></tr><tr><td colspan="2" style="padding:8px;text-align:right"><strong>Total paid</strong></td><td style="padding:8px;text-align:right"><strong>${naira(grand)}</strong></td></tr>` : ''}</tfoot></table>
<h3 style="margin:24px 0 8px">Customer</h3>
<p style="margin:0;line-height:1.7"><strong>Name:</strong> ${esc(o.name)}<br>
<strong>Email:</strong> ${esc(o.email)}<br>
<strong>Phone:</strong> ${esc(o.phone)} (<a href="https://wa.me/${esc(wa)}">WhatsApp</a>)<br>
<strong>Address:</strong> ${esc(o.address)}${o.note ? `<br><strong>Note:</strong> ${esc(o.note)}` : ''}</p>
<p style="margin-top:24px;color:#58614F;font-size:13px">${paid ? 'A receipt has been emailed to the customer. ' : "Wait for the customer's proof of payment on WhatsApp before confirming. "}Delivery cost is not included in the total.</p>
</div>`;

  return { subject, text, html };
}
