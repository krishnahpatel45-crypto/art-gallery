const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { protect } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post('/create-order', protect, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`
    });
    res.json(order);
  } catch (e) {
    res.status(500).json({ message: 'Razorpay order creation failed' });
  }
});

module.exports = router;
