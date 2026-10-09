import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Order from './pages/Order.jsx';
import PaymentComplete from './pages/PaymentComplete.jsx';
import { CONFIG, waLink } from './data.js';

/* Scroll to top on page change, or to #section when the URL has a hash. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<Order />} />
          <Route path="/order/complete" element={<PaymentComplete />} />
          <Route path="/:slug" element={<Product />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <a className="wa" href={waLink('Hi Kokobi+!')} target="_blank" rel="noopener noreferrer">
        Chat with Kokobi+
      </a>
    </>
  );
}
