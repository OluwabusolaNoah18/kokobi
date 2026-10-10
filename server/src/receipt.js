import PDFDocument from 'pdfkit';
import { esc, naira, ngn, lagosDate } from './format.js';
import { LOGO_BASE64 } from './logoData.js';

const LOGO = Buffer.from(LOGO_BASE64, 'base64');
const CONTACT_EMAIL = () => process.env.ORDER_TO || 'kokobifoods@gmail.com';
const WA = () => process.env.WHATSAPP_NUMBER || '2347048779681';
const WA_DISPLAY = '+234 704 877 9681';
const GREEN = '#17391F';
const MUTED = '#58614F';

/** Customer-facing receipt email. pay = { paidAt, channel, reference } */
export function buildReceiptEmail(o, pay) {
  const subject = `Your Kokobi+ receipt - order ${o.ref}`;
  const rows = o.items
    .map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #E4D6AE">${esc(i.name)}</td>
<td style="padding:8px;border-bottom:1px solid #E4D6AE;text-align:center">${i.qty}</td>
<td style="padding:8px;border-bottom:1px solid #E4D6AE;text-align:right">${naira(i.unitPrice)}</td>
<td style="padding:8px;border-bottom:1px solid #E4D6AE;text-align:right">${naira(i.lineTotal)}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:${GREEN}">
<h2 style="margin:0 0 4px">Thank you, ${esc(o.name.split(' ')[0])}!</h2>
<p style="margin:0 0 16px;color:${MUTED}">We have received your payment. Your receipt is below and attached as a PDF.</p>
<p style="margin:0 0 4px"><strong>Order:</strong> ${esc(o.ref)}<br><strong>Paid:</strong> ${esc(lagosDate(pay.paidAt))}${pay.channel ? `<br><strong>Method:</strong> ${esc(pay.channel)}` : ''}</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px"><thead><tr style="background:#FBF5E1">
<th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Price</th><th style="padding:8px;text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>${o.fee ? `<tr><td colspan="3" style="padding:8px;text-align:right">Items total</td><td style="padding:8px;text-align:right">${naira(o.total)}</td></tr><tr><td colspan="3" style="padding:8px;text-align:right">Online payment fee</td><td style="padding:8px;text-align:right">${naira(o.fee)}</td></tr>` : ''}<tr><td colspan="3" style="padding:8px;text-align:right"><strong>Total paid</strong></td><td style="padding:8px;text-align:right"><strong>${naira(o.charged ?? o.total)}</strong></td></tr></tfoot></table>
<p style="margin:20px 0 4px"><strong>Delivery to:</strong><br>${esc(o.name)}<br>${esc(o.address)}<br>${esc(o.phone)}</p>
<p style="margin:16px 0 8px;color:${MUTED};font-size:14px">The total covers the items only. We will confirm any delivery cost and delivery date with you on WhatsApp.</p>
<p style="margin:0 0 16px"><a href="https://wa.me/${WA()}?text=${encodeURIComponent(`Hi Kokobi+! I have paid online for order ${o.ref}. Please confirm my delivery.`)}" style="display:inline-block;background:#1F7A4D;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Chat with us on WhatsApp</a></p>
<p style="color:${MUTED};font-size:12px">Kokobi+ Everyday Wellness &middot; ${esc(CONTACT_EMAIL())}</p>
</div>`;
  const text = [
    `Thank you, ${o.name.split(' ')[0]}! We have received your payment.`,
    `Order: ${o.ref}`,
    `Paid: ${lagosDate(pay.paidAt)}${pay.channel ? ` (${pay.channel})` : ''}`,
    '',
    ...o.items.map((i) => `${i.qty} x ${i.name} @ ${naira(i.unitPrice)} = ${naira(i.lineTotal)}`),
    ...(o.fee ? [`Items total: ${naira(o.total)}`, `Online payment fee: ${naira(o.fee)}`] : []),
    `Total paid: ${naira(o.charged ?? o.total)}`,
    '',
    `Delivery to: ${o.name}, ${o.address}, ${o.phone}`,
    `The total covers the items only. We will confirm any delivery cost with you on WhatsApp: https://wa.me/${WA()}`,
    '',
    `Kokobi+ Everyday Wellness - ${CONTACT_EMAIL()}`,
  ].join('\n');
  return { subject, text, html };
}

/** Receipt as a PDF Buffer. */
export function buildReceiptPdf(o, pay) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Kokobi+ receipt ${o.ref}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = doc.page.width - 50;

    doc.image(LOGO, left, 45, { width: 150 });
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(24).text('RECEIPT', left, 55, { width: right - left, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text(`Order ${o.ref}`, left, 85, { width: right - left, align: 'right' })
      .text(`Paid ${lagosDate(pay.paidAt)}`, left, 99, { width: right - left, align: 'right' });
    if (pay.channel) doc.text(`Method: ${pay.channel}`, left, 113, { width: right - left, align: 'right' });

    // Customer block
    let y = 170;
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(11).text('BILLED TO / DELIVER TO', left, y);
    doc.font('Helvetica').fontSize(11).fillColor('#000')
      .text(o.name, left, y + 18)
      .text(o.address, left, doc.y, { width: 300 })
      .text(o.phone, left, doc.y)
      .text(o.email, left, doc.y);

    // Items table
    y = Math.max(doc.y + 30, 290);
    const col = { item: left, qty: 330, price: 390, amount: 470 };
    doc.rect(left, y, right - left, 24).fill('#FBF5E1');
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10)
      .text('Item', col.item + 8, y + 7)
      .text('Qty', col.qty, y + 7, { width: 40, align: 'center' })
      .text('Price', col.price, y + 7, { width: 70, align: 'right' })
      .text('Amount', col.amount, y + 7, { width: right - col.amount - 8, align: 'right' });
    y += 30;
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    for (const i of o.items) {
      doc.text(i.name, col.item + 8, y, { width: 270 })
        .text(String(i.qty), col.qty, y, { width: 40, align: 'center' })
        .text(ngn(i.unitPrice), col.price, y, { width: 70, align: 'right' })
        .text(ngn(i.lineTotal), col.amount, y, { width: right - col.amount - 8, align: 'right' });
      y += 24;
      doc.moveTo(left, y - 6).lineTo(right, y - 6).strokeColor('#E4D6AE').lineWidth(0.5).stroke();
    }
    y += 6;
    if (o.fee) {
      doc.font('Helvetica').fontSize(10).fillColor('#000')
        .text('Items total', col.price - 90, y, { width: 160, align: 'right' })
        .text(ngn(o.total), col.amount - 20, y, { width: right - col.amount + 12, align: 'right' });
      y += 18;
      doc.text('Online payment fee', col.price - 90, y, { width: 160, align: 'right' })
        .text(ngn(o.fee), col.amount - 20, y, { width: right - col.amount + 12, align: 'right' });
      y += 22;
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor(GREEN)
      .text('Total paid', col.price - 90, y, { width: 160, align: 'right' })
      .text(ngn(o.charged ?? o.total), col.amount - 20, y, { width: right - col.amount + 12, align: 'right' });

    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('The total covers the items only. Any delivery cost will be confirmed with you on WhatsApp.', left, y + 50, { width: right - left });
    doc.text(`Kokobi+ Everyday Wellness  |  ${CONTACT_EMAIL()}  |  WhatsApp ${WA_DISPLAY}`, left, 770, { width: right - left, align: 'center' });
    doc.end();
  });
}
