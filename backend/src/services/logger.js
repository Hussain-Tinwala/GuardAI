let ioInstance = null;

// In-memory event audit log
const eventsLog = [];

/**
 * Initializes the Socket.io instance for real-time dashboard streaming.
 */
function initSocket(io) {
    ioInstance = io;
    console.log('[OBSERVABILITY] Socket.io event bus initialized.');
}

/**
 * Emits and logs a structured state transition event in the GuardAI pipeline.
 * 
 * @param {Object} event
 * @param {string} event.userId
 * @param {string} event.stage - e.g., 'RECEIVED', 'DECISION', 'GUARDRAIL', 'QUEUED', 'EXECUTED'
 * @param {string} event.status - e.g., 'RESOLVED', 'ESCALATE', 'BLOCKED_DND', 'QUEUED_FOR_WINDOW', 'APPROVED'
 * @param {Object} event.metadata - Any additional metadata (sentiment, retryCount, reason)
 */
function logEvent({ userId, stage, status, metadata = {} }) {
    const eventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        userId,
        stage,
        status,
        metadata
    };

    eventsLog.unshift(eventRecord); // Add to beginning of audit log

    // Cap in-memory log to last 500 events to prevent memory leaks
    if (eventsLog.length > 500) {
        eventsLog.pop();
    }

    console.log(`[EVENT LOG] [${eventRecord.stage}] User: ${userId} | Status: ${status}`);

    // Broadcast to connected dashboard clients in real-time
    if (ioInstance) {
        ioInstance.emit('pipeline_event', eventRecord);
        ioInstance.emit('metrics_update', calculateMetrics());
    }

    return eventRecord;
}

/**
 * Aggregates logs to generate live dashboard statistics.
 */
function calculateMetrics() {
    const totalEvents = eventsLog.filter(e => e.stage === 'RECEIVED').length;
    
    const decisionEvents = eventsLog.filter(e => e.stage === 'DECISION');
    const escalatedCount = decisionEvents.filter(e => e.status === 'ESCALATE').length;
    const resolvedCount = decisionEvents.filter(e => e.status === 'RESOLVED').length;

    const guardrailEvents = eventsLog.filter(e => e.stage === 'GUARDRAIL');
    const blockedCount = guardrailEvents.filter(e => e.status.startsWith('BLOCKED')).length;
    const queuedCount = guardrailEvents.filter(e => e.status === 'QUEUED_FOR_WINDOW').length;
    const approvedCount = guardrailEvents.filter(e => e.status === 'APPROVED').length;

    const resolutionRate = totalEvents > 0 ? ((resolvedCount / totalEvents) * 100).toFixed(1) : "100.0";
    const escalationRate = totalEvents > 0 ? ((escalatedCount / totalEvents) * 100).toFixed(1) : "0.0";

    return {
        totalEvents,
        resolvedCount,
        escalatedCount,
        blockedCount,
        queuedCount,
        approvedCount,
        resolutionRate: parseFloat(resolutionRate),
        escalationRate: parseFloat(escalationRate)
    };
}

/**
 * Returns recent event logs for the REST API.
 */
function getEvents(limit = 50) {
    return eventsLog.slice(0, limit);
}

module.exports = {
    initSocket,
    logEvent,
    calculateMetrics,
    getEvents
};