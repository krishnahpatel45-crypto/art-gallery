const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect, admin } = require('../middleware/auth');

router.get('/hero', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'heroImage' });
    res.json({ heroImage: s ? s.value : '' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/hero', protect, admin, async (req, res) => {
  try {
    let s = await Settings.findOne({ key: 'heroImage' });
    if (s) { s.value = req.body.heroImage; } else { s = new Settings({ key: 'heroImage', value: req.body.heroImage }); }
    await s.save();
    res.json({ heroImage: req.body.heroImage });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
