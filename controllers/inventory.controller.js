import db from "../db.js";

/**
 * Get all inventory items, optionally filtered by item_code
 */
export const getInventory = async (req, res) => {
  try {
    const { item_code } = req.query;

    const [rows] = await db.query(
      `SELECT 
         i.id, 
         i.item_code, 
         i.quantity, 
         i.reorder_level, 
         i.last_updated,
         it.item_name, 
         it.barcode, 
         it.selling_price, 
         it.category_id, 
         c.category_name
       FROM inventory i
       LEFT JOIN items it ON i.item_code = it.item_code
       LEFT JOIN categories c ON it.category_id = c.id
       WHERE (? IS NULL OR i.item_code = ?)
       ORDER BY i.last_updated DESC`,
      [item_code || null, item_code || null]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({ message: "Failed to fetch inventory", error: err.message });
  }
};

/**
 * Create a new inventory record
 */
export const createInventory = async (req, res) => {
  try {
    const { item_code, quantity = 0, reorder_level = 10 } = req.body;

    if (!item_code) {
      return res.status(400).json({ message: "Item code is required" });
    }

    // Check if inventory record already exists for this item
    const [existingRecord] = await db.query(
      `SELECT id FROM inventory WHERE item_code = ?`,
      [item_code]
    );

    if (existingRecord.length > 0) {
      return res.status(400).json({ message: "Inventory record already exists for this item" });
    }

    // Insert new inventory record
    const [result] = await db.query(
      `INSERT INTO inventory (item_code, quantity, reorder_level, last_updated)
       VALUES (?, ?, ?, NOW())`,
      [item_code, quantity, reorder_level]
    );

    res.status(201).json({ message: "Inventory record created", inventory_id: result.insertId });
  } catch (err) {
    console.error("Error creating inventory:", err);
    res.status(500).json({ message: "Failed to create inventory", error: err.message });
  }
};

/**
 * Update an inventory record
 */
export const updateInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const { quantity, reorder_level } = req.body;

    // Check if inventory record exists
    const [existingRecord] = await db.query(
      `SELECT id FROM inventory WHERE id = ?`,
      [inventoryId]
    );

    if (existingRecord.length === 0) {
      return res.status(404).json({ message: "Inventory record not found" });
    }

    const updates = [];
    const values = [];

    if (quantity !== undefined) {
      updates.push("quantity = ?");
      values.push(quantity);
    }

    if (reorder_level !== undefined) {
      updates.push("reorder_level = ?");
      values.push(reorder_level);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    updates.push("last_updated = NOW()"); // always update timestamp
    values.push(inventoryId);

    await db.query(
      `UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ message: "Inventory updated successfully" });
  } catch (err) {
    console.error("Error updating inventory:", err);
    res.status(500).json({ message: "Failed to update inventory", error: err.message });
  }
};

/**
 * Delete an inventory record
 */
export const deleteInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;

    // Check if inventory record exists
    const [existingRecord] = await db.query(
      `SELECT id FROM inventory WHERE id = ?`,
      [inventoryId]
    );

    if (existingRecord.length === 0) {
      return res.status(404).json({ message: "Inventory record not found" });
    }

    await db.query(`DELETE FROM inventory WHERE id = ?`, [inventoryId]);

    res.json({ message: "Inventory record deleted" });
  } catch (err) {
    console.error("Error deleting inventory:", err);
    res.status(500).json({ message: "Failed to delete inventory", error: err.message });
  }
};
