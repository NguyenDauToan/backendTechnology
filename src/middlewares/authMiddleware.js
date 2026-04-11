import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 1. Kiểm tra đã đăng nhập chưa?
const protect = async (req, res, next) => {
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log("Token nhận được:", token); // <-- LOG TOKEN

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("Decoded JWT:", decoded); // <-- LOG JWT decode

            req.user = await User.findById(decoded.id).select('-password');
            console.log("User từ token:", req.user); // <-- LOG USER

            next();
        } catch (error) {
            console.error("Lỗi protect middleware:", error);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        console.log("Không tìm thấy token trong header"); // <-- LOG
        res.status(401).json({ message: "Not authorized, no token" });
    }
};
// 2. Kiểm tra có phải Admin không?
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Yêu cầu quyền Admin' });
    }
};
const staff = (req, res, next) => {
    // Cho phép nếu là Staff HOẶC Admin
    if (req.user && (req.user.role === 'staff' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(401);
        throw new Error('Không có quyền thực hiện (Yêu cầu quyền Nhân viên)');
    }
};
export { protect, admin, staff};