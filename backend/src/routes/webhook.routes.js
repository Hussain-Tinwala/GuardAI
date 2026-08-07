const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');
const decisionEngine = require('../services/decision.engine');

// Webhook receiver for Kipps Chat Agent events
router.post('/kipps-chat', async (req, res) => {
    try {
        const chatEvent = req.body;
        console.log('\n[WEBHOOK] Received chat event for user:', chatEvent.userId);

        // 1. Extract metadata from the incoming chat event
        // In reality, Kipps would send this. We default safely if missing.
        const context = {
            userId: chatEvent.userId || 'unknown_user',
            retryCount: chatEvent.metadata?.retryCount || 0,
            sentimentScore: chatEvent.metadata?.sentimentScore || 0.5,
            botConfidence: chatEvent.metadata?.botConfidence || 0.9,
            isUrgentTopic: chatEvent.metadata?.isUrgentTopic || false,
            transcript: chatEvent.transcript || ''
        };

        // 2. Run through the Decision Engine (Pipeline Stage 2)
        const decision = await decisionEngine.evaluateEscalation(context);
        console.log(`[DECISION ENGINE] Outcome: ${decision.action} | Reason: ${decision.reason}`);

        // 3. Handle the Decision
        if (decision.action === 'ESCALATE') {
            // PHASE 3 (Guardrail) will go here!
            // For now, we naively trigger the call to test the pipeline
            console.log(`[PIPELINE] Escalation approved. Triggering voice call...`);
            const callRes = await kippsApi.triggerVoiceCall(context.userId, {
                reason: decision.reason,
                priority: decision.priorityScore
            });
            console.log(`[PIPELINE] Call queued with ID: ${callRes.callId}`);
        } else if (decision.action === 'NEEDS_RETRY') {
            console.log(`[PIPELINE] Routing back to Chat Agent for retry.`);
            // In a real app, we might send a system prompt back to Kipps here
        } else {
            console.log(`[PIPELINE] Conversation marked as resolved. No action needed.`);
        }

        res.status(200).json({
            success: true,
            decision: decision.action,
            reason: decision.reason
        });

    } catch (error) {
        console.error('[WEBHOOK] Error processing event:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;