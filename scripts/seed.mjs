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
        slug: 'custom-bottle',
        name: 'オリジナルボトル',
        description: 'キャップ・ボトル・メインラベル・首ラベルを自由に組み合わせられるオリジナル瓶',
        base_price: 3280,
      },
    ]),
  });
  console.log('Product:', product.id, product.slug);

  const partsSpec = [
    {
      key: 'bottle',
      label: 'ボトル',
      display_order: 1,
      options: [
        { label: '光沢 茶色', color_hex: '#4a2c17', price_delta: 0 },
        { label: '光沢 緑', color_hex: '#2f6b3c', price_delta: 0 },
        { label: '光沢 青', color_hex: '#3f6ea5', price_delta: 0 },
        { label: 'つや消し 青', color_hex: '#7a92a8', price_delta: 100 },
        { label: 'つや消し 白', color_hex: '#eef0f0', price_delta: 100 },
        { label: 'つや消し 黒', color_hex: '#2b2b2b', price_delta: 100 },
        { label: 'つや消し 緑', color_hex: '#5f7a5a', price_delta: 100 },
      ],
    },
    {
      key: 'cap',
      label: 'キャップ',
      display_order: 2,
      options: [
        { label: '黒', color_hex: '#1c1c1c', price_delta: 0 },
        { label: '金', color_hex: '#caa14a', price_delta: 100 },
        { label: '銀', color_hex: '#c7c9cc', price_delta: 0 },
        { label: '赤', color_hex: '#b3272d', price_delta: 0 },
        { label: '青', color_hex: '#2e4d7b', price_delta: 0 },
      ],
    },
    {
      key: 'content',
      label: '中身（焼酎の種類）',
      display_order: 3,
      options: [
        { label: '芋焼酎', color_hex: '#caa15c', price_delta: 0 },
        { label: '麦焼酎', color_hex: '#e8d9a0', price_delta: 0 },
        { label: '米焼酎', color_hex: '#f0ecdf', price_delta: 0 },
        { label: '黒糖焼酎', color_hex: '#b8863f', price_delta: 200 },
        { label: '古酒（長期熟成）', color_hex: '#8a5a28', price_delta: 500 },
      ],
    },
    {
      key: 'main_label',
      label: 'メインラベル',
      display_order: 4,
      options: [
        { label: 'ホワイト', color_hex: '#ffffff', price_delta: 0 },
        { label: 'クラフト', color_hex: '#d8c9a3', price_delta: 0 },
        { label: 'ブラック', color_hex: '#141414', price_delta: 200 },
        { label: 'ゴールド', color_hex: '#d4af37', price_delta: 300 },
      ],
    },
    {
      key: 'neck_label',
      label: '首ラベル',
      display_order: 5,
      options: [
        { label: '手書き 赤文字', color_hex: '#f7f1e3', price_delta: 400 },
        { label: '手書き 黒文字', color_hex: '#f7f1e3', price_delta: 400 },
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
