import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import slugify from 'slugify';
import Order from '../models/Order.js';
import multer from "multer";
import mongoose from "mongoose";
const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
    "/:id/review",
    protect,
    upload.fields([
      { name: "images", maxCount: 5 },
      { name: "videos", maxCount: 2 }
    ]),
    async (req, res) => {
      try {
        const { rating, comment } = req.body;
  
        const product = await Product.findById(req.params.id);
  
        if (!product) {
          return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }
  
        // ✅ CHECK ĐÃ MUA
        const order = await Order.findOne({
          user: req.user._id,
          status: "Completed",
          "orderItems.product": req.params.id
        });
  
        if (!order) {
          return res.status(403).json({
            message: "Bạn cần mua và nhận hàng trước khi đánh giá"
          });
        }
  
        // ❌ CHECK ĐÃ REVIEW
        const alreadyReviewed = product.reviews.find(
          r => r.user.toString() === req.user._id.toString()
        );
  
        if (alreadyReviewed) {
          return res.status(400).json({
            message: "Bạn đã đánh giá rồi"
          });
        }
  
        // ✅ LẤY FILE
        const imagePaths = req.files?.images?.map(f => f.path) || [];
        const videoPaths = req.files?.videos?.map(f => f.path) || [];
  
        const review = {
          user: req.user._id,
          name: req.user.name,
          rating: Number(rating),
          comment,
          images: imagePaths,
          videos: videoPaths
        };
  
        product.reviews.push(review);
  
        // ✅ update rating
        product.numReviews = product.reviews.length;
        product.rating =
          product.reviews.reduce((acc, item) => acc + item.rating, 0) /
          product.reviews.length;
  
        await product.save();
  
        res.status(201).json({ message: "Đã đánh giá sản phẩm" });
  
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  );
// --- PUBLIC ROUTES ---

// 1. GET /api/products (Lấy danh sách)
router.get("/", async (req, res) => {
    try {
        const { q, categoryId, minPrice, maxPrice, cpu, sort } = req.query;

        const filter = { is_active: true };

        // SEARCH
        if (q) {
            filter.name = { $regex: String(q).trim(), $options: "i" };
        }

        // CATEGORY
        if (categoryId) {
            filter.category = categoryId;
        }

        // PRICE
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // 🔥 FILTER CPU (specs.cpu)
        if (cpu) {
            // cpu có thể là array hoặc string
            const cpuList = Array.isArray(cpu) ? cpu : [cpu];

            filter["specs.cpu"] = { $in: cpuList };
        }

        let query = Product.find(filter)
            .populate("category", "name slug")
            .populate("brand", "name");

        // SORT
        if (sort === "price_asc") query = query.sort({ price: 1 });
        else if (sort === "price_desc") query = query.sort({ price: -1 });
        else query = query.sort({ createdAt: -1 });

        const products = await query;

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/products/best-sellers
router.get("/best-sellers", async (req, res) => {
    try {
        const products = await Product.find({
            is_active: true,
            sold: { $gt: 0 } // <--- QUAN TRỌNG: Chỉ lấy sản phẩm đã bán được ít nhất 1 cái
        })
            .sort({ sold: -1 }) // Sắp xếp giảm dần
            .limit(10)          // Lấy top 10
            .select("name images image price original_price sold slug stock flashSale rating numReviews");

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// API: Lấy danh sách Flash Sale cho trang chủ
router.get("/flash-sale", async (req, res) => {
    try {
        const now = new Date();

        // Logic tự động: Lấy sản phẩm có bật cờ Sale VÀ đang trong khung giờ
        const products = await Product.find({
            "flashSale.isSale": true,
            "flashSale.startTime": { $lte: now }, // Đã bắt đầu
            "flashSale.endTime": { $gt: now }     // Chưa kết thúc
        })
            .limit(10); // Lấy 10 sản phẩm

        // Format lại dữ liệu cho Frontend
        const formatted = products.map(p => ({
            _id: p._id,
            name: p.name,
            image: p.images?.[0] || "",
            // Giá gốc lúc này là giá niêm yết
            originalPrice: p.original_price,
            // Giá hiển thị là giá Flash Sale
            price: p.flashSale.salePrice,
            sold: p.flashSale.sold,
            target: p.flashSale.target,
            endTime: p.flashSale.endTime // Trả về để frontend đếm ngược
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.get("/low-stock", protect, admin, async (req, res) => {
    try {
        const threshold = 10; // Ngưỡng báo động (có thể để user cài đặt sau này)

        const products = await Product.find({
            stock: { $lte: threshold }, // $lte: Less than or equal (Nhỏ hơn hoặc bằng)
            is_active: true
        })
            .select('name sku stock image price') // Chỉ lấy các trường cần thiết
            .sort({ stock: 1 }); // Sắp xếp từ ít nhất đến nhiều nhất

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// 2. GET /api/products/:id (Chi tiết)
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("category")
            .populate("brand");

        if (product) res.json(product);
        else res.status(404).json({ message: "Sản phẩm không tồn tại" });
    } catch (error) {
        res.status(404).json({ message: "Lỗi ID sản phẩm" });
    }
});

// --- ADMIN ROUTES ---

// 3. POST /api/products (Tạo mới)
router.post("/", protect, admin, async (req, res) => {
    try {
        const {
            name, sku, import_price, original_price, price,
            category, brand, specs, stock, warranty_months, images, description, flashSale
        } = req.body;

        const productExists = await Product.findOne({ sku });
        if (productExists) return res.status(400).json({ message: "Mã SKU đã tồn tại" });

        // <--- 2. TẠO SLUG TỪ NAME --->
        // Ví dụ: name="Áo Thun" -> slug="ao-thun"
        const slug = slugify(name, { lower: true, strict: true, locale: 'vi' });

        // Kiểm tra xem slug đã tồn tại chưa (trường hợp trùng tên sản phẩm)
        const slugExists = await Product.findOne({ slug });
        if (slugExists) {
            return res.status(400).json({ message: "Tên sản phẩm đã tồn tại (trùng slug)" });
        }

        const product = new Product({
            name,
            slug, // <--- 3. THÊM SLUG VÀO ĐÂY
            sku,
            import_price,
            original_price,
            price,
            category, brand, specs, stock, warranty_months, images, description
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        // Bắt lỗi trùng lặp chi tiết hơn
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ message: `Dữ liệu trùng lặp: ${field}` });
        }
        res.status(400).json({ message: error.message });
    }
});

// 4. PUT /api/products/:id (Cập nhật)
router.put("/:id", protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            // Nếu có gửi tên mới lên thì cập nhật lại slug luôn
            if (req.body.name) {
                req.body.slug = slugify(req.body.name, { lower: true, strict: true, locale: 'vi' });
            }

            Object.assign(product, req.body);
            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 5. DELETE giữ nguyên...
router.delete("/:id", protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            await product.deleteOne();
            res.json({ message: "Đã xóa sản phẩm" });
        } else {
            res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// [NEW] API Riêng cho Admin để xem Lợi Nhuận
// GET /api/products/admin/analytics
router.get("/admin/analytics", protect, admin, async (req, res) => {
    try {
        // Cần dùng .select('+import_price') để lấy trường ẩn
        const products = await Product.find({}).select('+import_price');

        const report = products.map(p => ({
            name: p.name,
            sku: p.sku,
            sold: p.sold,
            revenue: p.price * p.sold, // Doanh thu
            cost: (p.import_price || 0) * p.sold, // Giá vốn
            profit: (p.price - (p.import_price || 0)) * p.sold // Lợi nhuận
        }));

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/products/category/:slug
router.get("/category/:slug", async (req, res) => {
    try {
        const category = await Category.findOne({ slug: req.params.slug });

        if (!category) {
            return res.status(404).json({ message: "Không tìm thấy danh mục" });
        }

        const products = await Product.find({ category: category._id });

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/products/:id/reviews
router.get("/:id/reviews", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .select("reviews rating numReviews");

        if (!product) {
            return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;