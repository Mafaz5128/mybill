const express = require("express");
const router = express.Router();
const db = require("../db"); // your mysql2/promise pool

// GET all settings
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT setting_key, setting_value, category FROM settings");
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
});

// UPDATE a setting
router.put("/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!value) return res.status(400).json({ success: false, message: "Value is required" });

  try {
    const [result] = await db.query(
      "UPDATE settings SET setting_value=? WHERE setting_key=?",
      [value, key]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Setting not found" });
    }

    res.json({ success: true, message: `Setting '${key}' updated successfully`, value });
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({ success: false, message: "Failed to update setting" });
  }
});

module.exports = router;
