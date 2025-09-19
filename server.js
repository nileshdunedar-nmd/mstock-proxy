const express = require("express");
const fetch = require("node-fetch");
const { URLSearchParams } = require("url");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));   // for form data
app.use(bodyParser.json());

const API_KEY = process.env.MSTOCK_API_KEY;  // अपने api_key (subscription key)
const XMIRAE_VERSION = '1';

// 1) /login → username + password → triggers OTP
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ status: "error", message: "username & password required" });
  }
  const url = "https://api.mstock.trade/openapi/typea/connect/login";
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
        "api_key": API_KEY   // **Check** docs; might not need `api_key` header here, it's only for session/token. Docs say API Key is required for calls. :contentReference[oaicite:6]{index=6}
      },
      body: params.toString()
    });
    const text = await r.text();
    try {
      const j = JSON.parse(text);
      return res.status(r.status).json(j);
    } catch(e) {
      return res.status(r.status).send(text);
    }
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// 2) /session-token → OTP (request_token) + checksum → get access_token
app.post("/session-token", async (req, res) => {
  const { request_token, checksum } = req.body;
  if (!request_token || !checksum) {
    return res.status(400).json({ status: "error", message: "request_token & checksum required" });
  }
  const url = "https://api.mstock.trade/openapi/typea/session/token";
  const params = new URLSearchParams();
  params.append("api_key", API_KEY);
  params.append("request_token", request_token);
  params.append("checksum", checksum);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// 3) Optionally TOTP (if enabled)
app.post("/verify-totp", async (req, res) => {
  const { totp } = req.body;
  if (!totp) {
    return res.status(400).json({ status: "error", message: "totp required" });
  }
  const url = "https://api.mstock.trade/openapi/typea/session/verifytotp";
  const params = new URLSearchParams();
  params.append("api_key", API_KEY);
  params.append("totp", totp);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch(err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// 4) Fund Summary (uses access_token)
app.get("/fundsummary", async (req, res) => {
  const access_token = req.query.access_token;
  if (!access_token) {
    return res.status(400).json({ status: "error", message: "access_token query param required" });
  }
  const url = "https://api.mstock.trade/openapi/typea/user/fundsummary";
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Authorization": `token ${API_KEY}:${access_token}`
      }
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch(err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy listening on port", PORT));
