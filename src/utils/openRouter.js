const axios = require('axios');

/**
 * OpenRouter AI Utility for Fortune
 */
async function getFortuneAI(prompt, userMessage) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.FORTUNE_MODEL || process.env.OPENROUTER_FORTUNE_MODEL || 'google/gemini-2.0-flash-exp:free';

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
 */
async function getChatAI(messages, signal = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.AICHAT_MODEL || process.env.OPENROUTER_AICHAT_MODEL || 'google/gemini-2.0-flash-exp:free';

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
        return response.data.choices[0].message.content;
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') return null;
        console.error(`[OpenRouter] Chat AI Error (${model}):`, error.response?.data || error.message);
        return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (OpenRouter Error)";
    }
}

/**
 * ตรวจสอบว่าควรตอบโต้หรือไม่
 */
async function checkShouldRespondAI(recentHistory, botNames, userNames, signal = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.PRECHECK_MODEL || process.env.OPENROUTER_PRECHECK_MODEL || 'google/gemini-2.0-flash-exp:free';
    const systemPrompt = `You are a conversation analyzer for a multi-persona AI chat system...`;

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
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000, signal: signal }
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
        return null; 
    }
}

async function getInitialAI(userPrompt, guildName = "Unknown Server") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.INITIAL_MODEL || process.env.OPENROUTER_INITIAL_MODEL || 'google/gemini-2.0-flash-exp:free';
    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ...`;

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
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        throw new Error("ไม่สามารถติดต่อ AI เพื่อออกแบบเซิฟเวอร์ได้เมี๊ยว...");
    }
}

async function getRoleButtonAI(userPrompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.ROLE_MODEL || process.env.OPENROUTER_ROLE_MODEL || 'google/gemini-2.0-flash-exp:free';
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
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        throw new Error("ไม่สามารถติดต่อ AI เพื่อออกแบบยศได้เมี๊ยว...");
    }
}

async function getSummaryAI(chatBlock) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.SUMMARY_MODEL || process.env.OPENROUTER_SUMMARY_MODEL || 'google/gemini-2.0-flash-exp:free';
    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวสรุปความฉลาดปราดเปรื่อง 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. สรุปเหตุการณ์ที่เกิดขึ้นว่าใครทำอะไร ที่ไหน อย่างไร
3. สรุปเป็นข้อๆ ให้เข้าใจง่าย สั้นกระชับ
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)`;

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
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        throw new Error("งื้อออ ผมสรุปให้ไม่ได้เมี๊ยว...");
    }
}

async function getTranslateAI(chatBlock) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.SUMMARY_MODEL || process.env.OPENROUTER_SUMMARY_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวนักแปลภาษาผู้รอบรู้ 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. แปลบทสนทนานั้นให้เป็นภาษาไทย (หากเป็นภาษาไทยอยู่แล้ว ให้ขัดเกลาให้สละสลวยขึ้น)
3. คงรูปแบบ "User: Message" เอาไว้เพื่อให้รู้ว่าใครพูดอะไร
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)
5. สรุปใจความสำคัญสั้นๆ ทิ้งท้ายหากบทสนทนายาวเกินไปเมี๊ยว!
6. ห้ามใช้เครื่องหมาย @ หรือทำการ Tag ชื่อผู้ใช้เด็ดขาด ให้ใช้ชื่อธรรมดาเท่านั้น เพื่อป้องกันการแจ้งเตือนรบกวนเมี๊ยว!`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `บทสนทนาที่ต้องการแปล:\n${chatBlock}` }
                ],
                temperature: 0.5
            },
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        throw new Error("งื้อออ ผมแปลให้ไม่ได้เมี๊ยว...");
    }
}

async function generateImageAI(prompt, referenceImageUrl = null) {
    return null;
}

async function getRelationSummaryAI(chatBlock, targetName = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.SUMMARY_MODEL || process.env.OPENROUTER_SUMMARY_MODEL || 'google/gemini-2.0-flash-exp:free';

    let focusInstruction = targetName 
        ? `วิเคราะห์ความสัมพันธ์ระหว่าง "${targetName}" กับผู้คนในแชทนี้ "ทุกคน" ที่มีการปฏิสัมพันธ์กัน (Interact) 🐾
           กรุณาสรุปแยกเป็นรายบุคคลให้ครบถ้วนทุกคนที่ปรากฏในแชทและมีการคุยกับ ${targetName} หรือถูก ${targetName} พูดถึง
           โดยระบุ:
           - ชื่อผู้ที่ปฏิสัมพันธ์
           - ลักษณะความสัมพันธ์ (สนิทกัน, แกล้งกัน, จีบกัน, ไม่ถูกกัน ฯลฯ)
           - บรรยากาศการคุยที่เกิดขึ้น
           (สรุปให้สนุกสนาน น่าติดตาม และครบทุกคนที่มีการ Interact กันจริงๆ เมี๊ยว!)`
        : `วิเคราะห์ความสัมพันธ์ภาพรวมระหว่างผู้คนในแชท (ใครสนิทกับใคร ใครชอบแกล้งใคร ใครเป็นหัวโจก ใครเป็นคนคอยห้าม)`;

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวผู้เชี่ยวชาญด้านความสัมพันธ์ 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา (มีรูปแบบ: [เวลา] ชื่อ [Reply to: ใคร]: ข้อความ)
2. ${focusInstruction}
3. สังเกตว่าใครตอบกลับใคร (Reply) และเวลาที่คุยกัน เพื่อวิเคราะห์ "จังหวะ" และ "ความใส่ใจ" ของแต่ละคน
4. สรุปออกมาเป็นหัวข้อหรือรายชื่อที่อ่านง่ายและสนุกสนาน
5. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)`;

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
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        throw new Error("งื้อออ ผมสรุปความสัมพันธ์ให้ไม่ได้เมี๊ยว...");
    }
}

module.exports = { 
    getFortuneAI, 
    getChatAI, 
    checkShouldRespondAI, 
    getInitialAI, 
    getRoleButtonAI, 
    getSummaryAI,
    getRelationSummaryAI,
    getTranslateAI,
    generateImageAI
};