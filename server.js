const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// === Config from environment variables ===
const API_KEY = process.env.MSTOCK_API_KEY;
const CLIENT_CODE = process.env.MSTOCK_CLIENT_CODE;
const PASSWORD = process.env.MSTOCK_PASSWORD;

// === Login API ===
app.post("/login", async (req, res) => {
  try {
    const response = await fetch("https://openapi.mstock.com/v1/users/loginByPassword", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({
        clientcode: CLIENT_CODE,
        password: PASSWORD
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Place Order API ===
app.post("/order", async (req, res) => {
  try {
    const { symbol, side, qty, jwtToken } = req.body;

    const response = await fetch("https://openapi.mstock.com/v1/orders/place", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-client-code": CLIENT_CODE,
        "Authorization": "Bearer " + jwtToken
      },
      body: JSON.stringify({
        variety: "NORMAL",
        tradingsymbol: symbol,
        transactiontype: side,
        quantity: qty,
        ordertype: "MARKET",
        producttype: "DELIVERY"
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Proxy API running on port 3000"));
