import express from "express";
import Series from "../models/Series.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * GET /api/series
 * ?brand=xxx → lấy series theo brand
 */
router.get("/", async (req, res) => {
  try {
    const { brand } = req.query;

    const filter = {};

    // filter theo brand
    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      filter.brand = brand;
    }

    const series = await Series.find(filter)
      .populate("brand", "name") // lấy tên brand
      .sort({ name: 1 });

    res.json(series);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/series
 * tạo series mới
 */
router.post("/", async (req, res) => {
  try {
    const { name, brand } = req.body;

    if (!name || !brand) {
      return res.status(400).json({ message: "Thiếu name hoặc brand" });
    }

    if (!mongoose.Types.ObjectId.isValid(brand)) {
      return res.status(400).json({ message: "Brand không hợp lệ" });
    }

    // tránh trùng
    const existed = await Series.findOne({ name, brand });
    if (existed) {
      return res.status(400).json({ message: "Series đã tồn tại" });
    }

    const newSeries = new Series({ name, brand });
    const saved = await newSeries.save();

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/series/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const series = await Series.findById(req.params.id);

    if (!series) {
      return res.status(404).json({ message: "Không tìm thấy series" });
    }

    await series.deleteOne();

    res.json({ message: "Đã xóa series" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;