import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Kết nối với MongoDB (không cần các option cũ như useNewUrlParser vì Mongoose 6+ đã mặc định)
    const conn = await mongoose.connect(process.env.MONGO_URI);

    // In ra host để biết đã connect vào cluster nào (rất tiện khi debug)
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Thoát process với mã lỗi 1 (Uncaught Fatal Exception)
    process.exit(1);
  }
};

export default connectDB;