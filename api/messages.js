const WEBHOOK_BASE = 'https://n8n3.kyou.solutions/webhook-test/testbotv2';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.kyou.solutions');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const { userID, anfrage_user_frontend } = req.body;

  try {
    const url = new URL(WEBHOOK_BASE);
    url.searchParams.set('userID', userID);
    url.searchParams.set('anfrage_user_frontend', anfrage_user_frontend);

    const upstream = await fetch(url.toString());
    const text     = await upstream.text();

    res.status(upstream.status).send(text);
  } catch {
    res.status(502).json({ error: { message: 'Bad gateway' } });
  }
};
