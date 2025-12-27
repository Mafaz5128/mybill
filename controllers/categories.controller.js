import db from "../db.js";

/**
 * ----------------------------------------
 * GET ACTIVE CATEGORIES
 * ----------------------------------------
 */
export const getCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, ci.image_url
       FROM categories c
       LEFT JOIN categories_images ci ON c.id = ci.category_id`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch categories",
      error: err.message
    });
  }
};

/**
 * ----------------------------------------
 * CREATE CATEGORY (AUTO CODE: CAT0001)
 * ----------------------------------------
 */
export const createCategory = async (req, res) => {
  try {
    const {
      category_name,
      description,
      default_discount,
      default_tax
    } = req.body;

    // 🔹 Validate required fields
    if (!category_name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // 🔹 Get last category code
    const [rows] = await db.query(
      `SELECT category_code
       FROM categories
       ORDER BY id DESC
       LIMIT 1`
    );

    let nextCode = "CAT0001";

    if (rows.length > 0) {
      const lastCode = rows[0].category_code; // CAT0007
      const number = parseInt(lastCode.replace("CAT", ""), 10) + 1;
      nextCode = `CAT${number.toString().padStart(4, "0")}`;
    }

    // 🔹 Insert category
    const [result] = await db.query(
      `INSERT INTO categories
       (category_code, category_name, description, default_discount, default_tax, is_active)
       VALUES (?,?,?,?,?,1)`,
      [nextCode, category_name, description || null, default_discount || 0, default_tax || 0]
    );

    res.json({
      message: "Category created successfully",
      category_id: result.insertId,
      category_code: nextCode
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to create category",
      error: err.message
    });
  }
};

/**
 * ----------------------------------------
 * UPDATE CATEGORY
 * ----------------------------------------
 */
export const updateCategory = async (req, res) => {
  try {
    const {
      category_name,
      description,
      default_discount,
      default_tax
    } = req.body;

    await db.query(
      `UPDATE categories
       SET category_name = ?,
           description = ?,
           default_discount = ?,
           default_tax = ?
       WHERE id = ?`,
      [
        category_name,
        description || null,
        default_discount || 0,
        default_tax || 0,
        req.params.id
      ]
    );

    res.json({ message: "Category updated successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update category",
      error: err.message
    });
  }
};

/**
 * ----------------------------------------
 * ENABLE / DISABLE CATEGORY (SOFT TOGGLE)
 * ----------------------------------------
 */
export const toggleCategory = async (req, res) => {
  try {
    await db.query(
      `UPDATE categories
       SET is_active = NOT is_active
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({ message: "Category status changed" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to change category status",
      error: err.message
    });
  }
};

/**
 * ----------------------------------------
 * UPLOAD CATEGORY IMAGE
 * ----------------------------------------
 */
export const uploadCategoryImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    await db.query(
      `INSERT INTO categories_images (category_id, image_url)
       VALUES (?, ?)`,
      [req.params.id, req.file.path]
    );

    res.json({ message: "Category image uploaded successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Image upload failed",
      error: err.message
    });
  }
};
