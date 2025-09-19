// server.js
const express = require('express');
const fetch = require('node-fetch'); // v2
const { URLSearchParams } = require('url');

const app = express();
app.use(express.json());

const API_KEY = process.env.MSTOCK_API_KEY || ''; // must set in Render/Server
const XMIRAE_VERSION = '1';

// 1) Login (username+password) => sends OTP to user's mobile
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username & password required' });

    const url = 'https://api.mstock.trade/openapi/typea/connect/login';
    const body = new URLSearchParams({ username, password }).toString();

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'X-Mirae-Version': XMIRAE_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const text = await r.text();
    // forward JSON or raw text (some errors return html/text)
    try { return res.status(r.status).json(JSON.parse(text)); }
    catch (e) { return res.status(r.status).send(text); }

  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// 2a) Generate Session (OTP) - request_token = OTP, checksum required per docs
app.post('/session/token', async (req, res) => {
  try {
    const { request_token, checksum } = req.body;
    if (!request_token || !checksum) return res.status(400).json({ error: 'request_token(OTP) and checksum required' });

    const url = 'https://api.mstock.trade/openapi/typea/session/token';
    const body = new URLSearchParams({ api_key: API_KEY, request_token, checksum }).toString();

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'X-Mirae-Version': XMIRAE_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const json = await r.json();
    return res.status(r.status).json(json);

  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// 2b) Generate Session with TOTP (recommended if you enabled TOTP in m.Stock)
app.post('/session/verifytotp', async (req, res) => {
  try {
    const { totp } = req.body; // totp from authenticator app
    if (!totp) return res.status(400).json({ error: 'totp required' });

    const url = 'https://api.mstock.trade/openapi/typea/session/verifytotp';
    const body = new URLSearchParams({ api_key: API_KEY, totp }).toString();

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'X-Mirae-Version': XMIRAE_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const json = await r.json();
    return res.status(r.status).json(json);

  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// 3) Fund summary (Type A) - pass access_token
app.get('/fundsummary', async (req, res) => {
  try {
    const access_token = req.query.access_token;
    if (!access_token) return res.status(400).json({ error: 'access_token query param required' });

    const url = 'https://api.mstock.trade/openapi/typea/user/fundsummary';
    const headers = {
      'X-Mirae-Version': XMIRAE_VERSION,
      'Authorization': `token ${API_KEY}:${access_token}`
    };

    const r = await fetch(url, { method: 'GET', headers });
    const json = await r.json();
    return res.status(r.status).json(json);

  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// 4) Place order (Type B order endpoint example) 
// Note: order APIs usually under Type B. Proxy will forward to TypeB orders endpoint.
// Provide jwtToken (or whatever token your account accepts) + order body exactly as docs expect.
app.post('/place-order', async (req, res) => {
  try {
    const { jwtToken, order } = req.body;
    if (!jwtToken || !order) return res.status(400).json({ error: 'jwtToken and order body required' });

    const url = 'https://api.mstock.trade/openapi/typeb/orders'; // TypeB orders endpoint
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Mirae-Version': XMIRAE_VERSION,
        'X-PrivateKey': API_KEY,
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    const json = await r.json();
    return res.status(r.status).json(json);

  } catch (err) { return res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Proxy running on port', PORT));
