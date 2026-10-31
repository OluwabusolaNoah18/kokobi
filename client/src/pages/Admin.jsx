import { useCallback, useEffect, useState } from 'react';
import { adminApi, shrinkImage } from '../adminApi.js';
import { money } from '../data.js';

const TOKEN_KEY = 'kokobi-admin-token';
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const saveToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

const lines = (v) => (Array.isArray(v) ? v.join('\n') : '');
const fromLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const whenNg = (d) => (d ? new Date(d).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }) : '');
const pct = (p) => (Number(p.regularPrice) > Number(p.price) ? Math.round((1 - p.price / p.regularPrice) * 100) : 0);

const EMPTY_PRODUCT = {
  name: '', slug: '', purpose: '', netWeight: '', desc: '', price: '', regularPrice: '', images: [], active: true, sortOrder: 0,
  formula: '', type: '', what: '', who: [], uses: [], ingredients: [], allergens: [], directions: '', storage: '', nutrition: null,
};

export default function Admin() {
  const [token, setToken] = useState(readToken);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('products');

  useEffect(() => {
    document.title = 'Admin | Kokobi+';
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = 'noindex, nofollow';
    return () => { meta.content = 'index, follow'; };
  }, []);

  const signOut = useCallback((msg = '') => { saveToken(''); setToken(''); setNotice(msg); }, []);
  const onAuthFail = useCallback((res) => { if (res.status === 401) { signOut('Your session ended. Please sign in again.'); return true; } return false; }, [signOut]);

  if (!token) return <Login notice={notice} onDone={(t) => { saveToken(t); setToken(t); setNotice(''); }} />;

  return (
    <section>
      <div className="wrap admin">
        <div className="admhead">
          <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', margin: 0 }}>Kokobi+ Admin</h1>
          <button type="button" className="btn" onClick={() => signOut()}>Sign out</button>
        </div>
        <div className="admtabs" role="tablist">
          {[['products', 'Products'], ['promos', 'Promo codes'], ['orders', 'Orders'], ['summary', 'Sales summary']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'products' && <ProductsTab token={token} onAuthFail={onAuthFail} />}
        {tab === 'promos' && <PromosTab token={token} onAuthFail={onAuthFail} />}
        {tab === 'orders' && <OrdersTab token={token} onAuthFail={onAuthFail} />}
        {tab === 'summary' && <SummaryTab token={token} onAuthFail={onAuthFail} />}
      </div>
    </section>
  );
}

/* ---------------- sign in ---------------- */
function Login({ onDone, notice }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await adminApi.login(pw);
    setBusy(false);
    if (res.ok && res.token) onDone(res.token);
    else setErr(res.message || 'Could not sign in.');
  }
  return (
    <section>
      <div className="wrap" style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 'clamp(2rem,6vw,3rem)' }}>Admin sign in</h1>
        {notice && <p className="ok-box">{notice}</p>}
        <form onSubmit={submit}>
          <label htmlFor="apw">Password</label>
          <input id="apw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="err-box" role="alert" style={{ marginTop: 12 }}>{err}</p>}
          <p style={{ marginTop: 16 }}><button className="btn pri" type="submit" disabled={busy || !pw}>{busy ? 'Signing in...' : 'Sign in'}</button></p>
        </form>
      </div>
    </section>
  );
}

/* Loads a list and handles "session ended" and "database not connected" in one place. */
function useList(load, onAuthFail) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    const res = await load();
    if (!res.ok) { if (onAuthFail(res)) return; setState({ loading: false, error: res.message, data: null }); return; }
    setState({ loading: false, error: '', data: res });
  }, [load, onAuthFail]);
  useEffect(() => { reload(); }, [reload]);
  return [state, reload];
}

/* ---------------- products ---------------- */
function ProductsTab({ token, onAuthFail }) {
  const load = useCallback(() => adminApi.products(token), [token]);
  const [{ loading, error, data }, reload] = useList(load, onAuthFail);
  const [editing, setEditing] = useState(null); // null = list, object = form
  const [msg, setMsg] = useState('');

  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}"? It disappears from the website. Past orders keep their details.\n\nTip: untick "Show on website" instead if you may want it back.`)) return;
    const res = await adminApi.deleteProduct(token, p.id);
    if (!res.ok && onAuthFail(res)) return;
    setMsg(res.ok ? `"${p.name}" was deleted.` : res.message);
    reload();
  }

  if (editing) {
    return <ProductForm token={token} initial={editing} onAuthFail={onAuthFail}
      onCancel={() => setEditing(null)} onSaved={(name) => { setEditing(null); setMsg(`"${name}" was saved. It is live on the website now.`); reload(); }} />;
  }
  return (
    <div>
      <div className="admbar">
        <p style={{ margin: 0 }}>Prices and products you change here go live on the website within about 20 seconds.</p>
        <button type="button" className="btn pri" onClick={() => { setMsg(''); setEditing({ ...EMPTY_PRODUCT }); }}>Add product</button>
      </div>
      {msg && <p className="ok-box">{msg}</p>}
      {loading && <p>Loading...</p>}
      {error && <p className="err-box" role="alert">{error}</p>}
      {data?.products?.map((p) => (
        <div className="card admrow" key={p.id}>
          <div className="admthumb">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : <span>No photo</span>}</div>
          <div className="admmain">
            <h3>{p.name} {!p.active && <span className="admpill off">Hidden</span>}</h3>
            <p>
              <strong>{money(p.price)}</strong>
              {pct(p) > 0 && <> <s>{money(p.regularPrice)}</s> <span className="admpill">{pct(p)}% off</span></>}
              {p.netWeight ? ` · ${p.netWeight}` : ''} · /{p.slug}
            </p>
          </div>
          <div className="admact">
            <button type="button" className="btn" onClick={() => { setMsg(''); setEditing({ ...EMPTY_PRODUCT, ...p }); }}>Edit</button>
            <button type="button" className="btn" onClick={() => remove(p)}>Delete</button>
          </div>
        </div>
      ))}
      {data && !data.products.length && <p>No products yet. Press "Add product".</p>}
    </div>
  );
}

