import mongoose from 'mongoose';

const warrantySchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // Mã bảo hành (VD: HG-2024-1234)
    
    // Liên kết để truy vết
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Thời hạn
    purchased_date: { type: Date, default: Date.now },
    expire_date: { type: Date, required: true },
    
    // Trạng thái bảo hành
    status: { 
        type: String, 
        enum: ['active', 'expired', 'claimed', 'void'], // Active: còn hạn, Claimed: Đang bảo hành, Void: Từ chối bảo hành
        default: 'active' 
    },
    
    // Lịch sử sửa chữa (nếu có)
    history: [{
        date: { type: Date, default: Date.now },
        note: String, // VD: Thay mainboard
        staff: String // Tên nhân viên xử lý
    }]
}, { timestamps: true });

export default mongoose.model('Warranty', warrantySchema);