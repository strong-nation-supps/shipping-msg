const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ENV
const TOKEN = process.env.TOKEN;
const VENDOR_ID = process.env.VENDOR_ID;

if (!TOKEN || !VENDOR_ID) {
  console.error("❌ Missing TOKEN / VENDOR_ID");
  process.exit(1);
}

// duplicate protection
const sentTracking = new Set();

// health
app.get("/", (req, res) => {
  res.send("Shipping webhook running 🚚");
});

// webhook
app.post("/fulfillment", async (req, res) => {
  const data = req.body;

  try {
    res.sendStatus(200);

    // only when shipment is moving
    const status = (data?.shipment_status || "").toLowerCase();

    if (
      status &&
      status !== "confirmed" &&
      status !== "in_transit" &&
      status !== "label_printed"
    ) {
      console.log("⏭️ Ignored status:", status);
      return;
    }

    const trackingNumber = data?.tracking_numbers?.[0];
    if (!trackingNumber) {
      console.log("⏳ No tracking");
      return;
    }

    const orderId = data?.order_id || data?.id || "unknown";
    const uniqueKey = `${orderId}_${trackingNumber}`;

    if (sentTracking.has(uniqueKey)) {
      console.log("⚠️ Duplicate blocked:", uniqueKey);
      return;
    }

    const phoneRaw = data?.destination?.phone;
    if (!phoneRaw) {
      console.log("❌ No phone");
      return;
    }

    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    const name = data?.destination?.name || "Customer";

    const payload = {
      phone_number: phone,
      template_name: "order_shipped",
      template_language: "en_US",
      field_1: name,
      field_2: trackingNumber
    };

    console.log("📤 Sending shipping msg:", payload);

    await axios.post(
      `https://api.wamantra.com/api/${VENDOR_ID}/contact/send-template-message`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    // mark sent only after success
    sentTracking.add(uniqueKey);

    console.log("✅ Shipping message sent");

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});