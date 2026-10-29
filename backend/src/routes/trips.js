const express = require('express');
const Trip = require('../models/Trip');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.busId) filter.busId = req.query.busId;
    const trips = await Trip.find(filter).sort({ startedAt: -1 }).limit(100);
    res.json({ trips });
  } catch (err) { next(err); }
});

module.exports = router;
