import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { CONFIG, waLink } from '../data.js';

export default function Footer() {
  return (
    <footer id="contact">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Logo asLink={false} />
            <p>Kokobi + Everyday Wellness</p>
          </div>
          <div>
            <strong>Explore</strong>
            <Link to="/">Home</Link>
            <Link to="/order">Order</Link>
            <Link to="/#products">Shop</Link>
            <Link to="/#about">About</Link>
            <Link to="/#faq">FAQ</Link>
          </div>
          <div>
            <strong>Contact</strong>
            <a href={waLink('Hi Kokobi+!')}>{CONFIG.waDisplay}</a>
            <a href={waLink('Hi Kokobi+!', CONFIG.wa2)}>{CONFIG.wa2Display}</a>
            <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
            {CONFIG.socials.instagram && <a href={CONFIG.socials.instagram} target="_blank" rel="noopener noreferrer">Instagram @kokobifoods</a>}
            {CONFIG.socials.tiktok && <a href={CONFIG.socials.tiktok} target="_blank" rel="noopener noreferrer">TikTok @kokobifoods</a>}
          </div>
        </div>
        <small id="disclaimer">
          <strong>Disclaimer.</strong> Kokobi+ products are food and nutrition products. They are not intended to
          diagnose, treat, cure or prevent any disease. Privacy Policy and Terms &amp; Conditions pages will be added soon.
        </small>
        <small>&copy; Kokobi+. All rights reserved.</small>
      </div>
    </footer>
  );
}
