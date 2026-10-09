import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money, waLink, API_URL } from '../data.js';
import { verifyPayment } from '../api.js';

/* Paystack sends the customer back here with ?reference=KB-... after checkout. */
export default function PaymentComplete() {
  const [params] = useSearchParams();
  const ref = params.get('reference') || params.get('trxref') || '';
  const [state, setState] = useState({ phase: 'checking' }); // checking | paid | failed | error

  useEffect(() => { document.title = 'Payment | Kokobi+'; }, []);

  useEffect(() => {
    if (!/^KB-\d{6}-[A-Z0-9]{4}$/.test(ref)) { setState({ phase: 'error', message: 'This page needs an order reference.' }); return; }
    let cancelled = false;
    (async () => {
      const LAST = 3;
      for (let attempt = 0; attempt <= LAST && !cancelled; attempt++) {
        const res = await verifyPayment(ref);
        if (cancelled) return;
        if (res.ok && res.paid) { setState({ phase: 'paid', ...res }); return; }
        if (res.ok && ['abandoned', 'failed', 'reversed'].includes(res.status)) { setState({ phase: 'failed' }); return; }
        if (!res.ok && res.httpStatus && res.httpStatus < 500) { setState({ phase: 'error', message: res.message }); return; }
        if (attempt === LAST) {
          setState({ phase: 'error', message: res.message || 'We are still waiting for Paystack to confirm your payment.' });
          return;
        }
        await new Promise((r) => setTimeout(r, 2500)); // payment may still be settling
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);

  const help = waLink(`Hi Kokobi+! I need help with order ${ref}.`);

  return (
    <section>
      <div className="wrap" style={{ maxWidth: 720 }} role="status" aria-live="polite">
        {state.phase === 'checking' && (<><h1 style={{ fontSize: 'clamp(2rem,6vw,3rem)' }}>Confirming your payment...</h1><p>Please wait a moment and do not close this page.</p></>)}

        {state.phase === 'paid' && (
          <>
            <p className="ok-box">Payment received. Thank you!</p>
            <h1 style={{ fontSize: 'clamp(2rem,6vw,3rem)' }}>Your order is confirmed</h1>
            <div className="card">
              <strong>Order {state.ref}</strong>
              <ul className="chk">{state.items.map((i) => <li key={i.name}>{i.qty} x {i.name}</li>)}</ul>
              {state.fee > 0 && (
                <p style={{ margin: '0 0 6px' }}>Items: {money(state.subtotal)}<br />Online payment fee: {money(state.fee)}</p>
              )}
              <p style={{ margin: 0 }}><strong>Total paid: {money(state.total)}</strong></p>
            </div>
            <p>We have emailed your receipt to <strong>{state.email}</strong>. If it is not in your inbox in a few minutes, check your spam folder.</p>
            <div className="card">
              <h3>Next: confirm delivery on WhatsApp</h3>
              <p>Message us so we can confirm your delivery cost and delivery date.</p>
              <a className="btn pri" href={waLink(`Hi Kokobi+! I have paid online for order ${state.ref} (${money(state.total)}). Please confirm my delivery cost and delivery date.`)} target="_blank" rel="noopener noreferrer">
                Chat with us on WhatsApp
              </a>
            </div>
            <p style={{ marginTop: 20 }}>
              <a className="btn" href={`${API_URL}/api/paystack/receipt/${encodeURIComponent(state.ref)}?t=${encodeURIComponent(state.receiptToken)}`}>
                Download receipt (PDF)
              </a>
            </p>
            <Link className="btn pri" to="/">Back to Kokobi+</Link>
          </>
        )}

        {state.phase === 'failed' && (
          <>
            <h1 style={{ fontSize: 'clamp(2rem,6vw,3rem)' }}>Payment not completed</h1>
            <p>No money was taken for order {ref}. You can try again, or pay by bank transfer instead.</p>
            <Link className="btn pri" to="/order">Back to your order</Link>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <h1 style={{ fontSize: 'clamp(2rem,6vw,3rem)' }}>We could not confirm your payment</h1>
            <p className="err-box">{state.message}</p>
            <p>If you were charged, do not pay again. Message us with your order reference and we will sort it out.</p>
            <a className="btn pri" href={help} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
          </>
        )}
      </div>
    </section>
  );
}
