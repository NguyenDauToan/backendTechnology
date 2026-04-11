import express from 'express';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- TẤT CẢ ROUTE ĐỀU CẦN ĐĂNG NHẬP (protect) ---

// 1. Lấy giỏ hàng của tôi
// GET /api/cart
router.get('/', protect, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product', 'name price images slug stock'); // Lấy thông tin sản phẩm để hiển thị

        if (!cart) {
            // Nếu chưa có giỏ hàng, trả về mảng rỗng chứ không báo lỗi
            return res.json({ items: [] });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Thêm sản phẩm vào giỏ (Hoặc tăng số lượng nếu đã có)
// POST /api/cart
router.post('/', protect, async (req, res) => {
    const { productId, quantity } = req.body;
    const qty = Number(quantity) || 1;

    try {
        // Kiểm tra sản phẩm có tồn tại và còn hàng không
        const product = await Product.findById(productId);
        const finalPrice = product.current_price;
        if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
        if (product.stock < qty) return res.status(400).json({ message: 'Sản phẩm không đủ số lượng tồn kho' });

        // Tìm giỏ hàng của user
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: [{ product: productId, quantity: qty, price: finalPrice }] // Lưu giá tại thời điểm mua
            });
        } else {
            const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += qty;
                // Cập nhật lại giá mới nhất nếu giá thay đổi
                cart.items[itemIndex].price = finalPrice;
            } else {
                cart.items.push({ product: productId, quantity: qty, price: finalPrice });
            }
        }

        await cart.save();

        // Populate lại để trả về dữ liệu đầy đủ cho Frontend hiển thị ngay
        const result = await cart.populate('items.product', 'name price images slug stock');
        res.json(result);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Cập nhật số lượng item trong giỏ (Tăng/Giảm ở trang Cart)
// PUT /api/cart/:productId
router.put('/:productId', protect, async (req, res) => {
    const { quantity } = req.body; // Số lượng mới (VD: User sửa từ 2 thành 5)

    try {
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.status(404).json({ message: 'Giỏ hàng trống' });

        const itemIndex = cart.items.findIndex(p => p.product.toString() === req.params.productId);

        if (itemIndex > -1) {
            if (quantity > 0) {
                cart.items[itemIndex].quantity = quantity;
            } else {
                // Nếu gửi số lượng <= 0 thì coi như xóa luôn
                cart.items.splice(itemIndex, 1);
            }
            await cart.save();

            const result = await cart.populate('items.product', 'name price images slug stock');
            res.json(result);
        } else {
            res.status(404).json({ message: 'Sản phẩm không có trong giỏ' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. Xóa 1 sản phẩm khỏi giỏ
// DELETE /api/cart/:productId
router.delete('/:productId', protect, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.status(404).json({ message: 'Giỏ hàng trống' });

        // Lọc bỏ sản phẩm cần xóa
        cart.items = cart.items.filter(item => item.product.toString() !== req.params.productId);

        await cart.save();

        const result = await cart.populate('items.product', 'name price images slug stock');
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. Xóa toàn bộ giỏ hàng (Khi user nhấn "Làm trống" hoặc sau khi Thanh toán thành công)
// DELETE /api/cart
router.delete('/', protect, async (req, res) => {
    try {
        await Cart.findOneAndDelete({ user: req.user._id });
        res.json({ message: 'Đã xóa giỏ hàng', items: [] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;