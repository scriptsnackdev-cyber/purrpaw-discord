const axios = require('axios');



/**
 * OpenRouter AI Utility for Fortune
 */
async function getFortuneAI(prompt, userMessage) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_FORTUNE_MODEL || 'google/gemini-2.0-flash-exp:free';

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7
            },
            { 
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000 
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('OpenRouter AI Error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * General Chat AI with Memory support
 * @param {Array} messages - Array of {role: 'system'|'user'|'assistant', content: string}
 * @param {AbortSignal} signal - Optional abort signal
 */
async function getChatAI(messages, signal = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_AICHAT_MODEL || 'google/gemini-2.0-flash-exp:free';

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: messages,
                temperature: 0.8
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/purrpaw',
                    'X-Title': 'PurrPaw Discord Bot'
                },
                timeout: 45000,
                signal: signal
            }
        );
        const aiResponse = response.data.choices[0].message.content;
        


        return aiResponse;
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
            return null;
        }
        console.error('Chat AI Error:', error.response?.data || error.message);
        return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (OpenRouter Error)";
    }
}

/**
 * ตรวจสอบว่าควรตอบโต้หรือไม่ และใครควรเป็นคนตอบเมี๊ยว🐾
 * @returns {Promise<string[]|null>} รายชื่อบอทที่ควรตอบ หรือ null ถ้าไม่ควรตอบเลย
 */
async function checkShouldRespondAI(recentHistory, botNames, userNames, signal = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_PRECHECK_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `You are a conversation analyzer for a multi-persona AI chat system.
Your task is to determine which AI characters (if any) should respond to the latest conversation context.

Available AI Characters: [${botNames}]
Users in conversation: [${userNames}]

Instruction:
1. Analyze the chat history to see if any AI characters are being addressed, mentioned, or if their persona would naturally intervene.
2. For EACH AI character listed above, output a <persona> tag indicating "Yes" or "No".
3. If no AI should respond, set all to "No".

Output Format:
<persona name="Alan">No</persona>
<persona name="Belle">Yes</persona>

Respond ONLY with the XML tags. No thinking, no explanation.`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Chat History:\n${recentHistory}` }
                ],
                temperature: 0.1
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json'
                },
                timeout: 15000,
                signal: signal
            }
        );

        const content = response.data.choices[0].message.content;
        


        const activeBots = [];
        
        // ค้นหา <persona name="Name">Yes</persona> (รองรับช่องว่างเผื่อ AI ใส่มาเมี๊ยว🐾)
        const regex = /<persona\s+name\s*=\s*"([^"]+)"\s*>\s*Yes\s*<\/persona>/gi;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const botName = match[1].trim();
            activeBots.push(botName);
        }

        return activeBots.length > 0 ? activeBots : null;
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') return null;
        console.error('CheckShouldRespond Error:', error.message);
        return null; 
    }
}

async function getInitialAI(userPrompt, guildName = "Unknown Server") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_INITIAL_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ... (เนื้อหาถูกย่อเพื่อความรวดเร็วเมี๊ยว🐾)`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `ชื่อเซิฟเวอร์ปัจจุบัน: "${guildName}"\nสิ่งที่ต้องการ: "${userPrompt}"` }
                ],
                temperature: 0.5
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json'
                },
                timeout: 60000 
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Initial AI Error:', error.response?.data || error.message);
        throw new Error("ไม่สามารถติดต่อ AI เพื่อออกแบบเซิฟเวอร์ได้เมี๊ยว...");
    }
}

async function getRoleButtonAI(userPrompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_ROLE_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือผู้ช่วยออกแบบระบบ Role ใน Discord...`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `หัวข้อ: ${userPrompt}` }
                ],
                temperature: 0.7
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Role AI Error:', error.message);
        throw new Error("ไม่สามารถติดต่อ AI เพื่อออกแบบยศได้เมี๊ยว...");
    }
}

async function getSummaryAI(chatBlock) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_SUMMARY_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวสรุปความฉลาดปราดเปรื่อง...`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `บันทึกการคุยดังนี้:\n${chatBlock}` }
                ],
                temperature: 0.5
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Summary AI Error:', error.message);
        throw new Error("งื้อออ ผมสรุปให้ไม่ได้เมี๊ยว...");
    }
}

module.exports = { 
    getFortuneAI, 
    getChatAI, 
    checkShouldRespondAI, 
    getInitialAI, 
    getRoleButtonAI, 
    getSummaryAI 
};