function ProductForm({ token, initial, onCancel, onSaved, onAuthFail }) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    ...initial,
    price: initial.price ?? '', regularPrice: initial.regularPrice ?? '',
    who: lines(initial.who), uses: lines(initial.uses), ingredients: lines(initial.ingredients), allergens: lines(initial.allergens),
    nutBasis: initial.nutrition?.basis || 'Per 100 g', nutRows: (initial.nutrition?.rows || []).map((r) => r.join(' | ')).join('\n'),
    slugTouched: !isNew,
  });
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [discountPct, setDiscountPct] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const off = pct({ price: Number(f.price), regularPrice: Number(f.regularPrice) });

  function onName(e) {
    const name = e.target.value;
    setF((s) => ({ ...s, name, slug: s.slugTouched ? s.slug : slugify(name) }));
  }
  function applyDiscount(v) {
    setDiscountPct(v);
    const reg = Number(f.regularPrice);
    const p = Number(v);
    if (reg > 0 && p >= 0 && p < 100) setF((s) => ({ ...s, price: String(Math.round(reg * (1 - p / 100))) }));
  }

  async function addPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setFormErr('');
    try {
      const data = await shrinkImage(file);
      const res = await adminApi.upload(token, data);
      if (!res.ok) { if (onAuthFail(res)) return; setFormErr(res.message); }
      else setF((s) => ({ ...s, images: [...s.images, res.url].slice(0, 6) }));
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setUploading(false);
    }
  }
  const movePhoto = (i) => setF((s) => { const a = [...s.images]; const [x] = a.splice(i, 1); a.unshift(x); return { ...s, images: a }; });
  const dropPhoto = (i) => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrs({}); setFormErr('');
    const rows = fromLines(f.nutRows).map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0] && r[1]);
    const body = {
      id: initial.id, name: f.name, slug: f.slug, purpose: f.purpose, netWeight: f.netWeight, desc: f.desc,
      price: f.price, regularPrice: f.regularPrice, images: f.images, active: f.active, sortOrder: f.sortOrder,
      formula: f.formula, type: f.type, what: f.what, who: fromLines(f.who), uses: fromLines(f.uses),
      ingredients: fromLines(f.ingredients), allergens: fromLines(f.allergens), directions: f.directions, storage: f.storage,
      nutrition: rows.length ? { basis: f.nutBasis, rows } : null,
    };
    const res = await adminApi.saveProduct(token, body);
    setBusy(false);
    if (res.ok) { onSaved(f.name); return; }
    if (onAuthFail(res)) return;
    setErrs(res.errors || {});
    setFormErr(res.message || 'Could not save.');
  }

  const field = (id, label, input, hint) => (
    <div className="admfield">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <small className="hint">{hint}</small>}
      {errs[id] && <p className="err">{errs[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" className="backbtn" onClick={onCancel}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back to products
      </button>
      <h2 style={{ fontSize: 'clamp(1.6rem,5vw,2.2rem)' }}>{isNew ? 'Add a product' : `Edit ${initial.name}`}</h2>

      {field('name', 'Product name', <input id="name" value={f.name} onChange={onName} maxLength={100} />)}
      {field('slug', 'Web address of its page', <input id="slug" value={f.slug} onChange={(e) => setF((s) => ({ ...s, slug: slugify(e.target.value), slugTouched: true }))} maxLength={60} />, `Customers will see it at /${f.slug || 'your-product'}`)}
      {field('purpose', 'Short label (optional)', <input id="purpose" value={f.purpose} onChange={set('purpose')} maxLength={60} />, 'For example: Weight Gain')}
      {field('netWeight', 'Size (optional)', <input id="netWeight" value={f.netWeight} onChange={set('netWeight')} maxLength={30} />, 'For example: 250 g')}
      {field('desc', 'Short description', <textarea id="desc" value={f.desc} onChange={set('desc')} maxLength={600} />)}

      <fieldset className="paymethod">
        <legend>Price and discount</legend>
        <div className="admgrid">
          {field('regularPrice', 'Regular price (₦)', <input id="regularPrice" inputMode="numeric" value={f.regularPrice} onChange={(e) => { setF((s) => ({ ...s, regularPrice: e.target.value.replace(/\D/g, '') })); setDiscountPct(''); }} />, 'The "was" price. Leave empty for no discount.')}
          {field('price', 'Selling price (₦)', <input id="price" inputMode="numeric" value={f.price} onChange={(e) => { setF((s) => ({ ...s, price: e.target.value.replace(/\D/g, '') })); setDiscountPct(''); }} />, 'What customers pay.')}
          <div className="admfield">
            <label htmlFor="dpct">Or set a discount %</label>
            <input id="dpct" inputMode="numeric" value={discountPct} placeholder="e.g. 20" onChange={(e) => applyDiscount(e.target.value.replace(/\D/g, ''))} />
            <small className="hint">Works out the selling price from the regular price.</small>
          </div>
        </div>
        <p className="st">{off > 0 ? `Customers will see ${off}% off.` : 'No discount shown.'}</p>
      </fieldset>

      <fieldset className="paymethod">
        <legend>Photos</legend>
        <div className="admphotos">
          {f.images.map((u, i) => (
            <div className="admphoto" key={u}>
              <img src={u} alt="" />
              <div>
                {i > 0 && <button type="button" onClick={() => movePhoto(i)}>Make main</button>}
                <button type="button" onClick={() => dropPhoto(i)}>Remove</button>
              </div>
              {i === 0 && <span className="admpill">Main photo</span>}
            </div>
          ))}
        </div>
        <label className="btn" style={{ marginTop: 10, cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : 'Upload a photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={addPhoto} disabled={uploading || f.images.length >= 6} style={{ display: 'none' }} />
        </label>
        <small className="hint" style={{ display: 'block', marginTop: 6 }}>Up to 6 photos (JPG, PNG or WebP). They are shrunk automatically.</small>
      </fieldset>

      <fieldset className="paymethod">
        <legend>Visibility</legend>
        <label className="opt"><input type="checkbox" checked={f.active} onChange={set('active')} /><span><strong>Show on website</strong><br /><small>Untick to hide it and stop customers ordering it.</small></span></label>
        {field('sortOrder', 'Position on the page', <input id="sortOrder" inputMode="numeric" value={f.sortOrder} onChange={(e) => setF((s) => ({ ...s, sortOrder: e.target.value.replace(/[^\d-]/g, '') }))} />, 'Lower numbers come first.')}
      </fieldset>

      <details className="admmore">
        <summary>More details for its page (optional)</summary>
        {field('formula', 'Formula letter or short name', <input id="formula" value={f.formula} onChange={set('formula')} maxLength={20} />, 'Shows as "Formula A". Leave empty for other products.')}
        {field('type', 'Product type', <input id="type" value={f.type} onChange={set('type')} maxLength={80} />, 'For example: Plant-Based Protein Powder')}
        {field('what', 'What is it?', <textarea id="what" value={f.what} onChange={set('what')} maxLength={1000} />)}
        {field('who', 'May be for you if (one per line)', <textarea id="who" value={f.who} onChange={set('who')} />)}
        {field('uses', 'Ways to use it (one per line)', <textarea id="uses" value={f.uses} onChange={set('uses')} />)}
        {field('ingredients', 'Ingredients (one per line)', <textarea id="ingredients" value={f.ingredients} onChange={set('ingredients')} />)}
        {field('allergens', 'Allergens (one per line)', <textarea id="allergens" value={f.allergens} onChange={set('allergens')} />)}
        {field('nutBasis', 'Nutrition table heading', <input id="nutBasis" value={f.nutBasis} onChange={set('nutBasis')} maxLength={40} />)}
        {field('nutRows', 'Nutrition rows (one per line, like: Protein | approx. 27 g)', <textarea id="nutRows" value={f.nutRows} onChange={set('nutRows')} />)}
        {field('directions', 'Directions', <textarea id="directions" value={f.directions || ''} onChange={set('directions')} maxLength={600} />)}
        {field('storage', 'Storage', <textarea id="storage" value={f.storage} onChange={set('storage')} maxLength={400} />, 'Leave empty to use the standard storage text.')}
      </details>

      {formErr && <p className="err-box" role="alert" style={{ marginTop: 16 }}>{formErr}</p>}
      <p style={{ marginTop: 20 }}>
        <button className="btn pri" type="submit" disabled={busy || uploading}>{busy ? 'Saving...' : 'Save product'}</button>{' '}
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}

/* ---------------- promo codes ---------------- */
const EMPTY_PROMO = { code: '', kind: 'percent', value: '', minOrder: '', maxUses: '', expiresAt: '', active: true };

function PromosTab({ token, onAuthFail }) {
  const load = useCallback(() => adminApi.promos(token), [token]);
  const [{ loading, error, data }, reload] = useList(load, onAuthFail);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  async function remove(p) {
    if (!window.confirm(`Delete the code ${p.code}? Customers will no longer be able to use it.`)) return;
    const res = await adminApi.deletePromo(token, p.code);
    if (!res.ok && onAuthFail(res)) return;
    setMsg(res.ok ? `${p.code} was deleted.` : res.message);
    reload();
  }
  async function toggle(p) {
    const res = await adminApi.savePromo(token, { ...p, active: !p.active, expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '' }, false);
    if (!res.ok && onAuthFail(res)) return;
    setMsg(res.ok ? `${p.code} is now ${p.active ? 'switched off' : 'on'}.` : res.message);
    reload();
  }

  if (editing) {
    return <PromoForm token={token} initial={editing} onAuthFail={onAuthFail} onCancel={() => setEditing(null)}
      onSaved={(code) => { setEditing(null); setMsg(`${code} was saved.`); reload(); }} />;
  }
  return (
    <div>
      <div className="admbar">
        <p style={{ margin: 0 }}>Customers type a code on the order page to get money off their items.</p>
        <button type="button" className="btn pri" onClick={() => { setMsg(''); setEditing({ ...EMPTY_PROMO, isNew: true }); }}>Add promo code</button>
      </div>
      {msg && <p className="ok-box">{msg}</p>}
      {loading && <p>Loading...</p>}
      {error && <p className="err-box" role="alert">{error}</p>}
      {data?.promos?.map((p) => (
        <div className="card admrow" key={p.code}>
          <div className="admmain">
            <h3>{p.code} {!p.active && <span className="admpill off">Off</span>}</h3>
            <p>
              {p.kind === 'percent' ? `${p.value}% off` : `${money(p.value)} off`}
              {p.minOrder ? ` · min order ${money(p.minOrder)}` : ''}
              {p.maxUses ? ` · first ${p.maxUses} orders` : ''}
              {p.expiresAt ? ` · until ${new Date(p.expiresAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium' })}` : ''}
            </p>
          </div>
          <div className="admact">
            <button type="button" className="btn" onClick={() => toggle(p)}>{p.active ? 'Switch off' : 'Switch on'}</button>
            <button type="button" className="btn" onClick={() => { setMsg(''); setEditing({ ...EMPTY_PROMO, ...p, minOrder: p.minOrder || '', maxUses: p.maxUses ?? '', expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '' }); }}>Edit</button>
            <button type="button" className="btn" onClick={() => remove(p)}>Delete</button>
          </div>
        </div>
      ))}
      {data && !data.promos.length && <p>No promo codes yet.</p>}
    </div>
  );
}

function PromoForm({ token, initial, onCancel, onSaved, onAuthFail }) {
  const isNew = Boolean(initial.isNew);
  const [f, setF] = useState(initial);
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const num = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value.replace(/\D/g, '') }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrs({}); setFormErr('');
    const res = await adminApi.savePromo(token, { code: f.code, kind: f.kind, value: f.value, minOrder: f.minOrder, maxUses: f.maxUses, expiresAt: f.expiresAt, active: f.active }, isNew);
    setBusy(false);
    if (res.ok) { onSaved(String(f.code).toUpperCase()); return; }
    if (onAuthFail(res)) return;
    setErrs(res.errors || {});
    setFormErr(res.message || 'Could not save.');
  }

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" className="backbtn" onClick={onCancel}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back to promo codes
      </button>
      <h2 style={{ fontSize: 'clamp(1.6rem,5vw,2.2rem)' }}>{isNew ? 'Add a promo code' : `Edit ${initial.code}`}</h2>
      <div className="admfield">
        <label htmlFor="pcode">Code customers type</label>
        <input id="pcode" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} maxLength={30} disabled={!isNew} />
        <small className="hint">Letters and numbers only, for example WELCOME10.</small>
        {errs.code && <p className="err">{errs.code}</p>}
      </div>
      <div className="admgrid">
        <div className="admfield">
          <label htmlFor="pkind">Type of discount</label>
          <select id="pkind" value={f.kind} onChange={set('kind')}>
            <option value="percent">Percentage off</option>
            <option value="amount">Fixed naira amount off</option>
          </select>
        </div>
        <div className="admfield">
          <label htmlFor="pvalue">{f.kind === 'percent' ? 'Percentage (1 to 90)' : 'Amount off (₦)'}</label>
          <input id="pvalue" inputMode="numeric" value={f.value} onChange={num('value')} />
          {errs.value && <p className="err">{errs.value}</p>}
        </div>
      </div>
      <div className="admgrid">
        <div className="admfield">
          <label htmlFor="pmin">Minimum order (₦, optional)</label>
          <input id="pmin" inputMode="numeric" value={f.minOrder} onChange={num('minOrder')} />
          {errs.minOrder && <p className="err">{errs.minOrder}</p>}
        </div>
        <div className="admfield">
          <label htmlFor="pmax">Limit to first … orders (optional)</label>
          <input id="pmax" inputMode="numeric" value={f.maxUses} onChange={num('maxUses')} />
          {errs.maxUses && <p className="err">{errs.maxUses}</p>}
        </div>
        <div className="admfield">
          <label htmlFor="pexp">Last day it works (optional)</label>
          <input id="pexp" type="date" value={f.expiresAt} onChange={set('expiresAt')} />
          {errs.expiresAt && <p className="err">{errs.expiresAt}</p>}
        </div>
      </div>
      <label className="opt" style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400 }}>
        <input type="checkbox" checked={f.active} onChange={set('active')} style={{ width: 22, minHeight: 22 }} /> Code is switched on
      </label>
      {formErr && <p className="err-box" role="alert" style={{ marginTop: 16 }}>{formErr}</p>}
      <p style={{ marginTop: 20 }}>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save code'}</button>{' '}
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  );
}

