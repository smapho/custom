-- Custom product configurator schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Tables are prefixed with custom_ to avoid clashing with other projects
-- sharing this Supabase instance (products/designs are common generic names).

create extension if not exists "pgcrypto";

-- A customizable product (e.g. "オリジナルジャージ")
create table if not exists custom_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  base_price integer not null default 0, -- yen
  created_at timestamptz not null default now()
);

-- A customizable region/part of a product (e.g. "body", "sleeve", "collar")
create table if not exists custom_parts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references custom_products(id) on delete cascade,
  key text not null,            -- machine key used by the SVG (e.g. "body")
  label text not null,          -- shown in the UI (e.g. "本体")
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, key)
);

-- A selectable option (usually a color) for a part
create table if not exists custom_part_options (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references custom_parts(id) on delete cascade,
  label text not null,          -- shown in the UI (e.g. "レッド")
  color_hex text not null,      -- e.g. "#e63946"
  price_delta integer not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- A saved custom design (a user's finished configuration)
create table if not exists custom_designs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references custom_products(id) on delete cascade,
  name text,                          -- optional label the user gives their design
  selections jsonb not null,          -- { "<part_key>": "<option_id>", ... }
  custom_text text,                   -- e.g. jersey number/name print
  owner_token uuid not null default gen_random_uuid(), -- lets the creator edit/find their own design without login
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table custom_products enable row level security;
alter table custom_parts enable row level security;
alter table custom_part_options enable row level security;
alter table custom_designs enable row level security;

-- Public (anon) can read the catalog
drop policy if exists "public read custom_products" on custom_products;
create policy "public read custom_products" on custom_products for select using (true);

drop policy if exists "public read custom_parts" on custom_parts;
create policy "public read custom_parts" on custom_parts for select using (true);

drop policy if exists "public read custom_part_options" on custom_part_options;
create policy "public read custom_part_options" on custom_part_options for select using (true);

-- Public (anon) can save and read back designs (read is unrestricted so
-- a design can be shared via its id; there is no listing endpoint that
-- enumerates other people's designs).
drop policy if exists "public insert custom_designs" on custom_designs;
create policy "public insert custom_designs" on custom_designs for insert with check (true);

drop policy if exists "public read custom_designs" on custom_designs;
create policy "public read custom_designs" on custom_designs for select using (true);
