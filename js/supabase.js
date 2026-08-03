import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// These are injected at request time by /api/config.js (see fetch below)
// so the anon key never has to be hardcoded into this static file.
let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = fetch('/api/config')
      .then((r) => r.json())
      .then(({ url, anonKey }) => createClient(url, anonKey));
  }
  return clientPromise;
}

export async function fetchProductBySlug(slug) {
  const supabase = await getClient();
  const { data: product, error: productError } = await supabase
    .from('custom_products')
    .select('*')
    .eq('slug', slug)
    .single();
  if (productError) throw productError;

  const { data: parts, error: partsError } = await supabase
    .from('custom_parts')
    .select('*, custom_part_options(*)')
    .eq('product_id', product.id)
    .order('display_order', { ascending: true });
  if (partsError) throw partsError;

  parts.forEach((part) => {
    part.part_options = part.custom_part_options.sort((a, b) => a.display_order - b.display_order);
  });

  return { product, parts };
}

export async function saveDesign({ productId, name, selections }) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('custom_designs')
    .insert({
      product_id: productId,
      name: name || null,
      selections,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDesignById(id) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('custom_designs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
