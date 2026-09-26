const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  image: { type: String }
});

const orderSchema = new mongoose.Schema({
  // This binds the order to a customer account (null if guest)
  userId: { type: String, default: null }, 
  
  customerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  
  status: { type: String, default: 'Pending' },
  paymentMethod: { type: String, default: 'Cash on Delivery' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);