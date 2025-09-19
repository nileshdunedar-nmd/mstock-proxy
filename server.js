const express = require("express");
const fetch = require("node-fetch");
const { URLSearchParams } = require("url");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const API_KEY = process.env.MSTOCK_API_KEY;
const XMIRAE_VERSION = "1";
const CLIENT_CODE = process.env.MSTOCK_CLIENT_CODE;
const PASSWORD = process.env.MSTOCK_PASSWORD;
const TOTP_SECRET = process.env.TOPT_SECRET; // Base32 secret from Google Authenticator

// === Helper: Base32 decode ===
function base32toBuffer(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let buffer = [];

  base32 = base32.replace(/=+$/, "").toUpperCase();

  for (let char of base32) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error("Invalid base32 char.");
    bits += val.toString(2).padStart(5, "0");
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    buffer.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(buffer);
}

// === Generate TOTP ===
function generateTOTP(secret, digits = 6, step = 30) {
  const key = base32toBuffer(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / step);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;

  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 10 ** digits).toString().padStart(digits, "0");
}

// === Login with username/password (first step) ===
app.post("/login", async (req, res) => {
  const username = CLIENT_CODE;
  const password = PASSWORD;

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
        api_key: API_KEY,
      },
      body: params.toString(),
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: err.message });
  }
});

// === Verify TOTP directly (auto-generate OTP from server) ===
app.post("/verify-totp", async (req, res) => {
  const otp = generateTOTP(TOTP_SECRET);

  const url = "https://api.mstock.trade/openapi/typea/session/verifytotp";
  const params = new URLSearchParams();
  params.append("api_key", API_KEY);
  params.append("totp", otp);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: err.message });
  }
});

// === Fund Summary (needs access_token) ===
app.get("/fundsummary", async (req, res) => {
  const access_token = req.query.access_token;
  if (!access_token) {
    return res
      .status(400)
      .json({ status: "error", message: "access_token query param required" });
  }

  const url = "https://api.mstock.trade/openapi/typea/user/fundsummary";
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        Authorization: `token ${API_KEY}:${access_token}`,
      },
    });
    const json = await r.json();
    return res.status(r.status).json(json);
  } catch (err) {
    return res
      .status(500)
      .json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Proxy listening on port", PORT)
);
