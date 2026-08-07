const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');

// Webhook receiver for Kipps Chat Agent events
// This is the INPUT LAYER of our pipeline
// ⚠️ ASSUMPTION FLAG: Assuming the Kipps webhook payload sends a JSON body with `userId` and `action`.
router.post('/kipps-chat', async (req, res) => {
    try {
        const chatEvent = req.body;
        console.log('\n[WEBHOOK] Received chat event:', chatEvent);

        // Phase 2 will plug the Resolution Classifier here.
        // For now, we just acknowledge receipt to the webhook sender
        // and do a quick dummy test of our mock API layer.

        const mockUserId = chatEvent.userId || 'user_123';
        
        // Quick demo of the adapter abstraction
        if (chatEvent.action === 'escalate_test') {
            const callRes = await kippsApi.triggerVoiceCall(mockUserId, {
                reason: 'User requested escalation testing',
                summary: chatEvent.message || 'No summary provided'
            });
            console.log('[WEBHOOK] Triggered mock call:', callRes);
        }

        res.status(200).json({
            success: true,
            message: 'Webhook received successfully'
        });
    } catch (error) {
        console.error('[WEBHOOK] Error processing event:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;