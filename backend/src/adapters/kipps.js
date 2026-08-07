const mockAdapter = require('./kipps.mock');
const realAdapter = require('./kipps.real');

// Default to mock for now since real APIs aren't available until hackathon week
const useMock = process.env.USE_MOCK_API !== 'false';

if (useMock) {
    console.log('🔌 [ADAPTER] Kipps API initialized in MOCK mode');
} else {
    console.log('📡 [ADAPTER] Kipps API initialized in REAL mode');
}

module.exports = useMock ? mockAdapter : realAdapter;