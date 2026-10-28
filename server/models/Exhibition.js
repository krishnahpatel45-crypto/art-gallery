const mongoose = require('mongoose');
const exhibitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: String, venue: String,
  type: { type: String, enum: ['Upcoming', 'Past'], default: 'Upcoming' },
  details: String, photos: [String],
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Exhibition', exhibitionSchema);
