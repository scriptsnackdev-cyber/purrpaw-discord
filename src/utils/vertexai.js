const { VertexAI } = require('@google-cloud/vertexai');

/**
 * Vertex AI Utility (GCP)
 * ใช้ Environment Variables สำหรับการทำ Authentication เมี๊ยว🐾
 */

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'us-central1',
    // ถ้าใช้โซน global ให้วิ่งไปที่ Endpoint กลางโดยตรงเมี๊ยว🐾
    apiEndpoint: process.env.GCP_LOCATION === 'global' ? 'aiplatform.googleapis.com' : undefined,
    googleAuthOptions: {
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }
    }
});

// Helper สำหรับล้างชื่อโมเดลให้เข้ากับ Vertex AI (ฉลาดกว่าเดิมเมี๊ยว🐾)
function cleanModelName(name) {
    if (!name) return 'gemini-1.5-flash';
    // ตัดทุกอย่างออกให้เหลือแค่ชื่อโมเดลท้ายสุด (เช่น gemini-1.5-flash)
    const parts = name.split('/');
    let cleaned = parts[parts.length - 1];
    // ตัดพวก ':free' หรือคำสร้อยอื่นๆ ออก
    cleaned = cleaned.split(':').shift();
    return cleaned.replace(/['"]/g, '').trim();
}

// Helper สำหรับแปลง Messages (OpenAI Format) เป็น Vertex Format
function transformMessages(messages) {
    let systemInstruction = null;
    const contents = [];

    messages.forEach(msg => {
        if (msg.role === 'system') {
            systemInstruction = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        } else {
            const role = msg.role === 'assistant' ? 'model' : 'user';
            const parts = [];

            if (Array.isArray(msg.content)) {
                msg.content.forEach(item => {
                    if (item.type === 'text') {
                        parts.push({ text: item.text });
                    } else if (item.type === 'image_url') {
                        // Vertex AI SDK รองรับไฟล์ผ่าน base64 หรือ GCS
                        // สำหรับ URL ตรงๆ อาจต้อง fetch มาก่อน แต่ในที่นี้จะส่งเป็น text หรือข้ามไปก่อนเพื่อความง่าย
                        // (ในระบบ PurrPaw ส่วนใหญ่เป็น text)
                    }
                });
            } else {
                parts.push({ text: msg.content });
            }

            contents.push({ role, parts });
        }
    });

    return { systemInstruction, contents };
}

async function getFortuneAI(prompt, userMessage) {
    const rawModel = process.env.FORTUNE_MODEL || process.env.VERTEX_FORTUNE_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: prompt 
    });

    try {
        const result = await model.generateContent(userMessage);
        const response = result.response;
        return response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex AI Error (Fortune):', error);
        throw error;
    }
}

async function getChatAI(messages, signal = null) {
    const rawModel = process.env.AICHAT_MODEL || process.env.VERTEX_AICHAT_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const { systemInstruction, contents } = transformMessages(messages);
    
    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined
    });

    try {
        // ตั้งค่า Timeout ให้ยาวขึ้นเป็น 60 วินาทีเพื่อป้องกัน Headers Timeout Error เมี๊ยว🐾
        const requestOptions = { timeout: 60000 };
        const result = await model.generateContent({ contents }, requestOptions);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error(`[Vertex AI] Chat Error (${modelName}):`, error);
        if (error.message?.includes('429')) {
            return "🐾 *แงงง คนใช้เยอะมากจนแมวตอบไม่ทันแล้วเมี๊ยววว* (Vertex Rate Limit)";
        }
        return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (Vertex Error)";
    }
}

async function checkShouldRespondAI(recentHistory, botNames, userNames, signal = null) {
    const rawModel = process.env.PRECHECK_MODEL || process.env.VERTEX_PRECHECK_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
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

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });

    try {
        const result = await model.generateContent(`Chat History:\n${recentHistory}`);
        const content = result.response.candidates[0].content.parts[0].text;
        
        const activeBots = [];
        // ปรับ Regex ให้ยืดหยุ่นขึ้นเมี๊ยว🐾 (รองรับเคสเว้นวรรคเยอะๆ หรือไม่มีฟันหนู)
        const regex = /<persona\s+name\s*=\s*["']?([^"'>]+)["']?\s*>\s*Yes\s*<\/persona>/gi;
        let match;
        while ((match = regex.exec(content)) !== null) {
            activeBots.push(match[1].trim());
        }
        return activeBots.length > 0 ? activeBots : null;
    } catch (error) {
        console.error(`[Vertex AI] Pre-check Error:`, error);
        return null; 
    }
}

async function getInitialAI(userPrompt, guildName = "Unknown Server") {
    const rawModel = process.env.INITIAL_MODEL || process.env.VERTEX_INITIAL_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ... (เนื้อหาถูกย่อเพื่อความรวดเร็วเมี๊ยว🐾)`;

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });

    try {
        const result = await model.generateContent(`ชื่อเซิฟเวอร์ปัจจุบัน: "${guildName}"\nสิ่งที่ต้องการ: "${userPrompt}"`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Initial AI Error:', error);
        throw new Error("ไม่สามารถติดต่อ Vertex AI เพื่อออกแบบเซิฟเวอร์ได้เมี๊ยว...");
    }
}

async function getRoleButtonAI(userPrompt) {
    const rawModel = process.env.ROLE_MODEL || process.env.VERTEX_ROLE_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const systemPrompt = `คุณคือผู้ช่วยออกแบบระบบ Role ใน Discord...`;

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });

    try {
        const result = await model.generateContent(`หัวข้อ: ${userPrompt}`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Role AI Error:', error);
        throw new Error("ไม่สามารถติดต่อ Vertex AI เพื่อออกแบบยศได้เมี๊ยว...");
    }
}

async function getSummaryAI(chatBlock) {
    const rawModel = process.env.SUMMARY_MODEL || process.env.VERTEX_SUMMARY_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวสรุปความฉลาดปราดเปรื่อง 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. สรุปเหตุการณ์ที่เกิดขึ้นว่าใครทำอะไร ที่ไหน อย่างไร
3. สรุปเป็นข้อๆ ให้เข้าใจง่าย สั้นกระชับ
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)`;

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });

    try {
        const result = await model.generateContent(`บันทึกการคุยดังนี้:\n${chatBlock}`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Summary AI Error:', error);
        throw new Error("งื้อออ ผมสรุปให้ไม่ได้เมี๊ยว...");
    }
}

async function getTranslateAI(chatBlock) {
    const rawModel = process.env.SUMMARY_MODEL || process.env.VERTEX_SUMMARY_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวนักแปลภาษาผู้รอบรู้ 🐾
หน้าที่ของคุณคือ:
1. รับบันทึกการคุย (Chat Log) ที่ส่งมา
2. แปลบทสนทนานั้นให้เป็นภาษาไทย (หากเป็นภาษาไทยอยู่แล้ว ให้ขัดเกลาให้สละสลวยขึ้น)
3. คงรูปแบบ "User: Message" เอาไว้เพื่อให้รู้ว่าใครพูดอะไร
4. ใช้โทนเสียงที่น่ารัก เป็นกันเอง และแฝงความขี้อ้อนแบบแมว (มีเมี๊ยว🐾 ต่อท้ายได้)
5. สรุปใจความสำคัญสั้นๆ ทิ้งท้ายหากบทสนทนายาวเกินไปเมี๊ยว!`;

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });

    try {
        const result = await model.generateContent(`บทสนทนาที่ต้องการแปล:\n${chatBlock}`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Translate AI Error:', error);
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
