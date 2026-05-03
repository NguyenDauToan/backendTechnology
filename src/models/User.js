import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6
  },
  phone: {
    type: String,
    default: "",
    match: /^[0-9]{9,11}$/
  },
  isVerified: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  is_active: { type: Boolean, default: true },
  defaultAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  role: { type: String, enum: ['user', 'admin', 'staff'], default: 'user' },
  googleId: { type: String },
  avatar: { type: String },
}, { timestamps: true });

// Middleware hash password trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method kiểm tra password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
}

export default mongoose.model('User', userSchema);