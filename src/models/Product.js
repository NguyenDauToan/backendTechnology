import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    sku: { type: String, required: true, unique: true },

    // Liên kết
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },

    // --- CẬP NHẬT PHẦN GIÁ ---
    import_price: { type: Number, required: true, select: false }, // Giá nhập (Ẩn khi query thường)
    original_price: { type: Number, required: true }, // Giá niêm yết (Giá gạch ngang)
    price: { type: Number, required: true }, // Giá bán thực tế (Giá khách trả)
    // -------------------------

    stock: { type: Number, required: true, default: 0 },
    sold: { type: Number, default: 0 },

    images: [String],
    description: { type: String },

    specs: [{
        k: String,
        v: String
    }],
    reviews: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            name: { type: String, required: true },
            rating: { type: Number, required: true, min: 1, max: 5 },
            comment: { type: String },
            createdAt: { type: Date, default: Date.now },
            order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
            images: [String],
            videos: [String],
        }
    ],
    numReviews: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }, // ⭐ trung bình
    warranty_months: { type: Number, default: 12 },
    is_active: { type: Boolean, default: true },
    flashSale: {
        isSale: { type: Boolean, default: false }, // Có đang sale không    
        salePrice: { type: Number, default: 0 },   // Giá giảm
        startTime: { type: Date },                 // Thời gian bắt đầu
        endTime: { type: Date },                   // Thời gian kết thúc
        sold: { type: Number, default: 0 },        // Số lượng đã bán trong đợt sale (để hiển thị thanh tiến trình)
        target: { type: Number, default: 100 }     // Mục tiêu bán (để tính %)
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true }, // Để tính toán virtual field khi trả về JSON
    toObject: { virtuals: true }
});

// Virtual Field: Tính % giảm giá tự động
productSchema.virtual('discount_percentage').get(function () {
    if (this.original_price && this.price && this.original_price > this.price) {
        return Math.round(((this.original_price - this.price) / this.original_price) * 100);
    }
    return 0;
});
// Virtual Field: Tính giá bán thực tế tại thời điểm gọi API
productSchema.virtual('current_price').get(function () {
    const now = new Date();
    if (
        this.flashSale &&
        this.flashSale.isSale &&
        this.flashSale.startTime <= now &&
        this.flashSale.endTime > now
    ) {
        return this.flashSale.salePrice; // Trả về giá Flash Sale
    }
    return this.price; // Trả về giá thường
});
// Tạo index text
productSchema.index({ name: 'text', sku: 'text' });

export default mongoose.model('Product', productSchema);