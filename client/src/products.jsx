import { createContext, useContext, useEffect, useState } from 'react';
import { PRODUCTS as BUILT_IN, STORAGE } from './data.js';
import { getProducts } from './api.js';

/*
 * The products shown on the website. They come from the backend (so changes made in /admin appear straight away).
 * If the backend has no database yet, or cannot be reached, the built-in list from data.js is used instead.
 */
const builtInById = Object.fromEntries(BUILT_IN.map((p) => [p.id, p]));

const normalise = (p) => ({
  ...p,
  // The two original products ship with their photos inside the site; use those until a photo is uploaded.
  images: p.images?.length ? p.images : builtInById[p.id]?.images ?? [],
  who: p.who || [],
  uses: p.uses || [],
  ingredients: p.ingredients || [],
  nutrition: p.nutrition || null,
  allergens: p.allergens || null,
  directions: p.directions || null,
  storage: p.storage || STORAGE,
});

const Ctx = createContext({ products: BUILT_IN, status: 'ready' });

export function ProductsProvider({ children }) {
  const [state, setState] = useState({ products: [], status: 'loading' });
  useEffect(() => {
    let off = false;
    (async () => {
      const res = await getProducts();
      if (off) return;
      if (res.ok && res.source === 'database') setState({ products: res.products.map(normalise), status: 'ready' });
      else setState({ products: BUILT_IN, status: 'ready' });
    })();
    return () => { off = true; };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useProducts = () => useContext(Ctx);

/** Whole-number percentage taken off the regular price, or 0. */
export const percentOff = (p) => (p.regularPrice > p.price ? Math.round((1 - p.price / p.regularPrice) * 100) : 0);
