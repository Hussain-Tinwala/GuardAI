const cache = require('./redis.client');

const COMPLIANCE_RULES = {
    MAX_CALLS_PER_24H: 2,
    // TRAI Quiet hours: 9 PM (21) to 9 AM (9) IST
    QUIET_HOUR_START: 21, 
    QUIET_HOUR_END: 9
};

/**
 * Checks if the current time in India (IST) is within TRAI restricted hours (9PM - 9AM).
 * @returns {boolean} true if it is currently quiet hours
 */
function isQuietHoursInIndia() {
    // Get current hour specifically in Asia/Kolkata timezone
    const istTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istTimeString);
    const currentHour = istDate.getHours();

    return (currentHour >= COMPLIANCE_RULES.QUIET_HOUR_START || currentHour < COMPLIANCE_RULES.QUIET_HOUR_END);
}

/**
 * The Guardrail Pipeline. 
 * Evaluates whether an outbound call to this user is legally/ethically permitted right now.
 * 
 * @param {string} userId 
 * @returns {Object} { allowed: boolean, reason: string, status: 'APPROVED' | 'BLOCKED_DND' | 'QUEUED_FOR_WINDOW' | 'BLOCKED_FREQUENCY' }
 */
async function checkCompliance(userId) {
    // 1. Check Explicit DND / Opt-Out
    const dndStatus = await cache.get(`dnd:${userId}`);
    if (dndStatus === 'true') {
        return { allowed: false, status: 'BLOCKED_DND', reason: 'User is on the Do Not Disturb (DND) registry.' };
    }

    // 2. Check Frequency Capping (No more than 2 calls in 24 hours)
    const callCount = parseInt(await cache.get(`calls_24h:${userId}`) || '0', 10);
    if (callCount >= COMPLIANCE_RULES.MAX_CALLS_PER_24H) {
        return { allowed: false, status: 'BLOCKED_FREQUENCY', reason: `Hit 24h frequency cap (${callCount} calls).` };
    }

    // 3. Check TRAI Quiet Hours
    if (isQuietHoursInIndia()) {
        return { allowed: false, status: 'QUEUED_FOR_WINDOW', reason: 'TRAI quiet hours active (9PM - 9AM IST). Queuing for morning.' };
    }

    // All clear!
    return { allowed: true, status: 'APPROVED', reason: 'Passed all compliance checks.' };
}

/**
 * Records a successful outbound attempt to enforce frequency caps.
 */
async function logOutboundAttempt(userId) {
    // Increment the call count
    const count = await cache.increment(`calls_24h:${userId}`);
    // If it's the first call, set a 24-hour TTL (86400 seconds)
    if (count === 1) {
        // We re-set it with TTL just to ensure it expires
        await cache.set(`calls_24h:${userId}`, '1', 86400); 
    }
}

// Helper to manually set DND for testing
async function setDND(userId, isDND) {
    await cache.set(`dnd:${userId}`, isDND ? 'true' : 'false');
}

module.exports = {
    checkCompliance,
    logOutboundAttempt,
    setDND,
    isQuietHoursInIndia
};