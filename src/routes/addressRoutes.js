import express from 'express';
import Address from '../models/Address.js';
import User from '../models/User.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- HÀM LÀM SẠCH DỮ LIỆU (Helper) ---
// Giúp loại bỏ tên đường bị lặp trong city
const cleanCityData = (street, city) => {
    if (!street || !city) return city;
    
    const s = street.trim().toLowerCase();
    const c = city.trim().toLowerCase();

    // Nếu city bắt đầu bằng street (Ví dụ: street="Hẻm 20", city="Hẻm 20, Xã A...")
    if (c.indexOf(s) === 0) {
        // Cắt bỏ phần street và dấu phẩy thừa ở đầu
        // Ví dụ: "Hẻm 20, Xã A" -> ", Xã A" -> "Xã A"
        let newCity = city.substring(street.length).trim();
        // Xóa các ký tự đặc biệt ở đầu nếu còn sót (, -)
        return newCity.replace(/^[\s,.-]+/, '');
    }
    
    return city;
};

// 1. Lấy danh sách (Giữ nguyên)
router.get('/', protect, async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.user._id });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. THÊM ĐỊA CHỈ MỚI (ĐÃ SỬA)
router.post('/', protect, async (req, res) => {
    let { name, recipientName, phone, street, city, isDefault } = req.body;
    
    try {
        // 👇 BƯỚC QUAN TRỌNG: Làm sạch city trước khi lưu
        const cleanCity = cleanCityData(street, city);

        const address = new Address({
            user: req.user._id,
            name, recipientName, phone, street, 
            city: cleanCity, // Lưu city đã làm sạch
            isDefault
        });
        const createdAddress = await address.save();

        if (isDefault) {
            await Address.updateMany(
                { user: req.user._id, _id: { $ne: createdAddress._id } },
                { isDefault: false }
            );
            await User.findByIdAndUpdate(req.user._id, {
                defaultAddress: createdAddress._id,
                phone: phone 
            });
        }

        res.status(201).json(createdAddress);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 3. CẬP NHẬT ĐỊA CHỈ (ĐÃ SỬA)
router.put('/:id', protect, async (req, res) => {
    let { name, recipientName, phone, street, city, isDefault } = req.body;
    
    try {
        const address = await Address.findById(req.params.id);

        if (!address) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
        if (address.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Không có quyền' });

        address.name = name || address.name;
        address.recipientName = recipientName || address.recipientName;
        address.phone = phone || address.phone;
        
        // Cập nhật Street mới
        if (street) address.street = street;
        
        // Cập nhật City mới (Có làm sạch)
        if (city) {
            // Nếu có street mới thì dùng street mới, không thì dùng street cũ để check
            const currentStreet = street || address.street;
            address.city = cleanCityData(currentStreet, city);
        }

        if (isDefault) {
            address.isDefault = true;
            await Address.updateMany(
                { user: req.user._id, _id: { $ne: address._id } },
                { isDefault: false }
            );
            await User.findByIdAndUpdate(req.user._id, {
                defaultAddress: address._id,
                phone: address.phone
            });
        }

        const updatedAddress = await address.save();
        res.json(updatedAddress);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ... Phần Delete giữ nguyên ...
router.delete('/:id', protect, async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        if (address && address.user.toString() === req.user._id.toString()) {
            await address.deleteOne();
            res.json({ message: 'Đã xóa địa chỉ' });
        } else {
            res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;