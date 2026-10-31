import { esc } from './format.js';
import { GUIDE_BASE64 } from './guideData.js';

export const GUIDE_SUBJECT = 'Your KOKÓBI+ Guide to Better Nourishment 🌿';
export const GUIDE_FILENAME = 'KOKOBI-Usage-and-Nutrition-Guide.pdf';
const GREEN = '#17391F';
const MUTED = '#58614F';
const CONTACT_EMAIL = () => process.env.ORDER_TO || 'kokobifoods@gmail.com';
const WA = () => {
  let n = String(process.env.WHATSAPP_NUMBER || '2347048779681').replace(/\D/g, '');
  if (n.startsWith('0')) n = '234' + n.slice(1);
  return n || '2347048779681';
};

let pdf;
/** The usage guide PDF as a Buffer (decoded once). */
export const guidePdf = () => (pdf ||= Buffer.from(GUIDE_BASE64, 'base64'));
export const guideAttachment = () => ({ filename: GUIDE_FILENAME, content: guidePdf() });

const wording = (o) => {
  if (o.method === 'cash') return { head: 'Thank you for choosing KOKÓBI+!', line: 'We hope you enjoy it.' };
  if (o.fulfilment === 'pickup') return { head: 'Thanks for collecting your KOKÓBI+ order!', line: 'We hope you enjoy it.' };
  return { head: 'Your KOKÓBI+ order has been delivered!', line: 'We hope it reached you safely and that you enjoy it.' };
};

/** Email sent after an order is marked delivered / collected. The PDF guide is attached by the caller. */
export function buildGuideEmail(o) {
  const first = o.name && o.name !== 'Walk-in customer' ? o.name.split(' ')[0] : '';
  const w = wording(o);
  const wa = `https://wa.me/${WA()}?text=${encodeURIComponent(`Hi KOKÓBI+! I have a question about my order ${o.ref}.`)}`;
  const tips = [
    'Use one 40 g serving, mixed into milk or water, or blended into a smoothie.',
    'Enjoy it alongside your regular meals. It complements them, it does not replace them.',
    'Use a clean, dry spoon, keep the pack sealed, and store it somewhere cool and dry.',
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:${GREEN}">
<h2 style="margin:0 0 6px">${esc(w.head)} 🌿</h2>
<p style="margin:0 0 16px;color:${MUTED}">${first ? `Hi ${esc(first)}! ` : ''}${esc(w.line)} Order <strong>${esc(o.ref)}</strong>.</p>
<p style="margin:0 0 8px">Your <strong>KOKÓBI+ Guide to Better Nourishment</strong> is attached as a PDF. It shows you how to use your formula, easy ways to enjoy it, and simple habits that help you get the most from it.</p>
<p style="margin:16px 0 6px"><strong>A quick start:</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;line-height:1.7">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<p style="margin:0 0 16px;color:${MUTED};font-size:14px">Everybody's body is different, so results vary. If you have a medical condition, food allergies, or are pregnant or breastfeeding, please check with a healthcare professional before use.</p>
<p style="margin:0 0 16px"><a href="${wa}" style="display:inline-block;background:#1F7A4D;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Questions? Chat with us on WhatsApp</a></p>
<p style="margin:0 0 4px">Nourishment is a journey, not a competition. Eat well. Stay consistent. Take care of your body.</p>
<p style="color:${MUTED};font-size:12px;margin-top:16px">KOKÓBI+ Everyday wellness, made easier. &middot; ${esc(CONTACT_EMAIL())}</p>
</div>`;
  const text = [
    w.head,
    `${first ? `Hi ${first}! ` : ''}${w.line} Order ${o.ref}.`,
    '',
    'Your KOKÓBI+ Guide to Better Nourishment is attached as a PDF. It shows you how to use your formula, easy ways to enjoy it, and simple habits that help you get the most from it.',
    '',
    'A quick start:',
    ...tips.map((t) => `- ${t}`),
    '',
    "Everybody's body is different, so results vary. If you have a medical condition, food allergies, or are pregnant or breastfeeding, please check with a healthcare professional before use.",
    '',
    `Questions? WhatsApp us: ${wa}`,
    '',
    'Nourishment is a journey, not a competition. Eat well. Stay consistent. Take care of your body.',
    `KOKÓBI+ Everyday wellness, made easier. - ${CONTACT_EMAIL()}`,
  ].join('\n');
  return { subject: GUIDE_SUBJECT, text, html };
}
