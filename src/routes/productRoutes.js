import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import upload from '../config/cloudinary.js'; // ✅ Sử dụng Cloudinary cấu hình sẵn
import slugify from 'slugify';
import mongoose from "mongoose";
import Brand from '../models/Brand.js';

const router = express.Router();

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

            // 1. Kiểm tra xem khách đã mua và nhận hàng thành công chưa
            const order = await Order.findOne({
                user: req.user._id,
                status: "Completed", // ✅ Chỉ cho phép khi trạng thái đơn hàng đã hoàn tất
                orderItems: { $elemMatch: { product: req.params.id } }
            });

            if (!order) {
                return res.status(403).json({ message: "Bạn cần hoàn tất đơn hàng trước khi đánh giá" });
            }

            // 2. Kiểm tra xem user này đã đánh giá sản phẩm này chưa
            const alreadyReviewed = product.reviews.find(
                r => r.user.toString() === req.user._id.toString()
            );

            if (alreadyReviewed) {
                return res.status(400).json({ message: "Bạn đã đánh giá sản phẩm này rồi" });
            }

            // 3. Lấy URL từ Cloudinary
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

            // 4. Cập nhật Rating trung bình
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => acc + item.rating, 0) / product.reviews.length;

            await product.save();
            res.status(201).json({ message: "Đã gửi đánh giá thành công" });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);
// --- PUBLIC ROUTES ---

// 1. GET /api/products (Lấy danh sách)
router.get("/", async (req, res) => {
    try {
        const { q, categoryId, minPrice, maxPrice, cpu, sort, brand, series  } = req.query;

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
        // BRAND FILTER
        if (brand) {
            const brandList = Array.isArray(brand) ? brand : [brand];
        
            const validBrandIds = brandList
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
        
            filter.brand = { $in: validBrandIds };
        }
        if (series) {
            const seriesList = Array.isArray(series) ? series : [series];
        
            const validSeriesIds = seriesList
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
        
            filter.series = { $in: validSeriesIds };
        }
        let query = Product.find(filter)
            .populate("category", "name slug")
            .populate("brand", "name slug")
            .populate("series", "name");
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
            .select("+import_price")
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
        let {
            name, sku, import_price, original_price, price,
            category, brand, specs, stock, series,
            warranty_months, images, description
        } = req.body;

        // VALIDATE
        if (!name || !sku || !category) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
        }

        if (import_price == null || import_price <= 0) {
            return res.status(400).json({ message: "Giá nhập phải > 0" });
        }

        if (price <= 0 || original_price <= 0) {
            return res.status(400).json({ message: "Giá bán không hợp lệ" });
        }

        // ✅ CHECK BRAND
        if (brand) {
            if (!mongoose.Types.ObjectId.isValid(brand)) {
                return res.status(400).json({ message: "Brand không hợp lệ" });
            }

            const brandExists = await Brand.findById(brand);
            if (!brandExists) {
                return res.status(400).json({ message: "Brand không tồn tại" });
            }
        }

        // ÉP KIỂU
        import_price = Number(import_price);
        original_price = Number(original_price);
        price = Number(price);
        stock = Number(stock || 0);

        const productExists = await Product.findOne({ sku });
        if (productExists) {
            return res.status(400).json({ message: "SKU đã tồn tại" });
        }

        const slug = slugify(name, { lower: true, strict: true, locale: "vi" });

        const product = new Product({
            name,
            slug,
            sku,
            import_price,
            original_price,
            price,
            category,
            brand: brand || null, // 👈 fix null
            series: series || null, 
            specs,
            stock,
            warranty_months,
            images,
            description
        });

        const created = await product.save();

        res.status(201).json(created);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// 4. PUT /api/products/:id (Cập nhật)
router.put("/:id", protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).select("+import_price");

        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        let {
            name,
            sku,
            import_price,
            original_price,
            price,
            category,
            brand,
            series,
            specs,
            stock,
            warranty_months,
            images,
            description,
            flashSale // 👈 THÊM CÁI NÀY
        } = req.body;
        if (series !== undefined) product.series = series;
        // ===== VALIDATE =====
        if (import_price !== undefined) {
            if (import_price <= 0) {
                return res.status(400).json({ message: "Giá nhập phải > 0" });
            }
            product.import_price = Number(import_price);
        }

        if (price !== undefined) {
            if (price <= 0) {
                return res.status(400).json({ message: "Giá bán không hợp lệ" });
            }
            product.price = Number(price);
        }

        if (original_price !== undefined) {
            product.original_price = Number(original_price);
        }

        if (stock !== undefined) {
            product.stock = Number(stock);
        }

        // ===== UPDATE BASIC =====
        if (name) {
            product.name = name;
            product.slug = slugify(name, { lower: true, strict: true, locale: "vi" });
        }

        if (sku) product.sku = sku;
        if (category) product.category = category;
        if (brand) product.brand = brand;
        if (specs) product.specs = specs;
        if (warranty_months !== undefined) product.warranty_months = warranty_months;
        if (images) product.images = images;
        if (description !== undefined) product.description = description;

        // =========================
        // 🔥 FIX FLASH SALE Ở ĐÂY
        // =========================
        if (flashSale) {
            product.flashSale = {
                ...product.flashSale,
                ...flashSale,
                startTime: flashSale.startTime ? new Date(flashSale.startTime) : product.flashSale.startTime,
                endTime: flashSale.endTime ? new Date(flashSale.endTime) : product.flashSale.endTime,
            };
        }

        const updatedProduct = await product.save();

        res.json(updatedProduct);

    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({ message: error.message });
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

        // 🔥 Lấy tất cả danh mục con
        const childCategories = await Category.find({
            parent_id: category._id
        });

        const categoryIds = [
            category._id,
            ...childCategories.map(c => c._id)
        ];

        // 🔥 Lấy sản phẩm thuộc cả cha + con
        const products = await Product.find({
            category: { $in: categoryIds }
        });

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