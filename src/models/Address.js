import mongoose from 'mongoose';

const addressSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    name: { type: String, required: true }, // Tên người nhận (VD: Nhà riêng, Công ty)
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
}, {
    timestamps: true
});

const Address = mongoose.model('Address', addressSchema);
export default Address;