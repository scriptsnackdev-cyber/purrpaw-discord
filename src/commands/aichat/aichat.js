const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const supabase = require('../../supabaseClient');
const { invalidateCache } = require('../../utils/guildCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichat')
        .setDescription('🤖 จัดการตัวละคร AI และการตั้งค่าแชทเมี๊ยว')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('create')
                .setDescription('✨ สร้างตัวละคร AI ใหม่เมี๊ยว')
                .addStringOption(o => o.setName('name').setDescription('ชื่อของ AI เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('persona').setDescription('นิสัยหรือบทบาทของ AI เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('image_url').setDescription('ลิงก์รูปโปรไฟล์ของ AI เมี๊ยว'))
                .addBooleanOption(o => o.setName('public').setDescription('อนุญาตให้เซิร์ฟเวอร์อื่นใช้ตัวละครนี้ไหมเมี๊ยว?')))
        .addSubcommand(sub => 
            sub.setName('summon')
                .setDescription('🕯️ อัญเชิญ AI มาที่ห้องแชทนี้เมี๊ยว')
                .addStringOption(o => o.setName('name_or_id').setDescription('ชื่อหรือไอดีของ AI เมี๊ยว').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => 
            sub.setName('list').setDescription('📋 ดูรายชื่อ AI ที่กำลังสแตนบายในห้องนี้เมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('my-char').setDescription('🗂️ รายชื่อตัวละคร AI ทั้งหมดที่สร้างในเซิร์ฟเวอร์นี้เมี๊ยว'))
        .addSubcommand(sub => 
            sub.setName('clean')
                .setDescription('🧹 ไล่ AI ทั้งหมดออกไปจากพื้นที่เมี๊ยว')
                .addStringOption(o => 
                    o.setName('target')
                        .setDescription('เลือกพื้นที่ที่จะทำความสะอาดเมี๊ยว')
                        .setRequired(true)
                        .addChoices({ name: '📍 ห้องนี้ (ที่นี่เมี๊ยว)', value: 'here' })))
        .addSubcommand(sub => 
            sub.setName('leave')
                .setDescription('👋 ส่ง AI บางตัวกลับบ้านไปก่อนเมี๊ยว')
                .addStringOption(o => o.setName('name_or_id').setDescription('ชื่อหรือไอดีของ AI เมี๊ยว').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => 
            sub.setName('settings')
                .setDescription('⚙️ ปรับแต่งความจำ/จำนวนข้อความที่ AI จำได้เมี๊ยว')
                .addIntegerOption(o => o.setName('memory').setDescription('จำนวนข้อความล่าสุดที่จะจำ (N ข้อความ)เมี๊ยว').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('set-introduction')
                .setDescription('📚 ตั้งค่าห้องแนะนำตัวให้ AI ไปแอบศึกษาเมี๊ยว')
                .addChannelOption(o => o.setName('channel').setDescription('ห้องแนะนำตัวเมี๊ยว').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('set-introduction-backup')
                .setDescription('📚 ตั้งค่าห้องแนะนำตัวสำรองให้ AI ไปแอบศึกษาเมี๊ยว')
                .addChannelOption(o => o.setName('channel').setDescription('ห้องแนะนำตัวสำรองเมี๊ยว').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('create-private-form')
                .setDescription('📩 สร้างปุ่มกดเปิดห้องคุยส่วนตัวกับ AI เมี๊ยว')
                .addStringOption(o => o.setName('bot_id').setDescription('เลือก AI ที่จะให้ประจำการในห้องนี้เมี๊ยว').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('title').setDescription('หัวข้อของ Embed เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('message').setDescription('เนื้อหาของ Embed เมี๊ยว (ใช้ \\n ขึ้นบรรทัดใหม่ได้เมี๊ยว)').setRequired(true))
                .addStringOption(o => o.setName('button').setDescription('ข้อความบนปุ่มเมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('end_time').setDescription('เวลาหมดอายุของฟอร์ม (รูปแบบ HH:mm เช่น 09:00 หรือ 21:30) เมี๊ยว').setRequired(true))
                .addStringOption(o => o.setName('image_url').setDescription('ลิงก์รูปภาพประกอบ Embed เมี๊ยว')))
        .addSubcommand(sub =>
            sub.setName('private-end')
                .setDescription('🚫 สั่งปิดห้อง Private AI Chat ทั้งหมดในเซิร์ฟเวอร์ทันทีเมี๊ยว (Admin Only)'))
        .addSubcommand(sub =>
            sub.setName('speak')
                .setDescription('🎙️ สั่งให้ AI เจาะจงตัวละครมาตอบทันทีเมี๊ยว🐾')
                .addStringOption(o => o.setName('persona').setDescription('เลือก AI ที่ต้องการให้ตอบเมี๊ยว🐾').setRequired(true).setAutocomplete(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;

        // ⭐ Defer reply เพื่อป้องกัน Timeout เมี๊ยว🐾
        await interaction.deferReply({ flags: 64 });

        // 1. Create Persona
        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const persona = interaction.options.getString('persona');
            const image = interaction.options.getString('image_url');
            const isPublic = interaction.options.getBoolean('public') || false;

            const { data, error } = await supabase.from('ai_characters').insert({
                guild_id: guildId, name, persona, image_url: image, is_public: isPublic
            }).select().single();

            if (error) return interaction.editReply({ content: '❌ ฮืออ สร้างตัวละคร AI ไม่สำเร็จเมี๊ยว...' });
            
            const embed = new EmbedBuilder()
                .setTitle(`✅ สร้าง AI สำเร็จแล้วเมี๊ยว: ${name}`)
                .setDescription(`**ID:** \`${data.id}\`\n**นิสัย:** ${persona}`)
                .setThumbnail(image || null)
                .setColor(0x22C55E);
            
            return interaction.editReply({ embeds: [embed] });
        }

        // 2. Summon to Channel (Multiple AI support)
        if (sub === 'summon') {
            const search = interaction.options.getString('name_or_id');
            const { data: char, error } = await supabase.from('ai_characters')
                .select('*')
                .or(`id.eq.${search},name.ilike.${search}`)
                .eq('guild_id', guildId)
                .single();

            if (error || !char) return interaction.editReply({ content: '❌ หาตัวละคร AI ตัวนั้นไม่เจอเลยเมี๊ยว...' });

            await supabase.from('active_ai_chats').upsert({
                channel_id: channelId,
                guild_id: guildId,
                character_id: char.id
            });

            return interaction.editReply({ content: `✅ **${char.name}** ถูกอัญเชิญมาแล้วเมี๊ยว! 🕯️ พร้อมรับใช้แล้วนะ!` });
        }

        // 3. LIST: List AIs in channel
        if (sub === 'list') {
            const { data: activeList } = await supabase
                .from('active_ai_chats')
                .select('character_id, ai_characters(name, persona)')
                .eq('channel_id', channelId);

            if (!activeList || activeList.length === 0) return interaction.editReply({ content: '❌ ตอนนี้ไม่มี AI ตัวไหนอยู่ในห้องนี้เลยเมี๊ยว' });

            const list = activeList.map(a => `• **${a.ai_characters.name}** (\`${a.character_id}\`)\n  - ${a.ai_characters.persona}`).join('\n\n');
            const embed = new EmbedBuilder().setTitle('🤖 AI ที่กำลังแสตนบายในห้องนี้เมี๊ยว').setDescription(list).setColor(0x3B82F6);
            return interaction.editReply({ embeds: [embed] });
        }

        // 4. MY-CHAR: List all created in server
        if (sub === 'my-char') {
            const { data: allChars } = await supabase.from('ai_characters').select('*').eq('guild_id', guildId);
            if (!allChars || allChars.length === 0) return interaction.editReply({ content: '❌ ยังไม่มีใครสร้างตัวละคร AI ในเซิร์ฟนี้เลยเมี๊ยว...' });

            const list = allChars.map(c => `• **${c.name}** (\`${c.id}\`)\n  - สาธารณะ: ${c.is_public ? '✅' : '❌'}`).join('\n\n');
            const embed = new EmbedBuilder().setTitle('📋 รายชื่อตัวละคร AI ในเซิร์ฟเวอร์เมี๊ยว').setDescription(list).setColor(0x8B5CF6);
            return interaction.editReply({ embeds: [embed] });
        }

        // 5. CLEAN: Bulk remove
        if (sub === 'clean') {
            const target = interaction.options.getString('target');
            if (target === 'here') {
                await supabase.from('active_ai_chats').delete().eq('channel_id', channelId);
                return interaction.editReply({ content: '🧹 ไล่ AI ทุกตัวออกจากห้องนี้เรียบร้อยแล้วเมี๊ยว! สะอาดกริ๊บ!' });
            }
        }

        // 6. LEAVE: Remove specific
        if (sub === 'leave') {
            const search = interaction.options.getString('name_or_id');
            const { data: char } = await supabase.from('ai_characters')
                .select('id')
                .or(`id.eq.${search},name.ilike.${search}`)
                .eq('guild_id', guildId)
                .single();

            if (!char) return interaction.editReply({ content: 'หา AI ตัวนั้นไม่เจอเมี๊ยว...' });

            const { error } = await supabase.from('active_ai_chats').delete().eq('channel_id', channelId).eq('character_id', char.id);
            if (error) return interaction.editReply({ content: 'AI ตัวนี้ไม่ได้อยู่ในห้องนี้อยู่แล้วนะเมี๊ยว' });

            return interaction.editReply({ content: `👋 **${search}** ลากลับบ้านไปพักผ่อนแล้วนะเมี๊ยวว` });
        }

        // 7. Memory Settings
        if (sub === 'settings') {
            const memory = interaction.options.getInteger('memory');
            await supabase.from('active_ai_chats').update({ memory_limit: memory }).eq('channel_id', channelId);
            return interaction.editReply({ content: `✅ ตั้งความจำไว้ที่ **${memory}** ข้อความสำหรับห้องนี้แล้วนะเมี๊ยว!` });
        }

        // 8. Intro Channel Settings
        if (sub === 'set-introduction') {
            const channel = interaction.options.getChannel('channel');
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.ai_chat) settings.ai_chat = {};
            settings.ai_chat.intro_channel_id = channel.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            invalidateCache(guildId);
            return interaction.editReply({ content: `✅ AI จะเริ่มไปแอบอ่านข้อมูลแนะนำตัวจากห้อง ${channel} แล้วนะเมี๊ยวว! 📚` });
        }

        // 8.5. Backup Intro Channel Settings
        if (sub === 'set-introduction-backup') {
            const channel = interaction.options.getChannel('channel');
            let { data: guildData } = await supabase.from('guilds').select('settings').eq('id', guildId).single();
            const settings = guildData?.settings || {};
            
            if (!settings.ai_chat) settings.ai_chat = {};
            settings.ai_chat.intro_backup_channel_id = channel.id;

            await supabase.from('guilds').update({ settings }).eq('id', guildId);
            invalidateCache(guildId);
            return interaction.editReply({ content: `✅ ตั้งค่าห้อง **${channel}** เป็นห้องแนะนำตัวสำรอง (Backup) เรียบร้อยแล้วเมี๊ยวว! 📚` });
        }

        // 9. Create Private AI Chat Form
        if (sub === 'create-private-form') {
            const botId = interaction.options.getString('bot_id');
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const buttonLabel = interaction.options.getString('button');
            const endTimeStr = interaction.options.getString('end_time');
            const imageUrl = interaction.options.getString('image_url');

            // 🕒 คำนวณเวลาหมดอายุเมี๊ยว🐾 (อิงตามเวลาไทย Asia/Bangkok)
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(endTimeStr)) {
                return interaction.editReply({ content: '❌ รูปแบบเวลาไม่ถูกต้องเมี๊ยว! กรุณาใช้รูปแบบ HH:mm (เช่น 09:00)' });
            }

            const [hours, minutes] = endTimeStr.split(':').map(Number);
            
            // ดึงเวลาปัจจุบันในไทยเมี๊ยว🐾
            const nowInThailand = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
            let expiresAt = new Date(nowInThailand);
            expiresAt.setHours(hours, minutes, 0, 0);

            // ถ้าเวลาที่ตั้งไว้อยู่ในอดีต ให้เป็นของวันพรุ่งนี้เมี๊ยว🐾
            if (expiresAt < nowInThailand) {
                expiresAt.setDate(expiresAt.getDate() + 1);
            }

            // เช็คว่า AI มีตัวตนจริงไหม
            const { data: bot } = await supabase.from('ai_characters').select('name').eq('id', botId).single();
            if (!bot) return interaction.editReply({ content: '❌ หาบอท AI ตัวนั้นไม่เจอเมี๊ยว!' });

            const { data: formData, error } = await supabase.from('ai_chat_forms').insert({
                guild_id: guildId,
                bot_id: botId,
                title,
                description: message,
                button_label: buttonLabel,
                expires_at: expiresAt.toISOString(), // จะถูกแปลงเป็น UTC อัตโนมัติเพื่อเก็บใน DB
                image_url: imageUrl
            }).select().single();

            if (error) {
                console.error('Error creating AI form:', error);
                return interaction.editReply({ content: `❌ สร้างฟอร์มไม่สำเร็จเมี๊ยว: \`${error.message}\`` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`ʚ♡ɞ ${title} ₊˚`)
                .setDescription(message.replace(/\\n/g, '\n'))
                .setImage(imageUrl || null)
                .setColor(0x8B5CF6)
                .setFooter({ text: 'กดปุ่มด้านล่างเพื่อเปิดห้องแชทส่วนตัวนะเมี๊ยวว! 🐾' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ai_private_chat:${formData.id}`)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('ai_private_chat_close_all')
                    .setLabel('หมดเวลาการใช้งาน')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏰'),
                new ButtonBuilder()
                    .setCustomId(`ai_private_chat_delete:${formData.id}`)
                    .setLabel('ลบปุ่มนี้')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );

            await interaction.editReply({ content: '✅ สร้างปุ่มเปิดห้องแชท AI เรียบร้อยแล้วเมี๊ยวว!' });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        // 10. Private End: Close all private chats (Admin Only)
        if (sub === 'private-end') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ content: '❌ เฉพาะแอดมินเท่านั้นที่สั่งปิดห้องทั้งหมดได้นะเมี๊ยว!' });
            }

            const { closeAllSessions } = require('../../utils/aiCleanup');
            const deletedCount = await closeAllSessions(interaction.guild);

            return interaction.editReply({ content: `✅ ปิดห้อง Private AI Chat ทั้งหมดเรียบร้อยเมี๊ยว! (ลบไปทั้งหมด **${deletedCount}** ห้อง🐾)` });
        }

        // 11. Speak: Force AI to respond with Approve/Reject workflow
        if (sub === 'speak') {
            const botId = interaction.options.getString('persona');
            const { data: char } = await supabase.from('ai_characters').select('*').eq('id', botId).single();

            if (!char) return interaction.editReply({ content: '❌ หาตัวละคร AI ตัวนั้นไม่เจอเลยเมี๊ยว...' });

            // ดึงประวัติแชทเพื่อสร้าง Context
            const history = await interaction.channel.messages.fetch({ limit: 15 });
            const historyData = Array.from(history.values()).reverse();

            // นำเข้า Logic การสร้าง System Prompt และ Messages (เลียนแบบจาก messageCreate.js)
            const { getChatAI } = require('../../utils/openRouter');
            const { getGuildData } = require('../../utils/guildCache');
            const { settings } = await getGuildData(guildId);

            let usersContextXml = "<users_context>\n";
            const activeUserIds = new Set();
            historyData.forEach(m => { if (!m.author.bot) activeUserIds.add(m.author.id); });

            const userNamesMap = new Map();
            const userIntrosMap = new Map();
            const foundIntroUserIds = new Set();

            const introChId = settings.ai_chat?.intro_channel_id;
            const backupIntroChId = settings.ai_chat?.intro_backup_channel_id;

            for (const uId of activeUserIds) {
                const uObj = interaction.client.users.cache.get(uId);
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
                    const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
                    if (ch && ch.isTextBased()) {
                        const intros = await ch.messages.fetch({ limit: 100 });
                        for (const uId of activeUserIds) {
                            if (foundIntroUserIds.has(uId)) continue;
                            const userIntro = intros.find(m => m.author.id === uId && m.content.length > 5);
                            if (userIntro) {
                                const content = userIntro.content;
                                const nameMatch = content.match(/ชื่อ\s*:\s*([^\n]+)/);
                                if (nameMatch) userNamesMap.set(uId, nameMatch[1].trim());
                                userIntrosMap.set(uId, content);
                                foundIntroUserIds.add(uId);
                            }
                        }
                    }
                } catch (e) { console.error(`Intro scan error:`, e); }
            };

            if (introChId) await fetchIntrosFromChannel(introChId);
            if (backupIntroChId && foundIntroUserIds.size < activeUserIds.size) await fetchIntrosFromChannel(backupIntroChId);

            for (const [uId, introContent] of userIntrosMap.entries()) {
                usersContextXml += `  <user name="${userNamesMap.get(uId)}">${introContent}</user>\n`;
            }
            usersContextXml += "</users_context>";

            let finalPersona = char.persona ? char.persona.replace(/{{char}}/gi, char.name) : "";
            finalPersona = finalPersona.replace(/{{user}}/gi, interaction.user.username);

            const systemPrompt = `<instructions>
You are playing as ${char.name}.
[CORE RULES]
- **IMMERSIVE PORTRAYAL:** มั่นคงในคาแรคเตอร์และอารมณ์ของตัวละครเสมอ
- **XML OUTPUT ONLY:** ตอบกลับภายใต้โครงสร้าง XML ที่กำหนดให้เท่านั้น
- **NO HEADERS:** ห้ามใส่ [HH:mm] หรือ ชื่อตัวละคร : ลงในบทสนทนา

[OUTPUT STRUCTURE]
<turn_responses>
  <persona name="${char.name}">
    <thought>...วิเคราะห์สถานการณ์...</thought>
    <dialogue>...บทสนทนาคำพูดล้วนๆ (จำกัด 50-100 ตัวอักษร)...</dialogue>
  </persona>
</turn_responses>

[MULTI-CHARACTER RULES]
- ตัวละครควรพูดสั้นๆ (50-100 ตัวอักษร) เพื่อความสมจริงเมี๊ยว🐾
</instructions>

<characters>
  <persona name="${char.name}">${finalPersona}</persona>
</characters>

${usersContextXml}`;

            const messagesForAI = [{ role: 'system', content: systemPrompt }];
            historyData.forEach(m => {
                const name = userNamesMap.get(m.author.id) || m.author.username;
                const typeAttr = m.author.bot ? ' type="persona"' : '';
                messagesForAI.push({
                    role: m.author.bot ? 'assistant' : 'user',
                    content: `<msg from="${name}"${typeAttr}>${m.content.replace(/[<>]/g, '')}</msg>`
                });
            });

            // เรียก AI
            const aiResponse = await getChatAI(messagesForAI);
            
            // Parse XML
            const dialogueRegex = /<dialogue>([\s\S]*?)<\/dialogue>/i;
            const dialogueMatch = aiResponse.match(dialogueRegex);
            let finalMsg = dialogueMatch ? dialogueMatch[1].trim() : aiResponse.replace(/<[^>]+>/g, '').trim();

            if (!finalMsg) return interaction.editReply({ content: '❌ AI ไม่ตอบอะไรกลับมาเลยเมี๊ยว...' });

            // เก็บข้อความไว้ใน Cache เพื่อรอการอนุมัติ
            if (!interaction.client.aiSpeakCache) interaction.client.aiSpeakCache = new Map();
            interaction.client.aiSpeakCache.set(interaction.id, {
                content: finalMsg,
                charName: char.name,
                charAvatar: char.image_url
            });

            const embed = new EmbedBuilder()
                .setAuthor({ name: char.name, iconURL: char.image_url || null })
                .setDescription(finalMsg)
                .setColor(0x8B5CF6)
                .setFooter({ text: 'คุณต้องการส่งข้อความนี้ไหมเมี๊ยว? (เห็นแค่คนเดียวนะเมี๊ยว🐾)' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ai_speak_approve:${interaction.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`ai_speak_reject:${interaction.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

            return interaction.editReply({ embeds: [embed], components: [row] });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        const { data: chars } = await supabase
            .from('ai_characters')
            .select('id, name')
            .or(`guild_id.eq.${guildId},is_public.eq.true`)
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        if (!chars) return interaction.respond([]);

        await interaction.respond(
            chars.map(c => ({ name: c.name, value: c.id }))
        );
    }
};
