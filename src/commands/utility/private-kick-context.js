const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const supabase = require('../../supabaseClient');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Kick from My Room')
        .setType(ApplicationCommandType.User),

    async execute(interaction) {
        const targetUser = interaction.targetUser;
        const ownerId = interaction.user.id;

        // 🔍 หาห้องส่วนตัวของเจ้าของ (Interaction User) เมี๊ยว🐾
        const { data: room, error } = await supabase
            .from('private_rooms')
            .select('*')
            .eq('owner_id', ownerId)
            .eq('is_deleted', false)
            .single();

        if (error || !room) {
            return interaction.reply({ content: '❌ คุณยังไม่มีห้องส่วนตัวที่เปิดอยู่ตอนนี้เมี๊ยว!', ephemeral: true });
        }

        const channel = interaction.guild.channels.cache.get(room.channel_id) || await interaction.guild.channels.fetch(room.channel_id).catch(() => null);
        
        if (!channel) {
            return interaction.reply({ content: '❌ หาห้องส่วนตัวของคุณไม่เจอเมี๊ยว!', ephemeral: true });
        }

        if (targetUser.id === ownerId) {
            return interaction.reply({ content: '❌ คุณจะเตะตัวเองทำไมเมี๊ยวว!🐾', ephemeral: true });
        }

        try {
            await channel.permissionOverwrites.delete(targetUser.id);

            return interaction.reply({ 
                content: `✅ นำคุณ <@${targetUser.id}> ออกจากห้องเรียบร้อยแล้วเmi๊ยวว! 💨🐾`,
                ephemeral: true 
            });
        } catch (err) {
            console.error('Context menu kick error:', err);
            return interaction.reply({ content: 'งื้อออ เกิดข้อผิดพลาดในการเตะเพื่อนเมี๊ยว!', ephemeral: true });
        }
    }
};
