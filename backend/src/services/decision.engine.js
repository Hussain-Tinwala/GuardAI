const llmClassifier = require('./llm.classifier');

// Thresholds for deterministic routing
const THRESHOLDS = {
    MAX_RETRIES: 2,
    SEVERE_SENTIMENT: -0.6, // scale of -1 (angry) to 1 (happy)
    LOW_BOT_CONFIDENCE: 0.4 // scale of 0 to 1
};

/**
 * Evaluates the chat context to determine the next action.
 * Language-agnostic: Relies entirely on system metadata and scoring.
 * 
 * @param {Object} context 
 * @param {number} context.retryCount - How many times the bot failed to resolve this session
 * @param {number} context.sentimentScore - NLP sentiment score (-1 to 1)
 * @param {number} context.botConfidence - Chat bot's confidence in its own last answer
 * @param {boolean} context.isUrgentTopic - Tagged by NLP (e.g., "fraud", "payment_failed")
 * @param {string} context.transcript - Full chat history (for LLM if needed)
 * 
 * @returns {Object} { action: 'RESOLVED' | 'NEEDS_RETRY' | 'ESCALATE', priorityScore: number, reason: string }
 */
async function evaluateEscalation(context) {
    const { retryCount, sentimentScore, botConfidence, isUrgentTopic, transcript } = context;
    
    let priorityScore = 0;
    
    // 1. HARD ESCALATION RULES (Immediate Human Handoff)
    if (isUrgentTopic) {
        return { action: 'ESCALATE', priorityScore: 100, reason: 'Topic flagged as urgent/critical' };
    }
    
    if (retryCount >= THRESHOLDS.MAX_RETRIES) {
        return { action: 'ESCALATE', priorityScore: 90, reason: `Max retries (${retryCount}) reached` };
    }

    if (sentimentScore <= THRESHOLDS.SEVERE_SENTIMENT) {
        return { action: 'ESCALATE', priorityScore: 85, reason: `Severe negative sentiment (${sentimentScore})` };
    }

    // 2. BOT RETRY LOGIC (Let the Chat Agent try again)
    if (botConfidence < THRESHOLDS.LOW_BOT_CONFIDENCE && retryCount < THRESHOLDS.MAX_RETRIES) {
        // If bot is unsure, but the user isn't furious and we haven't maxed retries, let it try one more time.
        // Or if it's borderline, consult the LLM.
        if (sentimentScore < 0 && sentimentScore > THRESHOLDS.SEVERE_SENTIMENT) {
            const llmResult = await llmClassifier.analyzeBorderlineIntent(transcript);
            if (llmResult.suggestedAction === 'ESCALATE') {
                return { action: 'ESCALATE', priorityScore: 75, reason: `LLM Override: ${llmResult.reason}` };
            }
        }
        return { action: 'NEEDS_RETRY', priorityScore: 20, reason: 'Low bot confidence, attempting retry' };
    }

    // 3. DEFAULT (Resolved or normal flow)
    return { action: 'RESOLVED', priorityScore: 0, reason: 'Standard resolution flow' };
}

module.exports = {
    evaluateEscalation,
    THRESHOLDS
};