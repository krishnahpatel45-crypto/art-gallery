const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, sort, search } = req.query;
    let query = {};
    if (category && category !== 'All') query.category = category;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { desc: { $regex: search, $options: 'i' } }
    ];
    let products = Product.find(query);
    if (sort === 'new') products = products.sort({ createdAt: -1 });
    else if (sort === 'low') products = products.sort({ price: 1 });
    else if (sort === 'high') products = products.sort({ price: -1 });
    else products = products.sort({ featured: -1, createdAt: -1 });
    res.json(await products);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Product not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', protect, admin, async (req, res) => {
  try {
    const created = await new Product(req.body).save();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ message: 'Product not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const hasPurchased = await Order.exists({ user: req.user._id, 'items.product': product._id });
    if (!hasPurchased) return res.status(403).json({ message: 'Purchase to review' });
    product.reviews.push({
      user: req.user._id, author: req.user.name,
      text: req.body.text, rating: req.body.rating || 5, photo: req.body.photo
    });
    await product.save();
    res.status(201).json(product.reviews);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/reviews/:reviewId', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const review = product.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    review.isHidden = !review.isHidden;
    await product.save();
    res.json(product.reviews);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id/reviews/:reviewId', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    product.reviews.pull(req.params.reviewId);
    await product.save();
    res.json(product.reviews);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
