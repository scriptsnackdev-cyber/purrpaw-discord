const { Events } = require('discord.js');
const supabase = require('../../supabaseClient');
const { getChatAI } = require('../../utils/openRouter');
const { searchGif } = require('../../utils/tenor');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 1. กรองข้อความที่ไม่ต้องการ (บอทตัวเอง, ข้อความว่าง, หรือ DM)
        if (message.author.bot || !message.guild || !message.content) return;

        // ── ดึงข้อมูล Guild Settings และ Features ──
        const { data: guildData } = await supabase.from('guilds').select('features, settings').eq('id', message.guild.id).single();
        const features = guildData?.features || {};
        const settings = guildData?.settings || {};

        // ── ตรวจสอบระบบ TTS ──
        const ttsManager = message.client.ttsManager;
        const currentTTSChannel = ttsManager.ttsChannels.get(message.guild.id);
        
        console.log(`[TTS-Debug] New Message in ${message.channelId}. Active TTS Channel: ${currentTTSChannel}`);

        if (currentTTSChannel === message.channel.id) {
            console.log(`[TTS-Debug] Match! Processing message: ${message.content}`);
            // ไม่พูดข้อความที่เป็นคำสั่ง "/"
            if (!message.content.startsWith('/')) {
                await ttsManager.speak(message.guild.id, message.content);
            }
        }

        /* ── ⚡ ปิดใช้งานระบบสะสมคะแนนเลเวลชั่วคราวเมี๊ยว (Leveling Disabled) ──
        if (features.leveling !== false) {
            const xpMultiplier = 100;
            // ... (โค้ดถูกคอมเมนต์ไว้)
        }
        */

        // 2. ดึงข้อมูลว่าห้องนี้มี AI ตัวไหนสิงอยู่
        const [activeResult] = await Promise.all([
            supabase.from('active_ai_chats').select('character_id, memory_limit').eq('channel_id', message.channelId)
        ]);

        const activeChats = activeResult.data;
        const guildSettings = settings; // ใช้ settings ที่ดึงมาแล้วด้านบน
        if (!activeChats || activeChats.length === 0) return; 

        // 3. ดึงข้อมูล "การแนะนำตัว" ของผู้ใช้คนนี้ (ถ้ามี)
        let introContext = "";
        const introChId = guildSettings.ai_chat?.intro_channel_id;
        if (introChId) {
            try {
                const introCh = await message.guild.channels.fetch(introChId).catch(() => null);
                if (introCh && introCh.isTextBased()) {
                    const intros = await introCh.messages.fetch({ limit: 100 });
                    const userIntro = intros.find(m => m.author.id === message.author.id && m.content.length > 5);
                    if (userIntro) {
                        introContext = `\n**ข้อมูลประวัติ/แนะนำตัวของผู้ใช้คนนี้:**\n${userIntro.content}\n(คุณควรจดจำชื่อหรือสิ่งที่เขาบอกไว้ในแชทนี้ด้วยเมี๊ยว!)`;
                    }
                }
            } catch (e) { console.error('Intro scan error:', e); }
        }

        // 4. วนลูปให้ AI ทุกตัวในห้องตอบ (หรือจะเลือกตัวแรกก็ได้)
        for (const chat of activeChats) {
            try {
                // ดึงดีเทลตัวละคร
                const { data: char } = await supabase.from('ai_characters').select('*').eq('id', chat.character_id).single();
                if (!char) continue;

                // 5. ดึงความจำ (Memory)
                const limit = chat.memory_limit || 10;
                const history = await message.channel.messages.fetch({ limit: limit + 1 });
                
                // แปลงประวัติแชทให้เป็น Format ที่ AI เข้าใจ ([เวลา] ชื่อ: ข้อความ)
                const messagesForAI = [
                    { 
                        role: 'system', 
                        content: `คุณคือ ${char.name} ผู้มีบุคลิกดังนี้: ${char.persona}
นี่คือบทสนทนาใน Discord ห้องแชท สมาชิกคุยกันในรูปแบบ [เวลา] ชื่อ : ข้อความ
คุณต้องตอบโต้ด้วยบุคลิกนี้เสมอ และหาวิธีเรียกชื่อผู้ใช้ให้ดูเป็นธรรมชาติเมี๊ยว!

**คำแนะนำพิเศษ (Vision):**
หากผู้ใช้ส่งรูปภาพหรือ GIF มา ลิงก์รูปภาพเหล่านั้นจะถูกแนบไปกับข้อความ ให้คุณ "วิเคราะห์" สิ่งที่เห็นและตอบกลับให้ตรงบรรยากาศด้วยเมี๊ยว!

**คำแนะนำพิเศษ (GIF):**
หากคุณต้องการแสดงท่าทางหรืออารมณ์ด้วย GIF ให้ใส่แท็ก [GIF: คำค้นหาสี้นๆ ภาษาอังกฤษ] ไว้ท้ายข้อความ และบอทจะหา Gif มาแสดงให้เองเมี๊ยว!${introContext}` 
                    }
                ];

                // ย้อนกลับประวัติ (จากเก่าไปใหม่)
                const historyData = Array.from(history.values())
                    .slice(1) // ตัดข้อความล่าสุดตัวเองออก
                    .reverse()
                    .map(m => {
                        const time = m.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                        const name = m.author.displayName || m.author.username;
                        // สำหรับประวัติเก่า เราจะส่งแค่ Text เพื่อประหยัด Token (เว้นแต่คุณจะให้ส่งรูปย้อนหลังด้วย)
                        return {
                            role: m.author.id === message.client.user.id ? 'assistant' : 'user',
                            content: `[${time}] ${name} : ${m.content}`
                        };
                    });
                
                messagesForAI.push(...historyData);
                
                // ใส่ข้อความปัจจุบันของผู้ใช้ (พร้อมรูปภาพ Vision)
                const currentTime = message.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                const userName = message.author.displayName || message.author.username;
                const userContent = [{ type: 'text', text: `[${currentTime}] ${userName} : ${message.content}` }];

                // ดึงรูปภาพ/GIF จาก Attachments
                if (message.attachments.size > 0) {
                    message.attachments.forEach(att => {
                        if (att.contentType?.startsWith('image/') || att.contentType?.startsWith('video/')) {
                            userContent.push({ type: 'image_url', image_url: { url: att.url } });
                        }
                    });
                }

                messagesForAI.push({ role: 'user', content: userContent });

                // 6. เรียก AI จริง!
                await message.channel.sendTyping();
                let aiResponse = await getChatAI(messagesForAI);

                // 7. จัดการค้นหา GIF (ถ้า AI ขอมา)
                let gifUrl = null;
                const gifMatch = aiResponse.match(/\[GIF:\s*(.+?)\]/);
                if (gifMatch) {
                    const query = gifMatch[1];
                    gifUrl = await searchGif(query);
                    // ลบแท็ก [GIF: ...] ออกจากข้อความ AI
                    aiResponse = aiResponse.replace(/\[GIF:\s*(.+?)\]/g, '').trim();
                }

                // 8. จัดการ Webhook
                let webhook;
                const webhooks = await message.channel.fetchWebhooks();
                webhook = webhooks.find(wh => wh.name === 'PurrPaw-AI');
                if (!webhook) {
                    webhook = await message.channel.createWebhook({ name: 'PurrPaw-AI', reason: 'AI Persona Chat' });
                }

                await webhook.send({
                    content: gifUrl ? `${aiResponse}\n${gifUrl}` : aiResponse,
                    username: char.name,
                    avatarURL: char.image_url || null
                });

            } catch (err) {
                console.error('Real AI Error:', err);
            }
        }
    }
};
