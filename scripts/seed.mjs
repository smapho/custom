// One-time seed script. Run locally with:
//   node scripts/seed.mjs
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// (already populated by `vercel env pull`). Safe to re-run — it upserts by slug/key.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
      return [key, value];
    })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  // Upsert product
  const [product] = await rest('custom_products?on_conflict=slug', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify([
      {
        slug: 'original-jersey',
        name: 'オリジナルジャージ',
        description: '本体・袖・襟・サイドラインの色を自由に組み合わせられるオリジナルスポーツジャージ',
        base_price: 4980,
      },
    ]),
  });
  console.log('Product:', product.id, product.slug);

  const partsSpec = [
    {
      key: 'body',
      label: '本体',
      display_order: 1,
      options: [
        { label: 'ブルー', color_hex: '#2b6cb0', price_delta: 0 },
        { label: 'レッド', color_hex: '#c0392b', price_delta: 0 },
        { label: 'ブラック', color_hex: '#1c1c1c', price_delta: 0 },
        { label: 'グリーン', color_hex: '#1f7a4d', price_delta: 0 },
        { label: 'ホワイト', color_hex: '#f5f5f5', price_delta: 0 },
      ],
    },
    {
      key: 'sleeve',
      label: '袖',
      display_order: 2,
      options: [
        { label: 'ダークグレー', color_hex: '#3a3a3a', price_delta: 0 },
        { label: 'ブルー', color_hex: '#2b6cb0', price_delta: 0 },
        { label: 'レッド', color_hex: '#c0392b', price_delta: 0 },
        { label: 'ホワイト', color_hex: '#f5f5f5', price_delta: 0 },
      ],
    },
    {
      key: 'collar',
      label: '襟',
      display_order: 3,
      options: [
        { label: 'ホワイト', color_hex: '#ffffff', price_delta: 0 },
        { label: 'ブラック', color_hex: '#1c1c1c', price_delta: 200 },
        { label: 'ゴールド', color_hex: '#d4af37', price_delta: 300 },
      ],
    },
    {
      key: 'sideline',
      label: 'サイドライン',
      display_order: 4,
      options: [
        { label: 'ホワイト', color_hex: '#ffffff', price_delta: 0 },
        { label: 'イエロー', color_hex: '#f1c40f', price_delta: 200 },
        { label: 'シルバー', color_hex: '#c0c0c0', price_delta: 200 },
        { label: 'なし（本体色）', color_hex: '#2b6cb0', price_delta: 0 },
      ],
    },
  ];

  for (const spec of partsSpec) {
    const [part] = await rest('custom_parts?on_conflict=product_id,key', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify([
        {
          product_id: product.id,
          key: spec.key,
          label: spec.label,
          display_order: spec.display_order,
        },
      ]),
    });

    // Clear old options for this part, then insert fresh ones (idempotent reseed)
    await fetch(`${SUPABASE_URL}/rest/v1/custom_part_options?part_id=eq.${part.id}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    await rest('custom_part_options', {
      method: 'POST',
      body: JSON.stringify(
        spec.options.map((opt, i) => ({
          part_id: part.id,
          label: opt.label,
          color_hex: opt.color_hex,
          price_delta: opt.price_delta,
          display_order: i,
        }))
      ),
    });

    console.log(`Part "${spec.label}": ${spec.options.length} options seeded`);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
