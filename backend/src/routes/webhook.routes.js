const express = require('express');
const router = express.Router();
const kippsApi = require('../adapters/kipps');
const decisionEngine = require('../services/decision.engine');
const guardrail = require('../services/guardrail');
const queueService = require('../services/queue');
const contextPackager = require('../services/context.packager');
const logger = require('../services/logger');

router.post('/dnd/toggle', async (req, res) => {
    const { userId, isDND } = req.body;
    await guardrail.setDND(userId, isDND);
    
    logger.logEvent({
        userId,
        stage: 'SYSTEM',
        status: isDND ? 'DND_ENABLED' : 'DND_DISABLED',
        metadata: { isDND }
    });

    res.json({ success: true, userId, dndStatus: isDND });
});

router.post('/kipps-chat', async (req, res) => {
    try {
        const chatEvent = req.body;
        const userId = chatEvent.userId || 'unknown_user';
        
        // Stage 1: Received
        logger.logEvent({
            userId,
            stage: 'RECEIVED',
            status: 'RECEIVED',
            metadata: { transcript: chatEvent.transcript || '', metadata: chatEvent.metadata }
        });

        const context = {
            userId: userId,
            retryCount: chatEvent.metadata?.retryCount || 0,
            sentimentScore: chatEvent.metadata?.sentimentScore || 0.5,
            botConfidence: chatEvent.metadata?.botConfidence || 0.9,
            isUrgentTopic: chatEvent.metadata?.isUrgentTopic || false,
            transcript: chatEvent.transcript || ''
        };

        // Stage 2: Decision Engine
        const decision = await decisionEngine.evaluateEscalation(context);
        
        logger.logEvent({
            userId,
            stage: 'DECISION',
            status: decision.action,
            metadata: { reason: decision.reason, priorityScore: decision.priorityScore }
        });

        if (decision.action === 'ESCALATE') {
            
            // Stage 3: Guardrail Check
            const complianceCheck = await guardrail.checkCompliance(userId);
            
            logger.logEvent({
                userId,
                stage: 'GUARDRAIL',
                status: complianceCheck.status,
                metadata: { reason: complianceCheck.reason }
            });

            // Build packaged voice context
            const voicePayload = await contextPackager.buildVoiceContext(chatEvent, decision);

            if (complianceCheck.allowed) {
                // Trigger Voice Call directly
                const callRes = await kippsApi.triggerVoiceCall(userId, voicePayload);
                await guardrail.logOutboundAttempt(userId);
                
                logger.logEvent({
                    userId,
                    stage: 'EXECUTION',
                    status: 'CALL_TRIGGERED',
                    metadata: { callId: callRes.callId, summary: voicePayload.voicePayload.userSummary }
                });

            } else if (complianceCheck.status === 'QUEUED_FOR_WINDOW') {
                // Enqueue for compliant window
                const job = await queueService.enqueueEscalation(userId, voicePayload);
                
                logger.logEvent({
                    userId,
                    stage: 'QUEUED',
                    status: 'QUEUED_FOR_WINDOW',
                    metadata: { jobId: job.id, reason: complianceCheck.reason }
                });

            } else {
                // Blocked by DND or Frequency Capping
                logger.logEvent({
                    userId,
                    stage: 'HALTED',
                    status: complianceCheck.status,
                    metadata: { reason: complianceCheck.reason }
                });
            }

            return res.status(200).json({
                success: true,
                decision: decision.action,
                compliance: complianceCheck.status,
                message: complianceCheck.reason,
                packagedContext: voicePayload.voicePayload.userSummary
            });

        } else {
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