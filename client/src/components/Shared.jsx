import { Link } from 'react-router-dom';
import { money, CONFIG } from '../data.js';

export const Price = ({ p }) => (
  <p className="price">
    <strong>{money(p.price)}</strong> <s>{money(p.regularPrice)}</s>{' '}
    <span className="tag" style={{ margin: 0 }}>20% off</span>
  </p>
);

export const ProductImg = ({ p, all }) => (
  <>
    <img src={p.images[0]} alt={`${p.name} pouch front`} loading="lazy" style={{ width: '100%', borderRadius: 18 }} />
    {all && p.images[1] && (
      <img src={p.images[1]} alt={`${p.name} packaging, front and back`} loading="lazy"
        style={{ width: '100%', borderRadius: 18, marginTop: 14 }} />
    )}
  </>
);

export const FaqList = ({ items }) =>
  items.map(([q, a]) => (
    <details key={q}><summary>{q}</summary><p>{a}</p></details>
  ));

export const OrderBand = () => (
  <section className="wl" id="waitlist">
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h2>Ready to order?</h2>
      <p>Choose your Kokobi+, then pay by bank transfer and send us proof of payment on WhatsApp, or pay securely online with Paystack for an instant emailed receipt.</p>
      <Link className="btn pri" to="/order">Order Now</Link>
    </div>
  </section>
);
