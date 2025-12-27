import express from "express";
import {
  getInventory,
  createInventory,
  updateInventory,
  deleteInventory
} from "../controllers/inventory.controller.js";

const router = express.Router();

// Inventory routes
router.get("/", getInventory);                    // Get all inventory items
router.post("/", createInventory);                  // Create new inventory record
router.put("/:id", updateInventory);              // Update inventory by ID
router.delete("/:id", deleteInventory);           // Delete inventory by ID

export default router;