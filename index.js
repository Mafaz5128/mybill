// backend/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static images first (IMPORTANT)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/menu", require("./routes/menu"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/settings", require("./routes/settings"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
