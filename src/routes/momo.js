// backend/utils/momo.js
import crypto from 'crypto';
import axios from 'axios';

// --- QUAN TRỌNG: Hãy đăng ký tài khoản tại developers.momo.vn để lấy Key riêng ---
// Key dưới đây là key test công cộng, có thể không ổn định.
const PARTNER_CODE = "MOMO";
const ACCESS_KEY = "F8BBA842ECF85";
const SECRET_KEY = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create";

export const createMomoPayment = async (orderId, amount, returnUrl, notifyUrl) => {
  try {
    // 1. Chuẩn hóa dữ liệu (Quan trọng)
    const requestId = orderId + "_" + new Date().getTime(); // Tạo requestId unique
    const orderInfo = "Thanh toan don hang " + orderId;
    const requestType = "captureWallet";
    const extraData = ""; 
    
    // Momo yêu cầu amount phải là SỐ NGUYÊN (Integer)
    const amountStr = Math.round(Number(amount)).toString(); 

    // 2. Tạo chữ ký (Signature)
    // Sắp xếp thứ tự tham số đúng chuẩn a-z: accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType
    const rawSignature = `accessKey=${ACCESS_KEY}&amount=${amountStr}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${requestId}&orderInfo=${orderInfo}&partnerCode=${PARTNER_CODE}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;

    // Lưu ý: orderId trong signature ở trên mình dùng requestId để đảm bảo unique mỗi lần bấm thanh toán lại
    // Nếu bạn muốn orderId của Momo khớp 1-1 với DB, hãy cẩn thận vì Momo không cho thanh toán lại cùng 1 orderId nếu giao dịch trước đó thất bại/chờ xử lý.
    // Ở đây tôi dùng requestId gán cho trường orderId của Momo để an toàn nhất.

    const signature = crypto.createHmac('sha256', SECRET_KEY)
      .update(rawSignature)
      .digest('hex');

    // 3. Tạo Body Request
    const requestBody = {
      partnerCode: PARTNER_CODE,
      partnerName: "Test Momo",
      storeId: "MomoTestStore",
      requestId: requestId,
      amount: Number(amountStr), // Body gửi đi phải là Number
      orderId: requestId,        // Dùng requestId làm orderId phía Momo để tránh trùng lặp
      orderInfo: orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: notifyUrl,
      lang: "vi",
      requestType: requestType,
      autoCapture: true,
      extraData: extraData,
      signature: signature
    };

    console.log("Momo Request Body:", JSON.stringify(requestBody, null, 2));

    // 4. Gọi API
    const response = await axios.post(MOMO_ENDPOINT, requestBody);
    
    console.log("Momo Response:", response.data);
    return response.data; 

  } catch (error) {
    // Log lỗi chi tiết ra Terminal của Backend để bạn xem
    console.error("MOMO API ERROR DETAILED:", error.response?.data || error.message);
    
    // Ném lỗi ra ngoài để route xử lý
    throw new Error(JSON.stringify(error.response?.data) || "Lỗi kết nối Momo");
  }
};