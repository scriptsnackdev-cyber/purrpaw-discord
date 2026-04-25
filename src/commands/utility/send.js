const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('ส่งข้อความและรูปภาพในนามของบอท (สำหรับแอดมินเท่านั้นเมี๊ยว🐾)')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('ข้อความที่ต้องการให้บอทส่ง')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('image_url')
                .setDescription('URL ของรูปภาพที่ต้องการให้บอทส่ง (ถ้ามีเมี๊ยว🐾)')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('attachment')
                .setDescription('แนบไฟล์รูปภาพที่ต้องการให้บอทส่ง (ถ้ามีเมี๊ยว🐾)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const message = interaction.options.getString('message');
        const imageUrl = interaction.options.getString('image_url');
        const attachment = interaction.options.getAttachment('attachment');

        try {
            const payload = {
                content: message,
                files: []
            };

            if (imageUrl) {
                if (imageUrl.startsWith('http')) {
                    payload.files.push(imageUrl);
                } else {
                    return interaction.reply({
                        content: '❌ URL ของรูปภาพไม่ถูกต้องนะเมี๊ยว! ต้องเริ่มด้วย http หรือ https',
                        ephemeral: true
                    });
                }
            }

            if (attachment) {
                payload.files.push(attachment);
            }

            if (payload.files.length === 0) {
                delete payload.files;
            }

            // ส่งข้อความไปยัง channel ที่มีการเรียกใช้คำสั่ง
            await interaction.channel.send(payload);

            // ตอบกลับแอดมินแบบส่วนตัว (ephemeral) เพื่อไม่ให้คนอื่นเห็น
            await interaction.reply({
                content: '✅ ส่งข้อความเรียบร้อยแล้วเมี๊ยว! 🐾',
                ephemeral: true
            });

        } catch (error) {
            console.error('Send Command Error:', error);
            await interaction.reply({
                content: `งื้อออ เกิดข้อผิดพลาดในการส่งข้อความ: \`${error.message}\``,
                ephemeral: true
            });
        }
    },
};
