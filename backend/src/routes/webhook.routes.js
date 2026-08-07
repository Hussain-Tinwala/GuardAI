const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');
const decisionEngine = require('../services/decision.engine');
const guardrail = require('../services/guardrail');
const queueService = require('../services/queue');
const contextPackager = require('../services/context.packager');

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

            // NEW: Build the voice context payload
            const voicePayload = await contextPackager.buildVoiceContext(chatEvent, decision);

            if (complianceCheck.allowed) {
                console.log(`[PIPELINE] Context packaged. Triggering call...`);
                // Pass the enriched payload to the Voice Agent
                const callRes = await kippsApi.triggerVoiceCall(userId, voicePayload);
                await guardrail.logOutboundAttempt(userId);
                console.log(`[PIPELINE] Call queued successfully. ID: ${callRes.callId}`);
                
            } else if (complianceCheck.status === 'QUEUED_FOR_WINDOW') {
                console.log(`[PIPELINE] Quiet hours detected. Enqueuing with context for the morning.`);
                // Enqueue the enriched payload
                await queueService.enqueueEscalation(userId, voicePayload);
                
            } else {
                console.log(`[PIPELINE] Escalation permanently halted by Guardrail.`);
            }

            return res.status(200).json({
                success: true,
                decision: decision.action,
                compliance: complianceCheck.status,
                message: complianceCheck.reason,
                packagedContext: voicePayload.voicePayload.userSummary // sending back for demo visibility
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