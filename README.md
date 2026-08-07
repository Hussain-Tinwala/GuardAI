# GuardAI 🛡️

**Built for the Kipps.AI Developer Hackathon — Build for New Age India (August 2026)**
*Track: Support (Sales/Marketing/Customer Support)*

## The Problem
At scale in India, naively escalating every unresolved chat to an outbound voice call is a regulatory and customer experience nightmare. Strict TRAI DND regulations, quiet-hours norms, and contact frequency limits mean blind automation creates liabilities. 

## The Solution
GuardAI is not just a chatbot connector. It is an **Enterprise Compliance & Decision Guardrail** sitting between Kipps Chat Agents and Voice Agents. It intelligently classifies resolutions and strictly gates outbound voice triggers based on customer contact frequency ledgers, ensuring compliance by design.

## Architecture Pipeline
1. **Input:** Webhook consumer for Kipps Chat events.
2. **Decision Engine:** Evaluates resolution status via rules + LLM confidence.
3. **Guardrail:** Checks Redis-backed DND, quiet-hours, and frequency ledgers.
4. **Execution:** Priority queuing, context packaging, and Kipps Voice Agent trigger.
5. **Observability:** Real-time React/Socket.io dashboard logging every pipeline transition.

## Development Setup
This is an npm workspaces monorepo.
\`\`\`bash
npm install
npm run dev:backend
\`\`\`