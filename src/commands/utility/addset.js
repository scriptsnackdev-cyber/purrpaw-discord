const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addset')
        .setDescription('เพิ่มชุดข้อความ/รูปภาพสำหรับระบบ Daily')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('set_name')
                .setDescription('ชื่อเซต (เช่น morning_cat)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('ข้อความที่จะส่ง')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('หัวข้อ (ถ้ามี)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('ลิงก์รูปภาพ (ถ้ามี)')
                .setRequired(false)),

    async execute(interaction) {
        const setName = interaction.options.getString('set_name');
        const message = interaction.options.getString('message');
        const title = interaction.options.getString('title');
        const imageUrl = interaction.options.getString('image_url');
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const { error } = await supabase
                .from('daily_sets')
                .insert([
                    { 
                        guild_id: guildId, 
                        set_name: setName, 
                        title: title, 
                        message: message, 
                        image_url: imageUrl 
                    }
                ]);

            if (error) throw error;

            const embed = new EmbedBuilder()
                .setTitle('✅ เพิ่มข้อมูลสำเร็จ!')
                .setDescription(`เพิ่มข้อความลงในเซต **${setName}** เรียบร้อยแล้วเมี๊ยว🐾`)
                .setColor('#58f287')
                .addFields(
                    { name: 'ข้อความ', value: message.substring(0, 1024) }
                );

            if (title) embed.addFields({ name: 'หัวข้อ', value: title });
            if (imageUrl) embed.setImage(imageUrl);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('AddSet Error:', error);
            await interaction.editReply({ content: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเมี๊ยว🐾' });
        }
    },
};
