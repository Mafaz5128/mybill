// backend/routes/categories.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");

// ---------- Multer setup ----------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ---------- GET all ranges ----------
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM item_range ORDER BY range_id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- ADD new range (with optional image) ----------
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Range name is required" });

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await db.query(
      "INSERT INTO item_range (range_name, image_url, status) VALUES (?, ?, 1)",
      [name, image_url]
    );

    res.status(201).json({ range_id: result.insertId, range_name: name, image_url, status: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- UPDATE range (with optional image) ----------
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Range name is required" });

    if (req.file) {
      const image_url = `/uploads/${req.file.filename}`;
      await db.query("UPDATE item_range SET range_name=?, image_url=? WHERE range_id=?", [
        name,
        image_url,
        id,
      ]);
    } else {
      await db.query("UPDATE item_range SET range_name=? WHERE range_id=?", [name, id]);
    }

    res.json({ success: true, message: "Range updated!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- DELETE range (soft delete) ----------
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE item_range SET status=0 WHERE range_id=?", [id]);
    await db.query("UPDATE items SET status=0 WHERE range_id=?", [id]);
    res.json({ success: true, message: "Range deleted and items deactivated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- TOGGLE STATUS ----------
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 0 or 1
    await db.query("UPDATE item_range SET status=? WHERE range_id=?", [status, id]);

    if (status === 0) await db.query("UPDATE items SET status=0 WHERE range_id=?", [id]);

    res.json({ success: true, message: `Range ${status === 1 ? "activated" : "deactivated"}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
