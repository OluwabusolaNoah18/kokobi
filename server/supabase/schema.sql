-- Kokobi+ database. Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run more than once.

create table if not exists products (
  id text primary key,
  slug text not null unique,
  name text not null,
  purpose text not null default '',
  description text not null default '',
  net_weight text not null default '',
  price integer not null check (price >= 0),
  regular_price integer not null check (regular_price >= 0),
  images jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists promo_codes (
  code text primary key,
  kind text not null check (kind in ('percent', 'amount')),
  value integer not null check (value > 0),
  min_order integer not null default 0,
  max_uses integer,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  ref text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'awaiting_payment',   -- awaiting_payment | paid
  method text not null,                              -- bank | paystack
  fulfilment text not null default 'delivery',       -- delivery | pickup
  name text not null,
  email text not null,
  phone text not null,
  address text not null default '',
  note text not null default '',
  items jsonb not null default '[]'::jsonb,
  subtotal integer not null default 0,
  discount integer not null default 0,
  promo_code text,
  total integer not null default 0,
  fee integer not null default 0,
  charged integer not null default 0,
  paid_at timestamptz
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_promo_idx on orders (promo_code);

-- Lock the tables: only the backend (using your secret key) can read or write them.
-- Nobody visiting the website, or holding the public "anon" key, can touch this data.
alter table products enable row level security;
alter table promo_codes enable row level security;
alter table orders enable row level security;

-- Public storage bucket for product photos (anyone can view a photo; only the backend can upload).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Your two current products (prices match the website today). Edit them later in /admin.
insert into products (id, slug, name, purpose, description, net_weight, price, regular_price, images, details, sort_order) values
('kb-a', 'formula-a', 'Kokobi+ Formula A', 'Weight Gain',
 'A nutrient-dense plant-based blend designed to support increased calorie and protein intake as part of your weight-gain journey.',
 '250 g', 3600, 4500, '[]'::jsonb, '{"formula": "A", "type": "Plant-Based Protein Powder", "what": "Formula A is a plant-based protein powder made to help you add more calories and protein to your everyday diet. It is not a treatment for any condition and does not guarantee a specific amount or rate of weight gain.", "who": ["You are intentionally working toward weight gain", "You want an easier way to add calories and protein to your day", "You don''t always have time for large meals", "You enjoy smoothies, breakfast bowls and snacks", "You want a versatile plant-based protein powder"], "uses": ["Smoothies", "Protein shakes", "Oats", "Pap", "Pancakes", "Yoghurt bowls"], "ingredients": ["Defatted soybean flour", "Groundnut", "Oats", "Millet", "Tigernut", "Pumpkin seed", "Banana", "Dates", "Sesame", "Coconut powder", "Flaxseed", "Chia seed", "Cocoa powder", "Vanilla", "Salt"], "allergens": ["Soy", "Groundnut", "Sesame"], "directions": "Add the recommended serving to water, milk or your preferred beverage. Shake or blend thoroughly before consumption.", "storage": "Store in a cool, dry place away from direct sunlight and moisture. Keep tightly sealed after opening.", "nutrition": {"basis": "Per 100 g", "rows": [["Energy", "approx. 416 kcal"], ["Protein", "approx. 27.4 g"], ["Carbohydrates", "approx. 42.4 g"], ["Fat", "approx. 18.1 g"], ["Fibre", "approx. 9.6 g"]]}}'::jsonb, 1),
('kb-b', 'formula-b', 'Kokobi+ Formula B', 'Daily Wellness',
 'A convenient plant-based blend designed to fit into your everyday nutrition routine.',
 '250 g', 3600, 4500, '[]'::jsonb, '{"formula": "B", "type": "Plant-Based Protein Powder", "what": "Formula B is a convenient plant-based powder you can stir into the foods and drinks you already enjoy as part of your daily routine.", "who": ["You want a convenient everyday nutrition option", "You enjoy smoothies and breakfast meals", "You want more plant-based ingredients in your routine", "You want a versatile powder for everyday use"], "uses": ["Breakfast", "Smoothies", "Drinks", "Oats", "Pap", "Yoghurt", "Snacks"], "ingredients": [], "allergens": null, "directions": null, "storage": "Store in a cool, dry place away from direct sunlight and moisture. Keep tightly sealed after opening.", "nutrition": null}'::jsonb, 2)
on conflict (id) do nothing;
