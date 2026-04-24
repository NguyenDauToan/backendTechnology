import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/authMiddleware.js';
import passport from 'passport';
import '../config/passport.js';
import crypto from 'crypto';

const router = express.Router();

// Tạo JWT token
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Email hoặc mật khẩu sai" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Tài khoản đã bị khóa" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "Tài khoản này đăng nhập bằng Google" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Email hoặc mật khẩu sai" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id)
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- REGISTER ----------
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu tối thiểu 6 ký tự" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id)
    });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// ---------- PROFILE ----------
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    user.avatar = req.body.avatar || user.avatar;

    if (req.body.password) {
      user.password = req.body.password; // sẽ auto hash
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      role: updatedUser.role
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 phút

    await user.save();

    // TODO: gửi email thật ở đây
    res.json({
      message: "Token reset password đã tạo",
      token: resetToken // test trước
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ---------- GOOGLE AUTH ----------
router.get('/google', passport.authenticate('google', { scope: ['profile','email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req,res)=>{
    const user = req.user;
    const token = generateToken(user._id);
    const frontendURL = "http://localhost:8080";
    res.redirect(`${frontendURL}/login?token=${token}&role=${user.role}&name=${encodeURIComponent(user.name)}`);
  }
);

export default router;