const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getTranslateAI } = require('../../utils/aiProvider');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription('🌐 แปลบทสนทนาล่าสุดในห้องนี้เป็นภาษาไทยเมี๊ยว!')
        .addIntegerOption(o => 
            o.setName('limit')
                .setDescription('จำนวนข้อความที่ต้องการแปล (เริ่มต้น 20, สูงสุด 100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)),

    async execute(interaction) {
        const limit = interaction.options.getInteger('limit') || 20;
        // 💡 Defer ถูกจัดการโดย interactionCreate.js แล้วเมี๊ยว🐾

        try {
            // 1. ดึงข้อความล่าสุด
            const messages = await interaction.channel.messages.fetch({ limit });
            
            if (messages.size === 0) {
                return interaction.editReply("ห้องนี้ยังเงียบกริบเลยเมี๊ยววว!");
            }

            // 2. รวมข้อความ
            const chatLog = messages
                .reverse()
                .filter(m => !m.author.bot)
                .map(m => `${m.member?.displayName || m.author.displayName || m.author.username}: ${m.content}`)
                .join('\n');

            if (!chatLog) {
                return interaction.editReply("นอกจากบอทแล้ว ยังไม่มีเพื่อนคนไหนคุยกันเลยเมี๊ยวว!");
            }

            // 3. ส่งให้ AI แปล
            const translateResult = await getTranslateAI(chatLog);

            // 4. เก็บลง Cache (ใช้ระบบเดียวกับ Summary)
            if (!interaction.client.translateCache) interaction.client.translateCache = new Map();
            interaction.client.translateCache.set(interaction.id, {
                content: translateResult,
                limit: limit
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`translate_send:${interaction.id}`).setLabel('ส่งเข้าห้อง (Public)').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`translate_cancel:${interaction.id}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );

            // 5. พรีวิว
            const embed = new EmbedBuilder()
                .setTitle('🌐 พรีวิวผลการแปลภาษาเมี๊ยวว! 🐾')
                .setDescription(translateResult)
                .setColor('#00AAFF')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: `แปลจาก ${limit} ข้อความล่าสุด (พรีวิวเฉพาะคุณ) 🐈✨`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Translate Command Error:', error);
            await interaction.editReply(`งื้อออ เกิดข้อผิดพลาด: ${error.message}`);
        }
    },
};
