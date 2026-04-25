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

// 🧠 Duplicate protection (tracking based)
const sentTracking = new Set();

// 🧹 cleanup
setInterval(() => {
  sentTracking.clear();
  console.log("🧹 Cache cleared");
}, 1000 * 60 * 60);

// ✅ Health check
app.get("/", (req, res) => {
  res.send("Shipping webhook running 🚚");
});


// ======================================
// 📦 SHIPPING WEBHOOK (NO LINK)
// ======================================
app.post("/fulfillment", async (req, res) => {
  const data = req.body;

  try {
    res.sendStatus(200);

    const trackingNumber = data?.tracking_numbers?.[0];

    // ❌ tracking nahi → skip
    if (!trackingNumber) {
      console.log("⏳ No tracking yet");
      return;
    }

    // ❌ duplicate → skip
    if (sentTracking.has(trackingNumber)) {
      console.log("⚠️ Already sent");
      return;
    }
    sentTracking.add(trackingNumber);

    const phoneRaw = data?.destination?.phone;
    if (!phoneRaw) {
      console.log("❌ No phone");
      return;
    }

    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    const name = data?.destination?.name || "Customer";

    // 📲 WA payload (NO LINK)
    const payload = {
      phone_number: phone,
      template_name: "order_shipped",
      template_language: "en_US",

      field_1: name,
      field_2: trackingNumber
    };

    console.log("📤 Sending shipping msg:", payload);

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