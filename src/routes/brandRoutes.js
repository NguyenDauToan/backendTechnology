// routes/brandRoutes.js
import express from "express";
import Brand from "../models/Brand.js";
import { protect, admin, staff } from "../middlewares/authMiddleware.js";
import slugify from "slugify";
const router = express.Router();

// GET /api/brands
router.get("/", async (req, res) => {
    try {
        const brands = await Brand.find({});
        res.json(brands);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// routes/brandRoutes.js
router.post("/", protect, admin, async (req, res) => {
    try {
      const { name } = req.body;
  
      if (!name) {
        return res.status(400).json({ message: "Thiếu tên brand" });
      }
  
      const slug = slugify(name, { lower: true });
  
      const exists = await Brand.findOne({ slug });
      if (exists) {
        return res.status(400).json({ message: "Brand đã tồn tại" });
      }
  
      const brand = new Brand({ name, slug });
      const created = await brand.save();
  
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

router.put("/:id", protect, admin, async (req, res) => {
    const brand = await Brand.findById(req.params.id);

    if (!brand) return res.status(404).json({ message: "Not found" });

    brand.name = req.body.name || brand.name;
    brand.slug = slugify(brand.name, { lower: true });

    const updated = await brand.save();
    res.json(updated);
});

router.delete("/:id", protect, admin, async (req, res) => {
    const brand = await Brand.findById(req.params.id);

    if (!brand) return res.status(404).json({ message: "Not found" });

    await brand.deleteOne();
    res.json({ message: "Deleted" });
});
export default router;