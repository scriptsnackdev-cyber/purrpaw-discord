const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSummaryAI } = require('../../utils/openRouter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summary')
        .setDescription('📋 สรุปความเคลื่อนไหวในห้องนี้ 20 ข้อความล่าสุดเมี๊ยว!'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. ดึงข้อความล่าสุด 20 ข้อความ
            const messages = await interaction.channel.messages.fetch({ limit: 20 });
            
            if (messages.size === 0) {
                return interaction.editReply("ห้องนี้ยังเงียบกริบเลยเมี๊ยววว!");
            }

            // 2. กองรวมข้อความเป็นก้อนเดียว (User: Message)
            const chatLog = messages
                .reverse() // ย้อนกลับให้เรียงจากเก่าไปใหม่
                .filter(m => !m.author.bot) // กรองบอทออก (ถ้าต้องการ)
                .map(m => `${m.author.username}: ${m.content}`)
                .join('\n');

            if (!chatLog) {
                return interaction.editReply("นอกจากบอทแล้ว ยังไม่มีเพื่อนคนไหนคุยกันเลยเมี๊ยวว!");
            }

            // 3. ส่งให้ AI สรุป
            const summaryResult = await getSummaryAI(chatLog);

            // 4. ส่งผลลัพธ์ในรูปแบบ Embed
            const embed = new EmbedBuilder()
                .setTitle('📋 สรุปเหตุการณ์ที่ผ่านมาเมี๊ยวว! 🐾')
                .setDescription(summaryResult)
                .setColor('#FFB6C1')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: 'สรุปจาก 20 ข้อความล่าสุด 🐈✨', iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Summary Command Error:', error);
            await interaction.editReply(`งื้อออ เกิดข้อผิดพลาด: ${error.message}`);
        }
    },
};
