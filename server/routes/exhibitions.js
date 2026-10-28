const express = require('express');
const router = express.Router();
const Exhibition = require('../models/Exhibition');
const { protect, admin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try { res.json(await Exhibition.find({}).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/', protect, admin, async (req, res) => {
  try { res.status(201).json(await Exhibition.create(req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const e = await Exhibition.findByIdAndDelete(req.params.id);
    if (!e) return res.status(404).json({ message: 'Exhibition not found' });
    res.json({ message: 'Exhibition removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
module.exports = router;
