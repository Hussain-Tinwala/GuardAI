const path = require('path');
// Load environment variables from the root monorepo folder
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); 

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const webhookRoutes = require('./routes/webhook.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Request logging

// Routes
app.use('/api/webhooks', webhookRoutes);

// Health check (Phase 9 deployment requirement)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'guardai-backend', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🛡️  GuardAI Backend running on port ${PORT}`);
    console.log(`=========================================\n`);
});