const cache = require('./redis.client');
const kippsApi = require('../adapters/kipps');
const guardrail = require('./guardrail');

const QUEUE_KEY = 'escalation_queue';
const DLQ_KEY = 'dead_letter_queue';
const MAX_RETRIES = 3;

/**
 * Pushes an approved escalation into the Redis queue for asynchronous processing.
 */
async function enqueueEscalation(userId, payload) {
    const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        payload,
        status: 'pending',
        attempts: 0,
        queuedAt: new Date().toISOString()
    };

    // If we had the real ioredis client we would use LPUSH. 
    // Since we built a generic cache wrapper for hackathon safety, we'll maintain the list as a serialized JSON array.
    // (In production, use Redis Lists natively for atomicity).
    
    let queue = JSON.parse(await cache.get(QUEUE_KEY) || '[]');
    queue.push(job);
    await cache.set(QUEUE_KEY, JSON.stringify(queue));

    console.log(`[QUEUE] Job ${job.id} enqueued for ${userId}`);
    return job;
}

/**
 * Moves a job that has exhausted retries into the Dead Letter Queue.
 */
async function moveToDeadLetter(job, reason) {
    job.failedReason = reason;
    job.failedAt = new Date().toISOString();
    job.status = 'dead_letter';

    let dlq = JSON.parse(await cache.get(DLQ_KEY) || '[]');
    dlq.push(job);
    await cache.set(DLQ_KEY, JSON.stringify(dlq));

    console.error(`[QUEUE] 🚨 Job ${job.id} moved to Dead Letter Queue. Reason: ${reason}`);
}

/**
 * The Worker process that runs periodically to process pending jobs.
 */
async function processQueue() {
    // 1. Don't process the queue if it's currently quiet hours!
    if (guardrail.isQuietHoursInIndia()) {
        // Silently return, the queue will process when the window opens.
        return;
    }

    let queue = JSON.parse(await cache.get(QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    // Pop the oldest job (FIFO)
    const job = queue.shift();
    await cache.set(QUEUE_KEY, JSON.stringify(queue)); // update queue immediately

    console.log(`[WORKER] Processing job ${job.id} for ${job.userId} (Attempt ${job.attempts + 1})`);
    
    try {
        job.attempts += 1;
        
        // Double-check compliance right before executing (defense in depth)
        const compliance = await guardrail.checkCompliance(job.userId);
        
        if (!compliance.allowed) {
            throw new Error(`Compliance blocked at execution: ${compliance.reason}`);
        }

        // Trigger the actual call
        const callRes = await kippsApi.triggerVoiceCall(job.userId, job.payload);
        await guardrail.logOutboundAttempt(job.userId);
        
        console.log(`[WORKER] ✅ Job ${job.id} completed. Call ID: ${callRes.callId}`);

    } catch (error) {
        console.error(`[WORKER] ❌ Job ${job.id} failed: ${error.message}`);
        
        if (job.attempts >= MAX_RETRIES) {
            await moveToDeadLetter(job, error.message);
        } else {
            // Put it back in the queue for a retry
            let currentQueue = JSON.parse(await cache.get(QUEUE_KEY) || '[]');
            currentQueue.push(job);
            await cache.set(QUEUE_KEY, JSON.stringify(currentQueue));
            console.log(`[WORKER] Job ${job.id} requeued for attempt ${job.attempts + 1}`);
        }
    }
}

// Start a background worker polling the queue every 5 seconds
// (In production, use BullMQ/Bee-Queue, but for a hackathon demo, a simple setInterval proves the architectural concept without heavy dependencies)
let workerInterval;
function startWorker() {
    console.log(`[WORKER] Starting background queue processor...`);
    workerInterval = setInterval(processQueue, 5000);
}

module.exports = {
    enqueueEscalation,
    startWorker
};