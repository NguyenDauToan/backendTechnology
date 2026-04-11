import express from 'express';
import upload from '../config/cloudinary.js'; // Import file cấu hình bạn vừa gửi

const router = express.Router();

// 1. Upload 1 ảnh (Dùng cho Avatar, Banner, Icon danh mục)
// POST /api/upload
router.post('/', upload.single('image'), (req, res) => {
    try {
        // Sau khi qua middleware 'upload.single', file đã nằm trên Cloudinary
        // Đường dẫn ảnh nằm trong req.file.path
        
        if (!req.file) {
            return res.status(400).json({ message: 'Chưa chọn file ảnh' });
        }

        res.json({
            message: 'Upload thành công',
            url: req.file.path // Trả về link ảnh (https://res.cloudinary...)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Upload nhiều ảnh (Dùng cho thư viện ảnh Sản phẩm)
// POST /api/upload/multiple
// Cho phép tối đa 10 ảnh cùng lúc
router.post('/multiple', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Chưa chọn file ảnh nào' });
        }

        // Lấy danh sách URL
        const urls = req.files.map(file => file.path);

        res.json({
            message: 'Upload thành công',
            urls: urls 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;