import imgA from './assets/a.webp';
import imgB from './assets/b.webp';
import imgPack from './assets/pack.webp';

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/* ---- CONFIG ---- */
export const CONFIG = {
  mode: 'shop', // 'shop' | 'waitlist'
  wa: '2347048779681',
  waDisplay: '+234 704 877 9681',
  wa2: '2349070733185',
  wa2Display: '+234 907 073 3185',
  email: 'kokobifoods@gmail.com',
  bank: [
    { bank: 'Opay', no: '7048779681', name: 'Oluwabusola Noah' },
    { bank: 'Zenith Bank', no: '2270733185', name: 'Oluwabusola Noah' },
  ],
  socials: {
    instagram: 'https://www.instagram.com/kokobifoods',
    tiktok: 'https://www.tiktok.com/@kokobifoods',
  },
};

export const STORAGE =
  'Store in a cool, dry place away from direct sunlight and moisture. Keep tightly sealed after opening.';

/* ---- PRODUCT DATA: customer-facing only. Never add quantities or formulation. ---- */
export const PRODUCTS = [
  {
    id: 'kb-a', slug: 'formula-a', name: 'Kokobi+ Formula A', formula: 'A', purpose: 'Weight Gain',
    type: 'Plant-Based Protein Powder',
    desc: 'A nutrient-dense plant-based blend designed to support increased calorie and protein intake as part of your weight-gain journey.',
    netWeight: '250 g', price: 3600, regularPrice: 4500, images: [imgA, imgPack],
    ingredients: ['Defatted soybean flour', 'Groundnut', 'Oats', 'Millet', 'Tigernut', 'Pumpkin seed', 'Banana', 'Dates', 'Sesame', 'Coconut powder', 'Flaxseed', 'Chia seed', 'Cocoa powder', 'Vanilla', 'Salt'],
    nutrition: {
      basis: 'Per 100 g',
      rows: [['Energy', 'approx. 453 kcal'], ['Protein', 'approx. 22.5 g'], ['Carbohydrates', 'approx. 42.8 g'], ['Fat', 'approx. 24.5 g'], ['Fibre', 'approx. 8.3 g']],
    },
    allergens: ['Soy', 'Groundnut', 'Sesame'],
    directions: 'Suggested serving: 40 g once daily, alongside your regular meals. Add it to water, milk or your preferred beverage. Shake or blend thoroughly before consumption.',
    storage: STORAGE,
    what: 'Formula A is a plant-based protein powder made to help you add more calories and protein to your everyday diet. It is not a treatment for any condition and does not guarantee a specific amount or rate of weight gain.',
    who: ['You are intentionally working toward weight gain', 'You want an easier way to add calories and protein to your day', "You don't always have time for large meals", 'You enjoy smoothies, breakfast bowls and snacks', 'You want a versatile plant-based protein powder'],
    uses: ['Smoothies', 'Protein shakes', 'Oats', 'Pap', 'Pancakes', 'Yoghurt bowls'],
  },
  {
    id: 'kb-b', slug: 'formula-b', name: 'Kokobi+ Formula B', formula: 'B', purpose: 'Daily Wellness',
    type: 'Plant-Based Protein Powder',
    desc: 'A convenient plant-based blend designed to fit into your everyday nutrition routine.',
    netWeight: '250 g', price: 3600, regularPrice: 4500, images: [imgB],
    ingredients: [], nutrition: null, allergens: null, directions: null, storage: STORAGE,
    what: 'Formula B is a convenient plant-based powder you can stir into the foods and drinks you already enjoy as part of your daily routine.',
    who: ['You want a convenient everyday nutrition option', 'You enjoy smoothies and breakfast meals', 'You want more plant-based ingredients in your routine', 'You want a versatile powder for everyday use'],
    uses: ['Breakfast', 'Smoothies', 'Drinks', 'Oats', 'Pap', 'Yoghurt', 'Snacks'],
  },
];

