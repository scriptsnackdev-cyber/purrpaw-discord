const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getSummaryAI, getRelationSummaryAI } = require('../../utils/aiProvider');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summary').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('📋 สรุปเรื่องราวในห้องนี้เมี๊ยว!')
        .addSubcommand(sub => 
            sub.setName('chat')
                .setDescription('📝 สรุปความเคลื่อนไหวในห้องนี้ (ย้อนหลังสูงสุด 100 ข้อความ)')
                .addIntegerOption(o => 
                    o.setName('limit')
                        .setDescription('จำนวนข้อความที่ต้องการสรุป (เริ่มต้น 20, สูงสุด 100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('relation')
                .setDescription('👥 สรุปความสัมพันธ์ของผู้คนในห้องนี้ (ย้อนหลังสูงสุด 500 ข้อความ)')
                .addUserOption(o =>
                    o.setName('target')
                        .setDescription('เลือกคนที่ต้องการจะโฟกัสความสัมพันธ์ (ถ้าไม่เลือกจะสรุปภาพรวม)')
                        .setRequired(false))
                .addIntegerOption(o =>
                    o.setName('limit')
                        .setDescription('จำนวนข้อความที่ต้องการวิเคราะห์ (เริ่มต้น 100, สูงสุด 500)')
                        .setMinValue(10)
                        .setMaxValue(500)
                        .setRequired(false))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        // 💡 Defer ถูกจัดการโดย interactionCreate.js แล้วเมี๊ยว🐾

        try {
            if (sub === 'chat') {
                const limit = interaction.options.getInteger('limit') || 20;
                
                // 1. ดึงข้อความล่าสุด
                const messages = await interaction.channel.messages.fetch({ limit });
                
                if (messages.size === 0) {
                    return interaction.editReply("ห้องนี้ยังเงียบกริบเลยเมี๊ยววว!");
                }

                // 2. กองรวมข้อความ
                const chatLog = messages
                    .reverse()
                    .filter(m => !m.author.bot)
                    .map(m => `${m.member?.displayName || m.author.displayName || m.author.username}: ${m.content}`)
                    .join('\n');

                if (!chatLog) {
                    return interaction.editReply("นอกจากบอทแล้ว ยังไม่มีเพื่อนคนไหนคุยกันเลยเมี๊ยวว!");
                }

                // 3. ส่งให้ AI สรุป
                const summaryResult = await getSummaryAI(chatLog);

                // 4. เตรียมปุ่มยืนยัน
                if (!interaction.client.summaryCache) interaction.client.summaryCache = new Map();
                interaction.client.summaryCache.set(interaction.id, {
                    content: summaryResult,
                    limit: limit,
                    title: '📋 พรีวิวสรุปเหตุการณ์เมี๊ยวว! 🐾'
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`summary_send:${interaction.id}`).setLabel('ส่งเข้าห้อง (Public)').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId(`summary_cancel:${interaction.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary).setEmoji('❌')
                );

                const embed = new EmbedBuilder()
                    .setTitle('📋 พรีวิวสรุปเหตุการณ์เมี๊ยวว! 🐾')
                    .setDescription(summaryResult)
                    .setColor('#FFB6C1')
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .setFooter({ text: `สรุปจาก ${limit} ข้อความล่าสุด (พรีวิวเฉพาะคุณ) 🐈✨`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], components: [row] });
            }

            if (sub === 'relation') {
                const limit = interaction.options.getInteger('limit') || 100;
                const targetUser = interaction.options.getUser('target');
                
                // 1. ดึงข้อความล่าสุด (ถ้าเยอะอาจต้องวน Loop แต่ 500 ข้อความพอไหวเมี๊ยว🐾)
                let allMessages = [];
                let lastId = null;
                const totalNeeded = limit;
                
                for (let i = 0; i < Math.ceil(totalNeeded / 100); i++) {
                    const options = { limit: Math.min(100, totalNeeded - allMessages.length) };
                    if (lastId) options.before = lastId;
                    const messages = await interaction.channel.messages.fetch(options);
                    if (messages.size === 0) break;
                    allMessages.push(...messages.values());
                    lastId = messages.last().id;
                    if (messages.size < 100) break;
                }

                if (allMessages.length === 0) {
                    return interaction.editReply("ห้องนี้ยังเงียบกริบเลยเmi๊ยววว!");
                }

                // 2. กองรวมข้อความ (เก่าไปใหม่) และเก็บรายชื่อผู้ใช้
                const msgIdToName = {};
                allMessages.forEach(m => {
                    msgIdToName[m.id] = m.member?.displayName || m.author.displayName || m.author.username;
                });

                const messagesWithNames = allMessages
                    .reverse()
                    .map(m => {
                        const replyToName = m.reference?.messageId ? msgIdToName[m.reference.messageId] : null;
                        return {
                            id: m.author.id,
                            name: m.member?.displayName || m.author.displayName || m.author.username,
                            content: m.content || (m.embeds.length > 0 ? "[Embed Content]" : "[No Content]"),
                            isBot: m.author.bot,
                            replyToName: replyToName,
                            timestamp: m.createdAt
                        };
                    });

                const chatLog = messagesWithNames.map(m => {
                    const replyInfo = m.replyToName ? ` [Reply to: ${m.replyToName}]` : "";
                    const timeInfo = `[${m.timestamp.getHours().toString().padStart(2, '0')}:${m.timestamp.getMinutes().toString().padStart(2, '0')}]`;
                    return `${timeInfo} ${m.name}${m.isBot ? ' [BOT]' : ''}${replyInfo}: ${m.content}`;
                }).join('\n');

                if (!chatLog) {
                    return interaction.editReply("ห้องนี้ยังไม่มีความเคลื่อนไหวใดๆ เลยเมี๊ยวว!");
                }

                // 2.5 ค้นหาข้อมูลแนะนำตัวเพื่อช่วย AI วิเคราะห์ได้ลึกซึ้งขึ้นเมี๊ยว🐾
                let finalChatLog = chatLog;
                const userIds = [...new Set(messagesWithNames.map(m => m.id))];
                const idToName = {};
                messagesWithNames.forEach(m => { idToName[m.id] = m.name; });

                const { data: introData } = await supabase
                    .from('user_introductions')
                    .select('*')
                    .eq('guild_id', interaction.guildId)
                    .in('user_id', userIds);

                let introSection = "";
                if (introData && introData.length > 0) {
                    introSection = "[ข้อมูลพื้นฐานของผู้ร่วมสนทนา (จากระบบแนะนำตัว)]:\n";
                    introData.forEach(p => {
                        const name = idToName[p.user_id] || "Unknown User";
                        const intro = p.message_introduction || p.message_bot_introduction || p.message || "ไม่มีข้อมูลแนะนำตัว";
                        introSection += `- ${name}: ${intro.substring(0, 300)}${p.birth_date ? ` (วันเกิด: ${p.birth_date})` : ''}${p.favorite_characters ? ` (ตัวละครที่ชอบ: ${p.favorite_characters})` : ''}\n`;
                    });
                    introSection += "\n";
                }

                if (targetUser) {
                    const targetName = targetUser.displayName || targetUser.username;
                    const participants = [...new Set(messagesWithNames.map(m => m.name))];
                    const otherParticipants = participants.filter(p => p !== targetName);
                    
                    finalChatLog = introSection + 
                        `[รายชื่อผู้คนในแชทที่ต้องวิเคราะห์ความสัมพันธ์กับ ${targetName}]: ${otherParticipants.join(', ') || 'ไม่มีคนอื่น'}\n\n` + 
                        chatLog;
                } else {
                    finalChatLog = introSection + chatLog;
                }

                // 3. ส่งให้ AI วิเคราะห์
                const relationResult = await getRelationSummaryAI(finalChatLog, targetUser ? (targetUser.displayName || targetUser.username) : null);

                // 4. เตรียมปุ่มยืนยัน
                if (!interaction.client.summaryCache) interaction.client.summaryCache = new Map();
                interaction.client.summaryCache.set(interaction.id, {
                    content: relationResult,
                    limit: allMessages.length,
                    title: targetUser ? `👥 พรีวิววิเคราะห์ความสัมพันธ์ของ ${targetUser.displayName || targetUser.username} เมี๊ยวว! 🐾` : '👥 พรีวิววิเคราะห์ความสัมพันธ์เมี๊ยวว! 🐾'
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`summary_send:${interaction.id}`).setLabel('ส่งเข้าห้อง (Public)').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId(`summary_cancel:${interaction.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary).setEmoji('❌')
                );

                const embed = new EmbedBuilder()
                    .setTitle(targetUser ? `👥 พรีวิววิเคราะห์ความสัมพันธ์ของ ${targetUser.displayName || targetUser.username} เมี๊ยวว! 🐾` : '👥 พรีวิววิเคราะห์ความสัมพันธ์เมี๊ยวว! 🐾')
                    .setDescription(relationResult)
                    .setColor('#8B5CF6')
                    .setThumbnail(targetUser ? targetUser.displayAvatarURL() : interaction.client.user.displayAvatarURL())
                    .setFooter({ text: `วิเคราะห์จาก ${allMessages.length} ข้อความล่าสุด (พรีวิวเฉพาะคุณ) 🐈✨`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], components: [row] });
            }

        } catch (error) {
            console.error('Summary Command Error:', error);
            await interaction.editReply(`งื้อออ เกิดข้อผิดพลาด: ${error.message}`);
        }
    },
};
