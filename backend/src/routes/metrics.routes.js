const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// GET /api/metrics/summary - Live pipeline metrics overview
router.get('/summary', (req, res) => {
    try {
        const metrics = logger.calculateMetrics();
        res.status(200).json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/metrics/events - Historical pipeline events feed
router.get('/events', (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '50', 10);
        const events = logger.getEvents(limit);
        res.status(200).json({ success: true, count: events.length, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;