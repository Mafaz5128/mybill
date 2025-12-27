import db from "../db.js";

/**
 * Generate next item code (ITM00001, ITM00002, etc.)
 */
const generateItemCode = async () => {
  try {
    const [rows] = await db.query(
      `SELECT item_code FROM items ORDER BY id DESC LIMIT 1`
    );

    if (rows.length === 0) return "ITM00001";

    const lastCode = rows[0].item_code;
    const num = parseInt(lastCode.replace("ITM", "")) + 1;
    return "ITM" + num.toString().padStart(5, "0");
  } catch (err) {
    console.error("Error generating item code:", err);
    return "ITM00001";
  }
};

/**
 * Get all items, optionally filtered by category
 */
export const getItems = async (req, res) => {
  try {
    const { category_id } = req.query;

    const [rows] = await db.query(
      `SELECT i.*, c.category_name 
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE (? IS NULL OR i.category_id = ?)
       ORDER BY i.created_at DESC`,
      [category_id || null, category_id || null]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ message: "Failed to fetch items", error: err.message });
  }
};

/**
 * Create a new item (with inventory if stock item)
 */
export const createItem = async (req, res) => {
  try {
    const item = {
      item_name: req.body.item_name,
      category_id: req.body.category_id ? parseInt(req.body.category_id) : null,
      barcode: req.body.barcode || null,
      cost_price: req.body.cost_price ? parseFloat(req.body.cost_price) : 0,
      selling_price: req.body.selling_price ? parseFloat(req.body.selling_price) : 0,
      default_discount: req.body.default_discount ? parseFloat(req.body.default_discount) : 0,
      tax: req.body.tax ? parseFloat(req.body.tax) : 0,
      is_stock_item: (req.body.is_stock_item === "YES" || req.body.is_stock_item === "1") ? 1 : 0,
    };

    if (req.file) item.image_url = `/uploads/${req.file.filename}`;
    else item.image_url = null;

    if (!item.item_name || !item.category_id) {
      return res.status(400).json({ message: "Item name and category are required" });
    }

    const item_code = await generateItemCode();

    const [result] = await db.query(
      `INSERT INTO items 
       (item_code, item_name, category_id, barcode, cost_price, selling_price, default_discount, tax, image_url, is_stock_item, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        item_code, item.item_name, item.category_id, item.barcode,
        item.cost_price, item.selling_price, item.default_discount,
        item.tax, item.image_url, item.is_stock_item
      ]
    );

    // Automatically create inventory if stock item
    if (item.is_stock_item) {
      await db.query(
        `INSERT INTO inventory (item_code, quantity, reorder_level, last_updated)
         VALUES (?, 0, 10, NOW())`,
        [item_code]
      );
    }

    res.status(201).json({ message: "Item created successfully", item_id: result.insertId, item_code });
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(500).json({ message: "Failed to create item", error: err.message });
  }
};

/**
 * Update an existing item (with inventory handling if stock status changes)
 */
export const updateItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const updates = {};

    if (req.body.item_name !== undefined) updates.item_name = req.body.item_name;
    if (req.body.category_id !== undefined) updates.category_id = parseInt(req.body.category_id);
    if (req.body.barcode !== undefined) updates.barcode = req.body.barcode;
    if (req.body.cost_price !== undefined) updates.cost_price = parseFloat(req.body.cost_price);
    if (req.body.selling_price !== undefined) updates.selling_price = parseFloat(req.body.selling_price);
    if (req.body.default_discount !== undefined) updates.default_discount = parseFloat(req.body.default_discount);
    if (req.body.tax !== undefined) updates.tax = parseFloat(req.body.tax);
    if (req.body.is_stock_item !== undefined) updates.is_stock_item = (req.body.is_stock_item === "YES" || req.body.is_stock_item === "1") ? 1 : 0;

    if (req.file) updates.image_url = `/uploads/${req.file.filename}`;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updateFields = Object.keys(updates).map(key => `${key} = ?`);
    const updateValues = Object.values(updates);
    updateFields.push('updated_at = NOW()');
    updateValues.push(itemId);

    await db.query(`UPDATE items SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    // Inventory sync
    if ("is_stock_item" in updates) {
      const [inventoryRows] = await db.query(`SELECT id FROM inventory WHERE item_code = (SELECT item_code FROM items WHERE id = ?)`, [itemId]);
      if (updates.is_stock_item && inventoryRows.length === 0) {
        // Create inventory record
        const [itemRow] = await db.query(`SELECT item_code FROM items WHERE id = ?`, [itemId]);
        await db.query(`INSERT INTO inventory (item_code, quantity, reorder_level, last_updated) VALUES (?, 0, 10, NOW())`, [itemRow[0].item_code]);
      } else if (!updates.is_stock_item && inventoryRows.length > 0) {
        // Delete inventory record
        await db.query(`DELETE FROM inventory WHERE item_code = (SELECT item_code FROM items WHERE id = ?)`, [itemId]);
      }
    }

    res.json({ message: "Item updated successfully" });
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).json({ message: "Failed to update item", error: err.message });
  }
};

/**
 * Toggle item status (active/inactive) and handle inventory accordingly
 */
export const toggleItem = async (req, res) => {
  try {
    const itemId = req.params.id;

    const [itemRows] = await db.query(`SELECT status, is_stock_item, item_code FROM items WHERE id = ?`, [itemId]);
    if (itemRows.length === 0) return res.status(404).json({ message: "Item not found" });

    const { status: currentStatus, is_stock_item, item_code } = itemRows[0];
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    await db.query(`UPDATE items SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, itemId]);

    // Remove inventory if deactivating a stock item
    if (newStatus === 'inactive' && is_stock_item) {
      await db.query(`DELETE FROM inventory WHERE item_code = ?`, [item_code]);
    }

    res.json({ message: "Item status changed", status: newStatus });
  } catch (err) {
    console.error("Error toggling item:", err);
    res.status(500).json({ message: "Failed to change item status", error: err.message });
  }
};
