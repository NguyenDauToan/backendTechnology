import express from 'express';
import * as PayOSModule from '@payos/node';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config();

const router = express.Router();
const PayOS = PayOSModule.default?.PayOS || PayOSModule.PayOS || PayOSModule.default || PayOSModule;
console.log("PayOS:", PayOS);

// 🔥 Check env tránh crash ngu
if (!process.env.PAYOS_CLIENT_ID) {
  throw new Error("Thiếu PAYOS_CLIENT_ID trong .env");
}

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);
console.log("payos instance:", payos);
// ===============================
// ✅ 1. TẠO LINK THANH TOÁN
// ===============================
router.post("/create-payment-link", async (req, res) => {
  try {
    const { amount, description, orderId } = req.body;

    if (!amount || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu amount hoặc orderId"
      });
    }

    // 🔥 FIX: tránh trùng orderCode
    const orderCode = Date.now();

    const frontendURL = process.env.FRONTEND_URL || "http://localhost:8081";

    // 🔥 Lưu orderCode vào DB để mapping với PayOS
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    order.payosOrderCode = orderCode;
    await order.save();

    const requestData = {
      orderCode,
      amount,
      description: `DH ${orderId}`.slice(0, 25),
      // 🔥 Gửi orderId về FE để xử lý tiếp
      returnUrl: `${frontendURL}/payment-success?orderId=${orderId}`,
      cancelUrl: `${frontendURL}/payment-cancel?orderId=${orderId}`
    };

    const paymentLinkResponse = await payos.paymentRequests.create(requestData);
    console.log(paymentLinkResponse);

    return res.json({
      success: true,
      checkoutUrl: paymentLinkResponse.checkoutUrl,
      orderCode
    });

  } catch (error) {
    console.error("❌ Lỗi tạo link thanh toán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi Server"
    });
  }
});

// ===============================
// ✅ 2. (OPTION) WEBHOOK PAYOS
// ===============================
router.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    // ⚠️ Sau này nên verify checksum (nâng cao)
    const { orderCode, status } = data;

    const order = await Order.findOne({ payosOrderCode: orderCode });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (status === "PAID") {
      order.isPaid = true;
      order.paidAt = new Date();
      await order.save();
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("❌ Webhook lỗi:", error);
    return res.status(500).json({ success: false });
  }
});

export default router;