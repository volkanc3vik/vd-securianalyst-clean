// Vercel Serverless Function — CoinGlass CORS Proxy (V4)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, params } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const apiKey = process.env.COINGLASS_API_KEY || '';
  const queryStr = params ? '?' + decodeURIComponent(params) : '';
  // V4 base URL
  const cgUrl = 'https://open-api-v4.coinglass.com' + decodeURIComponent(endpoint) + queryStr;

  try {
    const r = await fetch(cgUrl, {
      headers: { 'CG-API-KEY': apiKey, 'Content-Type': 'application/json' },
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
