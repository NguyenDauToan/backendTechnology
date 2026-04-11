import mongoose from "mongoose";

const warrantyTicketSchema = new mongoose.Schema({
    // --- SỬA LỖI 1: code phải là String, không phải Object ---
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },

    // Thông tin khách hàng nằm ở đây (Đúng)
    customer: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: String
    },

    // Liên kết với User (người gửi yêu cầu)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    product: {
        name: { type: String, required: true },
        serialNumber: { type: String },
        model: String,
        purchaseDate: Date,
        warrantyExpiredDate: Date
    },

    issueDescription: { type: String, required: true },
    images: [
        {
            url: String
        }
    ],
    // Sửa lỗi chính tả: diagnoise -> diagnosis
    diagnosis: String, 

    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // --- SỬA LỖI 2: Thêm 'REQUESTED' vào enum ---
    status: {
        type: String,
        enum: ['REQUESTED', 'RECEIVED', 'CHECKING', 'WAITING_PARTS', 'FIXING', 'DONE', 'RETURNED', 'CANCELLED'],
        default: 'REQUESTED'
    },

    cost: {
        partsCost: { type: Number, default: 0 },
        serviceFee: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    note: String,

    history: [{
        status: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        comment: String
    }]
}, { timestamps: true });

// Middleware tính tổng tiền
warrantyTicketSchema.pre('save', function() {
    this.cost.total = (this.cost.partsCost || 0) + (this.cost.serviceFee || 0);
});

const WarrantyTicket = mongoose.model('WarrantyTicket', warrantyTicketSchema);
export default WarrantyTicket;