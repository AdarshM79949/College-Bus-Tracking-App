const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    order: { type: Number, required: true },
  },
  { _id: true }
);

const routeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    stops: {
      type: [stopSchema],
      validate: [(v) => v.length >= 2, 'A route needs at least 2 stops'],
    },
    polyline: {
      type: [[Number]], // [[lat, lng], ...]
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);
