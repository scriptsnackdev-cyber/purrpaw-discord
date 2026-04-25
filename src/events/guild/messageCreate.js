const { Events } = require('discord.js');
const { getGuildData } = require('../../utils/guildCache');
const supabase = require('../../supabaseClient');
const { getChatAI } = require('../../utils/openRouter');
const { searchGif } = require('../../utils/tenor');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 1. กรองข้อความที่ไม่ต้องการ (บอทตัวเอง, ข้อความว่าง+ไม่มีรูป, หรือ DM)
        if (message.author.bot || !message.guild || (!message.content && message.attachments.size === 0)) return;

        // ── ดึงข้อมูล Guild Settings และ Features จาก Cache ──
        const { features, settings } = await getGuildData(message.guild.id);

        const ttsManager = message.client.ttsManager;
        const currentTTSChannel = ttsManager.ttsChannels.get(message.guild.id);

        if (currentTTSChannel === message.channel.id) {
            // ไม่พูดข้อความที่เป็นคำสั่ง "/"
            if (!message.content.startsWith('/')) {
                await ttsManager.speak(message.guild.id, message.content);
            }
        }
 
        // ── 📝 ระบบบันทึก Log ห้องส่วนตัว (Private Room Logging) ──
        if (message.channel.name?.startsWith('🏠-')) {
            const { data: room } = await supabase.from('private_rooms')
                .select('id, chat_logs')
                .eq('channel_id', message.channel.id)
                .eq('is_deleted', false)
                .single();
            
            if (room) {
                const timeStr = message.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                const userDisplayName = message.member?.displayName || message.author.username;
                const logEntry = `[${timeStr}]-[${userDisplayName}] : ${message.content}\n`;
                
                const newLogs = (room.chat_logs || '') + logEntry;
                await supabase.from('private_rooms').update({ chat_logs: newLogs }).eq('id', room.id);
            }
        }

        // ── ⚡ ระบบสะสมคะแนนเลเวล (Leveling) ──
        if (features.leveling !== false) {
            if (!message.client.xpCooldowns) message.client.xpCooldowns = new Map();
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const lastXP = message.client.xpCooldowns.get(cooldownKey) || 0;
            const now = Date.now();

            const xpMultiplier = 100;
            const chatCharCount = message.content.length;

            if (chatCharCount > 0 && (now - lastXP > 60000)) {
                message.client.xpCooldowns.set(cooldownKey, now);
                // 1. ดึงข้อมูลเลเวลเดิมเมี๊ยว🐾
                let { data: memberLevel } = await supabase
                    .from('member_levels')
                    .select('*')
                    .eq('guild_id', message.guild.id)
                    .eq('user_id', message.author.id)
                    .single();

                const oldTotalChars = memberLevel?.total_chars || 0;
                const newTotalChars = oldTotalChars + chatCharCount;
                const oldLevel = Math.floor(Math.sqrt(oldTotalChars / xpMultiplier));
                const newLevel = Math.floor(Math.sqrt(newTotalChars / xpMultiplier));

                // 2. อัปเดตคะแนนเมี๊ยว🐾
                await supabase.from('member_levels').upsert({
                    guild_id: message.guild.id,
                    user_id: message.author.id,
                    total_chars: newTotalChars
                });

                // 3. ตรวจสอบการเลเวลอัพเมี๊ยว🐾
                if (newLevel > oldLevel && newLevel > 0) {
                    const { data: allRewards } = await supabase
                        .from('level_rewards')
                        .select('*')
                        .eq('guild_id', message.guild.id)
                        .order('level', { ascending: false });

                    const highestReward = allRewards?.find(r => r.level <= newLevel);
                    let roleName = null;
                    let newRole = null;

                    if (highestReward) {
                        newRole = message.guild.roles.cache.get(highestReward.role_id);
                        if (newRole) roleName = newRole.name;
                    }

                    const rewardRoleIds = allRewards ? allRewards.map(r => r.role_id) : [];
                    if (rewardRoleIds.length > 0) {
                        const rolesToRemove = message.member.roles.cache.filter(role => 
                            rewardRoleIds.includes(role.id) && (newRole ? role.id !== newRole.id : true)
                        );
                        if (rolesToRemove.size > 0) await message.member.roles.remove(rolesToRemove).catch(() => {});
                    }

                    if (newRole) await message.member.roles.add(newRole).catch(() => {});
                    
                    const { generateLevelUpCard } = require('../../utils/levelCard');
                    const { AttachmentBuilder } = require('discord.js');
                    
                    try {
                        const displayName = message.member?.displayName || message.author.username;
                        const avatarURL = message.member?.displayAvatarURL({ extension: 'png', size: 256 }) || message.author.displayAvatarURL({ extension: 'png', size: 256 });
                        const imageBuffer = await generateLevelUpCard(message.author, newLevel, 'Chat', roleName, displayName, avatarURL, settings.rank_background_url);
                        const attachment = new AttachmentBuilder(imageBuffer, { name: `levelup-${message.author.id}.png` });
                        
                        await message.reply({ 
                            content: `🎊 **ยินดีด้วยนะเมี๊ยววว! <@${message.author.id}> เลเวลอัพแล้ว!** 🐾✨`,
                            files: [attachment] 
                        });
                    } catch (error) {
                        console.error('Error sending level up card:', error);
                        await message.reply(`🎊 **ยินดีด้วยนะเมี๊ยววว!** คุณเลเวลอัพเป็น **Level ${newLevel}** แล้วนะเมี๊ยววว! 🐾✨`);
                    }
                }
            }
        }

        // 2. ดึงข้อมูลว่าห้องนี้มี AI ตัวไหนสิงอยู่ (ดึงเฉพาะคอลัมน์ที่ใช้เมี๊ยว🐾)
        const { data: activeChats } = await supabase
            .from('active_ai_chats')
            .select('character_id, memory_limit')
            .eq('channel_id', message.channelId);

        const guildSettings = settings; // ใช้ settings ที่ดึงมาแล้วด้านบน
        if (!activeChats || activeChats.length === 0) return;

        // 3. ดึงข้อมูล "การแนะนำตัว" ของผู้ใช้ (เน้นเจ้าของห้องถ้าเป็นห้องส่วนตัว)
        let introContext = "";
        const introChId = guildSettings.ai_chat?.intro_channel_id;
        
        // เช็คก่อนว่าเป็นห้องส่วนตัวไหมเมี๊ยว🐾 (ย้ายออกมาไว้ข้างนอกเพื่อให้จุดอื่นใช้ได้ด้วย)
        const { data: session } = await supabase.from('ai_chat_sessions').select('user_id').eq('channel_id', message.channelId).eq('is_deleted', false).single();
        const targetUserId = session ? session.user_id : message.author.id;

        if (introChId) {
            try {
                const introCh = await message.guild.channels.fetch(introChId).catch(() => null);
                if (introCh && introCh.isTextBased()) {
                    const intros = await introCh.messages.fetch({ limit: 100 });
                    const userIntro = intros.find(m => m.author.id === targetUserId && m.content.length > 5);
                    if (userIntro) {
                        const introPrefix = session ? "เจ้าของห้องส่วนตัวนี้" : "ผู้ใช้คนนี้";
                        introContext = `\n**ข้อมูลประวัติ/แนะนำตัวของ${introPrefix}:**\n${userIntro.content}\n(คุณควรจดจำชื่อหรือสิ่งที่เขาบอกไว้ในแชทนี้ด้วยเมี๊ยว!)`;
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

                // กำหนดชื่อที่จะเอาไปแทนที่ {{user}} เมี๊ยว🐾
                let targetName = "ลูกแมวเหมียว"; // ค่าเริ่มต้นสำหรับห้องรวม
                
                // เช็คอีกรอบเพื่อความชัวร์ว่าเป็นห้องส่วนตัวไหม (ใช้ตัวแปร session จากด้านบนได้เมี๊ยว)
                if (session) {
                    const targetMember = await message.guild.members.fetch(targetUserId).catch(() => null);
                    targetName = targetMember ? (targetMember.displayName || targetMember.user.username) : "คุณ";
                }

                // แทนที่ตัวแปรใน Persona เมี๊ยว🐾
                let finalPersona = char.persona ? char.persona.replace(/{{char}}/gi, char.name) : "";
                finalPersona = finalPersona.replace(/{{user}}/gi, targetName);

                // 5. ดึงความจำ (Memory)
                const limit = chat.memory_limit || 10;
                const history = await message.channel.messages.fetch({ limit: limit + 1 });

                // แปลงประวัติแชทให้เป็น Format ที่ AI เข้าใจ ([เวลา] ชื่อ: ข้อความ)
                const messagesForAI = [
                    {
                        role: 'system',
                        content: `คุณคือ ${char.name} ผู้มีบุคลิกดังนี้: ${finalPersona}
นี่คือบทสนทนาใน Discord ห้องแชท สมาชิกคุยกันในรูปแบบ [เวลา] ชื่อ : ข้อความ
คุณต้องตอบโต้ด้วยบุคลิกนี้เสมอ และหาวิธีเรียกชื่อผู้ใช้ให้ดูเป็นธรรมชาติเมี๊ยว!

**กฎเหล็กในการตอบกลับ:**
- ห้ามพิมพ์ชื่อและเวลา [เวลา] ชื่อ : นำหน้าข้อความตอบกลับของคุณเด็ดขาด! ให้พิมพ์เฉพาะเนื้อหาที่ต้องการพูดเท่านั้น เพราะบอทจะจัดการเรื่องชื่อของคุณให้เองเมี๊ยว!
- ห้ามใช้ Tag HTML เช่น <details>, <summary> เด็ดขาด! ให้ใช้ Markdown ของ Discord แทนเมี๊ยว

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
                        return {
                            role: m.author.id === message.client.user.id ? 'assistant' : 'user',
                            content: `[${time}] ${name} : ${m.content}`
                        };
                    });

                messagesForAI.push(...historyData);

                // ใส่ข้อความปัจจุบันของผู้ใช้
                const currentTime = message.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                const userName = message.author.displayName || message.author.username;
                const userContent = [{ type: 'text', text: `[${currentTime}] ${userName} : ${message.content}` }];

                if (message.attachments.size > 0) {
                    message.attachments.forEach(att => {
                        if (att.contentType?.startsWith('image/')) {
                            userContent.push({ type: 'image_url', image_url: { url: att.url } });
                        }
                    });
                }

                // สแกนหาลิงก์รูปภาพ/GIF ในเนื้อหาข้อความเมี๊ยว🐾
                const urlRegex = /(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))/gi;
                const foundUrls = message.content.match(urlRegex) || [];
                foundUrls.forEach(url => {
                    userContent.push({ type: 'image_url', image_url: { url: url } });
                });

                // สแกนหาจาก Embeds (เช่น GIF จาก Tenor/Giphy ที่ Discord แปลงให้)เมี๊ยว🐾
                if (message.embeds.length > 0) {
                    message.embeds.forEach(embed => {
                        if (embed.image?.url) {
                            userContent.push({ type: 'image_url', image_url: { url: embed.image.url } });
                        } else if (embed.thumbnail?.url) {
                            userContent.push({ type: 'image_url', image_url: { url: embed.thumbnail.url } });
                        }
                    });
                }

                messagesForAI.push({ role: 'user', content: userContent });

                // 6. เรียก AI จริง!
                await message.channel.sendTyping();
                let aiResponse = await getChatAI(messagesForAI);

                // --- Clean up: ลบ Prefix [เวลา] ชื่อ : ที่ AI อาจจะเผลอใส่มา ---
                aiResponse = aiResponse.replace(/^\[\d{2}:\d{2}\]\s*[^:]+\s*:\s*/, '').trim();

                // 7. จัดการค้นหา GIF
                let gifUrl = null;
                const gifMatch = aiResponse.match(/\[GIF:\s*(.+?)\]/);
                if (gifMatch) {
                    const query = gifMatch[1];
                    gifUrl = await searchGif(query);
                    aiResponse = aiResponse.replace(/\[GIF:\s*(.+?)\]/g, '').trim();
                }

                // 8. จัดการ Webhook (ใช้ Cache เพื่อความรวดเร็วเมี๊ยว🐾)
                if (!message.client.webhookCache) message.client.webhookCache = new Map();
                let webhook = message.client.webhookCache.get(message.channelId);

                if (!webhook) {
                    const webhooks = await message.channel.fetchWebhooks();
                    webhook = webhooks.find(wh => wh.name === 'PurrPaw-AI');
                    if (!webhook) {
                        webhook = await message.channel.createWebhook({ name: 'PurrPaw-AI', reason: 'AI Persona Chat' });
                    }
                    message.client.webhookCache.set(message.channelId, webhook);
                }

                // 9. ส่งข้อความ (รองรับการตัดแบ่งข้อความถ้าเกิน 2000 ตัวอักษร)
                const fullMessage = gifUrl ? `${aiResponse}\n${gifUrl}` : aiResponse;
                
                // ฟังก์ชันตัดแบ่งข้อความเมี๊ยว🐾
                const chunks = [];
                for (let i = 0; i < fullMessage.length; i += 2000) {
                    chunks.push(fullMessage.substring(i, i + 2000));
                }

                for (const chunk of chunks) {
                    await webhook.send({
                        content: chunk,
                        username: char.name,
                        avatarURL: char.image_url || null
                    });
                }

            } catch (err) {
                console.error('Real AI Error:', err);
            }
        }
    }
};
