const express = require("express");
const router = express.Router();
const db = require("../db");

// POST /api/sales - create a new sale
router.post("/", async (req, res) => {
  const { items, payment_method } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  try {
    // Calculate total amount
    const totals = await Promise.all(
      items.map(async (item) => {
        const [menu] = await db.query(
          "SELECT item_name, price FROM items WHERE item_id=? AND status=1",
          [item.item_id]
        );
        if (menu.length === 0) throw new Error(`Invalid item ID: ${item.item_id}`);
        return menu[0].price * item.qty;
      })
    );
    const total_amount = totals.reduce((a, b) => a + b, 0);

    // Generate invoice number
    const [lastInv] = await db.query("SELECT inv_id FROM invoice_sales ORDER BY inv_id DESC LIMIT 1");
    const nextId = lastInv.length > 0 ? lastInv[0].inv_id + 1 : 1;
    const inv_number = "INV-" + nextId.toString().padStart(6, "0");

    // Insert invoice
    const [invoiceResult] = await db.query(
      "INSERT INTO invoice_sales (inv_number, inv_total, payment_method) VALUES (?, ?, ?)",
      [inv_number, total_amount, payment_method]
    );

    const inv_id = invoiceResult.insertId;

    // Insert items (MySQL will calculate 'total')
    for (const item of items) {
      const [menu] = await db.query("SELECT price FROM items WHERE item_id=?", [item.item_id]);
      await db.query(
        `INSERT INTO item_sales (inv_id, item_id, qty, price) VALUES (?, ?, ?, ?)`,
        [inv_id, item.item_id, item.qty, menu[0].price]
      );
    }

    res.json({ success: true, inv_id, inv_number, total_amount });
  } catch (err) {
    console.error("Sale error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/history - last 50 invoices
router.get("/history", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT inv_id, inv_number, inv_total, payment_method, created_at
      FROM invoice_sales
      ORDER BY inv_id DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/summary - total invoices & sales
router.get("/summary", async (req, res) => {
  try {
    const [[{ total_invoices }]] = await db.query("SELECT COUNT(*) AS total_invoices FROM invoice_sales");
    const [[{ total_sales }]] = await db.query("SELECT SUM(inv_total) AS total_sales FROM invoice_sales");
    res.json({ total_invoices, total_sales: Number(total_sales) || 0 }); // Ensure it's a number
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:inv_id - fetch invoice details
router.get("/:inv_id", async (req, res) => {
  const { inv_id } = req.params;
  try {
    const [invoice] = await db.query("SELECT * FROM invoice_sales WHERE inv_id=?", [inv_id]);
    if (invoice.length === 0) return res.status(404).json({ error: "Invoice not found" });

    const [items] = await db.query(`
      SELECT i.item_name, s.qty, s.price, s.total
      FROM item_sales s
      JOIN items i ON i.item_id = s.item_id
      WHERE s.inv_id=?
    `, [inv_id]);

    res.json({ invoice: invoice[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
