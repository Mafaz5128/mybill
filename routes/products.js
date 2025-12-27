const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");

// ---------- Multer setup for image uploads ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + path.extname(file.originalname))
});
const upload = multer({ storage });

// ---------- Helpers ----------

// Generate unique Category code
async function generateCategoryCode() {
  const [rows] = await db.query("SELECT MAX(id) AS maxId FROM categories");
  const nextId = (rows[0].maxId || 0) + 1;
  return "CAT" + String(nextId).padStart(6, "0");
}

// Generate unique Item code
async function generateItemCode() {
  const [rows] = await db.query("SELECT MAX(id) AS maxId FROM items");
  const nextId = (rows[0].maxId || 0) + 1;
  return "ITM" + String(nextId).padStart(6, "0");
}

// Calculate MRP
function calculateMRP(price, tax = 0, discount = 0) {
  price = Number(price);
  tax = Number(tax);
  discount = Number(discount);
  const taxAmount = (price * tax) / 100;
  const discountAmount = (price * discount) / 100;
  return +(price + taxAmount - discountAmount).toFixed(2);
}

// ---------- CATEGORY ROUTES ----------

// Get all categories
router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.category_code, c.category_name, c.description,
             c.default_discount, c.default_tax, c.is_active,
             c.created_at, c.updated_at,
             COALESCE(JSON_ARRAYAGG(ci.image_url), JSON_ARRAY()) AS images
      FROM categories c
      LEFT JOIN category_images ci ON c.id = ci.category_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add category
router.post("/categories", upload.array("images", 5), async (req, res) => {
  try {
    const { category_name, description, default_discount, default_tax } = req.body;
    if (!category_name) return res.status(400).json({ error: "Category name required" });

    const category_code = await generateCategoryCode();

    const [result] = await db.query(
      `INSERT INTO categories
       (category_code, category_name, description, default_discount, default_tax, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [category_code, category_name, description || null, default_discount ?? 0, default_tax ?? 0]
    );

    const categoryId = result.insertId;

    if (req.files?.length) {
      const values = req.files.map(f => [categoryId, `/uploads/${f.filename}`]);
      await db.query("INSERT INTO category_images (category_id, image_url) VALUES ?", [values]);
    }

    res.status(201).json({ success: true, category_code, categoryId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put("/categories/:id", upload.array("images", 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, description, default_discount, default_tax } = req.body;

    await db.query(
      `UPDATE categories
       SET category_name=?, description=?, default_discount=?, default_tax=?, updated_at=NOW()
       WHERE id=?`,
      [category_name, description || null, default_discount ?? 0, default_tax ?? 0, id]
    );

    if (req.files?.length) {
      const values = req.files.map(f => [id, `/uploads/${f.filename}`]);
      await db.query("INSERT INTO category_images (category_id, image_url) VALUES ?", [values]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete category
router.delete("/categories/:id", async (req, res) => {
  await db.query("UPDATE categories SET is_active=0 WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

// Change category status
router.patch("/categories/:id/status", async (req, res) => {
  await db.query(
    "UPDATE categories SET is_active=? WHERE id=?",
    [req.body.is_active, req.params.id]
  );
  res.json({ success: true });
});

// ---------- ITEM ROUTES ----------

// Get all items
router.get("/items", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.id, i.item_code, i.item_name, i.barcode,
             i.category_id, c.category_name,
             i.cost_price, i.selling_price, i.default_discount,
             i.tax, i.mrp, i.image_url,
             i.is_stock_item, i.status,
             i.created_at, i.updated_at
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      ORDER BY i.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item
router.post("/items", async (req, res) => {
  const {
    item_name, category_id, barcode, cost_price,
    selling_price, default_discount, tax,
    image_url, is_stock_item
  } = req.body;

  if (!item_name || !category_id || !selling_price) {
    return res.status(400).json({ error: "item_name, category_id, selling_price required" });
  }

  try {
    const item_code = await generateItemCode();
    const mrp = calculateMRP(selling_price, tax ?? 0, default_discount ?? 0);

    const [result] = await db.query(
      `INSERT INTO items
       (item_code, item_name, category_id, barcode,
        cost_price, selling_price, default_discount, tax, mrp,
        image_url, is_stock_item, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        item_code, item_name, category_id, barcode ?? null,
        cost_price ?? 0, selling_price, default_discount ?? 0, tax ?? 0,
        mrp, image_url ?? null, is_stock_item ?? "NO"
      ]
    );

    res.status(201).json({ success: true, item_code, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put("/items/:id", async (req, res) => {
  const { id } = req.params;
  const {
    item_name, category_id, barcode, cost_price,
    selling_price, default_discount, tax,
    image_url, is_stock_item, status
  } = req.body;

  if (!item_name || !category_id || !selling_price) {
    return res.status(400).json({ error: "item_name, category_id, selling_price required" });
  }

  try {
    const mrp = calculateMRP(selling_price, tax ?? 0, default_discount ?? 0);

    await db.query(
      `UPDATE items SET
         item_name=?, category_id=?, barcode=?,
         cost_price=?, selling_price=?, default_discount=?,
         tax=?, mrp=?, image_url=?, is_stock_item=?,
         status=?, updated_at=NOW()
       WHERE id=?`,
      [
        item_name, category_id, barcode ?? null,
        cost_price ?? 0, selling_price, default_discount ?? 0,
        tax ?? 0, mrp, image_url ?? null,
        is_stock_item ?? "NO", status ?? "ACTIVE", id
      ]
    );

    res.json({ success: true, message: "Item updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete item
router.delete("/items/:id", async (req, res) => {
  await db.query(
    "UPDATE items SET status='INACTIVE', updated_at=NOW() WHERE id=?",
    [req.params.id]
  );
  res.json({ success: true });
});

// Change item status
router.patch("/items/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await db.query(
    "UPDATE items SET status=?, updated_at=NOW() WHERE id=?",
    [status, req.params.id]
  );
  res.json({ success: true });
});

module.exports = router;
