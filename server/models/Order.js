const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: String, price: Number, size: String, qty: Number, photo: String
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  items: [orderItemSchema],
  subtotal: Number,
  total: Number,
  address: { name: String, phone: String, line1: String, city: String, state: String, pincode: String, label: String },
  payment: { type: String, enum: ['COD', 'ONLINE', 'WHATSAPP'], default: 'COD' },
  razorpayPaymentId: String,
  status: { type: String, enum: ['Pending Approval','Placed','Packed','Shipped','Delivered','Cancelled','Rejected'], default: 'Pending Approval' },
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
