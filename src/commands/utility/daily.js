const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('ตั้งเวลาส่งข้อความรายวัน')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('days')
                .setDescription('วันที่ส่ง (เช่น MON,TUE หรือ ALL)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('เวลาที่ส่ง (HH:MM เช่น 08:00)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('set_name')
                .setDescription('ชื่อเซตที่จะใช้')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('ห้องที่ต้องการให้ส่ง')
                .setRequired(true)),

    async execute(interaction) {
        const days = interaction.options.getString('days').toUpperCase();
        const time = interaction.options.getString('time');
        const setName = interaction.options.getString('set_name');
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        // ตรวจสอบรูปแบบเวลาเบื้องต้น
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(time)) {
            return await interaction.editReply({ content: 'รูปแบบเวลาไม่ถูกต้องเมี๊ยว🐾 (ต้องเป็น HH:MM เช่น 08:30)' });
        }

        try {
            // เช็คก่อนว่ามีเซตนี้อยู่จริงไหม
            const { data: setExists } = await supabase
                .from('daily_sets')
                .select('id')
                .eq('guild_id', guildId)
                .eq('set_name', setName)
                .limit(1);

            if (!setExists || setExists.length === 0) {
                return await interaction.editReply({ 
                    content: `ไม่พบเซตชื่อ **${setName}** ในเซิร์ฟเวอร์นี้เมี๊ยว🐾 กรุณาใช้ \`/addset\` เพิ่มข้อมูลก่อน`
                });
            }

            // บันทึกหรืออัปเดต Schedule
            // ในที่นี้เราจะอนุญาตให้ 1 เซิร์ฟเวอร์มีหลาย Daily ได้ตามที่ต้องการ
            const { error } = await supabase
                .from('daily_schedules')
                .insert([
                    {
                        guild_id: guildId,
                        days: days,
                        time: time,
                        set_name: setName,
                        channel_id: channel.id
                    }
                ]);

            if (error) throw error;

            const embed = new EmbedBuilder()
                .setTitle('⏰ ตั้งเวลา Daily สำเร็จ!')
                .setDescription(`บอทจะส่งข้อความจากเซต **${setName}** ทุกวัน **${days}** เวลา **${time}** ที่ห้อง ${channel} เมี๊ยว🐾`)
                .setColor('#0099ff')
                .setFooter({ text: '⚠️ หมายเหตุ: เวลาอาจมีความคลาดเคลื่อนประมาณ +/- 5 นาที' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Daily Command Error:', error);
            await interaction.editReply({ content: 'เกิดข้อผิดพลาดในการตั้งเวลาเมี๊ยว🐾' });
        }
    },
};
