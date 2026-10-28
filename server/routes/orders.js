const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
  const { items, address, payment, razorpayPaymentId } = req.body;
  try {
    if (!items || items.length === 0) return res.status(400).json({ message: 'No order items' });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = new Order({
      user: req.user._id, userName: req.user.name, userEmail: req.user.email,
      items, subtotal, total: subtotal, address, payment, razorpayPaymentId,
      status: 'Pending Approval'
    });
    const created = await order.save();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/pending', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({ status: 'Pending Approval' }).sort({ createdAt: 1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/approve', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending Approval')
      return res.status(400).json({ message: 'Order already processed' });
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock = Math.max(0, product.stock - item.qty);
        await product.save();
      }
    }
    order.status = 'Placed';
    await order.save();
    res.json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/reject', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending Approval')
      return res.status(400).json({ message: 'Order already processed' });
    order.status = 'Rejected';
    order.rejectionReason = req.body.reason || 'No reason provided';
    await order.save();
    res.json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = req.body.status;
    await order.save();
    res.json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
