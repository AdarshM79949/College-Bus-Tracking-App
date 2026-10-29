const express = require('express');
const Route = require('../models/Route');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (_req, res, next) => {
  try {
    const routes = await Route.find().sort({ name: 1 });
    res.json({ routes });
  } catch (err) { next(err); }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const r = await Route.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Route not found' });
    res.json({ route: r });
  } catch (err) { next(err); }
});

router.post('/', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, stops, polyline } = req.body;
    const r = await Route.create({ name, stops, polyline: polyline || [] });
    res.status(201).json({ route: r });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Route name already exists' });
    next(err);
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const r = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!r) return res.status(404).json({ message: 'Route not found' });
    res.json({ route: r });
  } catch (err) { next(err); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const r = await Route.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: 'Route not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
