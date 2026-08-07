// Stub for the real Kipps APIs (to be filled during hackathon build week)
const KIPPS_BASE_URL = process.env.KIPPS_API_BASE_URL || 'https://api.kipps.ai/v1';
const API_KEY = process.env.KIPPS_API_KEY;

// ⚠️ ASSUMPTION FLAG: We assume Kipps uses standard Bearer token auth and JSON bodies.
// We will update these fetch calls once official API specs are released.

async function sendChatMessage(userId, message) {
    console.log(`[REAL KIPPS STUB] sendChatMessage to ${userId}`);
    // return fetch(`${KIPPS_BASE_URL}/chat/send`, { ... })
    return { status: 'pending_implementation' };
}

async function triggerVoiceCall(userId, contextData) {
    console.log(`[REAL KIPPS STUB] triggerVoiceCall to ${userId}`);
    // return fetch(`${KIPPS_BASE_URL}/voice/trigger`, { ... })
    return { status: 'pending_implementation' };
}

async function getCallStatus(callId) {
    console.log(`[REAL KIPPS STUB] getCallStatus for ${callId}`);
    // return fetch(`${KIPPS_BASE_URL}/voice/status/${callId}`, { ... })
    return { status: 'pending_implementation' };
}

module.exports = {
    sendChatMessage,
    triggerVoiceCall,
    getCallStatus
};