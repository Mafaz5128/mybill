// routes/sales.routes.js
import express from "express";
import {
  createSale,
  getSalesHistory,
  getInvoiceById,
  getTodaySales,
  getSalesSummary
} from "../controllers/sales.controller.js";

const router = express.Router();

/**
 * Create new invoice / sale
 */
router.post("/", createSale);

/**
 * Sales history (paginated)
 */
router.get("/history", getSalesHistory);

/**
 * Today's sales total
 */
router.get("/today-sales", getTodaySales);
router.get("/summary", getSalesSummary);

/**
 * Get invoice by ID
 * IMPORTANT: keep this LAST
 */
router.get("/:id", getInvoiceById);

export default router;
