import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    parent_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        default: null 
    }, // Để làm danh mục đa cấp (VD: Điện tử -> Laptop)
    image: { type: String },
    description: { type: String }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);