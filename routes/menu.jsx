// backend/routes/menu.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all menu items with their range name (SHOW BOTH active + inactive)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.item_id, i.item_name, i.price, i.range_id, i.status, i.created_at, r.range_name
       FROM items i
       LEFT JOIN item_range r ON i.range_id = r.range_id
       ORDER BY i.item_id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD new menu item
router.post("/", async (req, res) => {
  const { name, price, range_id, status } = req.body;

  if (!name || !price || !range_id) {
    return res.status(400).json({ error: "Please provide all required fields" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO items (item_name, price, range_id, status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [name, price, range_id, status ?? 1]
    );
    res.json({ message: "Menu item added", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE menu item
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, price, range_id, status } = req.body;

  if (!name || !price || !range_id) {
    return res.status(400).json({ error: "Please provide all required fields" });
  }

  try {
    await db.query(
      `UPDATE items
       SET item_name = ?, price = ?, range_id = ?, status = ?
       WHERE item_id = ?`,
      [name, price, range_id, status ?? 1, id]
    );
    res.json({ message: "Menu item updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SOFT DELETE → always set to inactive
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`UPDATE items SET status = 0 WHERE item_id = ?`, [id]);
    res.json({ message: "Menu item deleted (status = 0)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 TOGGLE ACTIVE / DEACTIVE MENU ITEM
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // expecting 0 or 1

  try {
    await db.query(`UPDATE items SET status = ? WHERE item_id = ?`, [status, id]);
    res.json({ message: "Menu item status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 DEACTIVATE ALL ITEMS IN A RANGE
router.put("/deactivate-range/:range_id", async (req, res) => {
  const { range_id } = req.params;

  try {
    await db.query(`UPDATE items SET status = 0 WHERE range_id = ?`, [range_id]);
    res.json({ message: "All menu items in this range have been deactivated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
