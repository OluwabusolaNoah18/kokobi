import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFIG, PRODUCTS, money, waLink, PHONE_RE, onlineCharge, PASS_FEE } from '../data.js';
import { submitOrder, startPaystack } from '../api.js';

const clampQty = (v) => Math.max(0, Math.min(20, parseInt(v, 10) || 0));
const makeRef = () =>
  'KB-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

export default function Order() {
  const [qty, setQty] = useState(() => Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])));
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', note: '', website: '' });
  const [errs, setErrs] = useState({});
  const [method, setMethod] = useState('bank'); // 'bank' | 'paystack'
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [done, setDone] = useState(null); // { ref, items, total, emailed }
  const payRef = useRef(null);
  const refKeep = useRef(makeRef()); // same reference if the customer goes back and resubmits

  useEffect(() => { document.title = 'Order | Kokobi+'; }, []);
  useEffect(() => { if (done) payRef.current?.scrollIntoView(); }, [done]);

  const items = useMemo(
    () => PRODUCTS.map((p) => ({ p, q: clampQty(qty[p.id]) })).filter((i) => i.q > 0),
    [qty]
  );
  const total = items.reduce((t, i) => t + i.p.price * i.q, 0);
  const saved = items.reduce((t, i) => t + (i.p.regularPrice - i.p.price) * i.q, 0);
  const online = onlineCharge(total);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    const phone = f.phone.replace(/[\s-]/g, '');
    const next = {
      items: items.length ? '' : 'Choose at least one pack.',
      name: f.name.trim() ? '' : 'Enter your name.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? '' : 'Enter a valid email, like name@example.com.',
      phone: PHONE_RE.test(phone) ? '' : 'Enter a Nigerian number, like 0704 877 9681.',
      address: f.address.trim() ? '' : 'Enter your delivery address.',
    };
    setErrs(next);
    if (Object.values(next).some(Boolean)) return;

    const ref = refKeep.current;
    const payload = {
      ref,
      name: f.name.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      address: f.address.trim(),
      note: f.note.trim(),
      website: f.website, // honeypot, must stay empty
      items: items.map((i) => ({ id: i.p.id, qty: i.q })),
    };
    setFormErr('');
    setBusy(true);

    if (method === 'paystack') {
      const res = await startPaystack(payload);
      if (res.ok && res.url) {
        window.location.assign(res.url); // off to Paystack's hosted checkout
        return;
      }
      setBusy(false);
      if (res.errors) setErrs({ ...next, ...res.errors });
      else setFormErr(res.message || 'We could not start online payment.');
      return;
    }

    const res = await submitOrder(payload);
    setBusy(false);
    if (!res.ok && res.errors) {
      setErrs({ ...next, ...res.errors });
      return;
    }
    setDone({ ref: res.ok ? res.ref || ref : ref, items, total, emailed: res.ok });
  }

  if (done) return <Payment done={done} f={f} payRef={payRef} onBack={() => setDone(null)} />;

  return (
    <section>
      <div className="wrap" style={{ maxWidth: 720 }}>
        <Link className="crumb" to="/">Back to Kokobi+</Link>
        <h1 style={{ fontSize: 'clamp(2.2rem,7vw,3.6rem)' }}>Place your order</h1>
        <p>Choose your packs and tell us where to send them. Then pay by bank transfer and send us proof of payment on WhatsApp, or pay securely online with Paystack.</p>
        <form onSubmit={onSubmit} noValidate>
          {PRODUCTS.map((p) => (
            <div className="card orow" key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <p>{p.netWeight} <strong>{money(p.price)}</strong> <s>{money(p.regularPrice)}</s></p>
              </div>
              <div className="qty">
                <label className="sr" htmlFor={`q-${p.id}`}>Quantity of {p.name}</label>
                <input id={`q-${p.id}`} type="number" min="0" max="20" inputMode="numeric"
                  value={qty[p.id]} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} />
              </div>
            </div>
          ))}
          <p className="err">{errs.items}</p>
          <p className="st" aria-live="polite">
            {total ? `Total: ${money(total)}. You save ${money(saved)} with the launch offer.` : ''}
            {total && method === 'paystack' && online.fee > 0 ? ` Paying online adds a processing fee of about ${money(online.fee)}, so you would pay ${money(online.charge)}.` : ''}
          </p>

          <label htmlFor="on">Full name</label>
          <input id="on" autoComplete="name" value={f.name} onChange={set('name')} maxLength={100} />
          <p className="err">{errs.name}</p>

          <label htmlFor="oe">Email (your receipt is sent here)</label>
          <input id="oe" type="email" autoComplete="email" value={f.email} onChange={set('email')} maxLength={120} />
          <p className="err">{errs.email}</p>

          <label htmlFor="op">Phone or WhatsApp number</label>
          <input id="op" type="tel" autoComplete="tel" placeholder="0704 877 9681" value={f.phone} onChange={set('phone')} maxLength={20} />
          <p className="err">{errs.phone}</p>

          <label htmlFor="oa">Delivery address</label>
          <input id="oa" autoComplete="street-address" value={f.address} onChange={set('address')} maxLength={300} />
          <p className="err">{errs.address}</p>

          <label htmlFor="onote">Note (optional)</label>
          <textarea id="onote" value={f.note} onChange={set('note')} maxLength={500} />

          <fieldset className="paymethod">
            <legend>How would you like to pay?</legend>
            <label className="opt">
              <input type="radio" name="method" checked={method === 'bank'} onChange={() => setMethod('bank')} />
              <span><strong>Bank transfer</strong><br /><small>No extra fee. Pay to our account, then send proof of payment on WhatsApp.</small></span>
            </label>
            <label className="opt">
              <input type="radio" name="method" checked={method === 'paystack'} onChange={() => setMethod('paystack')} />
              <span>
                <strong>Pay online now</strong><br />
                <small>Card, bank transfer or USSD on Paystack's secure page. Receipt emailed instantly.</small>
                {PASS_FEE_NOTE(online)}
              </span>
            </label>
          </fieldset>

          {formErr && <p className="err-box" role="alert">{formErr}</p>}

          {/* Honeypot field: hidden from people, bots tend to fill it in. */}
          <div className="hp" aria-hidden="true">
            <label htmlFor="web">Website</label>
            <input id="web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
          </div>

          <p style={{ marginTop: 20 }}>
            <button className="btn pri" type="submit" disabled={busy}>
              {busy ? (method === 'paystack' ? 'Taking you to Paystack...' : 'Sending your order...') : method === 'paystack' ? 'Pay now' : 'Continue to payment'}
            </button>
          </p>
        </form>
      </div>
    </section>
  );
}

