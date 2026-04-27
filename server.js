const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const VENDOR_ID = process.env.VENDOR_ID;

if (!TOKEN || !VENDOR_ID) {
  console.error("❌ Missing TOKEN / VENDOR_ID");
  process.exit(1);
}

// 🧠 Duplicate protection
const sentTracking = new Set();

// 🧹 Cleanup cache every 1 hour
setInterval(() => {
  sentTracking.clear();
  console.log("🧹 Cache cleared");
}, 1000 * 60 * 60);

// ✅ Health check
app.get("/", (req, res) => {
  res.send("Shipping webhook running 🚚");
});


// ======================================
// 📦 SHIPPING WEBHOOK
// ======================================
app.post("/fulfillment", async (req, res) => {
  const data = req.body;

  try {
    // Shopify ko instantly 200 OK
    res.sendStatus(200);

    // Get tracking number
    const trackingNumber = data?.tracking_numbers?.[0];

    // ❌ No tracking → skip
    if (!trackingNumber) {
      console.log("⏳ No tracking yet");
      return;
    }

    // Get order id / fulfillment id
    const orderId = data?.order_id || data?.id || "unknown";

    // Unique key = order + tracking
    const uniqueKey = `${orderId}_${trackingNumber}`;

    // ❌ Duplicate block
    if (sentTracking.has(uniqueKey)) {
      console.log("⚠️ Duplicate blocked:", uniqueKey);
      return;
    }

    sentTracking.add(uniqueKey);

    // Get customer phone
    const phoneRaw = data?.destination?.phone;

    if (!phoneRaw) {
      console.log("❌ No phone");
      return;
    }

    // Format phone
    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    // Get customer name
    const name = data?.destination?.name || "Customer";

    // 📲 WA payload
    const payload = {
      phone_number: phone,
      template_name: "order_shipped",
      template_language: "en_US",
      field_1: name,
      field_2: trackingNumber
    };

    console.log("📤 Sending shipping msg:", payload);

    // Send WA template
    const response = await axios.post(
      `https://api.wamantra.com/api/${VENDOR_ID}/contact/send-template-message`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Shipping message sent:", response.data);

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);
  }
});


// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});