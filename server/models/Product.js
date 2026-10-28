const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  author: String, text: String,
  rating: { type: Number, default: 5 },
  photo: String,
  isHidden: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  mrp: { type: Number, default: 0 },
  stock: { type: Number, default: 1 },
  desc: String,
  sizes: [String],
  photos: [String],
  reviews: [reviewSchema],
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
