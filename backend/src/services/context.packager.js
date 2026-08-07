/**
 * Context Packager
 * 
 * Transforms raw chat transcripts into structured briefing payloads 
 * for the Kipps Voice Agent.
 */

// In a real production environment, this would call an LLM (like GPT-4o-mini or Gemini) 
// to generate a concise 1-sentence summary of the transcript.
// For the hackathon, we use a fast rule-based extraction to save latency and credits.
async function extractSummary(transcript) {
    if (!transcript || transcript.trim() === '') {
        return "User escalated from chat due to unresolved issues.";
    }

    // Mock LLM Summarization: If the transcript contains keywords, formulate a summary
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.includes('payment') || lowerTranscript.includes('refund')) {
        return "User is experiencing a payment or refund-related issue.";
    }
    if (lowerTranscript.includes('login') || lowerTranscript.includes('password')) {
        return "User is locked out of their account or having login issues.";
    }
    if (lowerTranscript.includes('fraud') || lowerTranscript.includes('stolen')) {
        return "URGENT: User is reporting potential fraud or a security breach.";
    }

    // Fallback: Just take the last 50 characters of their chat as the context
    const lastUtterance = transcript.slice(-50).trim();
    return `User's last message was regarding: "...${lastUtterance}"`;
}

/**
 * Builds the complete payload to send to the Kipps Voice Agent API.
 * 
 * @param {Object} chatEvent The original incoming webhook payload
 * @param {Object} decision The decision object from the Decision Engine
 * @returns {Object} The structured Voice Agent payload
 */
async function buildVoiceContext(chatEvent, decision) {
    const summary = await extractSummary(chatEvent.transcript);

    // ⚠️ ASSUMPTION FLAG: We assume Kipps Voice API accepts an initial prompt 
    // or variables to inject into the voice AI's system prompt.
    return {
        userId: chatEvent.userId,
        escalationReason: decision.reason,
        priority: decision.priorityScore || 50,
        voicePayload: {
            agentInstructions: `You are escalating a case from the chat bot. Do not ask the user for their issue. Start by acknowledging you know about their problem. The problem is: ${summary}`,
            userSummary: summary,
            // Pass along language preferences if we had them in metadata
            preferredLanguage: chatEvent.metadata?.language || 'en-IN' 
        }
    };
}

module.exports = {
    buildVoiceContext
};