const { Events, EmbedBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const { guild } = member;

        // 1. ดึงการตั้งค่าจาก Supabase
        const { data: guildData } = await supabase
            .from('guilds')
            .select('settings')
            .eq('id', guild.id)
            .single();

        const goodbyeSettings = guildData?.settings?.goodbye;

        // เช็คว่าเปิดใช้งานไหม และมีห้องที่ตั้งไว้ไหม
        if (!goodbyeSettings || !goodbyeSettings.enabled || !goodbyeSettings.channel_id) return;

        const channel = guild.channels.cache.get(goodbyeSettings.channel_id);
        if (!channel) return;

        // 2. จัดการข้อความ (Replace `${User}` ด้วยชื่อ)
        // หมายเหตุ: เนื่องจากออกไปแล้ว การ mention อาจจะไม่สวยในบางครั้ง แต่เพื่อความยืดหยุ่นใช้ชื่อดิสเพลย์แทนได้
        let goodbyeMsg = goodbyeSettings.message || 'ลาก่อนนะคุณ ${User} หวังว่าเราจะได้พบกันใหม่เมี๊ยวว! 🐾';
        goodbyeMsg = goodbyeMsg.replace(/\$\{User\}/g, `**${member.user.displayName}**`);

        // 3. จัดการวันที่ (พ.ศ.)
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const yearBE = now.getFullYear() + 543;
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedDate = `${day}/${month}/${yearBE} ${hours}:${minutes}`;

        // 4. สร้าง Embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2') // สีฟ้าม่วง
            .setTitle(`ʚ♡ɞ ลาก่อนนะเมี๊ยวจาก ${guild.name}*🐾 ˚ ʚ♡ɞ`)
            .setDescription(goodbyeMsg)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '˚₊ʚ สมาชิก', value: `${member.user.tag}`, inline: true },
                { name: '˚₊ʚ ลำดับสมาชิก', value: `${guild.memberCount}`, inline: true }
            )
            .setFooter({ text: `ออกเมื่อ • ${formattedDate}` });

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending goodbye message:', error);
        }
    },
};
