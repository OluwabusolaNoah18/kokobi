import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FAQ, CONFIG } from '../data.js';
import { useProducts } from '../products.jsx';
import { Price, ProductImg, FaqList, OrderBand } from '../components/Shared.jsx';

export default function Product() {
  const { slug } = useParams();
  const { products, status } = useProducts();
  const p = products.find((x) => x.slug === slug);
  useEffect(() => { if (p) document.title = `${p.name} | Kokobi+`; }, [p]);
  if (status === 'loading') return <section><div className="wrap"><p>Loading...</p></div></section>;
  if (!p) return <Navigate to="/" replace />;
  const label = p.formula ? `Formula ${p.formula}` : p.name;

  const chips = (list) => (
    <div className="uses" style={{ marginTop: 0 }}>
      {list.map((i) => <span key={i} className="use" style={{ borderColor: 'var(--ink)' }}>{i}</span>)}
    </div>
  );

  return (
    <>
      <section>
        <div className="wrap">
          <Link className="crumb" to="/">Back to Kokobi+</Link>
          <div className="pd">
            <div><ProductImg p={p} all /></div>
            <div>
              <span className="tag">{p.purpose}</span>
              <h1 style={{ fontSize: 'clamp(2.2rem,7vw,3.6rem)' }}>{p.name}</h1>
              <p style={{ color: 'var(--muted)' }}>{[p.type, p.netWeight].filter(Boolean).join(', ')}</p>
              <Price p={p} />
              <p>{p.desc}</p>
              <Link className="btn pri" to="/order">{CONFIG.mode === 'shop' ? 'Order Now' : 'Join the Waitlist'}</Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 780 }}>
          {p.what && (<><h2>What is {label}?</h2><p>{p.what}</p></>)}
          {p.who.length > 0 && (<><h2>{label} may be for you if:</h2><ul className="chk">{p.who.map((w) => <li key={w}>{w}</li>)}</ul></>)}
          {p.uses.length > 0 && (<><h2>Ways to use it</h2>{chips(p.uses)}</>)}
          <h2>Ingredients</h2>
          {p.ingredients.length ? chips(p.ingredients) : <p>The full ingredient list will be shown here once confirmed from the final product label.</p>}
          {p.nutrition && (
            <>
              <h2>Estimated nutrition</h2>
              <p style={{ color: 'var(--muted)' }}>
                Estimated nutritional values, {p.nutrition.basis.toLowerCase()}. Values are estimates and may be updated following laboratory analysis.
              </p>
              <div className="tbl">
                <table><tbody>{p.nutrition.rows.map((r) => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td></tr>)}</tbody></table>
              </div>
            </>
          )}
          <h2>Allergen information</h2>
          <p>{p.allergens ? <strong>Contains {p.allergens.join(', ').toLowerCase()}.</strong> : 'Allergen information will be confirmed and shown here before launch.'}</p>
          <h2>Directions</h2>
          <p>{p.directions || 'Directions will be confirmed with the final product label.'}</p>
          <h2>Storage</h2>
          <p>{p.storage}</p>
          <h2>FAQ</h2>
          <FaqList items={FAQ.slice(4, 11)} />
        </div>
      </section>
      <OrderBand />
    </>
  );
}
