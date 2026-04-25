const axios = require('axios');

/**
 * OpenRouter AI Utility for Fortune
 */
async function getFortuneAI(prompt, userMessage) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

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
 */
async function getChatAI(messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_CHAT_MODEL || 'google/gemini-2.0-flash-exp:free';

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
                timeout: 45000 // เพิ่มเวลาให้แชทนิดหน่อยเมี๊ยว🐾 45 วินาที 
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Chat AI Error:', error.response?.data || error.message);
        return "🐾 *แมวตัวนั้นดูเหมือนจะหลับปุ๋ยไปแล้วเมี๊ยว...* (OpenRouter Error)";
    }
}

async function getInitialAI(userPrompt, guildName = "Unknown Server") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_INITIAL_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือสถาปนิกออกแบบ Discord Server มืออาชีพ
ภารกิจของคุณคือรับความต้องการจากผู้ใช้และชื่อเซิฟเวอร์ปัจจุบัน เพื่อออกแบบโครงสร้างเซิฟเวอร์ที่สมบูรณ์แบบ (Channels, Categories, Roles) ที่เข้ากับชื่อและธีม
- **ความละเอียดของเซิฟเวอร์:** ให้คุณออกแบบให้มีจำนวนห้องแชทและห้องเสียงรวมกันประมาณ 10-15 ห้องขึ้นไป เพื่อให้เซิฟเวอร์ดูเป็นทางการและมีพื้นที่ครอบคลุม


ข้อกำหนดเรื่องภาษา:
- ให้ใช้ "ภาษาเดียวกับที่ผู้ใช้สั่งงาน" (เช่น สั่งภาษาไทย ให้ตอบชื่อห้องและยศเป็นภาษาไทย)

ข้อกำหนดเรื่อง "ชื่อยศ" (Roles):
- ให้ตั้งชื่อยศให้น่ารักและเข้ากับ "ธีมเซิฟเวอร์" และ "ชื่อเซิฟเวอร์" (เช่น ถ้าชื่อ PurrPaw ให้ใช้ธีมแมว เช่น "แอดมินทาสแมว", "ผู้ดูแลกรงแมว", "ลูกแมวฝึกหัด")
- แบ่งระดับสิทธิ์ (Permissions) ให้ถูกต้องและปลอดภัย:
  *   Admin (เจ้าของ/ผู้ดูแลสูงสุด): ใช้สิทธิ์ "Administrator"
  *   Moderator (คนดูแล): ใช้สิทธิ์ "ManageChannels", "ManageRoles", "ManageMessages", "MuteMembers"
  *   Member (สมาชิกทั่วไป): ใช้สิทธิ์ "SendMessages", "ViewChannel", "Connect", "Speak"
- ใส่สี (Color) ให้เข้ากับธีม (สีพาสเทลหรือโทนที่ AI คิดว่าสวย)
- **ระบบคัดกรองคน (Verify System):** ให้เลือก 1 ยศสำหรับสมาชิกปกติที่ยืนยันแล้ว และใส่แฟล็ก "is_member_role": true ให้ยศนั้น


