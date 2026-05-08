const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getSummaryAI } = require('../../utils/aiProvider');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summary').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('📋 สรุปความเคลื่อนไหวในห้องนี้เมี๊ยว!')
        .addIntegerOption(o => 
            o.setName('limit')
                .setDescription('จำนวนข้อความที่ต้องการสรุป (เริ่มต้น 20, สูงสุด 100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)),

    async execute(interaction) {
        const limit = interaction.options.getInteger('limit') || 20;
        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. ดึงข้อความล่าสุดตามที่กำหนด
            const messages = await interaction.channel.messages.fetch({ limit });
            
            if (messages.size === 0) {
                return interaction.editReply("ห้องนี้ยังเงียบกริบเลยเมี๊ยววว!");
            }

            // 2. กองรวมข้อความเป็นก้อนเดียว (User: Message)
            const chatLog = messages
                .reverse() // ย้อนกลับให้เรียงจากเก่าไปใหม่
                .filter(m => !m.author.bot) // กรองบอทออก
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
                limit: limit
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`summary_send:${interaction.id}`).setLabel('ส่งเข้าห้อง (Public)').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`summary_cancel:${interaction.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );

            // 5. ส่งผลลัพธ์ในรูปแบบ Embed (พรีวิวคนเดียว)
            const embed = new EmbedBuilder()
                .setTitle('📋 พรีวิวสรุปเหตุการณ์เมี๊ยวว! 🐾')
                .setDescription(summaryResult)
                .setColor('#FFB6C1')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: `สรุปจาก ${limit} ข้อความล่าสุด (พรีวิวเฉพาะคุณ) 🐈✨`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Summary Command Error:', error);
            await interaction.editReply(`งื้อออ เกิดข้อผิดพลาด: ${error.message}`);
        }
    },
};


