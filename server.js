const express = require("express");
const fetch = require("node-fetch");
const { URLSearchParams } = require("url");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
app.use(bodyParser.json());

const API_KEY = process.env.MSTOCK_API_KEY;
const XMIRAE_VERSION = "1";
const CLIENT_CODE = process.env.MSTOCK_CLIENT_CODE;
const PASSWORD = process.env.MSTOCK_PASSWORD;
const TOTP_SECRET = process.env.TOPT_SECRET;

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

// === Main Order API ===
app.post("/order", async (req, res) => {
  try {
    const { symbol, quantity, transactionType } = req.body;
    if (!symbol || !quantity || !transactionType) {
      return res.status(400).json({ status: "error", message: "symbol, quantity, transactionType required" });
    }

    // 1) Login
    const loginUrl = "https://api.mstock.trade/openapi/typea/connect/login";
    const loginParams = new URLSearchParams();
    loginParams.append("username", CLIENT_CODE);
    loginParams.append("password", PASSWORD);

    let r = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
        api_key: API_KEY,
      },
      body: loginParams.toString(),
    });
    const loginData = await r.json();
    if (loginData.status !== "success") {
      return res.status(401).json({ status: "error", message: "Login failed", data: loginData });
    }

    // 2) Verify TOTP
    const otp = generateTOTP(TOTP_SECRET);
    const totpUrl = "https://api.mstock.trade/openapi/typea/session/verifytotp";
    const totpParams = new URLSearchParams();
    totpParams.append("api_key", API_KEY);
    totpParams.append("totp", otp);

    r = await fetch(totpUrl, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: totpParams.toString(),
    });
    const totpData = await r.json();
    if (totpData.status !== "success") {
      return res.status(401).json({ status: "error", message: "TOTP failed", data: totpData });
    }

    const access_token = totpData.data?.access_token;
    if (!access_token) {
      return res.status(401).json({ status: "error", message: "No access_token received", data: totpData });
    }

    // 3) Place Order
    const orderUrl = "https://api.mstock.trade/openapi/typea/order/place";
    const orderPayload = {
      symbol,
      quantity,
      transaction_type: transactionType, // BUY / SELL
      product: "DELIVERY",                    // MIS/DELIVERY etc.
      order_type: "MARKET",              // MARKET/LIMIT
      validity: "DAY"
      price: 0
    };

    // 3) Place Order
    r = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "X-Mirae-Version": XMIRAE_VERSION,
        "Content-Type": "application/json",
        "Authorization": `token ${API_KEY}:${access_token}`,
      },
      body: JSON.stringify(orderPayload),
    });
    
    const raw = await r.text();   // पहले raw text ले लो
    let orderResponse;
    try {
      orderResponse = JSON.parse(raw);
    } catch (e) {
      orderResponse = { status: "error", raw: raw };  // अगर JSON नहीं है तो raw लौटा दो
    }
    
    return res.status(r.status).json(orderResponse);
    

  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy listening on port", PORT));