ข้อกำหนดเรื่อง "การตั้งชื่อ" (Naming Convention):
- ในฟิลด์ "name" **ต้องเป็นข้อความเปล่าๆ เท่านั้น** (ห้ามใส่อีโมจิ, ห้ามใส่ขีด (-), ห้ามใส่สัญลักษณ์ตกแต่งอื่นๆ โดยเด็ดขาด!)
- ตัวอย่าง: ให้ใส่เพียง "ประกาศ" แทนที่จะเป็น "📢---ประกาศ"
- อีโมจิให้แยกไปใส่ในฟิลด์ "emoji" โดยเฉพาะเมี๊ยว!
- บอทจะนำ "name" ไปประกอบร่างกับ "emoji" เป็นรูปแบบ \`─── ꒰ EMOJI ꒱ NAME ───\` หรือ \`[ EMOJI ] NAME\` ให้เองอัตโนมัติ

ข้อกำหนดเรื่อง "ระบบคัดกรองคน":
- ให้เลือก 1 ห้องเป็นห้องยืนยันตัวตน (เช่น ห้องกฎ) และใส่แฟล็ก "is_verify_channel": true ให้ห้องนั้น


ข้อกำหนดเรื่อง "ข้อความแรก" และ "การร่างเนื้อหา" (First Message & Content):
- สำหรับห้องแชท (Text Channels) ให้ AI ออกแบบ "ข้อความแรก" ที่เหมาะสม
- **สำหรับห้องกฎระเบียบ (is_verify_channel):** ให้เขียนกฎแบบละเอียด (แบ่งเป็นข้อๆ ยาวๆ) มีหัวข้อชัดเจน และคำเตือนเรื่องการรักษาสังคมที่ดี (Professional & Detailed)
- **สำหรับ welcome_message:** ให้เขียนข้อความต้อนรับที่ยาวและดูอบอุ่น มีการอธิบายเบื้องต้น และเชิญชวนทำภารกิจต่างๆ (เช่น อ่านกฎที่ห้อง...)
- ใช้สไตล์การเขียนที่น่ารักในธีม PurrPaw (แมว) แต่ยังคงความเป็นระเบียบและเป็นทางการในตัวเนื้อหา


ข้อกำหนดผลลัพธ์:
ตอบกลับมาเป็น JSON เปล่าๆ เท่านั้น (ไม่มี Markdown, ไม่มีคำอธิบาย) ตามรูปแบบนี้:
{
  "roles": [
    { "name": "ยศเริ่มต้น", "color": "#808080", "permissions": [], "is_unverified_role": true },
    { "name": "ยศสมาชิก", "color": "#FFB6C1", "permissions": ["SendMessages", "ViewChannel"], "is_member_role": true }
  ],
  "welcome_message": "ข้อความต้อนรับ...",
  "goodbye_message": "ข้อความบอกลา...",
  "sub_role_sections": [
    {
      "title": "ชื่อหัวข้อ (เช่น 🎮 เลือกความสนใจ)",
      "description": "คำอธิบายหัวข้อยสย่อยกลุ่มนี้ (เช่น เลือกประเภทเกมที่คุณชอบ)",
      "roles": [
        { "name": "ชื่อยศย่อย", "color": "#FFFFFF", "emoji": "🎮" }
      ]
    }
  ],
  "categories": [
    {
      "name": "หมวดหมู่...",
      "emoji": "📁",
      "channels": [
        { 
          "name": "รับยศย่อย", 
          "emoji": "🎭",
          "type": "GUILD_TEXT", 
          "is_subrole_channel": true 
        }
      ]
    }
  ]
}

หมายเหตุ: 
- **ข้อกำหนดบังคับ (Mandatory):** ทุกๆ โครงสร้างเซิฟเวอร์ที่สร้างขึ้น **ต้องมี** หมวดหมู่เริ่มต้น (เช่น 👋 การต้อนรับ) และ **ต้องมี** ห้องต้อนรับ (\`is_welcome_channel\`: true) กับห้องบอกลา (\`is_goodbye_channel\`: true) และฟิลด์ \`welcome_message\`, \`goodbye_message\` เสมอ! ห้ามขาดเด็ดขาด!
- "welcome_message": ใช้เป็นข้อความที่จะส่งตอนสมาชิกเข้าใหม่ (คุณสามารถใช้ \$\{User\} เพื่อแทนชื่อผู้ใช้)
- "goodbye_message": ใช้เป็นข้อความที่จะส่งตอนสมาชิกออกจากเซิฟเวอร์ (คุณสามารถใช้ \$\{User\} เพื่อแทนชื่อผู้ใช้)
- "is_subrole_channel": ห้องที่ใช้สำหรับรับยศย่อย บอทจะส่งข้อความแยกตามแต่ละกลุ่ม (Section) พร้อมปุ่มกดรับยศ
- permissions สำหรับ roles ให้เลือกระหว่าง: "Administrator", "ManageChannels", "ManageRoles", "SendMessages", "ViewChannel", "Connect" เป็นต้น (ตาม Discord.js PermissionFlagsBits)
- ห้ามใส่สัญลักษณ์ตกแต่งในฟิลด์ "name" บอทจะจัดการเอง
- อย่าใส่ข้อความอื่นเด็ดขาดนอกจาก JSON`;

    const userContext = `ชื่อเซิฟเวอร์ปัจจุบัน: "${guildName}"\nสิ่งที่ต้องการ: "${userPrompt}"`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContext }
                ],
                temperature: 0.5
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/purrpaw',
                    'X-Title': 'PurrPaw Discord Bot'
                },
                timeout: 60000 // โหมดออกแบบให้ 60 วินาทีเลยเมี๊ยว🐾 
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
    const model = process.env.OPENROUTER_INITIAL_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือผู้ช่วยออกแบบระบบ Role ใน Discord
ภารกิจของคุณคือรับหัวข้อจากผู้ใช้ และออกแบบกลุ่มของ Role (ยศ) ที่เหมาะสม พร้อมเนื้อหาสำหรับ Embed

ข้อกำหนดผลลัพธ์:
ตอบกลับมาเป็น JSON เปล่าๆ เท่านั้น ตามรูปแบบนี้:
{
  "title": "ชื่อหัวข้อ (เช่น 🎮 เลือกความสนใจ)",
  "description": "คำอธิบายกลุ่มยศนี้ยาวๆ ให้น่าดึงดูด",
  "roles": [
    { "name": "ชื่อยศ", "emoji": "อีโมจิ", "color": "#000000" }
  ]
}
หมายเหตุ:
- ให้สร้างมาประมาณ 3-5 ยศที่เข้ากับหัวข้อที่ได้รับ
- ใช้สไตล์การเขียนที่น่ารักในธีม PurrPaw (แมว)
- อย่าใส่ข้อความอื่นเด็ดขาดนอกจาก JSON`;

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
    const model = process.env.OPENROUTER_INITIAL_MODEL || 'google/gemini-2.0-flash-exp:free';

    const systemPrompt = `คุณคือ "PurrPaw" บอทแมวสรุปความฉลาดปราดเปรื่อง
ภารกิจของคุณคือรับบันทึกการพูดคุย (Chat Logs) และสรุปประเด็นสำคัญที่เกิดขึ้นให้กระชับ เข้าใจง่าย และน่ารัก

ข้อกำหนดการสรุป:
- สรุปแยกเป็นข้อๆ (Bullet points)
- ใช้สไตล์การเขียนที่น่ารักในธีมแมว (มีเมี๊ยวๆ ลงท้าย)
- ถ้าไม่มีเนื้อหาสำคัญ ให้บอกว่า "ไม่มีอะไรน่าตื่นเต้นเลยเมี๊ยว พักผ่อนกันต่อเถอะ!"
- อย่าใส่ข้อความที่ไม่เกี่ยวข้อง`;

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

module.exports = { getFortuneAI, getChatAI, getInitialAI, getRoleButtonAI, getSummaryAI };

