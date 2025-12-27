import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import loginRoute from "./routes/login.js";
import categoryRoutes from "./routes/categories.routes.js";
import itemRoutes from "./routes/items.routes.js";
import inventoryRoute from "./routes/inventory.routes.js";
import salesRoute from "./routes/sales.routes.js";

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// ✅ Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.use("/login", loginRoute);
app.use("/api/categories", categoryRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/inventory", inventoryRoute);
app.use("/api/sales", salesRoute)

// Health check (optional but recommended)
app.get("/", (req, res) => {
  res.send("✅ POS API is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
