import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import { CONFIG, money, PRODUCTS } from '../data.js';

const storedTheme = () => {
  try { return localStorage.getItem('kokobi-theme'); } catch { return null; }
};
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

function ThemeToggle() {
  const [dark, setDark] = useState(() => (storedTheme() ? storedTheme() === 'dark' : systemDark()));
  useEffect(() => {
    // Only force a theme once the visitor has chosen one; until then the browser setting applies.
    if (storedTheme()) document.documentElement.setAttribute('data-theme', storedTheme());
  }, []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('kokobi-theme', next); } catch { /* private mode: ignore */ }
  };
  return (
    <button type="button" className="themebtn" onClick={toggle} aria-pressed={dark}
      aria-label={dark ? 'Switch to light background' : 'Switch to dark background'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, loc.hash]);
  const cta = CONFIG.mode === 'shop' ? 'Order Now' : 'Join the Waitlist';
  const p = PRODUCTS[0];
  return (
    <>
      <div className="bar">
        Launch offer: 20% off Kokobi+ powders. Now {money(p.price)} instead of {money(p.regularPrice)}.{' '}
        <Link to="/order">Order now</Link>
      </div>
      <header>
        <div className="wrap nav">
          <Logo />
          <nav id="nav" className={open ? 'open' : ''} aria-label="Main">
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/#products">Shop</Link></li>
              <li><Link to="/#about">About</Link></li>
              <li><Link to="/#faq">FAQ</Link></li>
              <li><Link to="/#contact">Contact</Link></li>
              <li className="navcta"><Link to="/order">{cta}</Link></li>
            </ul>
          </nav>
          <div className="navtools">
            <Link className="btn pri hide-m" to="/order">{cta}</Link>
            <ThemeToggle />
          </div>
          <button className="burger" aria-label="Menu" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            &#9776;
          </button>
        </div>
      </header>
    </>
  );
}
