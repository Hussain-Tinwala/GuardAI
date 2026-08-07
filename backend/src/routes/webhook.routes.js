const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');
const decisionEngine = require('../services/decision.engine');
const guardrail = require('../services/guardrail');

// Quick endpoint to toggle DND for demo purposes
router.post('/dnd/toggle', async (req, res) => {
    const { userId, isDND } = req.body;
    await guardrail.setDND(userId, isDND);
    res.json({ success: true, userId, dndStatus: isDND });
});

router.post('/kipps-chat', async (req, res) => {
    try {
        const chatEvent = req.body;
        const userId = chatEvent.userId || 'unknown_user';
        console.log(`\n[WEBHOOK] --- New Chat Event: ${userId} ---`);

        // 1. Context Extraction
        const context = {
            userId: userId,
            retryCount: chatEvent.metadata?.retryCount || 0,
            sentimentScore: chatEvent.metadata?.sentimentScore || 0.5,
            botConfidence: chatEvent.metadata?.botConfidence || 0.9,
            isUrgentTopic: chatEvent.metadata?.isUrgentTopic || false,
            transcript: chatEvent.transcript || ''
        };

        // 2. Decision Engine (Does this need human help?)
        const decision = await decisionEngine.evaluateEscalation(context);
        console.log(`[DECISION] Action: ${decision.action} | Reason: ${decision.reason}`);

        if (decision.action === 'ESCALATE') {
            
            // 3. The Guardrail (Is it legal/compliant to call them now?)
            console.log(`[GUARDRAIL] Evaluating compliance for ${userId}...`);
            const complianceCheck = await guardrail.checkCompliance(userId);
            
            console.log(`[GUARDRAIL] Status: ${complianceCheck.status} | Reason: ${complianceCheck.reason}`);

            if (complianceCheck.allowed) {
                // Execute Call
                console.log(`[PIPELINE] Escalation approved & compliant. Triggering call...`);
                const callRes = await kippsApi.triggerVoiceCall(userId, {
                    reason: decision.reason,
                    priority: decision.priorityScore
                });
                
                // Log that we attempted a call to enforce frequency caps
                await guardrail.logOutboundAttempt(userId);
                
                console.log(`[PIPELINE] Call queued successfully. ID: ${callRes.callId}`);
            } else {
                // Blocked or Queued by Guardrail
                console.log(`[PIPELINE] Escalation halted by Guardrail.`);
                // If status is QUEUED_FOR_WINDOW, we would push to our Redis Priority Queue here (Phase 4)
            }

            return res.status(200).json({
                success: true,
                decision: decision.action,
                compliance: complianceCheck.status,
                message: complianceCheck.reason
            });

        } else {
            // RESOLVED or NEEDS_RETRY
            return res.status(200).json({
                success: true,
                decision: decision.action,
                message: decision.reason
            });
        }

    } catch (error) {
        console.error('[WEBHOOK] Error processing event:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;