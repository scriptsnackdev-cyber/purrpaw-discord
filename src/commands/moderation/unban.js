const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { unbanUser } = require('../../utils/banManager');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('✨ ปลดแบนสมาชิกและคืนยศเดิมให้เมี๊ยว🐾')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('user')
                .setDescription('เลือกคนที่ต้องการปลดแบน (พิมพ์เพื่อค้นหา)')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        try {
            // ดึงข้อมูลการแบนที่ยังไม่พ้นโทษ
            const { data: bannedUsers } = await supabase
                .from('guild_bans')
                .select('user_id, reason')
                .eq('guild_id', interaction.guildId)
                .eq('is_processed', false)
                .limit(25);

            if (!bannedUsers || bannedUsers.length === 0) {
                return await interaction.respond([]);
            }

            const choices = [];
            for (const ban of bannedUsers) {
                // พยายามหาจาก Cache ก่อนเพื่อความเร็วเมี๊ยว🐾
                let displayName = `ID: ${ban.user_id}`;
                const member = interaction.guild.members.cache.get(ban.user_id);
                
                if (member) {
                    displayName = member.displayName; // 🐾 จะได้ "MyNeko" หรือ Nickname ถ้ามี
                } else {
                    // ถ้าไม่มีใน Cache ลองหาจาก User Cache ทั่วไป
                    const user = interaction.client.users.cache.get(ban.user_id);
                    if (user) displayName = user.displayName;
                }

                if (displayName.toLowerCase().includes(focusedValue)) {
                    choices.push({
                        name: `${displayName} - เหตุผล: ${ban.reason || 'ไม่มี'}`,
                        value: ban.user_id
                    });
                }
            }

            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error('Unban Autocomplete Error:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const userId = interaction.options.getString('user');
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ content: '❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์เมี๊ยว🐾 (เขาอาจจะออกไปแล้ว หรือหาไม่เจอ)', ephemeral: true });
        }

        return await unbanUser(interaction, targetMember);
    }
};



