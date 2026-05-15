const crypto = require('crypto');

function createJWT(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  const signInput = `${header}.${claim}`;
  const signature = crypto.sign('sha256', Buffer.from(signInput), privateKey).toString('base64url');
  return `${signInput}.${signature}`;
}

async function getAccessToken(email, privateKey) {
  const jwt = createJWT(email, privateKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { gallery, items, name, phone, address } = req.body || {};

  if (!Array.isArray(items) || !items.length || !name || !phone || !address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const orderId = `MG-${Date.now().toString(36).toUpperCase()}`;
  const date = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const total = items.reduce((sum, i) => sum + (i.size === 'A3' ? 1000 : 500) * (i.qty || 1), 0);

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !sheetId) {
    return res.status(500).json({ error: 'Google Sheets not configured. Please use WhatsApp to place your order.' });
  }

  try {
    const token = await getAccessToken(email, key);

    const rows = items.map((item) => [
      orderId,
      date,
      gallery || '',
      item.imageId || '',
      item.size || 'A4',
      item.qty || 1,
      (item.size === 'A3' ? 1000 : 500) * (item.qty || 1),
      name,
      phone,
      address,
      'Pending',
    ]);

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Orders!A:K:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    if (!appendRes.ok) {
      const errBody = await appendRes.text();
      console.error('Sheets API error:', appendRes.status, errBody);
      throw new Error(`Sheets API returned ${appendRes.status}`);
    }

    return res.status(200).json({ success: true, orderId, total });
  } catch (err) {
    console.error('Order submission error:', err);
    return res.status(500).json({ error: 'Failed to save order. Please try WhatsApp.' });
  }
};
