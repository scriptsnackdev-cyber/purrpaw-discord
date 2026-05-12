const { Events } = require('discord.js');
const { getGuildData } = require('../../utils/guildCache');
const supabase = require('../../supabaseClient');
const { getChatAI, checkShouldRespondAI } = require('../../utils/aiProvider');
const { searchGif } = require('../../utils/tenor');
const globalAIQueue = require('../../utils/aiQueue');

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
            if (!message.client.privateRoomCache) message.client.privateRoomCache = new Map();
            let roomCache = message.client.privateRoomCache.get(message.channelId);
            const now = Date.now();
            let room = null;
            
            if (roomCache && (now - roomCache.timestamp < 60000)) {
                room = roomCache.data;
            } else {
                const { data } = await supabase.from('private_rooms')
                    .select('id')
                    .eq('channel_id', message.channel.id)
                    .eq('is_deleted', false)
                    .single();
                room = data;
                message.client.privateRoomCache.set(message.channelId, { data, timestamp: now });
            }

            if (room) {
                const timeStr = message.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                const userDisplayName = message.member?.displayName || message.author.username;
                const logEntry = `[${timeStr}]-[${userDisplayName}] : ${message.content}\n`;

                if (!message.client.privateRoomLogs) message.client.privateRoomLogs = new Map();
                let logBuffer = message.client.privateRoomLogs.get(room.id) || "";
                logBuffer += logEntry;
                message.client.privateRoomLogs.set(room.id, logBuffer);

                if (!message.client.privateRoomLogTimer) {
                    message.client.privateRoomLogTimer = setTimeout(() => {
                        const logsToFlush = new Map(message.client.privateRoomLogs);
                        message.client.privateRoomLogs.clear();
                        message.client.privateRoomLogTimer = null;
                        
                        for (const [rId, logs] of logsToFlush) {
                            supabase.rpc('append_private_room_log', { room_id: rId, new_log: logs }).then(({ error }) => {
                                if (error) {
                                    supabase.from('private_rooms').select('chat_logs').eq('id', rId).single().then(({ data }) => {
                                        if (data) {
                                            const updatedLogs = (data.chat_logs || '') + logs;
                                            supabase.from('private_rooms').update({ chat_logs: updatedLogs }).eq('id', rId).catch(() => { });
                                        }
                                    });
                                }
                            }).catch(() => {});
                        }
                    }, 5000);
                }
            }
        }

        // ── ⚡ ระบบสะสมคะแนนเลเวล (Leveling) ──
        if (features.leveling !== false && (!settings.ban_role_id || !message.member.roles.cache.has(settings.ban_role_id))) {
            if (!message.client.xpCooldowns) message.client.xpCooldowns = new Map();
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const lastXP = message.client.xpCooldowns.get(cooldownKey) || 0;
            const now = Date.now();

            const xpMultiplier = 100;
            const chatCharCount = message.content.length;

            if (chatCharCount > 0 && (now - lastXP > 60000)) {
                message.client.xpCooldowns.set(cooldownKey, now);
                
                // 🚀 อัปเดตแบบไม่รอ (Non-blocking) เพื่อไม่ให้ขัดจังหวะการแชทเมี๊ยว🐾
                (async () => {
                    try {
                        let { data: memberLevel } = await supabase
                            .from('member_levels')
                            .select('total_chars')
                            .eq('guild_id', message.guild.id)
                            .eq('user_id', message.author.id)
                            .single();

                        const oldTotalChars = memberLevel?.total_chars || 0;
                        const newTotalChars = oldTotalChars + chatCharCount;
                        const oldLevel = Math.floor(Math.sqrt(oldTotalChars / xpMultiplier));
                        const newLevel = Math.floor(Math.sqrt(newTotalChars / xpMultiplier));

                        await supabase.from('member_levels').upsert({
                            guild_id: message.guild.id,
                            user_id: message.author.id,
                            total_chars: newTotalChars
                        });

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

                            const rewardRoleIds = allRewards ? allRewards.map(role => role.role_id) : [];
                            if (rewardRoleIds.length > 0) {
                                const rolesToRemove = message.member.roles.cache.filter(role => 
                                    rewardRoleIds.includes(role.id) && (newRole ? role.id !== newRole.id : true)
                                );
                                if (rolesToRemove.size > 0) await message.member.roles.remove(rolesToRemove).catch(() => {});
                            }

                            if (newRole) await message.member.roles.add(newRole).catch(() => {});
                            
                            const { generateLevelUpCard } = require('../../utils/levelCard');
                            const { AttachmentBuilder } = require('discord.js');
                            
                            const displayName = message.member?.displayName || message.author.username;
                            const avatarURL = message.member?.displayAvatarURL({ extension: 'png', size: 256 }) || message.author.displayAvatarURL({ extension: 'png', size: 256 });
                            const imageBuffer = await generateLevelUpCard(message.author, newLevel, 'Chat', roleName, displayName, avatarURL, settings.rank_background_url);
                            const attachment = new AttachmentBuilder(imageBuffer, { name: `levelup-${message.author.id}.png` });
                            
                            await message.reply({ 
                                content: `🎊 **ยินดีด้วยนะ! <@${message.author.id}> เลเวลอัพแล้ว!** 🐾✨`,
                                files: [attachment] 
                            }).catch(() => {});
                        }
                    } catch (e) { console.error('Leveling error (silenced):', e); }
                })();
            }
        }

        // 2. เช็ค AI Status (มีระบบ Cache 30 วินาทีเพื่อลดโหลด DB เมี๊ยว🐾)
        if (!message.client.activeChatCache) message.client.activeChatCache = new Map();
        let activeChats = message.client.activeChatCache.get(message.channelId)?.data;
        const cacheTime = message.client.activeChatCache.get(message.channelId)?.timestamp || 0;

        if (!activeChats || (Date.now() - cacheTime > 30000)) {
            const { data } = await supabase
                .from('active_ai_chats')
                .select('character_id, memory_limit')
                .eq('channel_id', message.channelId);
            activeChats = data;
            message.client.activeChatCache.set(message.channelId, { data, timestamp: Date.now() });
        }

        if (!activeChats || activeChats.length === 0) return;

        // 3. ระบบ Debounce (หน่วงเวลา) สำหรับ AI Chat เมี๊ยว🐾
        if (!message.client.aiChatQueues) message.client.aiChatQueues = new Map();

        let queueState = message.client.aiChatQueues.get(message.channelId);
        if (!queueState) {
            queueState = {
                timer: null,
                firstMessageTime: Date.now(),
                isProcessing: false,
                hasPendingMessages: false,
                isBotMentioned: false,
                lastMessage: message
            };
            message.client.aiChatQueues.set(message.channelId, queueState);
        }
        
        // อัปเดต Context ของข้อความล่าสุดเสมอเมี๊ยว🐾
        queueState.lastMessage = message;
        
        const isMentioned = message.mentions.has(message.client.user) || message.content.includes(`<@${message.client.user.id}>`);
        if (isMentioned) {
            queueState.isBotMentioned = true;
        }

        // หากกำลังประมวลผลอยู่ ไม่ต้องยกเลิก (ยกเว้นผ่านไปนานมากจริงๆ)
        // แต่จะจดไว้ว่ามีข้อความใหม่มา เพื่อให้ประมวลผลรอบถัดไปทันทีที่จบรอบนี้เมี๊ยว🐾
        if (queueState.isProcessing) {
            queueState.hasPendingMessages = true;
            return;
        }

        const runAILogic = async () => {
            if (queueState.isProcessing) return; // ป้องกันการรันซ้อนเมี๊ยว🐾

            queueState.isProcessing = true;
            queueState.hasPendingMessages = false;
            // สร้าง AbortController ใหม่สำหรับการประมวลผลรอบนี้
            queueState.abortController = new AbortController();
            const signal = queueState.abortController.signal;

            let typingInterval = null;

            try {
                // ใช้ Context จาก Message ล่าสุดในคิวเสมอเมี๊ยว🐾
                const latestMsg = queueState.lastMessage || message;
                const { channelId, guild } = latestMsg;

                // เช็คห้องส่วนตัว (มี Cache 1 นาที)
                if (!message.client.sessionCache) message.client.sessionCache = new Map();
                let session = message.client.sessionCache.get(channelId)?.data;
                const sessionCacheTime = message.client.sessionCache.get(channelId)?.timestamp || 0;
                
                if (Date.now() - sessionCacheTime > 60000) {
                    const { data } = await supabase.from('ai_chat_sessions').select('user_id').eq('channel_id', channelId).eq('is_deleted', false).single();
                    session = data;
                    message.client.sessionCache.set(channelId, { data, timestamp: Date.now() });
                }

                const targetUserId = session ? session.user_id : latestMsg.author.id;
                
                let targetMember = null;
                if (session) {
                    targetMember = await guild.members.fetch(targetUserId).catch(() => null);
                }

                // ดึงโปรไฟล์ตัวละครทั้งหมดแบบ Batch (มี Cache 5 นาที) เมี๊ยว🐾
                const characterIds = activeChats.map(c => c.character_id);
                const characterProfiles = [];
                const idsToFetch = [];
                
                if (!message.client.aiCharCache) message.client.aiCharCache = new Map();
                
                for (const cId of characterIds) {
                    const cached = message.client.aiCharCache.get(cId);
                    if (cached && Date.now() - cached.timestamp < 300000) {
                        characterProfiles.push(cached.data);
                    } else {
                        idsToFetch.push(cId);
                    }
                }

                if (idsToFetch.length > 0) {
                    const { data: fetchedChars, error: profileError } = await supabase
                        .from('ai_characters')
                        .select('*')
                        .in('id', idsToFetch);

                    if (profileError || !fetchedChars) return;
                    
                    fetchedChars.forEach(char => {
                        message.client.aiCharCache.set(char.id, { data: char, timestamp: Date.now() });
                        characterProfiles.push(char);
                    });
                }

                if (characterProfiles.length === 0) return;

                // หา Memory Limit สูงสุด (จำกัดไม่เกิน 15 เพื่อความเร็วเมี๊ยว🐾)
                const maxMemoryLimit = Math.min(Math.max(...activeChats.map(c => c.memory_limit || 10), 10), 15);

                // 4. ดึงประวัติแชทและแยกรายชื่อผู้ใช้ (Dynamic Context)
                const history = await latestMsg.channel.messages.fetch({ limit: maxMemoryLimit });
                const historyData = Array.from(history.values()).reverse();

                // หาสมาชิกที่มีส่วนร่วมในแชทล่าสุด
                const activeUserIds = new Set();
                historyData.forEach(m => {
                    if (!m.author.bot) activeUserIds.add(m.author.id);
                });

                // --- 🚀 FAST AI MODE: SKIP PRE-CHECK 🚀 ---
                // ส่งรายชื่อตัวละครทั้งหมดไปให้ AI ตัดสินใจเองในรอบเดียวเมี๊ยว🐾
                let activeCharNames = characterProfiles.map(c => c.name);
                
                // 🚀 เริ่มแจ้ง Typing ทันทีเพื่อความลื่นไหลเมี๊ยว🐾
                await latestMsg.channel.sendTyping().catch(() => {});
                typingInterval = setInterval(() => {
                    latestMsg.channel.sendTyping().catch(() => {});
                }, 5000);
                
                // ข้ามการเรียก checkShouldRespondAI เดิม
                /* 
                if (queueState.isBotMentioned || isPrivateRoom) { ... }
                else { ... activeCharNames = await checkShouldRespondAI(...) }
                */


                // กรองเฉพาะตัวละครที่จะตอบ (ในที่นี้คือทั้งหมดในห้อง) เมี๊ยว🐾
                const filteredProfiles = characterProfiles;
                // --------------------------

                // 5. ดึงข้อมูลการแนะนำตัว (Introductions)
                let usersContextXml = "<users_context>\n";
                const introChId = settings.ai_chat?.intro_channel_id;
                const backupIntroChId = settings.ai_chat?.intro_backup_channel_id;

                const foundIntroUserIds = new Set();
                const userNamesMap = new Map();
                const userIntrosMap = new Map();

                for (const uId of activeUserIds) {
                    const uObj = message.client.users.cache.get(uId);
                    const uname = uObj ? uObj.username : uId;

                    if (uname === 'superdupermeow_') {
                        const smIntro = `⊹₊˚‧︵‿₊୨ᰔ୧₊‿︵‧˚₊⊹\nชื่อ: คุณแม่เหมียว\nเพศ: หญิง\nบทบาท: คุณแม่เหมียวในห้อง ห้ามเถียง ห้ามด่า ต้องฟังแม่ ห้ามมารักหรือชอบแม่ ไปชอบลูกแมวเหมียว\n⊹₊˚‧︵‿₊୨ᰔ୧₊‿︵‧˚₊⊹`;
                        userIntrosMap.set(uId, smIntro);
                        userNamesMap.set(uId, 'คุณแม่เหมียว');
                        foundIntroUserIds.add(uId);
                    } else {
                        userNamesMap.set(uId, uname);
                    }
                }

                const fetchIntrosFromChannel = async (channelId) => {
                    try {
                        if (!message.client.introCache) message.client.introCache = new Map();
                        const cacheKey = `${message.guild.id}-${channelId}`;
                        const cached = message.client.introCache.get(cacheKey);
                        const now = Date.now();

                        let intros;
                        let needsFetch = false;

                        if (cached && (now - cached.timestamp < 300000)) { // Cache 5 นาทีเมี๊ยว🐾
                            intros = cached.data;
                            // ⭐ ตรวจสอบว่ามีผู้ใช้ใหม่ที่ไม่ได้อยู่ใน Cache หรือไม่
                            for (const uId of activeUserIds) {
                                if (uId === 'superdupermeow_') continue;
                                const hasIntro = intros.some(m => m.author.id === uId);
                                if (!hasIntro) {
                                    needsFetch = true;
                                    break;
                                }
                            }
                        } else {
                            needsFetch = true;
                        }

                        if (needsFetch) {
                            const ch = await message.guild.channels.fetch(channelId).catch(() => null);
                            if (ch && ch.isTextBased()) {
                                intros = await ch.messages.fetch({ limit: 100 });
                                message.client.introCache.set(cacheKey, { data: intros, timestamp: now });
                                console.log(`[Intro Cache] Refreshed for channel ${channelId} (New user or TTL) 🐾`);
                            }
                        }

                        if (intros) {
                            for (const uId of activeUserIds) {
                                if (foundIntroUserIds.has(uId)) continue;

                                const userIntro = intros.find(m => m.author.id === uId && m.content.length > 5);
                                if (userIntro) {
                                    const content = userIntro.content;
                                    const nameMatch = content.match(/ชื่อ\s*:\s*([^\n]+)/);
                                    if (nameMatch) {
                                        userNamesMap.set(uId, nameMatch[1].trim());
                                    }

                                    userIntrosMap.set(uId, content);
                                    foundIntroUserIds.add(uId);
                                }
                            }
                        }
                    } catch (e) { console.error(`Intro scan error for channel ${channelId}:`, e); }
                };

                if (introChId) await fetchIntrosFromChannel(introChId);
                if (backupIntroChId && foundIntroUserIds.size < activeUserIds.size) await fetchIntrosFromChannel(backupIntroChId);

                for (const [uId, introContent] of userIntrosMap.entries()) {
                    usersContextXml += `  <user name="${userNamesMap.get(uId)}">${introContent}</user>\n`;
                }
                usersContextXml += "</users_context>";

                // 6. สร้าง XML สำหรับตัวละคร (Personas) - ส่งเฉพาะตัวที่จะตอบเพื่อประหยัด Token เมี๊ยว🐾
                let charsXml = "<characters>\n";
                filteredProfiles.forEach(char => {
                    let targetName = "ลูกแมวเหมียว";
                    if (session) {
                        targetName = targetMember ? (targetMember.displayName || targetMember.user.username) : "คุณ";
                    }
                    let finalPersona = char.persona ? char.persona.replace(/{{char}}/gi, char.name) : "";
                    finalPersona = finalPersona.replace(/{{user}}/gi, targetName);
                    charsXml += `  <persona name="${char.name}">${finalPersona}</persona>\n`;
                });
                charsXml += "</characters>";

                const activeUserNames = Array.from(userNamesMap.values()).join(", ");
                const activePersonaNames = filteredProfiles.map(c => c.name).join(", ");
                const roomStatusXml = `<room_status>\nผู้ที่กำลังอยู่ในห้องสนทนาตอนนี้:\n- ผู้ใช้ (Users): ${activeUserNames}\n- ตัวละครบอท (Personas ที่จะตอบ): ${activePersonaNames}\n</room_status>`;
                // 7. ประกอบร่าง System Prompt ด้วยโครงสร้าง XML (Design v2)
                const systemPrompt = `<instructions>
You are a role-playing AI in a multiplayer chatroom. 

[CORE RULES]
- **ALLOWED CHARACTERS:** คุณสามารถตอบได้เฉพาะตัวละครที่มีรายชื่ออยู่ในแท็ก <characters> เท่านั้น: [${activePersonaNames}] (ห้ามสวมบทบาทเป็นตัวละครอื่นเด็ดขาด)
- **IMMERSIVE PORTRAYAL:** มั่นคงในคาแรคเตอร์และอารมณ์ของตัวละครเสมอ
- **XML OUTPUT ONLY:** คุณ "ต้อง" ตอบกลับภายใต้โครงสร้าง XML ที่กำหนดให้เท่านั้น ห้ามมีข้อความนอกแท็ก
- **NO HEADERS:** ห้ามใส่ [HH:mm] หรือ ชื่อตัวละคร : ลงในบทสนทนาเด็ดขาด ระบบจะจัดการเอง

[OUTPUT STRUCTURE]
คุณต้องตอบกลับด้วยโครงสร้างดังนี้:
<turn_responses>
  <persona name="ชื่อตัวละคร">
    <thought>...วิเคราะห์สถานการณ์ เจตนาของผู้ใช้ และวางแผนการตอบสนอง...</thought>
    <dialogue>...บทสนทนาคำพูดล้วนๆ (ห้ามมีบรรยายกริยา หรือใส่หัวข้อชื่อ/เวลา)...</dialogue>
  </persona>
</turn_responses>

[MULTI-CHARACTER RULES]
- หากมีตัวละครต้องการตอบหลายตัว ให้สร้างบล็อก <persona> แยกกันภายใต้ <turn_responses> เดียวกัน
- หากตัวละครไหนพิจารณาแล้วว่า "ไม่ควรตอบ" ให้ใช้รูปแบบ: <persona name="..." action="skip"><thought>...</thought></persona>
- สนับสนุนให้ตัวละครโต้ตอบ แซว หรือเถียงกันเองได้ตามนิสัย
- ตัวละคร 1 ตัวควรพูดสั้นๆ (50-100 ตัวอักษร) เพื่อความสมจริง

[DIALOGUE STYLE]
- ใช้ภาษาพูดธรรมชาติ มีการพูดติดอ่าง หรือลังเลบ้าง (Imperfect speech)
- ห้ามใช้เครื่องหมายดอกจัน * บรรยายท่าทาง ให้ใช้คำพูดสื่อสารอารมณ์แทน
- **MENTIONS:** หากเห็นข้อความที่มี @ ตามด้วยชื่อ (เช่น @Name) นั่นคือการที่ผู้ใช้กำลังพูดถึงหรือเรียกคนอื่น ไม่ใช่เรียกคุณเสมอไป ให้พิจารณาบริบทด้วย

[IMAGE GENERATION]
- หากผู้ใช้ขอให้วาดรูป หรือคุณต้องการแสดงภาพตัวเอง/สิ่งของ/สถานการณ์ ให้เพิ่มแท็ก <image_prompt>รายละเอียดรูปภาพภาษาอังกฤษแบบละเอียด</image_prompt> "นอก" แท็ก <dialogue> (แต่อยู่ใน <persona>)
- สำคัญ: สร้างรูปภาพเฉพาะเมื่อจำเป็นจริงๆ หรือผู้ใช้สั่งเท่านั้น (นานๆ ครั้ง) อย่าสร้างบ่อยเพื่อประหยัดทรัพยากร
- **CONSISTENCY:** ใน <image_prompt> ให้บรรยายฉากหรือท่าทางที่ต้องการ โดยอ้างอิงจากลักษณะของคุณ (ใบหน้า, รูปร่าง, การแต่งกาย) และลายเส้น (Art Style) ตามรูป Profile ของคุณอย่างเคร่งครัด ระบบจะส่งรูป Profile ของคุณไปเป็นตัวอย่างให้ AI วาดรูปด้วย
- แท็ก <image_prompt> จะไม่ถูกโชว์ให้ผู้ใช้เห็น ดังนั้นไม่ต้องกังวล
- ตัวอย่าง: 
<persona name="Aria">
  <thought>...</thought>
  <dialogue>ได้เลยค่ะ เดี๋ยววาดให้ดูนะ</dialogue>
  <image_prompt>Character (Aria) wearing a chef hat, cooking in a vibrant kitchen, maintaining original art style and facial features.</image_prompt>
</persona>
</instructions>

${charsXml}

${usersContextXml}

${roomStatusXml}`;

                const messagesForAI = [{ role: 'system', content: systemPrompt }];

                // --- 🖼️ ระบบค้นหารูปภาพ 2 รูปล่าสุดในประวัติเมี๊ยว🐾 ---
                const maxHistoryImages = 2;
                let foundImagesCount = 0;
                const messageImageMap = new Map(); // index -> array of image urls

                // วนจากข้อความใหม่ไปเก่าเพื่อหา 2 รูปล่าสุด
                for (let i = historyData.length - 1; i >= 0 && foundImagesCount < maxHistoryImages; i--) {
                    const m = historyData[i];
                    const currentMsgImages = [];

                    // 1. เช็คจาก Attachments
                    m.attachments.forEach(att => {
                        if (foundImagesCount < maxHistoryImages && att.contentType?.startsWith('image/')) {
                            currentMsgImages.push(att.url);
                            foundImagesCount++;
                        }
                    });

                    // 2. เช็คจาก URLs ในข้อความ (ถ้ายังมีโควตาเหลือ)
                    if (foundImagesCount < maxHistoryImages) {
                        const urlRegex = /(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))/gi;
                        const foundUrls = (m.cleanContent || '').match(urlRegex) || [];
                        foundUrls.forEach(url => {
                            if (foundImagesCount < maxHistoryImages) {
                                currentMsgImages.push(url);
                                foundImagesCount++;
                            }
                        });
                    }

                    // 3. เช็คจาก Embeds (ถ้ายังมีโควตาเหลือ)
                    if (foundImagesCount < maxHistoryImages) {
                        m.embeds.forEach(embed => {
                            const imgUrl = embed.image?.url || embed.thumbnail?.url;
                            if (imgUrl && foundImagesCount < maxHistoryImages) {
                                currentMsgImages.push(imgUrl);
                                foundImagesCount++;
                            }
                        });
                    }

                    if (currentMsgImages.length > 0) {
                        messageImageMap.set(i, currentMsgImages);
                    }
                }

                historyData.forEach((m, index) => {
                    const time = m.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const name = userNamesMap.get(m.author.id) || m.author.username;

                    let replyAttr = "";
                    if (m.reference && m.reference.messageId) {
                        const refMsg = historyData.find(msg => msg.id === m.reference.messageId);
                        if (refMsg) {
                            const refName = userNamesMap.get(refMsg.author.id) || refMsg.author.username;
                            replyAttr = ` replying_to="${refName}"`;
                        } else if (m.mentions && m.mentions.repliedUser) {
                            const refName = userNamesMap.get(m.mentions.repliedUser.id) || m.mentions.repliedUser.username;
                            replyAttr = ` replying_to="${refName}"`;
                        }
                    }

                    const typeAttr = m.author.bot ? ' type="persona"' : '';
                    const msgContent = m.cleanContent.replace(/[<>]/g, ''); // ป้องกัน XML แตกเบื้องต้นเมี๊ยว🐾
                    const xmlMessage = `<msg from="${name}"${typeAttr}${replyAttr} time="${time}">${msgContent}</msg>`;

                    // สร้าง Content Array สำหรับ Multi-modal เมี๊ยว🐾
                    const contentArray = [{ type: 'text', text: xmlMessage }];
                    
                    // ถ้ารูปที่หาไว้ตรงกับข้อความนี้ ให้ใส่ลงไปใน context ด้วย
                    const imagesForThisMsg = messageImageMap.get(index);
                    if (imagesForThisMsg) {
                        imagesForThisMsg.forEach(url => {
                            contentArray.push({ type: 'image_url', image_url: { url: url } });
                        });
                    }

                    messagesForAI.push({
                        role: m.author.bot ? 'assistant' : 'user',
                        content: contentArray.length === 1 ? contentArray[0].text : contentArray
                    });
                });

                // 8. เรียก AI
                await message.channel.sendTyping();

                let aiResponse = await globalAIQueue.run(() => getChatAI(messagesForAI, signal));
                
                if (!aiResponse || aiResponse.includes("OpenRouter Error")) {
                    console.error(`[AI Error] AI2 (getChatAI) failed or returned error message for channel ${message.channelId}`);
                }

                // 9. แยกแยะและประมวลผล XML Responses (Design v2)
                if (!aiResponse || typeof aiResponse !== 'string') return;

                const personaRegex = /<persona\s+name=["']([^"']+)["'](?:\s+action=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/persona>/gi;
                const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/i;
                const dialogueRegex = /<dialogue>([\s\S]*?)<\/dialogue>/i;
                const imagePromptRegex = /<image_prompt>([\s\S]*?)<\/image_prompt>/i;

                let personaMatch;
                const responses = [];

                while ((personaMatch = personaRegex.exec(aiResponse)) !== null) {
                    const charName = personaMatch[1].trim();
                    const action = personaMatch[2];
                    const personaBody = personaMatch[3];

                    if (action === 'skip') continue;

                    const dialogueMatch = personaBody.match(dialogueRegex);
                    const imagePromptMatch = personaBody.match(imagePromptRegex);
                    if (dialogueMatch) {
                        responses.push({
                            name: charName,
                            message: dialogueMatch[1].trim(),
                            imagePrompt: imagePromptMatch ? imagePromptMatch[1].trim() : null
                        });
                    }
                }

                // Fallback กรณี AI หลุดฟอร์แมตเมี๊ยว🐾
                if (responses.length === 0) {
                    const legacyRegex = /<\s*(?:[a-zA-Z0-9_]+_)?response\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\s*(?:[a-zA-Z0-9_]+_)?response\s*>/gi;
                    let m;
                    while ((m = legacyRegex.exec(aiResponse)) !== null) {
                        responses.push({
                            name: m[1].trim(),
                            message: m[2].replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<\/?thinking>/gi, '').trim()
                        });
                    }
                }

                // กรองผลลัพธ์สุดท้ายให้เหลือแค่ตัวละครที่ได้รับอนุญาตให้ตอบเท่านั้นเมี๊ยว🐾
                const allowedResponses = responses.filter(resp =>
                    filteredProfiles.some(p => p.name.toLowerCase() === resp.name.toLowerCase())
                );

                // 10. จัดการ Webhook และส่งข้อความ
                if (!message.client.webhookCache) message.client.webhookCache = new Map();
                let webhook = message.client.webhookCache.get(message.channelId);

                if (!webhook) {
                    const webhooks = await message.channel.fetchWebhooks();
                    webhook = webhooks.find(wh => wh.name === 'PurrPaw-AI');
                    if (!webhook) webhook = await message.channel.createWebhook({ name: 'PurrPaw-AI', reason: 'AI Persona Chat' });
                    message.client.webhookCache.set(message.channelId, webhook);
                }

                for (const resp of allowedResponses) {
                    const charProfile = filteredProfiles.find(c => c.name.toLowerCase() === resp.name.toLowerCase()) || filteredProfiles[0];

                    let finalMsg = resp.message;

                    // ล้างแท็ก <thinking> ออก
                    finalMsg = finalMsg.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
                    finalMsg = finalMsg.replace(/<\/?thinking>/gi, '').trim();

                    // ล้าง Header ที่ AI อาจจะเผลอใส่มา (เช่น [23:40] น๊อต : ...) ออกให้หมดทุกบรรทัดเมี๊ยว🐾
                    finalMsg = finalMsg.replace(/^\[\d{2}:\d{2}\]\s*[^:]+\s*:\s*/gm, '').trim();

                    if (!finalMsg || finalMsg.length === 0) continue;

                    // ล้างแท็ก <image_prompt> หาก AI เผลอใส่มาใน Dialogue เมี๊ยว🐾
                    finalMsg = finalMsg.replace(/<image_prompt>[\s\S]*?<\/image_prompt>/gi, '').trim();

                    // หาก AI เผลอส่งแท็ก [GIF: ...] มา ให้ลบทิ้ง
                    finalMsg = finalMsg.replace(/\[GIF:\s*(.+?)\]/gi, '').trim();

                    const fullMessage = finalMsg;
                    if (!fullMessage) continue;

                    const chunks = [];
                    for (let i = 0; i < fullMessage.length; i += 2000) {
                        chunks.push(fullMessage.substring(i, i + 2000));
                    }

                    for (const chunk of chunks) {
                        await webhook.send({
                            content: chunk,
                            username: charProfile.name,
                            avatarURL: charProfile.image_url || null
                        });
                    }

                    // --- 🎨 ระบบสร้างรูปภาพ (Image Generation) ──
                    if (resp.imagePrompt) {
                        const { generateImageAI } = require('../../utils/aiProvider');
                        
                        // เช็ค Cooldown การสร้างรูป (เช่น 2 นาทีต่อห้อง)
                        if (!message.client.imageCooldowns) message.client.imageCooldowns = new Map();
                        const lastImage = message.client.imageCooldowns.get(message.channelId) || 0;
                        const now = Date.now();
                        
                        if (now - lastImage > 120000) { // 2 นาที
                            message.client.imageCooldowns.set(message.channelId, now);
                            
                            (async () => {
                                let loadingMsg = null;
                                try {
                                    const { AttachmentBuilder } = require('discord.js');
                                    
                                    // 1. ส่งข้อความแจ้งเตือนเบื้องต้นก่อนโดยใช้ Webhook ของตัวละครเมี๊ยว🐾
                                    loadingMsg = await webhook.send({
                                        content: "(กำลังส่งรูป...)",
                                        username: charProfile.name,
                                        avatarURL: charProfile.image_url || null,
                                        wait: true // สำคัญ: ต้องรอเพื่อให้ได้ Message Object มาแก้ไขเมี๊ยว🐾
                                    });

                                    const imageBuffer = await generateImageAI(resp.imagePrompt, charProfile.image_url);
                                    if (imageBuffer) {
                                        const attachment = new AttachmentBuilder(imageBuffer, { name: 'generated-image.png' });
                                        
                                        // 2. เมื่อรูปเสร็จแล้ว แก้ไขข้อความเดิมเป็นรูปภาพแทนเมี๊ยว🐾
                                        await loadingMsg.edit({
                                            content: "", // ล้างข้อความ "(กำลังส่งรูป...)"
                                            files: [attachment]
                                        });
                                    } else {
                                        // กรณีวาดไม่สำเร็จเมี๊ยว🐾
                                        await loadingMsg.edit({ content: "🐾 *งื้อออ วาดรูปไม่สำเร็จเมี๊ยว...*" }).catch(() => {});
                                    }
                                } catch (err) {
                                    console.error('[Image Gen Error]', err);
                                    if (loadingMsg) {
                                        await loadingMsg.edit({ content: "🐾 *เกิดข้อผิดพลาดในการวาดรูปเมี๊ยว...*" }).catch(() => {});
                                    }
                                }
                            })();
                        } else {
                            console.log(`[Image Gen] Skipped due to cooldown for channel ${message.channelId}`);
                        }
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError' || err.message === 'canceled') {
                    console.log('AI processing aborted.');
                } else {
                    console.error('Real AI Error:', err);
                }
            } finally {
                if (typingInterval) clearInterval(typingInterval);
                queueState.isProcessing = false;
                // ถ้ามีข้อความค้างอยู่ให้รันต่อเมี๊ยว🐾
                if (queueState.hasPendingMessages) {
                    queueState.hasPendingMessages = false;
                    queueState.firstMessageTime = Date.now();
                    queueState.timer = setTimeout(() => runAILogic().catch(console.error), 2000);
                } else {
                    message.client.aiChatQueues.delete(message.channelId);
                }
            }
        };

        // 11. เริ่มจับเวลา Debounce
        const now = Date.now();
        const timeSinceFirstMessage = now - queueState.firstMessageTime;

        if (queueState.timer) {
            clearTimeout(queueState.timer);
        }

        if (timeSinceFirstMessage >= 7000) {
            runAILogic().catch(console.error);
        } else {
            // ปรับให้เร็วขึ้นนิดหน่อยเป็น 2 วินาทีเมี๊ยว🐾
            let waitTime = 1000;
            const remainingTo2Sec = 2000 - timeSinceFirstMessage;
            if (remainingTo2Sec > waitTime) {
                waitTime = remainingTo2Sec;
            }

            queueState.timer = setTimeout(() => {
                runAILogic().catch(console.error);
            }, waitTime);
        }

        return; // 🐾เมี๊ยว
    }
};
