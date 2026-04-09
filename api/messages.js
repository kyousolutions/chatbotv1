const WEBHOOK_BASE  = 'https://n8n3.kyou.solutions/webhook/testbotv2';
const TIMEOUT_MS    = 15_000;
const MAX_MSG_CHARS = 1_000;
const MAX_BODY_KB   = 8;

// Only letters (all languages), numbers, whitespace, and common punctuation
const ALLOWED = /^[\p{L}\p{N}\s.,!?;:'"()\-–—@/+&%°€#…]+$/u;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://www.kyou.solutions');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: { message: 'Method not allowed' } });

  // Body size guard
  const bodyBytes = Buffer.byteLength(JSON.stringify(req.body ?? ''));
  if (bodyBytes > MAX_BODY_KB * 1024) {
    return res.status(413).json({ error: { message: 'Payload too large' } });
  }

  // Input validation
  const { userID, anfrage_user_frontend: msg } = req.body ?? {};
  if (!userID || typeof userID !== 'string') {
    return res.status(400).json({ error: { message: 'Missing userID' } });
  }
  if (!msg || typeof msg !== 'string' || msg.trim().length === 0) {
    return res.status(400).json({ error: { message: 'Missing message' } });
  }
  if (msg.length > MAX_MSG_CHARS) {
    return res.status(400).json({ error: { message: `Message too long (max ${MAX_MSG_CHARS} chars)` } });
  }
  if (!ALLOWED.test(msg.trim())) {
    return res.status(400).json({ error: { message: 'Nachricht enthält ungültige Zeichen' } });
  }

  // Webhook call with timeout
  const url = new URL(WEBHOOK_BASE);
  url.searchParams.set('userID', userID);
  url.searchParams.set('anfrage_user_frontend', msg.trim());

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: { message: 'Der Assistent antwortet nicht. Bitte versuche es erneut.' } });
    }
    res.status(502).json({ error: { message: 'Bad gateway' } });
  }
};
