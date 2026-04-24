import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // Tổng sản phẩm
    const totalProducts = await Product.countDocuments();

    // Tổng user
    const totalUsers = await User.countDocuments();

    // Tổng đơn hàng
    const totalOrders = await Order.countDocuments();

    // Doanh thu
    const orders = await Order.find({ isPaid: true });

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);

    // Đơn hàng gần đây
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name");

    // Top sản phẩm bán chạy
    const topProducts = await Product.find()
      .sort({ sold: -1 })
      .limit(5)
      .select("name sold images price");

    res.json({
      stats: {
        totalProducts,
        totalUsers,
        totalOrders,
        totalRevenue
      },
      recentOrders,
      topProducts
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;