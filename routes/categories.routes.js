import express from "express";
import upload from "../middleware/upload.js";
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  uploadCategoryImage
} from "../controllers/categories.controller.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.patch("/:id/status", toggleCategory);
router.post("/:id/image", upload.single("image"), uploadCategoryImage);

export default router;