/* ---------------- orders ---------------- */
const METHOD = { paystack: 'Paystack', bank: 'bank transfer', cash: 'cash' };
const todayNg = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

/** A WhatsApp link with the receipt already typed (for customers who have no email). */
function waReceiptUrl(o) {
  const first = o.name && o.name !== 'Walk-in customer' ? ` ${o.name.split(' ')[0]}` : '';
  const text = [
    `Hi${first}! Thank you for your purchase from Kokobi+. Here is your receipt.`,
    `Order: ${o.ref}`,
    ...o.items.map((i) => `${i.qty} x ${i.name} = ${money(i.lineTotal)}`),
    ...(o.discount ? [`Discount: -${money(o.discount)}`] : []),
    `Total paid (cash): ${money(o.total)}`,
  ].join('\n');
  let n = String(o.phone || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '234' + n.slice(1);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

const handed = (o) => (o.method === 'cash' ? 'Handed over' : o.fulfilment === 'pickup' ? 'Collected' : 'Delivered');
const markWord = (o) => (o.method === 'cash' ? 'handed over' : o.fulfilment === 'pickup' ? 'collected' : 'delivered');
const needsDelivery = (o) => o.status === 'paid' && !o.deliveredAt;
const FILTERS = [['all', 'All'], ['todo', 'To deliver'], ['done', 'Delivered'], ['unpaid', 'Awaiting payment']];
const matchFilter = (f, o) => f === 'all' || (f === 'todo' && needsDelivery(o)) || (f === 'done' && o.deliveredAt) || (f === 'unpaid' && o.status !== 'paid');

function OrdersTab({ token, onAuthFail }) {
  const load = useCallback(() => adminApi.orders(token), [token]);
  const [{ loading, error, data }, reload] = useList(load, onAuthFail);
  const [open, setOpen] = useState('');
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState('');
  const [mailTo, setMailTo] = useState({});
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('all');
  const [notes, setNotes] = useState({});

  const paid = (data?.orders || []).filter((o) => o.status === 'paid');
  const paidTotal = paid.reduce((n, o) => n + (o.total || 0), 0);

  async function sendReceipt(o) {
    setBusy(o.ref); setNotice('');
    const res = await adminApi.sendReceipt(token, o.ref, (mailTo[o.ref] ?? o.email ?? '').trim());
    setBusy('');
    if (!res.ok && onAuthFail(res)) return;
    setNotice(res.ok ? `Receipt emailed to ${res.email}.` : res.message);
    if (res.ok) reload();
  }
  async function setDelivered(o, delivered) {
    setBusy(o.ref); setNotice('');
    const res = await adminApi.setDelivery(token, o.ref, delivered, notes[o.ref] ?? o.deliveryNote ?? '');
    setBusy('');
    if (!res.ok && onAuthFail(res)) return;
    if (!res.ok) { setNotice(res.message); return; }
    let msg = delivered ? `Marked as ${markWord(o)}.` : 'Marked as not delivered.';
    if (res.guide === 'sent') msg += ` Usage guide emailed to ${res.guideEmail}.`;
    else if (res.guide === 'failed') msg += ` ${res.guideError}`;
    else if (res.guide === 'no-email') msg += ' This customer has no email, so no usage guide was sent. You can add one in the order and send it.';
    setNotice(msg);
    reload();
  }
  async function sendGuide(o) {
    setBusy(o.ref); setNotice('');
    const res = await adminApi.sendGuide(token, o.ref, (mailTo[`g-${o.ref}`] ?? o.email ?? '').trim());
    setBusy('');
    if (!res.ok && onAuthFail(res)) return;
    setNotice(res.ok ? `Usage guide emailed to ${res.email}.` : res.message);
    if (res.ok) reload();
  }
  async function removeSale(o) {
    if (!window.confirm(`Delete this cash sale (${o.ref}, ${money(o.total)})? This removes it from your records.`)) return;
    const res = await adminApi.deleteSale(token, o.ref);
    if (!res.ok && onAuthFail(res)) return;
    setNotice(res.ok ? 'Sale deleted.' : res.message);
    if (res.ok) reload();
  }

  if (logging) {
    return <SaleForm token={token} onAuthFail={onAuthFail} onClose={(logged) => { setLogging(false); if (logged) reload(); }} />;
  }
  return (
    <div>
      <div className="admbar">
        <p style={{ margin: 0 }}>Every order, online and cash. Bank-transfer orders show as "Awaiting payment" until you send the receipt.</p>
        <span className="admbtns">
          <button type="button" className="btn pri" onClick={() => { setNotice(''); setLogging(true); }}>Log a cash sale</button>
          <button type="button" className="btn" onClick={reload} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </span>
      </div>
      {data && (
        <div className="admtabs" role="group" aria-label="Show orders">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} ({data.orders.filter((o) => matchFilter(id, o)).length})
            </button>
          ))}
        </div>
      )}
      {data && paid.length > 0 && <p className="admsum">Paid orders in this list: <strong>{paid.length}</strong> · Items sold for <strong>{money(paidTotal)}</strong> · Waiting to be delivered: <strong>{paid.filter(needsDelivery).length}</strong></p>}
      {notice && <p className="okmsg" role="status">{notice}</p>}
      {error && <p className="err-box" role="alert">{error}</p>}
      {data?.orders?.filter((o) => matchFilter(filter, o)).map((o) => (
        <div className="card admorder" key={o.ref}>
          <button type="button" className="admorderhead" onClick={() => setOpen(open === o.ref ? '' : o.ref)} aria-expanded={open === o.ref}>
            <span><strong>{o.name}</strong> · {o.ref}<br /><small>{whenNg(o.createdAt)}</small></span>
            <span className="admorderside">
              <strong>{money(o.charged || o.total)}</strong><br />
              <span className={`admpill ${o.status === 'paid' ? '' : 'off'}`}>{o.status === 'paid' ? 'Paid' : 'Awaiting payment'}</span>{' '}
              <span className="admpill">{o.method === 'cash' ? 'Cash' : o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</span>{' '}
              {o.deliveredAt ? <span className="admpill good">{handed(o)}</span> : o.status === 'paid' ? <span className="admpill warn">{o.fulfilment === 'pickup' ? 'To collect' : 'To deliver'}</span> : null}
            </span>
          </button>
          {needsDelivery(o) && (
            <div className="admquick">
              <button type="button" className="btn" disabled={busy === o.ref} onClick={() => setDelivered(o, true)}>{busy === o.ref ? 'Saving...' : `Mark as ${markWord(o)}`}</button>
            </div>
          )}
          {open === o.ref && (
            <div className="admorderbody">
              <ul className="chk">{o.items.map((i) => <li key={i.id}>{i.qty} x {i.name} ({money(i.lineTotal)})</li>)}</ul>
              <p>
                {o.discount > 0 && <>Subtotal {money(o.subtotal)} · Discount {o.promoCode ? `(${o.promoCode}) ` : ''}-{money(o.discount)}<br /></>}
                Items total {money(o.total)}{o.fee > 0 ? ` · Online fee ${money(o.fee)} · Paid ${money(o.charged)}` : ''}<br />
                Paid by {METHOD[o.method] || o.method}{o.paidAt ? ` on ${whenNg(o.paidAt)}` : ''}
              </p>
              <p>
                {o.phone ? <><a href={`tel:${o.phone}`}>{o.phone}</a>{' · '}</> : null}
                {o.email ? <a href={`mailto:${o.email}`}>{o.email}</a> : o.method === 'cash' ? 'No email on file' : null}
                {o.method !== 'cash' && <><br />{o.fulfilment === 'pickup' ? 'Pickup (customer will collect)' : `Deliver to: ${o.address}`}</>}
                {o.note ? <><br />Note: {o.note}</> : null}
              </p>
              <div className="admreceipt">
                <strong>{o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} tracker</strong>
                <p style={{ margin: '6px 0' }}>{o.deliveredAt ? `${handed(o)} on ${whenNg(o.deliveredAt)}.` : o.status === 'paid' ? 'Not delivered yet.' : 'Waiting for payment first.'}</p>
                <label htmlFor={`dn-${o.ref}`}>Note (optional, for example who received it)</label>
                <input id={`dn-${o.ref}`} value={notes[o.ref] ?? o.deliveryNote ?? ''} maxLength={200} onChange={(e) => setNotes({ ...notes, [o.ref]: e.target.value })} />
                <p className="admbtns" style={{ marginTop: 10 }}>
                  {o.deliveredAt
                    ? <>
                        <button type="button" className="btn" disabled={busy === o.ref} onClick={() => setDelivered(o, true)}>Save note</button>
                        <button type="button" className="btn" disabled={busy === o.ref} onClick={() => setDelivered(o, false)}>Mark as not delivered</button>
                      </>
                    : <button type="button" className="btn pri" disabled={busy === o.ref} onClick={() => setDelivered(o, true)}>Mark as {markWord(o)}</button>}
                </p>
                <p className="hint" style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '.9rem' }}>When you mark an order as {markWord(o)}, the customer is emailed their usage guide (PDF).</p>
                <label htmlFor={`g-${o.ref}`} style={{ marginTop: 12, display: 'block' }}>Send the usage guide by email</label>
                <div className="promorow">
                  <input id={`g-${o.ref}`} type="email" inputMode="email" placeholder="customer@example.com" value={mailTo[`g-${o.ref}`] ?? o.email ?? ''} onChange={(e) => setMailTo({ ...mailTo, [`g-${o.ref}`]: e.target.value })} />
                  <button type="button" className="btn" disabled={busy === o.ref} onClick={() => sendGuide(o)}>{busy === o.ref ? 'Sending...' : 'Send guide'}</button>
                </div>
              </div>
              {o.method === 'cash' && (
                <div className="admreceipt" style={{ marginTop: 12 }}>
                  <label htmlFor={`m-${o.ref}`}>Send the receipt by email</label>
                  <div className="promorow">
                    <input id={`m-${o.ref}`} type="email" inputMode="email" placeholder="customer@example.com" value={mailTo[o.ref] ?? o.email ?? ''} onChange={(e) => setMailTo({ ...mailTo, [o.ref]: e.target.value })} />
                    <button type="button" className="btn" disabled={busy === o.ref} onClick={() => sendReceipt(o)}>{busy === o.ref ? 'Sending...' : 'Send receipt'}</button>
                  </div>
                  <p className="admbtns" style={{ marginTop: 10 }}>
                    <a className="btn" href={waReceiptUrl(o)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
                    <button type="button" className="btn" onClick={() => removeSale(o)}>Delete this sale</button>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {data && !data.orders.length && <p>No orders yet.</p>}
      {data && data.orders.length > 0 && !data.orders.some((o) => matchFilter(filter, o)) && <p>Nothing here.</p>}
    </div>
  );
}

/* ---------------- log a cash sale ---------------- */
function SaleForm({ token, onAuthFail, onClose }) {
  const load = useCallback(() => adminApi.products(token), [token]);
  const [{ loading, error, data }] = useList(load, onAuthFail);
  const [f, setF] = useState({ name: '', email: '', phone: '', date: todayNg(), discount: '', note: '' });
  const [qty, setQty] = useState({});
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const products = data?.products || [];
  const subtotal = products.reduce((n, p) => n + (Number.parseInt(qty[p.id], 10) || 0) * p.price, 0);
  const discount = Number.parseInt(f.discount, 10) || 0;
  const total = Math.max(0, subtotal - discount);

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setErrors({});
    const items = products.map((p) => ({ id: p.id, qty: Number.parseInt(qty[p.id], 10) || 0 })).filter((i) => i.qty > 0);
    setSaving(true);
    const res = await adminApi.logSale(token, { ...f, items });
    setSaving(false);
    if (!res.ok) {
      if (onAuthFail(res)) return;
      setErrors(res.errors || {}); setMsg(res.message); return;
    }
    setDone(res);
  }

  if (done) {
    const o = done.order;
    return (
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Sale logged</h2>
        <p><strong>{o.ref}</strong> · {money(o.total)} · {o.name}</p>
        {done.emailed && <p className="okmsg" role="status">The receipt was emailed to {o.email}.</p>}
        {done.emailError && <p className="err-box" role="alert">{done.emailError}</p>}
        {!o.email && <p>No email was entered, so no receipt was emailed. You can send it on WhatsApp instead.</p>}
        <p className="admbtns">
          <a className="btn pri" href={done.whatsappUrl} target="_blank" rel="noopener noreferrer">Send receipt on WhatsApp</a>
          <button type="button" className="btn" onClick={() => onClose(true)}>Done</button>
        </p>
      </div>
    );
  }

  const field = (id, label, input, hint) => (
    <div className="admfield">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <small className="hint">{hint}</small>}
      {errors[id] && <p className="err" role="alert">{errors[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" className="backbtn" onClick={() => onClose(false)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back to orders
      </button>
      <h2 style={{ fontSize: 'clamp(1.6rem,5vw,2.2rem)' }}>Log a cash sale</h2>
      {loading && <p>Loading products...</p>}
      {error && <p className="err-box" role="alert">{error}</p>}
      {products.length > 0 && (
        <fieldset className="admset">
          <legend>What did they buy?</legend>
          {products.map((p) => (
            <div className="admsaleitem" key={p.id}>
              <label htmlFor={`q-${p.id}`}><strong>{p.name}</strong>{p.active ? '' : ' (hidden)'}<br /><small>{money(p.price)} each</small></label>
              <input id={`q-${p.id}`} type="number" inputMode="numeric" min="0" max="500" value={qty[p.id] ?? ''} placeholder="0" onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} />
            </div>
          ))}
          {errors.items && <p className="err" role="alert">{errors.items}</p>}
        </fieldset>
      )}
      {field('discount', 'Discount in naira (optional)', <input id="discount" inputMode="numeric" value={f.discount} onChange={set('discount')} placeholder="0" />, 'Take this off the total, for example when you agreed a lower price.')}
      <p className="admtotal">Total: <strong>{money(total)}</strong>{discount > 0 && subtotal > 0 ? ` (${money(subtotal)} less ${money(discount)})` : ''}</p>
      {field('name', 'Customer name (optional)', <input id="name" value={f.name} onChange={set('name')} maxLength={80} autoComplete="off" />)}
      {field('email', 'Customer email (optional)', <input id="email" type="email" inputMode="email" value={f.email} onChange={set('email')} maxLength={120} autoComplete="off" />, 'If you enter one, the receipt is emailed to them with a PDF.')}
      {field('phone', 'Phone or WhatsApp (optional)', <input id="phone" type="tel" value={f.phone} onChange={set('phone')} maxLength={30} autoComplete="off" />, 'Used for the WhatsApp receipt option.')}
      {field('date', 'Date of sale', <input id="date" type="date" value={f.date} max={todayNg()} onChange={set('date')} />, 'Change this if you are recording an earlier sale.')}
      {field('note', 'Note (optional)', <textarea id="note" rows={2} value={f.note} onChange={set('note')} maxLength={300} />)}
      {msg && <p className="err-box" role="alert">{msg}</p>}
      <p className="admbtns">
        <button type="submit" className="btn pri" disabled={saving || loading}>{saving ? 'Saving...' : f.email.trim() ? 'Save sale and email receipt' : 'Save sale'}</button>
        <button type="button" className="btn" onClick={() => onClose(false)}>Cancel</button>
      </p>
    </form>
  );
}

/* ---------------- sales summary ---------------- */
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthStart = (date) => `${date.slice(0, 8)}01`;
const dayLabel = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function presetRange(id, today = todayNg()) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  switch (id) {
    case 'today': return [today, today];
    case 'yesterday': return [addDays(today, -1), addDays(today, -1)];
    case 'week': return [addDays(today, -dow), today];
    case 'month': return [monthStart(today), today];
    case 'lastmonth': { const end = addDays(monthStart(today), -1); return [monthStart(end), end]; }
    default: return [today, today];
  }
}
const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom dates']];

function SummaryTab({ token, onAuthFail }) {
  const [preset, setPreset] = useState('today');
  const [[from, to], setRange] = useState(() => presetRange('today'));
  const [{ loading, error, data }, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let live = true;
    if (!from || !to || to < from) { setState({ loading: false, error: to < from ? 'The end date must not be before the start date.' : '', data: null }); return undefined; }
    setState((s) => ({ ...s, loading: true, error: '' }));
    adminApi.summary(token, from, to).then((res) => {
      if (!live) return;
      if (!res.ok) { if (onAuthFail(res)) return; setState({ loading: false, error: res.message, data: null }); return; }
      setState({ loading: false, error: '', data: res });
    });
    return () => { live = false; };
  }, [token, from, to, onAuthFail]);

  function choose(id) {
    setPreset(id);
    if (id !== 'custom') setRange(presetRange(id));
  }
  function downloadCsv() {
    const rows = [['Date', 'Orders', 'Money received (NGN)'], ...data.daily.map((d) => [d.date, d.orders, d.revenue]), ['Total', data.totals.orders, data.totals.revenue]];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kokobi-sales-${data.from}-to-${data.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const max = data ? Math.max(1, ...data.daily.map((d) => d.revenue)) : 1;
  const METHODS = [['paystack', 'Paid online (Paystack)'], ['bank', 'Bank transfer'], ['cash', 'Cash']];
  return (
    <div>
      <p style={{ marginTop: 0 }}>Money received from orders that are <strong>paid</strong>, counted on the day they were paid. Bank-transfer orders count once you have sent the receipt.</p>
      <div className="admtabs" role="group" aria-label="Period">
        {PRESETS.map(([id, label]) => (
          <button key={id} type="button" className={preset === id ? 'on' : ''} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="admgrid" style={{ maxWidth: 520 }}>
          <div className="admfield"><label htmlFor="sfrom">From</label><input id="sfrom" type="date" value={from} max={todayNg()} onChange={(e) => setRange([e.target.value, to])} /></div>
          <div className="admfield"><label htmlFor="sto">To</label><input id="sto" type="date" value={to} max={todayNg()} onChange={(e) => setRange([from, e.target.value])} /></div>
        </div>
      )}
      {error && <p className="err-box" role="alert">{error}</p>}
      {loading && !data && <p>Loading...</p>}
      {data && (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <p className="admsum">{data.from === data.to ? dayLabel(data.from) : `${dayLabel(data.from)} to ${dayLabel(data.to)}`}</p>
          <div className="admcards">
            <div className="card admstat"><small>Money received</small><strong>{money(data.totals.revenue)}</strong></div>
            <div className="card admstat"><small>Paid orders</small><strong>{data.totals.orders}</strong></div>
            <div className="card admstat"><small>Average order</small><strong>{money(data.average)}</strong></div>
            <div className="card admstat"><small>Discounts given</small><strong>{money(data.totals.discount)}</strong></div>
          </div>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 14 }}>
            <strong>By payment method</strong>
            {METHODS.map(([k, label]) => (
              <div className="admmethod" key={k}><span>{label}</span><span>{data.byMethod[k]?.orders || 0} orders</span><strong>{money(data.byMethod[k]?.revenue || 0)}</strong></div>
            ))}
          </div>
          {data.pending.orders > 0 && (
            <p className="admsum">Not counted yet: <strong>{data.pending.orders}</strong> bank-transfer order{data.pending.orders === 1 ? '' : 's'} placed in this period still awaiting payment ({money(data.pending.total)}).</p>
          )}
          <div className="admbar">
            <strong>Day by day</strong>
            <button type="button" className="btn" onClick={downloadCsv}>Download CSV</button>
          </div>
          <div className="card admdays">
            {[...data.daily].reverse().map((d) => (
              <div className="admday" key={d.date}>
                <span className="admdaydate">{dayLabel(d.date)}</span>
                <span className="admdaybar"><i style={{ width: `${(d.revenue / max) * 100}%` }} /></span>
                <span className="admdayamt">{money(d.revenue)}<small> · {d.orders}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
