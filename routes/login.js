import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js"; // make sure db.js uses mysql2/promise

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    // Fetch user by username
    const [rows] = await db.execute(
      "SELECT id, username, password_hash, status FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = rows[0];

    // Check user status
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ message: "User account disabled" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Remove sensitive data
    delete user.password_hash;

    // Login success
    return res.status(200).json({
      message: "Login successful",
      user
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
