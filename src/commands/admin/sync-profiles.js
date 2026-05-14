const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-profiles')
        .setDescription('Sync profiles from intro and birthday channels (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { syncGuildProfiles } = require('../../utils/profileSyncer');
        const totalSynced = await syncGuildProfiles(interaction.guild);

        await interaction.editReply({ 
            content: `✅ Sync ข้อมูลโปรไฟล์ในเซิร์ฟเวอร์นี้เรียบร้อยแล้วเมี๊ยว! ทั้งหมด **${totalSynced}** รายการ 🐾` 
        });
    }
};
