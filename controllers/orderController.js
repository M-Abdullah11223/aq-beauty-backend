const Order = require('../models/Order');
const Product = require('../models/Product');

// 1. Create a new order and automatically deduct stock
const createOrder = async (req, res) => {
  try {
    const { userId, customerName, email, phone, city, address, items, totalAmount, paymentMethod } = req.body;

    if (!customerName || !email || !phone || !city || !address || !items || items.length === 0 || totalAmount === undefined) {
      return res.status(400).json({ error: 'Please provide all required order fields and items.' });
    }

    // Loop through each item in the order and decrement its stock in the database
    for (const item of items) {
      const prodId = item.productId || item._id;
      const orderedQty = Number(item.quantity) || 1;

      if (prodId) {
        const product = await Product.findById(prodId);
        if (product) {
          // Subtract stock, but ensure it never drops below 0
          product.stock = Math.max(0, product.stock - orderedQty);
          await product.save();
        }
      }
    }

    // Create and save the new order
    const newOrder = new Order({
      userId: userId || null,
      customerName,
      email,
      phone,
      city,
      address,
      items,
      totalAmount,
      status: 'Pending',
      paymentMethod: paymentMethod || 'Cash on Delivery'
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Server error while creating order', message: error.message });
  }
};

// 2. Fetch all orders (for Admin portal)
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Server error while fetching orders' });
  }
};

// 3. Update order status (Processing, Shipped, Delivered, Cancelled)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Server error while updating order status' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus
};