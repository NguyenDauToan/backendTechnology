import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    logo: { type: String }, // URL ảnh logo
    description: { type: String }
}, { timestamps: true });

export default mongoose.model('Brand', brandSchema);