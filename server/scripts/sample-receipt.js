// Creates server/sample-receipt.pdf so you can check the receipt design without paying.
// Run:  npm run sample:receipt --prefix server
import { writeFileSync } from 'node:fs';
import { buildReceiptPdf } from '../src/receipt.js';

const order = {
  ref: 'KB-261009-TEST', name: 'Ada Obi', email: 'ada@example.com', phone: '0704 877 9681',
  address: '12 Example Street, Ikeja, Lagos', note: '', total: 14400,
  items: [
    { id: 'kb-a', qty: 3, name: 'Kokobi+ Formula A', unitPrice: 3600, lineTotal: 10800 },
    { id: 'kb-b', qty: 1, name: 'Kokobi+ Formula B', unitPrice: 3600, lineTotal: 3600 },
  ],
};
const pdf = await buildReceiptPdf(order, { paidAt: new Date().toISOString(), channel: 'card', reference: order.ref });
writeFileSync(new URL('../sample-receipt.pdf', import.meta.url), pdf);
console.log(`Wrote sample-receipt.pdf (${pdf.length} bytes) in the server folder. Open it to check the design.`);
