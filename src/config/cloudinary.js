// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// 1. Cấu hình thông tin tài khoản (Lấy từ Dashboard Cloudinary)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Cấu hình nơi lưu trữ (Storage)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'huynh-gia', // Tên folder trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // Định dạng cho phép
    // transformation: [{ width: 500, height: 500, crop: 'limit' }], // (Optional) Resize ảnh luôn nếu muốn
  },
});

// 3. Khởi tạo Multer
const upload = multer({ storage });

export default upload;