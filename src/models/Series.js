// models/Series.js
import mongoose from "mongoose";

const seriesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true }
}, { timestamps: true });

export default mongoose.model("Series", seriesSchema);