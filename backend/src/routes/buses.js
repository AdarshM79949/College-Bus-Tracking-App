const express = require('express');
const Bus = require('../models/Bus');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.routeId) filter.routeId = req.query.routeId;
    const buses = await Bus.find(filter).populate('routeId', 'name').populate('driverId', 'name email');
    res.json({ buses });
  } catch (err) { next(err); }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const b = await Bus.findById(req.params.id).populate('routeId').populate('driverId', 'name email');
    if (!b) return res.status(404).json({ message: 'Bus not found' });
    res.json({ bus: b });
  } catch (err) { next(err); }
});

router.post('/', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { busNumber, routeId, driverId } = req.body;
    if (!busNumber || !routeId) return res.status(400).json({ message: 'busNumber and routeId required' });
    const b = await Bus.create({ busNumber, routeId, driverId });
    res.status(201).json({ bus: b });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Bus number already exists' });
    next(err);
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const b = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!b) return res.status(404).json({ message: 'Bus not found' });
    res.json({ bus: b });
  } catch (err) { next(err); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const b = await Bus.findByIdAndDelete(req.params.id);
    if (!b) return res.status(404).json({ message: 'Bus not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
