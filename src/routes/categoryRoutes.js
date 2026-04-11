import express from 'express';
import Category from '../models/Category.js'; // Nhớ có đuôi .js
import { protect, admin } from '../middlewares/authMiddleware.js';
import Product from '../models/Product.js';
const router = express.Router();

// --- PUBLIC ROUTES (Ai cũng xem được) ---

// 1. Lấy tất cả danh mục
// GET /api/categories
router.get('/', async (req, res) => {
    try {
        // Lấy danh sách, populate để hiện tên danh mục cha (nếu là danh mục con)
        const categories = await Category.find({})
            .populate('parent_id', 'name') 
            .sort({ createdAt: -1 });
        
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Lấy chi tiết 1 danh mục (kèm theo logic lấy danh mục con nếu cần)
// GET /api/categories/:id
router.get('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).populate('parent_id', 'name');
        
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ message: 'Không tìm thấy danh mục' });
        }
    } catch (error) {
        res.status(404).json({ message: 'Lỗi ID danh mục' });
    }
});

// --- ADMIN ROUTES (Cần Token & Quyền Admin) ---

// 3. Tạo danh mục mới
// POST /api/categories
router.post('/', protect, admin, async (req, res) => {
    try {
        const { name, slug, description, image, parent_id } = req.body;

        // Kiểm tra trùng tên hoặc slug
        const categoryExists = await Category.findOne({ $or: [{ name }, { slug }] });
        if (categoryExists) {
            return res.status(400).json({ message: 'Danh mục hoặc Slug đã tồn tại' });
        }

        const category = new Category({
            name,
            slug, // Frontend nên gửi slug, hoặc bạn dùng thư viện slugify để tự tạo
            description,
            image,
            parent_id: parent_id || null // Nếu không chọn cha thì là null (danh mục gốc)
        });

        const createdCategory = await category.save();
        res.status(201).json(createdCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 4. Cập nhật danh mục
// PUT /api/categories/:id
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const { name, slug, description, image, parent_id } = req.body;
        const category = await Category.findById(req.params.id);

        if (category) {
            category.name = name || category.name;
            category.slug = slug || category.slug;
            category.description = description || category.description;
            category.image = image || category.image;
            category.parent_id = parent_id !== undefined ? parent_id : category.parent_id;

            const updatedCategory = await category.save();
            res.json(updatedCategory);
        } else {
            res.status(404).json({ message: 'Danh mục không tồn tại' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 5. Xóa danh mục
// DELETE /api/categories/:id
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (category) {
            // *Nâng cao: Nên kiểm tra xem có sản phẩm nào đang thuộc danh mục này không trước khi xóa
            // const hasProduct = await Product.findOne({ category: category._id });
            // if (hasProduct) return res.status(400).json({ message: "Phải xóa hết sản phẩm trong danh mục này trước" });

            await category.deleteOne();
            res.json({ message: 'Đã xóa danh mục' });
        } else {
            res.status(404).json({ message: 'Danh mục không tồn tại' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;