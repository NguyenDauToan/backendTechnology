import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Warranty from '../models/Warranty.js';
import { protect, admin, staff } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Hàm phụ trợ sinh mã bảo hành (Helper)
const generateCode = () => {
    const prefix = "HG";
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // VD: 240115
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${date}-${random}`;
};
const generateIMEI = () => {
    return 'IMEI-' + Math.floor(100000000000000 + Math.random() * 900000000000000);
};
// 1. Tạo đơn hàng mới (User mua)
router.post("/", protect, async (req, res) => {
    // 1. Bổ sung itemsPrice, shippingPrice vào destructuring
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        totalPrice,
        itemsPrice,    // <--- Thêm cái này
        shippingPrice  // <--- Thêm cái này
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        return res.status(400).json({ message: "Không có sản phẩm nào trong giỏ" });
    }

    try {
        const order = new Order({
            user: req.user._id,
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,    // <--- Lưu vào DB
            shippingPrice, // <--- Lưu vào DB
            totalPrice
        });

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);
    } catch (error) {
        console.error("Error creating order:", error); // Log lỗi ra terminal để debug
        res.status(500).json({ message: error.message });
    }
});
// 2. Lấy đơn hàng của tôi (User xem lịch sử)
router.get("/myorders", protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// PUT /api/orders/:id/pay
router.put("/:id/pay", protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) throw new Error("Không tìm thấy đơn hàng");

        order.isPaid = true;
        order.paidAt = Date.now();

        // 👇 THÊM LOGIC SINH IMEI
        for (const item of order.orderItems) {
            if (!item.imeiList || item.imeiList.length === 0) {
                item.imeiList = [];

                for (let i = 0; i < item.quantity; i++) {
                    item.imeiList.push(generateIMEI());
                }
            }
        }

        await order.save();

        res.json({
            message: "Thanh toán thành công. Đã tạo IMEI cho sản phẩm.",
            order
        });

    } catch (error) {
        console.error("Lỗi cập nhật thanh toán:", error);
        res.status(500).json({ message: error.message });
    }
});
// PUT /api/orders/:id/confirm
router.put("/:id/confirm", protect, admin, staff, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) throw new Error("Không tìm thấy đơn hàng");

        // Chỉ xác nhận khi đã thanh toán
        if (!order.isPaid) {
            return res.status(400).json({ message: "Chưa thanh toán, không thể xác nhận." });
        }

        order.status = 'Delivered';
        order.deliveredAt = Date.now();

        // Sinh bảo hành
        const warrantyList = [];
        for (const item of order.orderItems) {
            const productInfo = await Product.findById(item.product);
            if (productInfo && productInfo.warranty_months > 0) {
                const expireDate = new Date();
                expireDate.setMonth(expireDate.getMonth() + productInfo.warranty_months);

                for (let i = 0; i < item.quantity; i++) {
                    warrantyList.push({
                        code: generateCode() + i,
                        order_id: order._id,
                        product_id: item.product,
                        user_id: order.user,
                        purchased_date: Date.now(),
                        expire_date: expireDate,
                        status: 'active'
                    });
                }
            }
        }

        if (warrantyList.length > 0) {
            await Warranty.insertMany(warrantyList);
        }

        await order.save();

        res.json({ message: "Đơn hàng đã được xác nhận & tạo bảo hành", warranties: warrantyList });

    } catch (error) {
        console.error("Lỗi xác nhận đơn hàng:", error);
        res.status(500).json({ message: error.message });
    }
});
// GET /api/orders/my-products
router.get("/my-products", protect, async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user._id,
            isPaid: true // chỉ lấy đơn đã thanh toán
        });

        let products = [];

        for (const order of orders) {
            for (const item of order.orderItems) {

                // Lấy warranty để có IMEI (code)
                const warranties = await Warranty.find({
                    order_id: order._id,
                    product_id: item.product,
                    user_id: req.user._id
                });

                warranties.forEach(w => {
                    products.push({
                        _id: w._id,
                        name: item.name,
                        imei: w.code, // 👈 dùng code làm IMEI
                        product_id: item.product,
                        order_id: order._id
                    });
                });
            }
        }

        res.json(products);

    } catch (error) {
        console.error("Lỗi my-products:", error);
        res.status(500).json({ message: error.message });
    }
});
// 4. Lấy TẤT CẢ đơn hàng (Dành cho Admin Page)
router.get("/", protect, admin, async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate("user", "id name email") // Lấy thêm tên user
            .sort({ createdAt: -1 }); // Mới nhất lên đầu
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. Cập nhật trạng thái đơn hàng (Dành cho Shipper/Admin)
router.put("/:id/status", protect, async (req, res) => {
    const { status } = req.body;

    try {
        // 1. Tìm đơn hàng
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        // 2. Logic trừ kho (Chỉ chạy khi chuyển sang Completed)
        if (status === 'Completed' && order.status !== 'Completed') {

            // ❗ COD phải thu tiền trước
            if (order.paymentMethod === 'COD' && !order.isPaid) {
                return res.status(400).json({
                    message: "Chưa thu tiền COD, không thể hoàn tất đơn"
                });
            }
        
            // ❗ Non-COD thì auto paid
            if (order.paymentMethod !== 'COD') {
                order.isPaid = true;
                order.paidAt = Date.now();
            }
        
            order.deliveredAt = Date.now();
        
            // trừ kho
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock -= item.quantity;
                    product.sold = (product.sold || 0) + item.quantity;
                    await product.save();
                }
            }
        }

        // 3. Cập nhật trạng thái đơn
        order.status = status;
        const updatedOrder = await order.save();

        res.json(updatedOrder);

    } catch (error) {
        console.error("Lỗi cập nhật trạng thái:", error); // In lỗi ra terminal để debug
        res.status(500).json({ message: error.message });
    }
});

// Lấy danh sách đơn hàng cho Shipper
router.get("/staff/deliveries", protect, staff, async (req, res) => {
    try {
        const orders = await Order.find({
            // ĐÃ SỬA: Thêm 'Delivered' vào mảng điều kiện để hiển thị ở tab "Chờ KH"
            status: { $in: ['Pending', 'Confirmed', 'Shipping', 'Delivered', 'Completed'] }
        })
            .populate("user", "id name email phone")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 7. Lấy chi tiết đơn hàng theo ID (Đặt route này ở cuối cùng để tránh xung đột)
router.get("/:id", protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("user", "name email phone"); // Lấy thêm thông tin người đặt

        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }
    } catch (error) {
        // Nếu ID không đúng định dạng ObjectId của Mongo cũng sẽ vào đây
        res.status(500).json({ message: "Lỗi Server hoặc ID đơn hàng không hợp lệ" });
    }
});
// PUT /api/orders/:id/cod-paid
router.put("/:id/cod-paid", protect, staff, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        // Chỉ áp dụng cho COD + đã giao
        if (order.paymentMethod !== "COD") {
            return res.status(400).json({ message: "Đơn này không phải COD" });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({ message: "Chưa giao hàng, không thể xác nhận thanh toán" });
        }

        order.isPaid = true;
        order.paidAt = Date.now();

        await order.save();

        res.json({ message: "Đã xác nhận khách thanh toán COD", order });

    } catch (error) {
        console.error("COD pay error:", error);
        res.status(500).json({ message: error.message });
    }
});
export default router;