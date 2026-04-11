import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // không bắt buộc
  phone: { type: String, default: "" },
  defaultAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  role: { type: String, enum: ['user','admin','staff'], default: 'user' },
  googleId: { type: String },
  avatar: { type: String },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Middleware hash password trước khi lưu
userSchema.pre('save', async function(next){
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method kiểm tra password
userSchema.methods.matchPassword = async function(enteredPassword){
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
}

export default mongoose.model('User', userSchema);