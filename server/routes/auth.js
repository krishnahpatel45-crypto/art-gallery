const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    let role = 'customer';
    if (email === process.env.OWNER_EMAIL) role = 'owner';
    else if (email === 'mod@chikhli.art') role = 'mod';
    const user = await User.create({ name, email, password, phone, role });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, phone: user.phone, token: genToken(user._id)
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ message: 'Invalid credentials' });
    res.json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, addresses: user.addresses, token: genToken(user._id)
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json(user);
});

router.put('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    if (req.body.password) user.password = req.body.password;
    const updated = await user.save();
    res.json({ _id: updated._id, name: updated.name, email: updated.email,
      role: updated.role, phone: updated.phone, token: genToken(updated._id) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) user.addresses.forEach(a => a.isDefault = false);
    user.addresses.push(req.body);
    if (!user.addresses.some(a => a.isDefault) && user.addresses.length)
      user.addresses[0].isDefault = true;
    await user.save();
    res.status(201).json(user.addresses);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/addresses/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    if (req.body.isDefault) user.addresses.forEach(a => a.isDefault = false);
    Object.assign(addr, req.body);
    await user.save();
    res.json(user.addresses);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/addresses/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.pull(req.params.id);
    if (!user.addresses.some(a => a.isDefault) && user.addresses.length)
      user.addresses[0].isDefault = true;
    await user.save();
    res.json(user.addresses);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/sync', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.cart) user.cart = req.body.cart;
    if (req.body.wishlist) user.wishlist = req.body.wishlist;
    await user.save();
    res.json({ cart: user.cart, wishlist: user.wishlist });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
