const express = require('express');
const router = express.Router();

// Import ALL logic from our controller
const { 
  getProducts, 
  createProduct, 
  getProductById,
  updateProduct, 
  deleteProduct 
} = require('../controllers/productController');

// GET request to /api/products
router.get('/', getProducts);

// POST request to /api/products
router.post('/', createProduct);

// GET request to /api/products/:id (Fetch a single product)
router.get('/:id', getProductById);

// PUT (Update) request to /api/products/:id
router.put('/:id', updateProduct);

// DELETE request to /api/products/:id
router.delete('/:id', deleteProduct);

module.exports = router;