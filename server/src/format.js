export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const naira = (n) => '₦' + n.toLocaleString('en-NG');
// The standard PDF fonts cannot draw the naira sign, so PDFs use "NGN".
export const ngn = (n) => 'NGN ' + n.toLocaleString('en-NG');
export const lagosDate = (d) =>
  new Date(d).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
export const waNumber = (phone) => phone.replace(/[\s-]/g, '').replace(/^0/, '234').replace(/^\+/, '');
export const isPickup = (o) => o?.fulfilment === 'pickup';
