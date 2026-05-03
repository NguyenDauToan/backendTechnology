import express from 'express';
import User from '../models/User.js';
import Order from '../models/Order.js'; // Import thêm để làm thống kê
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- ÁP DỤNG MIDDLEWARE BẢO VỆ CHO TOÀN BỘ ROUTE BÊN DƯỚI ---
// Tất cả các route trong file này đều yêu cầu Login + Quyền Admin
router.use(protect, admin); 

// ==========================================
// 1. QUẢN LÝ USER (NHÂN VIÊN/KHÁCH HÀNG)
// ==========================================

// GET /api/admin/users - Lấy danh sách user
// GET /api/admin/users?role=staff
router.get("/users", async (req, res) => {
    try {
        const users = await User.find({
            role: { $in: ["admin", "staff"] } // ❌ loại bỏ customer
        })
        .select("-password")
        .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/admin/users - Thêm nhân viên mới
router.post("/users", async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "Email đã tồn tại" });

        const user = await User.create({
            name, email, password, phone,
            role: role || 'staff',
            is_active: true
        });

        if (user) {
            res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role });
        }
    } catch (error) {
        res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }
});

// PUT /api/admin/users/:id - Sửa user
router.put("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;
            user.is_active = req.body.is_active !== undefined ? req.body.is_active : user.is_active;
            
            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();
            res.json({ _id: updatedUser._id, name: updatedUser.name, role: updatedUser.role });
        } else {
            res.status(404).json({ message: "Không tìm thấy user" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/admin/users/:id - Xóa user
router.delete("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            if (user.role === 'admin') return res.status(400).json({ message: "Không thể xóa Admin" });
            await user.deleteOne();
            res.json({ message: "Đã xóa thành công" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==========================================
// 2. DASHBOARD STATS (Thống kê cho Admin)
// ==========================================
router.get("/dashboard", async (req, res) => {
    try {
        // 1. Tổng đơn hàng
        const totalOrders = await Order.countDocuments();
        
        // 2. Tổng doanh thu (Tính tổng field totalPrice của các đơn đã thanh toán)
        const totalSalesData = await Order.aggregate([
            { $match: { isPaid: true } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalSales = totalSalesData.length > 0 ? totalSalesData[0].total : 0;

        // 3. Tổng User
        const totalUsers = await User.countDocuments();

        res.json({
            totalOrders,
            totalSales,
            totalUsers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// GET /api/admin/customers
router.get("/customers", async (req, res) => {
    try {
        // Query params từ frontend
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const keyword = req.query.keyword
            ? {
                  $or: [
                      { name: { $regex: req.query.keyword, $options: "i" } },
                      { email: { $regex: req.query.keyword, $options: "i" } },
                      { phone: { $regex: req.query.keyword, $options: "i" } }
                  ]
              }
            : {};

        const statusFilter =
            req.query.is_active !== undefined
                ? { is_active: req.query.is_active === "true" }
                : {};

        // Điều kiện tổng
        const query = {
            role: "user", // khách hàng
            ...keyword,
            ...statusFilter
        };

        // Tổng số record
        const total = await User.countDocuments(query);

        // Lấy data
        const customers = await User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            data: customers,
            page,
            totalPages: Math.ceil(total / limit),   
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// GET /api/admin/revenue-stats
router.get("/revenue-stats", async (req, res) => {
    try {
        const stats = await Order.aggregate([
            { $match: { isPaid: true } },

            { $unwind: "$orderItems" },

            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },

                    // Doanh thu = giá bán * số lượng
                    revenue: {
                        $sum: {
                            $multiply: [
                                "$orderItems.price",     // giá bán
                                "$orderItems.quantity"
                            ]
                        }
                    },

                    // Lợi nhuận = (giá bán - giá nhập) * số lượng
                    profit: {
                        $sum: {
                            $multiply: [
                                {
                                    $subtract: [
                                        "$orderItems.price",
                                        "$orderItems.costPrice" // 👉 cần có field này
                                    ]
                                },
                                "$orderItems.quantity"
                            ]
                        }
                    },

                    orderCount: { $sum: 1 }
                }
            },

            { $sort: { _id: 1 } },

            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    revenue: 1,
                    profit: 1,
                    orderCount: 1
                }
            }
        ]);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
export default router;