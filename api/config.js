// Exposes the Supabase URL + anon/publishable key to the browser.
// Safe to expose: the anon key only grants what Row Level Security allows.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  });
}
