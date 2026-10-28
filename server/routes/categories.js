const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, admin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try { res.json(await Category.find({})); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', protect, admin, async (req, res) => {
  try {
    const exists = await Category.findOne({ name: req.body.name });
    if (exists) return res.status(400).json({ message: 'Category already exists' });
    res.status(201).json(await Category.create({ name: req.body.name }));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const c = await Category.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    if (!c) return res.status(404).json({ message: 'Category not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const c = await Category.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
