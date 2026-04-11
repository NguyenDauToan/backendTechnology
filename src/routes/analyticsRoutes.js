// routes/analyticsRoutes.js
import express from 'express';
import Order from '../models/Order.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /api/analytics/revenue?type=daily|weekly|monthly
router.get('/revenue', protect, admin, async (req, res) => {
    try {
        const { type = 'daily' } = req.query;

        // 1. Xác định khoảng thời gian lọc
        let dateGroupFormat;
        let startDate = new Date();

        if (type === 'daily') {
            // Lấy 7 ngày gần nhất
            startDate.setDate(startDate.getDate() - 7);
            dateGroupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (type === 'monthly') {
            // Lấy 12 tháng gần nhất
            startDate.setMonth(startDate.getMonth() - 11);
            dateGroupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        } 
        // (Bạn có thể mở rộng thêm logic weekly nếu cần)

        // 2. Pipeline Aggregation
        const stats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    // Chỉ tính đơn hàng đã thanh toán/hoàn thành
                    status: { $in: ['delivered', 'completed'] }, 
                    isPaid: true // Nếu có trường này
                }
            },
            // Tách mảng orderItems ra từng document riêng lẻ
            { $unwind: "$orderItems" },
            // Join với bảng Products để lấy giá nhập (import_price)
            {
                $lookup: {
                    from: "products", // Tên collection trong DB (thường là số nhiều, viết thường)
                    localField: "orderItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            // Unwind mảng productDetails (vì lookup trả về mảng)
            { $unwind: "$productDetails" },
            // Tính toán lợi nhuận cho từng item
            {
                $project: {
                    createdAt: 1,
                    quantity: "$orderItems.quantity",
                    price: "$orderItems.price", // Giá bán tại thời điểm mua
                    importPrice: "$productDetails.import_price", // Giá nhập hiện tại
                    // Doanh thu item = giá bán * số lượng
                    itemRevenue: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
                    // Chi phí item = giá nhập * số lượng
                    itemCost: { $multiply: ["$productDetails.import_price", "$orderItems.quantity"] }
                }
            },
            // Gom nhóm theo ngày/tháng
            {
                $group: {
                    _id: dateGroupFormat,
                    totalRevenue: { $sum: "$itemRevenue" },
                    totalCost: { $sum: "$itemCost" },
                    totalOrders: { $addToSet: "$_id" } // Đếm số đơn (unique order ID)
                }
            },
            // Tính lợi nhuận cuối cùng và đếm số đơn
            {
                $project: {
                    date: "$_id",
                    revenue: "$totalRevenue",
                    profit: { $subtract: ["$totalRevenue", "$totalCost"] },
                    orderCount: { $size: "$totalOrders" },
                    _id: 0
                }
            },
            { $sort: { date: 1 } } // Sắp xếp tăng dần theo thời gian
        ]);

        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

export default router;