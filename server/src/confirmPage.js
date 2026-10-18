import { esc, naira, isPickup } from './format.js';

const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
body{margin:0;background:#FBF5E1;color:#17391F;font:17px/1.55 Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:28px 20px}
h1{font-size:1.6rem;margin:0 0 8px}
.card{background:#FFFBEF;border:1px solid #E4D6AE;border-radius:16px;padding:20px;margin:16px 0}
table{width:100%;border-collapse:collapse}td{padding:6px 0;vertical-align:top}td:last-child{text-align:right}
button{background:#B4521A;color:#fff;border:0;border-radius:999px;min-height:52px;padding:0 28px;font:700 1rem Arial,sans-serif;cursor:pointer;width:100%}
.ok{border-color:#1F7A4D;background:#EAF6EF}.bad{border-color:#B4521A;background:#FBE9E0}
small{color:#58614F}
</style></head><body><main>${body}</main></body></html>`;

const summary = (o) => `<div class="card">
<strong>Order ${esc(o.ref)}</strong>
<table>${o.items.map((i) => `<tr><td>${i.qty} x ${esc(i.name)}</td><td>${naira(i.lineTotal)}</td></tr>`).join('')}
<tr><td><strong>Items total</strong></td><td><strong>${naira(o.total)}</strong></td></tr></table>
<p style="margin:12px 0 0"><strong>${esc(o.name)}</strong><br>${esc(o.email)}<br>${esc(o.phone)}<br>${isPickup(o) ? '<strong>PICKUP</strong> (customer will collect)' : `<strong>DELIVERY</strong>: ${esc(o.address)}`}</p></div>`;

export const askPage = (o, d, s) => shell('Send receipt', `
<h1>Send receipt?</h1>
<p>Only continue if you have <strong>checked your bank account</strong> and the transfer of <strong>${naira(o.total)}</strong> for this order has arrived.</p>
${summary(o)}
<form method="post" action="/api/orders/confirm">
<input type="hidden" name="d" value="${esc(d)}"><input type="hidden" name="s" value="${esc(s)}">
<button type="submit">Yes, payment received. Email the receipt to ${esc(o.email)}</button></form>
<p><small>The customer gets a branded PDF receipt marked "Paid by bank transfer". Nothing is sent until you press the button.</small></p>`);

export const donePage = (o, already) => shell('Receipt sent', `
<h1>${already ? 'Receipt already sent' : 'Receipt sent'}</h1>
<div class="card ok">${already ? 'A receipt for this order was already emailed to' : 'The receipt has been emailed to'} <strong>${esc(o.email)}</strong>.</div>
${summary(o)}
<p><small>${isPickup(o) ? 'Remember to confirm the pickup time and location with the customer on WhatsApp.' : 'Remember to confirm the delivery cost and date with the customer on WhatsApp.'}</small></p>`);

export const errorPage = (message) => shell('Receipt link', `
<h1>We could not do that</h1><div class="card bad">${esc(message)}</div>`);
