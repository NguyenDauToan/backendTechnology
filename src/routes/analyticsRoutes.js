// routes/analyticsRoutes.js
import express from 'express';
import Order from '../models/Order.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /api/analytics/revenue?type=daily|weekly|monthly
router.get('/revenue', protect, admin, async (req, res) => {
    try {
        const { type = 'daily' } = req.query;

        let startDate = new Date();
        let format;

        if (type === 'daily') {
            startDate.setDate(startDate.getDate() - 7);
            format = "%Y-%m-%d";
        } else {
            startDate.setMonth(startDate.getMonth() - 11);
            format = "%Y-%m";
        }

        const stats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $in: ['Delivered', 'Completed'] },
                    isPaid: true
                }
            },

            { $unwind: "$orderItems" },

            // 🔥 JOIN PRODUCT
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.product",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },

            // 🔥 GROUP 1: theo ngày + order
            {
                $group: {
                    _id: {
                        date: {
                            $dateToString: {
                                format: format,
                                date: "$createdAt"
                            }
                        },
                        orderId: "$_id"
                    },

                    revenue: {
                        $sum: {
                            $multiply: [
                                "$orderItems.price",
                                "$orderItems.quantity"
                            ]
                        }
                    },

                    cost: {
                        $sum: {
                            $multiply: [
                                "$product.import_price", // ✅ FIX CHUẨN
                                "$orderItems.quantity"
                            ]
                        }
                    }
                }
            },

            // 🔥 GROUP 2: theo ngày
            {
                $group: {
                    _id: "$_id.date",
                    revenue: { $sum: "$revenue" },
                    cost: { $sum: "$cost" },
                    orderCount: { $sum: 1 }
                }
            },

            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    revenue: 1,
                    profit: { $subtract: ["$revenue", "$cost"] },
                    orderCount: 1
                }
            },

            { $sort: { date: 1 } }
        ]);

        res.json(stats);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});
export default router;