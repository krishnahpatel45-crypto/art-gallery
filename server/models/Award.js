const mongoose = require('mongoose');
const awardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: String, by: String, details: String, photos: [String],
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Award', awardSchema);
