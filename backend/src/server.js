const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); 

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');

const webhookRoutes = require('./routes/webhook.routes');
const metricsRoutes = require('./routes/metrics.routes');
const queueService = require('./services/queue');
const logger = require('./services/logger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Setup Socket.io with CORS enabled for dashboard
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize logger with Socket.io instance
logger.initSocket(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/metrics', metricsRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'guardai-backend', timestamp: new Date().toISOString() });
});

// Socket connection listener
io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    
    // Emit initial snapshot of metrics and recent events
    socket.emit('metrics_update', logger.calculateMetrics());
    socket.emit('initial_events', logger.getEvents(20));

    socket.on('disconnect', () => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🛡️  GuardAI Backend running on port ${PORT}`);
    console.log(`=========================================\n`);
    
    queueService.startWorker();
});