const PASS_FEE_NOTE = (online) =>
  PASS_FEE ? (
    <span className="feenote">
      Online payment attracts a processing fee
      {online.fee > 0 ? ` (about ${money(online.fee)} on this order).` : ' of about 1.5% + ₦100 (waived below ₦2,500).'}
    </span>
  ) : null;

function Payment({ done, f, payRef, onBack }) {
  const { ref, items, total, emailed } = done;
  const [copied, setCopied] = useState('');
  const lines = items.map((i) => `${i.q} x ${i.p.name}`);
  const msg =
    `Hi Kokobi+! Order ${ref}\n${lines.join('\n')}\nName: ${f.name}\nPhone: ${f.phone}\nAddress: ${f.address}` +
    (f.note ? `\nNote: ${f.note}` : '') + `\nTotal: ${money(total)}\nI have made payment. Proof attached.`;
  const copy = (no) => {
    try { navigator.clipboard.writeText(no); } catch { /* ignore */ }
    setCopied(no);
  };

  return (
    <section>
      <div className="wrap" style={{ maxWidth: 720 }} ref={payRef} role="status" aria-live="polite">
        <button type="button" className="backbtn" onClick={onBack} aria-label="Go back to your order">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Back to order
        </button>
        {emailed ? (
          <p className="ok-box">Thank you, {f.name.split(' ')[0]}! We have received your order details.</p>
        ) : (
          <p className="err-box">
            We could not send your order details automatically. Please complete the WhatsApp step below so we receive your order.
          </p>
        )}
        <h2>Pay by bank transfer</h2>
        <div className="card">
          <strong>Order {ref}</strong>
          <ul className="chk">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p style={{ margin: 0 }}>
            <strong>Total for items: {money(total)}</strong><br />
            We will confirm any delivery cost with you on WhatsApp.
          </p>
        </div>
        <h3 style={{ marginTop: 28 }}>Transfer to either account</h3>
        {CONFIG.bank.map((b) => (
          <div className="card bank" key={b.no}>
            <div><strong>{b.bank}</strong><br />{b.name}<br /><span className="acct">{b.no}</span></div>
            <button className="btn" type="button" onClick={() => copy(b.no)}>{copied === b.no ? 'Copied' : 'Copy number'}</button>
          </div>
        ))}
        <p>Use {ref} as your transfer narration if your bank app allows it.</p>
        <div className="card">
          <h3>Then send proof of payment</h3>
          <p>Send your payment screenshot or receipt on WhatsApp. Your order is confirmed once we receive it.</p>
          <a className="btn pri" href={waLink(msg)} target="_blank" rel="noopener noreferrer">Send proof of payment</a>
        </div>
        <p style={{ color: 'var(--muted)' }}>Your order is confirmed only after we receive your proof of payment.</p>
      </div>
    </section>
  );
}
