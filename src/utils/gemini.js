const axios = require('axios');

/**
 * Gemini AI Utility (OpenAI-Compatible Endpoint)
 */

async function getFortuneAI(prompt, userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.FORTUNE_MODEL || process.env.GEMINI_FORTUNE_MODEL || 'gemini-1.5-flash';

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
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
        console.error('Gemini AI Error (Fortune):', error.response?.data || error.message);
        throw error;
    }
}

/**
 * General Chat AI with Memory support
 */
async function getChatAI(messages, signal = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.AICHAT_MODEL || process.env.GEMINI_AICHAT_MODEL || 'gemini-1.5-flash';

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                model: model,
                messages: messages,
                temperature: 0.8
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json'
                },
                timeout: 45000,
                signal: signal
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
            return null;
        }
        const errorDetail = error.response?.data?.error?.message || error.response?.data || error.message;
        console.error(`[Gemini] Chat AI Error (${model}):`, errorDetail);
        
        if (error.response?.status === 429) {
            return "🐾 *แงงง คนใช้เยอะมากจนแมวตอบไม่ทันแล้วเมี๊ยววว* (Gemini Rate Limit)";
        }
        return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (Gemini Error)";
    }
}

/**
 * ตรวจสอบว่าควรตอบโต้หรือไม่ และใครควรเป็นคนตอบ
 */
async function checkShouldRespondAI(recentHistory, botNames, userNames, signal = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.PRECHECK_MODEL || process.env.GEMINI_PRECHECK_MODEL || 'gemini-1.5-flash';

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
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
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
        const regex = /<persona\s+name\s*=\s*"([^"]+)"\s*>\s*Yes\s*<\/persona>/gi;
        let match;
        while ((match = regex.exec(content)) !== null) {
            activeBots.push(match[1].trim());
        }

        return activeBots.length > 0 ? activeBots : null;
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') return null;
        console.error(`[Gemini] Pre-check Error:`, error.response?.data || error.message);
        return null; 
    }
}

async function getInitialAI(userPrompt, guildName = "Unknown Server") {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.INITIAL_MODEL || process.env.GEMINI_INITIAL_MODEL || 'gemini-1.5-flash';

    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ... (เนื้อหาถูกย่อเพื่อความรวดเร็วเมี๊ยว🐾)`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `ชื่อเซิฟเวอร์ปัจจุบัน: "${guildName}"\nสิ่งที่ต้องการ: "${userPrompt}"` }
                ],
                temperature: 0.5
            },
            { 
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 60000 
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Gemini Initial AI Error:', error.response?.data || error.message);
        throw new Error("ไม่สามารถติดต่อ Gemini เพื่อออกแบบเซิฟเวอร์ได้เมี๊ยว...");
    }
}

async function getRoleButtonAI(userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.ROLE_MODEL || process.env.GEMINI_ROLE_MODEL || 'gemini-1.5-flash';

    const systemPrompt = `คุณคือผู้ช่วยออกแบบระบบ Role ใน Discord...`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `หัวข้อ: ${userPrompt}` }
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
        console.error('Gemini Role AI Error:', error.message);
        throw new Error("ไม่สามารถติดต่อ Gemini เพื่อออกแบบยศได้เมี๊ยว...");
    }
}

async function getSummaryAI(chatBlock) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.SUMMARY_MODEL || process.env.GEMINI_SUMMARY_MODEL || 'gemini-1.5-flash';

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวสรุปความฉลาดปราดเปรื่อง 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. สรุปเหตุการณ์ที่เกิดขึ้นว่าใครทำอะไร ที่ไหน อย่างไร
3. สรุปเป็นข้อๆ ให้เข้าใจง่าย สั้นกระชับ
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `บันทึกการคุยดังนี้:\n${chatBlock}` }
                ],
                temperature: 0.5
            },
            { 
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Gemini Summary AI Error:', error.message);
        throw new Error("งื้อออ ผมสรุปให้ไม่ได้เมี๊ยว...");
    }
}

async function getTranslateAI(chatBlock) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.SUMMARY_MODEL || process.env.GEMINI_SUMMARY_MODEL || 'gemini-1.5-flash';

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวนักแปลภาษาผู้รอบรู้ 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. แปลบทสนทนานั้นให้เป็นภาษาไทย (หากเป็นภาษาไทยอยู่แล้ว ให้ขัดเกลาให้สละสลวยขึ้น)
3. คงรูปแบบ "User: Message" เอาไว้เพื่อให้รู้ว่าใครพูดอะไร
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)
5. สรุปใจความสำคัญสั้นๆ ทิ้งท้ายหากบทสนทนายาวเกินไปเมี๊ยว!`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `บทสนทนาที่ต้องการแปล:\n${chatBlock}` }
                ],
                temperature: 0.5
            },
            { 
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Gemini Translate AI Error:', error.message);
        throw new Error("งื้อออ ผมแปลให้ไม่ได้เมี๊ยว...");
    }
}

module.exports = { 
    getFortuneAI, 
    getChatAI, 
    checkShouldRespondAI, 
    getInitialAI, 
    getRoleButtonAI, 
    getSummaryAI,
    getTranslateAI
};
