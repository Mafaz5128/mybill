import db from "../db.js";

/**
 * Generate invoice number (INV-000001)
 */
const generateInvoiceNumber = async () => {
  try {
    const [rows] = await db.query(
      "SELECT id FROM invoices ORDER BY id DESC LIMIT 1"
    );

    if (rows.length === 0) return "INV-000001";

    const nextId = rows[0].id + 1;
    return `INV-${nextId.toString().padStart(6, "0")}`;
  } catch (err) {
    console.error("Invoice number error:", err);
    // Fallback to a default or throw an error, depending on desired behavior
    throw new Error("Could not generate invoice number.");
  }
};

/**
 * Create Sale
 * Updated to align with items, invoices, and invoiceitems table structures.
 * Handles item-level discounts/taxes (from items table) and a flat bill discount.
 */
/**
 * Create Sale
 * CORRECTED VERSION
 */
/**
 * Create Sale
 * CORRECTED VERSION - Handles Generated Columns
 */
export const createSale = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      items, // Array of { item_id, quantity }
      payment_method,
      paid_amount = 0,
      notes,
      created_by,
      flat_discount = 0
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items in the sale." });
    }

    let invoice_subtotal = 0;
    let total_item_discount = 0;
    let total_tax_amount = 0;

    const processedItems = [];

    // 1. Process each item: fetch details, calculate line totals, discounts, and taxes
    for (const item of items) {
      if (!item.item_id || !item.quantity) {
        throw new Error(`Invalid item data provided for item ID: ${item.item_id}`);
      }

      const [itemRows] = await connection.query(
        "SELECT item_name, item_code, barcode, selling_price, default_discount, tax, is_stock_item FROM items WHERE id = ? AND status = 'active'",
        [item.item_id]
      );

      if (itemRows.length === 0) {
        throw new Error(`Item with ID ${item.item_id} not found or inactive.`);
      }

      const dbItem = itemRows[0];
      const unit_price = dbItem.selling_price;
      const quantity = item.quantity;
      const lineTotalBeforeDiscounts = unit_price * quantity;

      const discount_percent = dbItem.default_discount || 0;
      const item_discount_amount = (lineTotalBeforeDiscounts * discount_percent) / 100;
      const lineTotalAfterItemDiscount = lineTotalBeforeDiscounts - item_discount_amount;

      const tax_percent = dbItem.tax || 0;
      const item_tax_amount = (lineTotalAfterItemDiscount * tax_percent) / 100;

      const final_line_price = lineTotalAfterItemDiscount + item_tax_amount;

      processedItems.push({
        ...dbItem,
        item_id: item.item_id,
        quantity,
        unit_price,
        discount_percent,
        tax_percent,
        item_discount_amount,
        item_tax_amount,
        final_line_price,
      });

      invoice_subtotal += lineTotalBeforeDiscounts;
      total_item_discount += item_discount_amount;
      total_tax_amount += item_tax_amount;
    }

    // 2. Calculate final invoice totals
    const flat_discount_amount = parseFloat(flat_discount) || 0;
    const total_after_all_discounts = invoice_subtotal - total_item_discount - flat_discount_amount;
    const final_total_amount = Math.max(0, total_after_all_discounts + total_tax_amount);

    const balance_amount = final_total_amount - paid_amount;
    const payment_status = paid_amount >= final_total_amount ? "PAID" : "PARTIAL";

    const invoice_number = await generateInvoiceNumber();

    // 3. Insert the main invoice record
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices (
        invoice_number, invoice_date, subtotal, tax_amount, discount_amount, 
        total_amount, payment_method, notes, created_by
      ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_number,
        invoice_subtotal,
        total_tax_amount,
        flat_discount_amount,
        final_total_amount,
        payment_method,
        notes || '',
        created_by
      ]
    );

    const invoice_id = invoiceResult.insertId;

    // 4. Insert each processed item into the invoiceitems table
    for (const pItem of processedItems) {
      // CORRECTED QUERY: Removed generated columns from the INSERT statement
      await connection.query(
        `INSERT INTO invoiceitems (
          invoice_id, item_id, item_name, item_code, barcode, category_name, quantity, 
          unit_price, discount_percent, tax_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoice_id,
          pItem.item_id,
          pItem.item_name,
          pItem.item_code,
          pItem.barcode,
          pItem.category_name,
          pItem.quantity,
          pItem.unit_price,
          pItem.discount_percent,
          pItem.tax_percent
          // The values for discount_amount, tax_amount, and total_price are removed
        ]
      );

      // 5. Update inventory if the item is a stock item
      if (pItem.is_stock_item) {
        const [updateResult] = await connection.query(
          `UPDATE inventory 
           SET quantity = quantity - ?, last_updated = NOW()
           WHERE item_code = ? AND quantity - ? >= 0`,
          [pItem.quantity, pItem.item_code, pItem.quantity]
        );
        
        if (updateResult.affectedRows === 0) {
          throw new Error(`Insufficient stock for item: ${pItem.item_name}.`);
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      invoice_id,
      invoice_number,
      total_amount: final_total_amount,
      balance_amount,
      payment_status
    });

  } catch (err) {
    await connection.rollback();
    console.error("Create sale error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
/**
 * Get Sales History
 * (No changes needed here)
 */
export const getSalesHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT id, invoice_number, total_amount, payment_method, created_at
       FROM invoices
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );

    const [[count]] = await db.query(
      "SELECT COUNT(*) AS total FROM invoices"
    );

    res.json({
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count.total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get Invoice By ID
 * Updated to use the correct 'invoiceitems' table name.
 */
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoice] = await db.query(
      "SELECT * FROM invoices WHERE id = ?",
      [id]
    );

    if (invoice.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Corrected table name from 'invoicesitems' to 'invoiceitems'
    const [items] = await db.query(
      "SELECT * FROM invoiceitems WHERE invoice_id = ?",
      [id]
    );

    res.json({ invoice: invoice[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Today Sales Total
 * (No changes needed here)
 */
export const getTodaySales = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT SUM(total_amount) AS today_total
       FROM invoices
       WHERE DATE(created_at) = CURDATE()`
    );

    res.json({ today_total: Number(rows[0].today_total) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ----------------------------------------
 * GET SALES SUMMARY (for Dashboard)
 * ----------------------------------------
 * (No changes needed here, but updated query for clarity)
 */
export const getSalesSummary = async (req, res) => {
  try {
    // Get today's sales and transaction count
    const [todayResult] = await db.query(
      `SELECT 
         SUM(total_amount) AS today_sales,
         COUNT(id) AS today_transactions
       FROM invoices
       WHERE DATE(created_at) = CURDATE()`
    );

    // Get the total number of products in the 'items' table
    const [productsResult] = await db.query(
      `SELECT COUNT(*) AS total_products FROM items WHERE status = 'active'`
    );
    
    // Get the number of low stock items
    // This assumes an 'inventory' table with 'quantity' and 'reorder_level' columns
    const [lowStockResult] = await db.query(
      `SELECT COUNT(*) AS low_stock_items 
       FROM inventory 
       WHERE quantity <= reorder_level`
    );

    const summary = {
      today_sales: Number(todayResult[0].today_sales) || 0,
      today_transactions: todayResult[0].today_transactions || 0,
      total_products: productsResult[0].total_products || 0,
      low_stock_items: lowStockResult[0].low_stock_items || 0,
    };

    res.json(summary);

  } catch (err) {
    console.error("Error fetching sales summary:", err);
    res.status(500).json({ message: "Failed to fetch sales summary", error: err.message });
  }
};