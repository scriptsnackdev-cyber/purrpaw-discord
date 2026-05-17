const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

/**
 * Vertex AI Utility (GCP)
 * ใช้ Environment Variables สำหรับการทำ Authentication เมี๊ยว🐾
 */

const googleAuthOptions = {
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }
};

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'us-central1',
    // ถ้าใช้โซน global ให้วิ่งไปที่ Endpoint กลางโดยตรงเมี๊ยว🐾
    apiEndpoint: process.env.GCP_LOCATION === 'global' ? 'aiplatform.googleapis.com' : undefined,
    googleAuthOptions
});

// แยก Instance สำหรับสร้างรูปภาพโดยเฉพาะตามที่ต้องการเมี๊ยว🐾
const imageVertexAI = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: process.env.IMAGE_GCP_LOCATION || 'us-central1',
    googleAuthOptions
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
                        const url = item.image_url?.url || item.image_url;
                        if (url) {
                            parts.push({
                                fileData: {
                                    mimeType: 'image/jpeg',
                                    fileUri: url
                                }
                            });
                        }
                    }
                });
            } else {
                parts.push({ text: msg.content });
            }

            contents.push({ role, parts });
        }
    });

    // --- 🚨 กฎเหล็กของ Gemini: ต้องเริ่ม Turn ด้วย 'user' เสมอเมี๊ยว🐾 ---
    while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
    }

    return { systemInstruction, contents };
}

async function getFortuneAI(prompt, userMessage) {
    const rawModel = process.env.FORTUNE_MODEL || process.env.VERTEX_FORTUNE_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];
    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: prompt,
        safetySettings
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
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
        safetySettings
    });

    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 วินาที

    while (retries <= maxRetries) {
        try {
            const requestOptions = { timeout: 60000 };
            const result = await model.generateContent({ contents }, requestOptions);
            return result.response.candidates[0].content.parts[0].text || "";
        } catch (error) {
            const isRateLimit = error.message?.includes('429') || error.code === 429 || error.status === 'RESOURCE_EXHAUSTED';
            
            if (isRateLimit && retries < maxRetries) {
                retries++;
                const delay = baseDelay * Math.pow(2, retries - 1);
                console.warn(`[Vertex AI] Rate limit hit (429). Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            console.error(`[Vertex AI] Chat Error (${modelName}):`, error);
            if (isRateLimit) {
                return "🐾 *แงงง คนใช้เยอะมากจนแมวตอบไม่ทันแล้วเมี๊ยววว* (Vertex Rate Limit - Resource Exhausted)";
            }
            return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (Vertex Error)";
        }
    }
}

async function checkShouldRespondAI(recentHistory, botNames, userNames, signal = null) {
    const rawModel = process.env.PRECHECK_MODEL || process.env.VERTEX_PRECHECK_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    const systemPrompt = `You are a conversation analyzer for a multi-persona AI chat system.
Your task is to analyze the provided chat history and determine which of the available AI personas should respond to the latest message.

[AVAILABLE PERSONAS]
${botNames.join(', ')}

[USER NAMES]
${userNames.join(', ')}

[RULES]
- Only select a persona if they are directly mentioned, replied to, or if the context highly suggests they should speak.
- Respond ONLY with the selected persona names in the following XML format:
<persona name="PersonaName">Yes</persona>
- If no one should respond, return an empty response.`;

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
    });

    try {
        const result = await model.generateContent(`Chat History:\n${recentHistory}`);
        const content = result.response.candidates[0].content.parts[0].text;
        
        const activeBots = [];
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
    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ...`;
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
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

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
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

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
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
5. สรุปใจความสำคัญสั้นๆ ทิ้งท้ายหากบทสนทนายาวเกินไปเมี๊ยว!
6. ห้ามใช้เครื่องหมาย @ หรือทำการ Tag ชื่อผู้ใช้เด็ดขาด ให้ใช้ชื่อธรรมดาเท่านั้น เพื่อป้องกันการแจ้งเตือนรบกวนเมี๊ยว!`;

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
    });

    try {
        const result = await model.generateContent(`บทสนทนาที่ต้องการแปล:\n${chatBlock}`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Translate AI Error:', error);
        throw new Error("งื้อออ ผมแปลให้ไม่ได้เมี๊ยว...");
    }
}

async function generateImageAI(prompt, referenceImageUrl = null) {
    const project = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.IMAGE_GCP_LOCATION || 'us-central1';
    const rawModel = process.env.AICHAT_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const modelName = cleanModelName(rawModel);

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    // ใช้ Generative Model จาก Instance ที่แยกโซนมาเฉพาะรูปภาพ (us-central1) เมี๊ยว🐾
    const model = imageVertexAI.getGenerativeModel({ 
        model: modelName,
        safetySettings
    });

    try {
        const parts = [{ text: prompt }];

        // หากมีรูปตัวละครอ้างอิง ให้ดึงมาใส่ใน Prompt ด้วยเมี๊ยว🐾
        if (referenceImageUrl) {
            try {
                const imgResp = await axios.get(referenceImageUrl, { responseType: 'arraybuffer' });
                const base64Data = Buffer.from(imgResp.data, 'binary').toString('base64');
                const mimeType = imgResp.headers['content-type'] || 'image/webp';

                parts.unshift({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
                
                // ปรับ Prompt ให้เน้นการรักษา Style และหน้าตาตัวละครให้เข้มข้นขึ้นเมี๊ยว🐾
                parts[parts.length - 1].text = `IMPORTANT: Use the provided reference image for character consistency. 
Generate a new image that EXACTLY maintains the:
1. ART STYLE: The specific drawing style, lines, and coloring technique.
2. CHARACTER APPEARANCE: Face features, hair color/style, and distinctive traits.
3. PERSONALITY: The vibe and expression of the character.

Description of the new scene: ${prompt}`;
            } catch (imgErr) {
                console.warn('[Vertex AI] Failed to fetch reference image:', imgErr.message);
            }
        }

        const generationConfig = {
            responseModalities: ["IMAGE", "TEXT"],
            // ปรับแต่งคุณภาพและขนาดตามที่โมเดล Gemini 3.1 รองรับเมี๊ยว🐾
            imageConfig: {
                aspectRatio: "1:1", // หรือ "16:9", "4:3", "3:4", "9:16"
                // imageSize: "1024x1024" // สามารถปรับตามต้องการ
            }
        };

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: parts }],
            generationConfig
        });

        const response = result.response;
        const responseParts = response.candidates[0].content.parts;
        
        // วนหา Part ที่เป็นข้อมูลรูปภาพ (inlineData)
        for (const part of responseParts) {
            if (part.inlineData) {
                return Buffer.from(part.inlineData.data, 'base64');
            }
        }
        
        console.warn('[Vertex AI] Image generation did not return image data.');
        return null;
    } catch (error) {
        console.error('[Vertex AI] Generative Image Error:', error);
        return null;
    }
}

async function getRelationSummaryAI(chatBlock, targetName = null) {
    const rawModel = process.env.SUMMARY_MODEL || process.env.VERTEX_SUMMARY_MODEL || 'gemini-1.5-flash';
    const modelName = cleanModelName(rawModel);
    
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

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
    ];

    const model = vertexAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt,
        safetySettings
    });

    try {
        const result = await model.generateContent(`บันทึกการคุยดังนี้:\n${chatBlock}`);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Vertex Relation Summary AI Error:', error);
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
