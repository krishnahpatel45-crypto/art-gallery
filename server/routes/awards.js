const express = require('express');
const router = express.Router();
const Award = require('../models/Award');
const { protect, admin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try { res.json(await Award.find({}).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/', protect, admin, async (req, res) => {
  try { res.status(201).json(await Award.create(req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const a = await Award.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ message: 'Award not found' });
    res.json({ message: 'Award removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
module.exports = router;
