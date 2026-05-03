import express from 'express';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import cors from 'cors';
import axios from 'axios';
import morgan from 'morgan';

// Import Routes
import productRoutes from './src/routes/productRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import categoryRoutes from './src/routes/categoryRoutes.js';
import cartRoutes from './src/routes/cartRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import addressRoutes from './src/routes/addressRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import warrantyRoutes from './src/routes/warrantyRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
// 1. IMPORT PAYMENT ROUTES (Đảm bảo bạn đã tạo file này trong thư mục routes nhé)
import paymentRoutes from './src/routes/paymentRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';

dotenv.config();
connectDB();

const app = express();
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// --- MOUNT ROUTES ---
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes); 
app.use('/api/cart', cartRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/analytics', analyticsRoutes);

// 2. KHAI BÁO PAYMENT ROUTES CHO APP
app.use('/api/payment', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/', (req, res) => {
    res.send('API Huynh Gia is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server running on port ${PORT}`));