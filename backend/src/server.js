const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); 

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const webhookRoutes = require('./routes/webhook.routes');
const queueService = require('./services/queue');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/webhooks', webhookRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'guardai-backend', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🛡️  GuardAI Backend running on port ${PORT}`);
    console.log(`=========================================\n`);
    
    // Start the background queue worker
    queueService.startWorker();
});