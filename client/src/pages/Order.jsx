import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFIG, money, waLink, PHONE_RE, onlineCharge, PASS_FEE } from '../data.js';
import { submitOrder, startPaystack, checkPromo } from '../api.js';
import { useProducts } from '../products.jsx';

const clampQty = (v) => Math.max(0, Math.min(20, parseInt(v, 10) || 0));
const makeRef = () =>
  'KB-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

export default function Order() {
  const { products, status } = useProducts();
  const [qty, setQty] = useState({});
  const [promo, setPromo] = useState({ input: '', applied: null, msg: '', busy: false });
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', note: '', website: '' });
  const [errs, setErrs] = useState({});
  const [method, setMethod] = useState('bank'); // 'bank' | 'paystack'
  const [fulfilment, setFulfilment] = useState('delivery'); // 'delivery' | 'pickup'
  const pickup = fulfilment === 'pickup';
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [done, setDone] = useState(null); // { ref, items, total, emailed }
  const payRef = useRef(null);
  const refKeep = useRef(makeRef()); // same reference if the customer goes back and resubmits

  useEffect(() => { document.title = 'Order | Kokobi+'; }, []);
  useEffect(() => { if (done) payRef.current?.scrollIntoView(); }, [done]);

  const items = useMemo(
    () => products.map((p) => ({ p, q: clampQty(qty[p.id]) })).filter((i) => i.q > 0),
    [products, qty]
  );
  const itemsKey = items.map((i) => `${i.p.id}:${i.q}`).join(',');
  const subtotal = items.reduce((t, i) => t + i.p.price * i.q, 0);
  const saved = items.reduce((t, i) => t + (i.p.regularPrice - i.p.price) * i.q, 0);
  const discount = promo.applied ? Math.min(promo.applied.discount, subtotal) : 0;
  const total = subtotal - discount;
  const online = onlineCharge(total);

  const cartForApi = () => items.map((i) => ({ id: i.p.id, qty: i.q }));

  async function applyPromo() {
    const code = promo.input.trim();
    if (!code) { setPromo((s) => ({ ...s, msg: 'Enter a promo code first.' })); return; }
    setPromo((s) => ({ ...s, busy: true, msg: '' }));
    const res = await checkPromo(code, cartForApi());
    if (res.ok && res.discount != null) setPromo({ input: res.code, applied: { code: res.code, label: res.label, discount: res.discount }, msg: '', busy: false });
    else setPromo((s) => ({ ...s, busy: false, msg: res.message || 'We could not check that code. Please try again.' }));
    setErrs((e) => ({ ...e, promoCode: '' }));
  }
  const removePromo = () => setPromo({ input: '', applied: null, msg: '', busy: false });

  // If the cart changes after a code was applied, check the code again against the new cart.
  useEffect(() => {
    if (!promo.applied) return undefined;
    let stale = false;
    (async () => {
      if (!items.length) { removePromo(); return; }
      const res = await checkPromo(promo.applied.code, cartForApi());
      if (stale) return;
      if (res.ok && res.discount != null) setPromo((s) => ({ ...s, applied: { code: res.code, label: res.label, discount: res.discount } }));
      else setPromo({ input: promo.input, applied: null, msg: res.message || 'That code no longer applies to this cart.', busy: false });
    })();
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    const phone = f.phone.replace(/[\s-]/g, '');
    const next = {
      items: items.length ? '' : 'Choose at least one pack.',
      name: f.name.trim() ? '' : 'Enter your name.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? '' : 'Enter a valid email, like name@example.com.',
      phone: PHONE_RE.test(phone) ? '' : 'Enter a Nigerian number, like 0704 877 9681.',
      address: pickup || f.address.trim() ? '' : 'Enter your delivery address.',
    };
    setErrs(next);
    if (Object.values(next).some(Boolean)) return;
    if (promo.input.trim() && !promo.applied) {
      setPromo((s) => ({ ...s, msg: 'Press Apply to use this code, or clear the box.' }));
      return;
    }

    const ref = refKeep.current;
    const payload = {
      ref,
      name: f.name.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      fulfilment,
      address: pickup ? '' : f.address.trim(),
      note: f.note.trim(),
      website: f.website, // honeypot, must stay empty
      promoCode: promo.applied ? promo.applied.code : '',
      items: cartForApi(),
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
    // Show what the server actually charged (prices can change in the admin while someone is ordering).
    const s = res.ok ? res.order : null;
    setDone({
      ref: res.ok ? res.ref || ref : ref,
      items: s ? s.items.map((i) => ({ p: { name: i.name }, q: i.qty })) : items,
      subtotal: s ? s.subtotal : subtotal,
      discount: s ? s.discount : discount,
      promoCode: s ? s.promoCode : promo.applied?.code || '',
      total: s ? s.total : total,
      emailed: res.ok, fulfilment, address: pickup ? '' : f.address.trim(),
    });
  }

  if (done) return <Payment done={done} f={f} payRef={payRef} onBack={() => setDone(null)} />;

  if (status === 'loading') {
    return <section><div className="wrap" style={{ maxWidth: 720 }}><h1 style={{ fontSize: 'clamp(2.2rem,7vw,3.6rem)' }}>Place your order</h1><p>Loading today's prices...</p></div></section>;
  }
  if (!products.length) {
    return <section><div className="wrap" style={{ maxWidth: 720 }}><Link className="crumb" to="/">Back to Kokobi+</Link><h1 style={{ fontSize: 'clamp(2.2rem,7vw,3.6rem)' }}>Place your order</h1><p>Nothing is available to order right now. Please message us on WhatsApp and we will help.</p></div></section>;
  }

  return (
    <section>
      <div className="wrap" style={{ maxWidth: 720 }}>
        <Link className="crumb" to="/">Back to Kokobi+</Link>
        <h1 style={{ fontSize: 'clamp(2.2rem,7vw,3.6rem)' }}>Place your order</h1>
        <p>Choose your packs and tell us where to send them. Then pay by bank transfer and send us proof of payment on WhatsApp, or pay securely online with Paystack.</p>
        <form onSubmit={onSubmit} noValidate>
          {products.map((p) => (
            <div className="card orow" key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <p>{p.netWeight} <strong>{money(p.price)}</strong> {p.regularPrice > p.price && <s>{money(p.regularPrice)}</s>}</p>
              </div>
              <div className="qty">
                <label className="sr" htmlFor={`q-${p.id}`}>Quantity of {p.name}</label>
                <input id={`q-${p.id}`} type="number" min="0" max="20" inputMode="numeric"
                  value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} />
              </div>
            </div>
          ))}
          <p className="err">{errs.items}</p>
          <p className="st" aria-live="polite">
            {subtotal ? `Total: ${money(total)}.` : ''}
            {saved > 0 ? ` You save ${money(saved)} with the launch offer.` : ''}
            {discount > 0 ? ` Promo code ${promo.applied.code} takes off ${money(discount)}.` : ''}
            {total && method === 'paystack' && online.fee > 0 ? ` Paying online adds a processing fee of about ${money(online.fee)}, so you would pay ${money(online.charge)}.` : ''}
          </p>

          <div className="promo">
            <label htmlFor="promo">Promo code (optional)</label>
            <div className="promorow">
              <input id="promo" value={promo.input} maxLength={30} autoCapitalize="characters" autoComplete="off" disabled={!!promo.applied}
                onChange={(e) => setPromo({ ...promo, input: e.target.value, msg: '' })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!promo.applied) applyPromo(); } }} />
              {promo.applied
                ? <button type="button" className="btn" onClick={removePromo}>Remove</button>
                : <button type="button" className="btn" onClick={applyPromo} disabled={promo.busy}>{promo.busy ? 'Checking...' : 'Apply'}</button>}
            </div>
            {promo.applied
              ? <p className="okmsg">{promo.applied.code} applied: {promo.applied.label} (-{money(promo.applied.discount)})</p>
              : <p className="err">{promo.msg || errs.promoCode}</p>}
          </div>

          <label htmlFor="on">Full name</label>
          <input id="on" autoComplete="name" value={f.name} onChange={set('name')} maxLength={100} />
          <p className="err">{errs.name}</p>

          <label htmlFor="oe">Email (your receipt is sent here)</label>
          <input id="oe" type="email" autoComplete="email" value={f.email} onChange={set('email')} maxLength={120} />
          <p className="err">{errs.email}</p>

          <label htmlFor="op">Phone or WhatsApp number</label>
          <input id="op" type="tel" autoComplete="tel" placeholder="0704 877 9681" value={f.phone} onChange={set('phone')} maxLength={20} />
          <p className="err">{errs.phone}</p>

          <fieldset className="paymethod fulfil">
            <legend>How will you get your order?</legend>
            <label className="opt">
              <input type="radio" name="fulfilment" checked={!pickup} onChange={() => setFulfilment('delivery')} />
              <span><strong>Delivery</strong><br /><small>We bring it to you. Delivery cost is confirmed on WhatsApp.</small></span>
            </label>
            <label className="opt">
              <input type="radio" name="fulfilment" checked={pickup} onChange={() => setFulfilment('pickup')} />
              <span><strong>Pickup</strong><br /><small>You collect it yourself, so no address is needed. We confirm the pickup location and time on WhatsApp.</small></span>
            </label>
          </fieldset>

          {!pickup && (
            <>
              <label htmlFor="oa">Delivery address</label>
              <input id="oa" autoComplete="street-address" value={f.address} onChange={set('address')} maxLength={300} />
              <p className="err">{errs.address}</p>
            </>
          )}

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
  const { ref, items, total, discount = 0, promoCode, emailed, fulfilment, address } = done;
  const pickup = fulfilment === 'pickup';
  const [copied, setCopied] = useState('');
  const lines = items.map((i) => `${i.q} x ${i.p.name}`);
  const msg =
    `Hi Kokobi+! Order ${ref}\n${lines.join('\n')}\nName: ${f.name}\nPhone: ${f.phone}\n` +
    (pickup ? 'Order type: PICKUP (I will collect)' : `Order type: DELIVERY\nAddress: ${address}`) +
    (f.note ? `\nNote: ${f.note}` : '') +
    (discount > 0 ? `\nPromo code ${promoCode || ''}: -${money(discount)}` : '') +
    `\nTotal: ${money(total)}\nI have made payment. Proof attached.`;
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
            {discount > 0 && <>Promo code {promoCode}: -{money(discount)}<br /></>}
            <strong>Total for items: {money(total)}</strong><br />
            {pickup ? 'This is a pickup order. We will confirm the pickup location and time with you on WhatsApp.' : 'We will confirm any delivery cost with you on WhatsApp.'}
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
