const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');
const decisionEngine = require('../services/decision.engine');
const guardrail = require('../services/guardrail');
const queueService = require('../services/queue');

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

        const context = {
            userId: userId,
            retryCount: chatEvent.metadata?.retryCount || 0,
            sentimentScore: chatEvent.metadata?.sentimentScore || 0.5,
            botConfidence: chatEvent.metadata?.botConfidence || 0.9,
            isUrgentTopic: chatEvent.metadata?.isUrgentTopic || false,
            transcript: chatEvent.transcript || ''
        };

        const decision = await decisionEngine.evaluateEscalation(context);
        console.log(`[DECISION] Action: ${decision.action} | Reason: ${decision.reason}`);

        if (decision.action === 'ESCALATE') {
            
            console.log(`[GUARDRAIL] Evaluating compliance for ${userId}...`);
            const complianceCheck = await guardrail.checkCompliance(userId);
            console.log(`[GUARDRAIL] Status: ${complianceCheck.status} | Reason: ${complianceCheck.reason}`);

            if (complianceCheck.allowed) {
                // Immediate Execution
                console.log(`[PIPELINE] Escalation approved. Triggering call...`);
                const callRes = await kippsApi.triggerVoiceCall(userId, { reason: decision.reason });
                await guardrail.logOutboundAttempt(userId);
                console.log(`[PIPELINE] Call queued successfully. ID: ${callRes.callId}`);
                
            } else if (complianceCheck.status === 'QUEUED_FOR_WINDOW') {
                // It's quiet hours, put it in the queue for the morning!
                console.log(`[PIPELINE] Quiet hours detected. Enqueuing for the next compliant window.`);
                await queueService.enqueueEscalation(userId, { reason: decision.reason });
                
            } else {
                // Blocked due to DND or Frequency Capping (drop it entirely)
                console.log(`[PIPELINE] Escalation permanently halted by Guardrail.`);
            }

            return res.status(200).json({
                success: true,
                decision: decision.action,
                compliance: complianceCheck.status,
                message: complianceCheck.reason
            });

        } else {
            return res.status(200).json({ success: true, decision: decision.action, message: decision.reason });
        }

    } catch (error) {
        console.error('[WEBHOOK] Error processing event:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;