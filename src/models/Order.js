import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    orderItems: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true }, // Lưu tên phòng khi sản phẩm bị xóa
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // Giá tại thời điểm mua (Quan trọng)
        image: { type: String },
        imeiList: [String],
        costPrice: { type: Number, required: true }, 
    }],
    isReceived: { type: Boolean, default: false },
    shippingAddress: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        phone: { type: String, required: true },
        recipient_name: { type: String, required: true }
    },

    paymentMethod: { type: String, default: 'COD' }, // COD, Banking, Momo...
    paymentResult: { // Lưu kết quả từ cổng thanh toán (nếu có)
        id: String,
        status: String,
        update_time: String,
        email_address: String,
    },
    itemsPrice: { type: Number, required: true, default: 0.0 },
    // Tiền
    shippingPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    // Trạng thái
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    
    status: {   
        type: String, 
        enum: ['Pending', 'Confirmed', 'Shipping','Delivered', 'Completed', 'Cancelled'], 
        default: 'Pending' 
    },
    deliveredAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);