import express from 'express';
import WarrantyTicket from '../models/WarrantyTicket.js';
import { protect, admin } from '../middlewares/authMiddleware.js'; // Bỏ staff nếu chưa định nghĩa

const router = express.Router();

// 1. TẠO PHIẾU (ADMIN)
router.post('/', protect, async (req, res) => {
    try {
        const { customer, product, issueDescription, note } = req.body;
        const code = 'RO-' + Date.now().toString().slice(-6);
        
        const ticket = new WarrantyTicket({
            code,
            // Nếu admin tạo, có thể không cần link user, hoặc link chính admin
            // user: req.user._id, // Tùy chọn
            customer,
            product,
            issueDescription,
            note,
            history: [{
                status: 'RECEIVED',
                updatedBy: req.user._id,
                timestamp: Date.now(),
                comment: 'Đã nhận yêu cầu bảo hành'
            }]
        });

        const createdTicket = await ticket.save();
        res.status(201).json(createdTicket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.post('/request', protect, async (req, res) => {
    try {
        const { 
            productName, 
            serialNumber, 
            issueDescription, 
            address, 
            phone,
            images // 👈 thêm
        } = req.body;

        const code = 'REQ-' + Date.now().toString().slice(-6);

        const ticket = new WarrantyTicket({
            code,
            user: req.user._id,
            customer: {
                name: req.user.name || 'Khách hàng',
                phone: phone || req.user.phone,
                address: address || ''
            },
            product: {
                name: productName,
                serialNumber: serialNumber || 'N/A'
            },
            issueDescription,

            // 👇 LƯU ẢNH
            images: images || [],

            status: 'REQUESTED',
            history: [{
                status: 'REQUESTED',
                updatedBy: req.user._id,
                comment: 'Đã gửi yêu cầu bảo hành'
            }]
        });

        const createdTicket = await ticket.save();
        res.status(201).json(createdTicket);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});
// 2. LẤY DANH SÁCH (TÌM KIẾM)
router.get('/', protect, async (req, res) => {
    // SỬA LỖI CHÍNH TẢ: stauts -> status
    const { keyword, status } = req.query;
    let query = {};

    if (keyword) {
        query = {
            $or: [
                { 'customer.name': { $regex: keyword, $options: 'i' } },
                { 'customer.phone': { $regex: keyword, $options: 'i' } },
                // SỬA LỖI: regex -> $regex
                { code: { $regex: keyword, $options: 'i' } },
            ]
        };
    }

    if (status) {
        query.status = status;
    }

    try {
        const tickets = await WarrantyTicket.find(query)
            .sort({ createdAt: -1 })
            .populate('technician', 'name'); // Đảm bảo model User có trường name
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. CẬP NHẬT TRẠNG THÁI
router.put('/:id/status', protect, async (req, res) => {
    // SỬA LỖI CHÍNH TẢ: diagnoise -> diagnosis
    const { status, diagnosis, partsCost, serviceFee, note } = req.body;
    
    try {
        const ticket = await WarrantyTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Không tìm thấy yêu cầu bảo hành' });

        ticket.status = status || ticket.status;
        
        // SỬA LỖI: Gán đúng trường diagnosis
        if (diagnosis) ticket.diagnosis = diagnosis;
        
        if (partsCost !== undefined) ticket.cost.partsCost = partsCost;
        if (serviceFee !== undefined) ticket.cost.serviceFee = serviceFee;
        
        // Gán kỹ thuật viên là người đang thao tác
        if (req.user._id) ticket.technician = req.user._id;

        ticket.history.push({
            status: status || ticket.status,
            updatedBy: req.user._id,
            // SỬA LỖI: Dùng backtick `` để nối chuỗi
            comment: note || `Cập nhật trạng thái thành ${status}`
        });

        const updatedTicket = await ticket.save();
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. KHÁCH GỬI YÊU CẦU (ĐÃ FIX LỖI 500)
router.post('/request', protect, async (req, res) => {
    try {
        // Lấy phone từ req.body (dữ liệu khách nhập)
        const { productName, serialNumber, issueDescription, address, phone } = req.body;
        
        const code = 'REQ-' + Date.now().toString().slice(-6);

        const ticket = new WarrantyTicket({
            code,
            user: req.user._id, // Link với tài khoản User
            customer: {
                // Ưu tiên lấy tên từ User, nếu không có thì lấy chuỗi rỗng
                name: req.user.name || 'Khách hàng', 
                
                // 👇 QUAN TRỌNG: Ưu tiên lấy SĐT khách nhập từ Form (req.body.phone)
                // Nếu khách không nhập thì mới lấy từ hồ sơ (req.user.phone)
                phone: phone || req.user.phone, 
                
                address: address || ''
            },
            product: {
                name: productName,
                serialNumber: serialNumber || 'N/A'
            },
            issueDescription,
            status: 'REQUESTED',
            history: [{
                status: 'REQUESTED',
                updatedBy: req.user._id,
                timestamp: Date.now(),
                comment: 'Đã gửi yêu cầu bảo hành'
            }]
        });

        const createdTicket = await ticket.save();
        res.status(201).json(createdTicket);
    } catch (error) {
        console.error("Lỗi tạo phiếu:", error); // Log ra terminal để dễ debug
        res.status(500).json({ message: error.message });
    }
});

// 5. LẤY LỊCH SỬ CỦA TÔI
router.get('/my-tickets', protect, async (req, res) => {
    try {
        const tickets = await WarrantyTicket.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;