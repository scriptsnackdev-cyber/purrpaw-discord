const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('ดูรายชื่อคนเกิดในเดือนนี้เมี๊ยว🐾'),
    async execute(interaction) {
        await interaction.deferReply();

        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];

        // ดึงข้อมูลจาก Supabase โดยค้นหาคนที่มีเดือนเกิดตรงกันเมี๊ยว🐾
        // รูปแบบเก็บเป็น DD/MM/YYYY ดังนั้นเราจะหาที่มี /MM/
        const { data: bdays, error } = await supabase
            .from('user_introductions')
            .select('user_id, birth_date, message_introduction, message_bot_introduction, message_birthday')
            .eq('guild_id', interaction.guild.id)
            .like('birth_date', `%/${currentMonth}/%`);

        if (error) {
            console.error('Birthday Command Error:', error);
            return interaction.editReply('งื้อออ เกิดข้อผิดพลาดในการดึงข้อมูลวันเกิดครับเมี๊ยว 😿');
        }

        if (!bdays || bdays.length === 0) {
            return interaction.editReply(`เดือน${monthNames[now.getMonth()]}นี้ ไม่มีใครเกิดเลยครับเมี๊ยว🐾`);
        }

        // เรียงลำดับตามวันที่เกิด
        const sortedBdays = bdays.sort((a, b) => {
            const dayA = parseInt(a.birth_date.split('/')[0]);
            const dayB = parseInt(b.birth_date.split('/')[0]);
            return dayA - dayB;
        });

        const embed = new EmbedBuilder()
            .setTitle(`🎂 รายชื่อคนเกิดเดือน${monthNames[now.getMonth()]}`)
            .setColor('#FFB6C1')
            .setThumbnail(interaction.guild.iconURL())
            .setDescription(`เดือนนี้มีคนเกิดทั้งหมด **${sortedBdays.length}** ท่านครับเมี๊ยว🐾`)
            .setTimestamp();

        let listText = "";
        for (const b of sortedBdays) {
            const member = await interaction.guild.members.fetch(b.user_id).catch(() => null);
            const displayName = member ? member.displayName : `<@${b.user_id}>`;
            const day = b.birth_date.split('/')[0];
            
            // ดึงชื่อเล่นจากข้อความแนะนำตัว (ถ้ามี)
            const content = b.message_bot_introduction || b.message_birthday || b.message_introduction || "";
            const nameMatch = content.match(/ชื่อ\s*[:：]\s*([^\n]+)/);
            const nickName = nameMatch ? ` (${nameMatch[1].trim()})` : "";
            
            // เพิ่มตัวละครที่ชอบเมี๊ยว🐾
            const favText = b.favorite_characters ? `\n   ╰ ตัวละครที่ชอบ: *${b.favorite_characters}*` : "";

            listText += `**วันที่ ${day}**: ${displayName}${nickName}${favText}\n`;
        }

        embed.addFields({ name: '✨ รายชื่อ', value: listText || 'ไม่มีข้อมูล' });

        await interaction.editReply({ embeds: [embed] });
    }
};
