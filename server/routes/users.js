const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, owner } = require('../middleware/auth');

router.get('/mods', protect, owner, async (req, res) => {
  try { res.json(await User.find({ role: 'mod' }).select('-password')); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/mods', protect, owner, async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      if (user.role === 'owner') return res.status(400).json({ message: 'Cannot change owner' });
      user.role = 'mod';
      if (password) user.password = password;
      await user.save();
      return res.json({ message: 'Moderator updated' });
    }
    await User.create({ name: email.split('@')[0], email, password: password || 'mod123', role: 'mod' });
    res.status(201).json({ message: 'Moderator added' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/mods/:id', protect, owner, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'owner') return res.status(400).json({ message: 'Cannot change owner' });
    user.role = 'customer';
    await user.save();
    res.json({ message: 'Moderator access revoked' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/customers', protect, owner, async (req, res) => {
  try { res.json(await User.find({ role: 'customer' }).select('-password')); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
