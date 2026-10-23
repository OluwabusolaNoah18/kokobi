import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WAYS, FAQ, money } from '../data.js';
import { useProducts, percentOff } from '../products.jsx';
import { Price, ProductImg, FaqList, OrderBand } from '../components/Shared.jsx';
import imgA from '../assets/a.webp';
import imgB from '../assets/b.webp';

/* The launch banner is worked out from the current prices, so it always matches what you set in /admin. */
function launchOffer(products) {
  const on = products.filter((p) => percentOff(p) > 0);
  if (!on.length) return null;
  const maxOff = Math.max(...on.map(percentOff));
  const same = on.every((p) => p.price === on[0].price && p.regularPrice === on[0].regularPrice);
  const names = on.map((p) => p.name.replace(/^Kokobi\+\s*/, ''));
  const text = same
    ? `Get ${names.join(' or ')} for ${money(on[0].price)} each, down from ${money(on[0].regularPrice)}${on[0].netWeight ? ` for the ${on[0].netWeight} pack` : ''}.`
    : `Prices start from ${money(Math.min(...on.map((p) => p.price)))}, with up to ${maxOff}% off selected packs.`;
  return { maxOff, text };
}

export default function Home() {
  const { products, status } = useProducts();
  const offer = launchOffer(products);
  useEffect(() => { document.title = 'Kokobi+ | Everyday Wellness'; }, []);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <h1>Everyday nutrition, made simpler.</h1>
          <p>Plant-based blends made to fit into your everyday routine. Whether you're working toward healthy weight gain or simply looking for convenient everyday nourishment.</p>
          <div className="row">
            <Link className="btn pri" to="/order">Order Now</Link>
            <Link className="btn" to="/#products">Explore Kokobi+</Link>
          </div>
          <div className="fam">
            <img src={imgA} alt="Kokobi+ Formula A pouch front" />
            <img src={imgB} alt="Kokobi+ Formula B pouch front" />
          </div>
        </div>
      </section>

      {offer && (
        <section className="launch" style={{ padding: '36px 0' }}>
          <div className="wrap">
            <h2 style={{ fontSize: 'clamp(1.8rem,5vw,2.8rem)' }}>Kokobi+ has launched. Enjoy {offer.maxOff}% off.</h2>
            <p>{offer.text}</p>
            <Link className="btn" to="/order">Order Now</Link>
          </div>
        </section>
      )}

      <section id="about">
        <div className="wrap">
          <h2>Nutrition that fits real life.</h2>
          <p>Kokobi+ is built around a simple idea: everyday nutrition shouldn't have to be complicated.</p>
          <p>We create convenient plant-based blends that can easily become part of the foods and drinks you already enjoy.</p>
        </div>
      </section>

      <section id="products" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Meet the Kokobi+ formulas</h2>
          {status === 'loading' && <p>Loading...</p>}
          {status === 'ready' && !products.length && <p>Our products are being updated. Please check back soon, or message us on WhatsApp.</p>}
          <div className="grid g2">
            {products.map((p) => (
              <article key={p.id} className="card pcard">
                <ProductImg p={p} />
                <span className="tag">{p.purpose}</span>
                <h3>{p.name}</h3>
                <p style={{ color: 'var(--muted)', margin: 0 }}>{p.type}</p>
                <Price p={p} />
                <p>{p.desc}</p>
                <Link className="btn" to={`/${p.slug}`}>{p.formula ? `Explore Formula ${p.formula}` : 'View details'}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Why Kokobi+?</h2>
          <div className="grid g4">
            <div className="card"><h3>Plant-based</h3><p>Made with a blend of plant-based ingredients.</p></div>
            <div className="card"><h3>Convenient</h3><p>Easy to add to drinks, meals and snacks.</p></div>
            <div className="card"><h3>Versatile</h3><p>More than just a shake. Use it in different everyday recipes.</p></div>
            <div className="card"><h3>Purpose-driven</h3><p>Different formulas designed around different nutritional needs.</p></div>
          </div>
        </div>
      </section>

      <section className="shake" id="ways">
        <div className="wrap">
          <h2>More ways to enjoy Kokobi+</h2>
          <p style={{ fontSize: '1.25rem' }}>Your Kokobi+ doesn't have to live in a shaker bottle.</p>
          <div className="ways">
            {WAYS.map((w) => (
              <article key={w.title} className="way">
                <span className="ico" aria-hidden="true">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>What's in your blend?</h2>
          <p>We bring together a thoughtful mix of plant-based ingredients to create convenient blends for everyday use. Ingredient lists are shown on each product page as they are confirmed.</p>
          <div className="card"><strong>Formula A allergens:</strong> contains soy, groundnut and sesame.</div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Make it your own.</h2>
          <div className="steps">
            <div className="card"><h3>Choose</h3><p>Pick the Kokobi+ formula that fits your goal.</p></div>
            <div className="card"><h3>Mix</h3><p>Add to your preferred drink or meal.</p></div>
            <div className="card"><h3>Enjoy</h3><p>Make it part of your everyday routine.</p></div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Which formula fits?</h2>
          <div className="tbl">
            <table>
              <thead><tr><th></th><th>Formula A</th><th>Formula B</th></tr></thead>
              <tbody>
                <tr><th>Focus</th><td>Weight Gain</td><td>Daily Wellness</td></tr>
                <tr><th>Best for</th><td>Increased calorie and protein intake</td><td>Everyday nutrition</td></tr>
                <tr><th>Product type</th><td>Plant-Based Protein Powder</td><td>Plant-Based Protein Powder</td></tr>
                <tr><th>Great in</th><td>Smoothies, oats, pap, pancakes and more</td><td>Smoothies, breakfast meals, drinks and more</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 780 }}>
          <h2>Questions, answered.</h2>
          <FaqList items={FAQ} />
        </div>
      </section>

      <OrderBand />
    </>
  );
}
