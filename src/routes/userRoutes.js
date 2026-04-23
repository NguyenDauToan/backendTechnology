import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/authMiddleware.js';
import passport from 'passport';
import '../config/passport.js';
const router = express.Router();

// Tạo JWT token
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ---------- LOGIN ----------
router.post('/login', async (req,res)=>{
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if(user && user.password && await user.matchPassword(password)){
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: "Email hoặc mật khẩu sai" });
    }
  } catch(err){
    res.status(500).json({ message: err.message });
  }
});

// ---------- REGISTER ----------
router.post('/register', async (req,res)=>{
  const { name, email, password, phone } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if(userExists) return res.status(400).json({ message: "Email đã tồn tại" });

    const user = await User.create({ name, email, password, phone });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id)
    });

  } catch(err){
    res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }
});

// ---------- PROFILE ----------
router.get('/profile', protect, async (req,res)=>{
  try {
    const user = await User.findById(req.user._id).populate('defaultAddress');
    if(!user) return res.status(404).json({ message: "Không tìm thấy user" });

    const fullAddress = user.defaultAddress ? user.defaultAddress.city : "Chưa thiết lập địa chỉ mặc định";
    let displayPhone = user.phone;
    if(!displayPhone && user.defaultAddress) displayPhone = user.defaultAddress.phone;

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: displayPhone || "",
      role: user.role,
      avatar: user.avatar || "",
      address: fullAddress,
      defaultAddressId: user.defaultAddress?._id
    });
  } catch(err){
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