const { Events, EmbedBuilder } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild } = member;

        // 1. ดึงการตั้งค่าจาก Supabase
        const { data: guildData } = await supabase
            .from('guilds')
            .select('settings')
            .eq('id', guild.id)
            .single();

        // ── จัดการแจก Role อัตโนมัติ (Auto-Role) ──
        try {
            const { data: autoRoleData } = await supabase
                .from('auto_roles')
                .select('role_id')
                .eq('guild_id', guild.id)
                .single();

            if (autoRoleData && autoRoleData.role_id) {
                const role = guild.roles.cache.get(autoRoleData.role_id) || await guild.roles.fetch(autoRoleData.role_id).catch(() => null);
                if (role && role.position < guild.members.me.roles.highest.position) {
                    await member.roles.add(role).catch(err => console.error('AutoRole apply error:', err));
                }
            }
        } catch (e) {
            console.error('AutoRole fetch error:', e.message);
        }

        const welcomeSettings = guildData?.settings?.welcome;

        // เช็คว่าเปิดใช้งานไหม และมีห้องที่ตั้งไว้ไหม
        if (!welcomeSettings || !welcomeSettings.enabled || !welcomeSettings.channel_id) return;

        const channel = guild.channels.cache.get(welcomeSettings.channel_id);
        if (!channel) return;

        // 2. จัดการข้อความ (Replace `${User}` ด้วยการ mention)
        let welcomeMsg = welcomeSettings.message || 'สวัสดีค่าา ยินดีต้อนรับเข้าสู่บ้านของเราคุณ ${User} เมี๊ยวว! 🐾';
        welcomeMsg = welcomeMsg.replace(/\$\{User\}/g, `<@${member.id}>`);

        // 3. จัดการวันที่ (พ.ศ.)
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const yearBE = now.getFullYear() + 543;
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedDate = `${day}/${month}/${yearBE} ${hours}:${minutes}`;

        // 4. สร้าง Embed ตามแบบที่ส่งมา
        const embed = new EmbedBuilder()
            .setColor('#FF69B4') // ชมพูตามรูปตัวอย่าง
            .setTitle(`ʚ♡ɞ ยินดีต้อนรับสู่ ${guild.name}*🐾 ˚ ʚ♡ɞ`)
            .setDescription(welcomeMsg)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '˚₊ʚ สมาชิก', value: `<@${member.id}>`, inline: true },
                { name: '˚₊ʚ ลำดับที่', value: `${guild.memberCount}`, inline: true }
            )
            .setFooter({ text: `เข้าร่วมเมื่อ • ${formattedDate}` });

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    },
};
