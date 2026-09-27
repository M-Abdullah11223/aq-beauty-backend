const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // 🔥 Security Headers
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Bring in the security lock
const verifyAdmin = require('./middleware/adminAuth');

// Configure Cloudinary securely using your .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up Multer to hold the file temporarily in RAM (memory) instead of saving to disk
const upload = multer({ storage: multer.memoryStorage() });

// Models
const Product = require('./models/Product');
const Order = require('./models/Order');
const Admin = require('./models/Admin');

const app = express();

// 🔥 Apply Helmet for standard HTTP security headers
app.use(helmet());

// 🔥 BULLETPROOF CORS configuration: Dynamically allows your Vercel frontend, custom domains, and local testing
const allowedOrigins = [
  'http://localhost:3000',
  'https://aq-beauty-frontend.vercel.app',
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN
].filter(Boolean); // Filters out undefined/null if env vars aren't set yet

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    // Dynamically allow any vercel.app deployment URL or localhost
    if (
      allowedOrigins.indexOf(origin) !== -1 || 
      origin.endsWith('.vercel.app') || 
      process.env.NODE_ENV !== 'production'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(async () => {
    console.log('✅ MongoDB Connected Successfully');
  })
  .catch((err) => {
    console.error('❌ CRITICAL MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// --- HEALTH CHECK ROUTE (Important for Back4App / Render monitoring) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// --- ADMIN AUTH ROUTES ---
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { adminId: admin._id }, 
      process.env.JWT_SECRET || 'super_secret_aq_key_2026', 
      { expiresIn: '1d' }
    );

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// 🔥 SECURE CUSTOMER AUTHENTICATION SYSTEM ROUTES
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);


// --- PRODUCT ROUTES ---
app.get('/api/products', async (req, res) => {
  try {
    const { category, sort, page = 1, limit = 8 } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    let dbQuery = Product.find(query);

    if (sort === 'best-sellers') {
      dbQuery = dbQuery.sort({ rating: -1, createdAt: -1 });
    } else if (sort === 'sale') {
      query.isSale = true;
      dbQuery = Product.find(query).sort({ createdAt: -1 });
    } else {
      dbQuery = dbQuery.sort({ createdAt: -1 });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalProducts = await Product.countDocuments(query);
    const products = await dbQuery.skip(skip).limit(parseInt(limit));

    res.json({
      products: products || [],
      totalPages: Math.ceil(totalProducts / parseInt(limit)) || 1,
      currentPage: parseInt(page),
      totalProducts
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('Error fetching product by ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', verifyAdmin, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json({ message: 'Product created successfully!', product: savedProduct });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } 
    );
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// POST: Upload Image to Cloudinary
app.post('/api/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResponse = await cloudinary.uploader.upload(dataURI, {
      folder: 'aq-beauty',
    });

    res.status(200).json({ imageUrl: uploadResponse.secure_url });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
});

// Update Product Stock (Admin Inventory)
app.put('/api/products/:id/stock', verifyAdmin, async (req, res) => {
  try {
    const { stock } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      { stock: Number(stock) },
      { new: true }
    );
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json(updatedProduct);
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// --- ORDER ROUTES ---
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, customerName, email, phone, city, address, items, totalAmount, status, paymentMethod } = req.body;
    
    const newOrder = new Order({
      userId: userId || null, 
      customerName,
      email,
      phone,
      city,
      address,
      items,
      totalAmount,
      status: status || 'Pending',
      paymentMethod: paymentMethod || 'Cash on Delivery'
    });

    const savedOrder = await newOrder.save();
    res.status(201).json({ message: 'Order placed successfully!', order: savedOrder });
  } catch (error) {
    console.error("Order Creation Error:", error);
    res.status(500).json({ message: "Failed to create order", error: error.message });
  }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id, 
      { status: 'Cancelled' },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
    res.json(updatedOrder);
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

app.get('/api/orders', verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/my-orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

app.put('/api/orders/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id, 
      { status },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
    res.json(updatedOrder);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});