// Mock implementation of Kipps APIs
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function sendChatMessage(userId, message) {
    console.log(`[MOCK KIPPS] Sending chat to ${userId}: ${message}`);
    await delay(500);
    return { status: 'success', messageId: `msg_mock_${Date.now()}` };
}

async function triggerVoiceCall(userId, contextData) {
    console.log(`[MOCK KIPPS] Triggering voice call to ${userId} with context:`, contextData);
    await delay(800);
    // Returning a fake callId we can use to poll status later
    return { status: 'queued', callId: `call_mock_${Date.now()}` };
}

async function getCallStatus(callId) {
    await delay(300);
    // Simulate 80% success rate, 20% no-answer to test edge cases
    const status = Math.random() > 0.2 ? 'completed' : 'no_answer';
    return { callId, status, duration: Math.floor(Math.random() * 120) };
}

module.exports = {
    sendChatMessage,
    triggerVoiceCall,
    getCallStatus
};