/* ---- More ways to enjoy Kokobi+ ---- */
export const WAYS = [
  { icon: '🥤', title: 'Smoothies', text: 'Blend Kokobi+ with fruits, milk or your preferred beverage for a delicious, creamy smoothie.' },
  { icon: '💪', title: 'Protein Shakes', text: 'Mix Kokobi+ with milk, water or your preferred drink for a quick and convenient protein shake.' },
  { icon: '🥣', title: 'Oats', text: 'Stir Kokobi+ into your favourite oats recipe for a more filling breakfast.' },
  { icon: '🍲', title: 'Pap', text: 'Add Kokobi+ to prepared pap for an easy way to incorporate it into your breakfast or snack.' },
  { icon: '🥞', title: 'Pancakes', text: 'Mix Kokobi+ into pancake batter for a delicious twist on your regular pancakes.' },
  { icon: '🍨', title: 'Yoghurt Bowls', text: 'Stir Kokobi+ into yoghurt and top with your favourite fruits, seeds or nuts.' },
  { icon: '🍓', title: 'Smoothie Bowls', text: 'Blend your favourite fruits with Kokobi+ and top with fruits, seeds or other toppings.' },
  { icon: '🍪', title: 'Energy Bites', text: 'Use Kokobi+ as part of a homemade energy-bite recipe for a convenient snack.' },
  { icon: '🥛', title: 'Milkshakes', text: 'Blend Kokobi+ with milk, fruit and your favourite flavours for a rich, creamy treat.' },
];

export const FAQ = [
  ['What is Kokobi+?', 'Kokobi+ is a Nigerian everyday wellness brand making convenient plant-based powder blends you can add to foods and drinks.'],
  ['What is Formula A?', 'A plant-based protein powder designed to support increased calorie and protein intake as part of a weight-gain journey.'],
  ['What is Formula B?', 'A plant-based wellness blend designed to fit into your everyday nutrition routine.'],
  ["What's the difference between Formula A and Formula B?", 'Formula A focuses on weight gain. Formula B focuses on daily wellness. Neither is better; pick the one that fits what you are looking for.'],
  ['How can I use Kokobi+?', 'Mix it into water, milk or your preferred drink, or stir it into meals. Follow the directions on the final product label.'],
  ['Can I add Kokobi+ to food?', 'Yes. Kokobi+ can be added to suitable foods and drinks such as smoothies, oats, pap, pancakes, yoghurt and similar recipes.'],
  ['Can I use Kokobi+ every day?', 'Kokobi+ is designed to fit into an everyday nutrition routine. Follow the final product directions and consider your individual dietary needs.'],
  ['Does Formula A guarantee weight gain?', 'No. Kokobi+ does not guarantee a specific amount or rate of weight gain. Results depend on overall diet, calorie intake, lifestyle and individual differences.'],
  ['What allergens are in Formula A?', 'Formula A contains soy, groundnut and sesame.'],
  ['How should I store Kokobi+?', STORAGE],
  ['Can I use Kokobi+ if I have a food allergy?', 'Review the ingredient and allergen information carefully. If you have specific dietary or medical concerns, seek advice from a qualified professional.'],
  ['How do I order and pay?', 'Choose your packs on the order page, then pay one of two ways. Bank transfer: pay to the account details shown, then send your proof of payment on WhatsApp, and your order is confirmed once we receive it. Pay online: pay securely with Paystack (card, bank transfer or USSD). A small payment processing fee applies, and your receipt is emailed to you straight away.'],
];

/* Paystack online-payment fee. Must match server/src/fees.js (same numbers, same flag). */
export const PASS_FEE = import.meta.env.VITE_PASS_PAYSTACK_FEE !== 'false';
const paystackFee = (a) => Math.min(2000, Math.ceil(a * 0.015 + (a >= 2500 ? 100 : 0)));
export function onlineCharge(total) {
  if (!PASS_FEE || !total) return { fee: 0, charge: total };
  let a = total;
  for (let i = 0; i < 10; i++) a = total + paystackFee(a);
  while (a - paystackFee(a) < total) a++;
  return { fee: a - total, charge: a };
}

export const money = (n) => '₦' + n.toLocaleString('en-NG');
export const waLink = (t, num = CONFIG.wa) => `https://wa.me/${num}?text=${encodeURIComponent(t)}`;
export const PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/;
