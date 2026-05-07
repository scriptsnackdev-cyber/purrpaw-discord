const openRouter = require('./openRouter');
const gemini = require('./gemini');
const vertexai = require('./vertexai');
const { logAI } = require('./logger');

// เลือก Provider จาก AI_PROVIDER ใน .env
const providerName = (process.env.AI_PROVIDER || 'openRouter').toLowerCase();
let selectedProvider;

if (providerName === 'gemini') {
    console.log('[AI Provider] Using Gemini API 🐾');
    selectedProvider = gemini;
} else if (providerName === 'vertex' || providerName === 'vertexai') {
    console.log('[AI Provider] Using Vertex AI 🐾');
    selectedProvider = vertexai;
} else {
    console.log('[AI Provider] Using OpenRouter API 🐾');
    selectedProvider = openRouter;
}

// สร้าง Wrapper เพื่อทำ Logging เมี๊ยว🐾
const wrappedProvider = {};
for (const key in selectedProvider) {
    if (typeof selectedProvider[key] === 'function') {
        wrappedProvider[key] = async (...args) => {
            // บันทึก Input (Raw)
            logAI(`INPUT(${key})`, args);
            
            try {
                const result = await selectedProvider[key](...args);
                // บันทึก Output (Raw)
                logAI(`OUTPUT(${key})`, result);
                return result;
            } catch (error) {
                logAI(`ERROR(${key})`, error.message);
                throw error;
            }
        };
    } else {
        wrappedProvider[key] = selectedProvider[key];
    }
}

module.exports = wrappedProvider;
