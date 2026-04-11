import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    items: [
        {
            product: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'Product', 
                required: true 
            },
            quantity: { type: Number, default: 1 },
            // Nếu sản phẩm có specs/biến thể thì lưu thêm ở đây
        }
    ]
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);