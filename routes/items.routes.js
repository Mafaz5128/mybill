// routes/itemRoutes.js

import express from 'express';
import { 
  getItems, 
  createItem, 
  updateItem, 
  toggleItem 
} from '../controllers/items.controller.js';

// 1. Import your existing upload middleware
import upload from '../middleware/upload.js'; 

const router = express.Router();

// GET /api/items - No file upload needed
router.get('/', getItems);

// POST /api/items - Create item, apply middleware for 'image_url' field
router.post('/', upload.single('image_url'), createItem);

// PUT /api/items/:id - Update item, also apply middleware
router.put('/:id', upload.single('image_url'), updateItem);

// PATCH /api/items/:id/status - Toggle status, no file upload needed
router.patch('/:id/status', toggleItem);

export default router;