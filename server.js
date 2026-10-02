const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // 🔥 Security Headers
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const nodemailer = require('nodemailer'); // 🔥 Added Nodemailer

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

/// --- ORDER ROUTES ---
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, customerName, email, phone, city, address, items, totalAmount, status, paymentMethod } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain items' });
    }

    // 🔥 AUTOMATIC STOCK DEDUCTION LOGIC (FIXED)
    for (const item of items) {
      const prodId = item.productId || item._id;
      const orderedQty = Number(item.quantity) || 1;

      if (prodId) {
        const product = await Product.findById(prodId);
        if (product) {
          const newStock = Math.max(0, product.stock - orderedQty);
          // Use findByIdAndUpdate to bypass the pre-save hook that causes the "next is not a function" error
          await Product.findByIdAndUpdate(prodId, { stock: newStock });
        }
      }
    }

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

// 🔥 POST: Support API (Task 5.1)
app.post('/api/support', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // 1. Validate Input Server-Side
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: name, email, subject, and message are required.' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 2. Configure Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_PORT === '465', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 3. Email to AQ Beauty Admin
    const mailOptionsAdmin = {
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: process.env.SUPPORT_RECEIVER_EMAIL || 'orakzaiabdul70@gmail.com',
      subject: `[Support Ticket] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0f172a;">New Support Request</h2>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    };

    // 4. Send the email to the admin
    await transporter.sendMail(mailOptionsAdmin);

    // 5. Send an automated confirmation back to the customer
    const mailOptionsCustomer = {
      from: `"AQ Beauty Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Received: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f4f9f8; text-align: center;">
          <h2 style="color: #111; font-family: serif; font-size: 24px; margin-bottom: 10px;">AQ Beauty</h2>
          <p style="color: #666; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 30px;">Concierge Services</p>
          <p style="color: #333; text-align: left; font-size: 15px; line-height: 1.6;">Dear ${name},</p>
          <p style="color: #333; text-align: left; font-size: 15px; line-height: 1.6;">Thank you for reaching out to AQ Beauty. We have received your message regarding <strong>"${subject}"</strong>.</p>
          <p style="color: #333; text-align: left; font-size: 15px; line-height: 1.6;">Our concierge team is reviewing your inquiry and will respond to this email within 24 hours.</p>
          <p style="color: #333; text-align: left; font-size: 15px; line-height: 1.6; margin-top: 30px;">Warm regards,<br><strong>The AQ Beauty Team</strong></p>
        </div>
      `
    };
    await transporter.sendMail(mailOptionsCustomer);

    res.status(200).json({ success: true, message: 'Support request submitted successfully.' });

  } catch (error) {
    console.error('Error handling support request:', error);
    res.status(500).json({ success: false, error: 'An internal server error occurred while sending the message.' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});