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
          {[['products', 'Products'], ['promos', 'Promo codes'], ['orders', 'Orders']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'products' && <ProductsTab token={token} onAuthFail={onAuthFail} />}
        {tab === 'promos' && <PromosTab token={token} onAuthFail={onAuthFail} />}
        {tab === 'orders' && <OrdersTab token={token} onAuthFail={onAuthFail} />}
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
function OrdersTab({ token, onAuthFail }) {
  const load = useCallback(() => adminApi.orders(token), [token]);
  const [{ loading, error, data }, reload] = useList(load, onAuthFail);
  const [open, setOpen] = useState('');
  return (
    <div>
      <div className="admbar">
        <p style={{ margin: 0 }}>The latest orders. Bank-transfer orders show as "Awaiting payment" until you send the receipt.</p>
        <button type="button" className="btn" onClick={reload} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>
      {error && <p className="err-box" role="alert">{error}</p>}
      {data?.orders?.map((o) => (
        <div className="card admorder" key={o.ref}>
          <button type="button" className="admorderhead" onClick={() => setOpen(open === o.ref ? '' : o.ref)} aria-expanded={open === o.ref}>
            <span><strong>{o.name}</strong> · {o.ref}<br /><small>{whenNg(o.createdAt)}</small></span>
            <span className="admorderside">
              <strong>{money(o.charged || o.total)}</strong><br />
              <span className={`admpill ${o.status === 'paid' ? '' : 'off'}`}>{o.status === 'paid' ? 'Paid' : 'Awaiting payment'}</span>{' '}
              <span className="admpill">{o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            </span>
          </button>
          {open === o.ref && (
            <div className="admorderbody">
              <ul className="chk">{o.items.map((i) => <li key={i.id}>{i.qty} x {i.name} ({money(i.lineTotal)})</li>)}</ul>
              <p>
                {o.discount > 0 && <>Subtotal {money(o.subtotal)} · Discount {o.promoCode ? `(${o.promoCode}) ` : ''}-{money(o.discount)}<br /></>}
                Items total {money(o.total)}{o.fee > 0 ? ` · Online fee ${money(o.fee)} · Paid ${money(o.charged)}` : ''}<br />
                Paid by {o.method === 'paystack' ? 'Paystack' : 'bank transfer'}{o.paidAt ? ` on ${whenNg(o.paidAt)}` : ''}
              </p>
              <p>
                <a href={`tel:${o.phone}`}>{o.phone}</a> · <a href={`mailto:${o.email}`}>{o.email}</a><br />
                {o.fulfilment === 'pickup' ? 'Pickup (customer will collect)' : `Deliver to: ${o.address}`}
                {o.note ? <><br />Note: {o.note}</> : null}
              </p>
            </div>
          )}
        </div>
      ))}
      {data && !data.orders.length && <p>No orders yet.</p>}
    </div>
  );
}
